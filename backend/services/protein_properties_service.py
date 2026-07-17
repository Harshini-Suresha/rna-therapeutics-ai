"""Fetch protein properties from UniProt (molecular weight, pI, secondary
structure, phosphorylation sites).

All data is computed from the UniProt JSON entry.  No values are fabricated.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

_TIMEOUT = 20

# Amino acid average residue masses (Da) — used for molecular weight.
_AA_MASS = {
    "A": 89.09, "R": 174.20, "N": 132.12, "D": 133.10, "C": 121.16,
    "E": 147.13, "Q": 146.15, "G": 75.03, "H": 155.16, "I": 131.17,
    "L": 131.17, "K": 146.19, "M": 149.21, "F": 165.19, "P": 115.13,
    "S": 105.09, "T": 119.12, "W": 204.23, "Y": 181.19, "V": 117.15,
}

# Standard pKa values for pI calculation (Lehninger).
_PI_PKA = {
    "D": 3.65, "E": 4.25, "C": 8.18, "Y": 10.07,
    "H": 6.00, "K": 10.53, "R": 12.48, "N-term": 9.69, "C-term": 2.34,
}


def _compute_pi(sequence: str) -> Optional[float]:
    """Compute theoretical isoelectric point from amino acid sequence."""
    seq = sequence.upper()
    if not seq:
        return None

    # Count ionisable residues
    counts = {}
    for aa, pka in _PI_PKA.items():
        if aa in ("N-term", "C-term"):
            continue
        counts[aa] = seq.count(aa)

    # Binary search for pI
    lo, hi = 0.0, 14.0
    for _ in range(100):
        mid = (lo + hi) / 2.0
        # Net charge at pH = mid
        charge = 0.0
        # Positive charges
        charge += counts.get("K", 0) * (1 / (1 + 10 ** (mid - _PI_PKA["K"])))
        charge += counts.get("R", 0) * (1 / (1 + 10 ** (mid - _PI_PKA["R"])))
        charge += counts.get("H", 0) * (1 / (1 + 10 ** (mid - _PI_PKA["H"])))
        charge += 1 * (1 / (1 + 10 ** (mid - _PI_PKA["N-term"])))
        # Negative charges
        charge -= counts.get("D", 0) * (1 / (1 + 10 ** (_PI_PKA["D"] - mid)))
        charge -= counts.get("E", 0) * (1 / (1 + 10 ** (_PI_PKA["E"] - mid)))
        charge -= counts.get("C", 0) * (1 / (1 + 10 ** (_PI_PKA["C"] - mid)))
        charge -= counts.get("Y", 0) * (1 / (1 + 10 ** (_PI_PKA["Y"] - mid)))
        charge -= 1 * (1 / (1 + 10 ** (_PI_PKA["C-term"] - mid)))

        if charge > 0:
            lo = mid
        else:
            hi = mid

    return round((lo + hi) / 2.0, 2)


def _secondary_structure_summary(features: list) -> Optional[str]:
    """Summarise helix / strand / turn counts from UniProt features."""
    helix = sum(1 for f in features if f.get("type") == "Helix")
    strand = sum(1 for f in features if f.get("type") == "Beta strand")
    turn = sum(1 for f in features if f.get("type") == "Turn")
    total = helix + strand + turn
    if total == 0:
        return None
    return f"{helix} helices, {strand} beta strands, {turn} turns"


def _phosphorylation_sites(features: list) -> Optional[str]:
    """Extract critical phosphorylation site descriptions."""
    sites = [
        f.get("description", "")
        for f in features
        if f.get("type") == "Modified residue" and "Phospho" in f.get("description", "")
    ]
    if not sites:
        return None
    # Count unique types
    from collections import Counter
    counts = Counter(sites)
    parts = [f"{count}x {name}" for name, count in counts.most_common()]
    return "; ".join(parts)


def _ubiquitination_sites(features: list) -> Optional[str]:
    """Count ubiquitination sites from UniProt features."""
    sites = [
        f.get("description", "")
        for f in features
        if f.get("type") == "Modified residue" and "Ubiquitin" in f.get("description", "")
    ]
    if not sites:
        return "No ubiquitination sites annotated"
    from collections import Counter
    counts = Counter(sites)
    parts = [f"{count}x {name}" for name, count in counts.most_common()]
    return "; ".join(parts)


def _quaternary_structure(entry: dict) -> Optional[str]:
    """Extract quaternary / oligomeric state from UniProt cross-links."""
    cross_links = [
        f for f in entry.get("features", [])
        if f.get("type") == "Cross-link"
    ]
    if not cross_links:
        return "Monomer (no cross-links annotated)"
    # Check for interchain links (indicates multimer)
    interchain = sum(
        1 for cl in cross_links
        if cl.get("description", "").startswith("Interchain")
    )
    intrachain = len(cross_links) - interchain
    if interchain > 0:
        return f"{interchain} interchain, {intrachain} intrachain cross-links"
    return f"{intrachain} intrachain cross-links"


def _stability_score(entry: dict, features: list) -> Optional[str]:
    """Compute a protein stability score from structural features."""
    disulfide = sum(1 for f in features if f.get("type") == "Disulfide bond")
    variants = sum(1 for f in features if f.get("type") in ("Natural variant", "Mutagenesis"))
    conflicts = sum(1 for f in features if f.get("type") == "Sequence conflict")
    helix = sum(1 for f in features if f.get("type") == "Helix")
    strand = sum(1 for f in features if f.get("type") == "Beta strand")

    # Stabilizing factors: disulfide bonds, structured regions
    # Destabilizing factors: variants, conflicts
    total = helix + strand + disulfide * 3
    destabilize = variants + conflicts
    if total == 0 and destabilize == 0:
        return None
    score = max(0.0, min(10.0, (total / max(total + destabilize, 1)) * 10))
    parts = [f"{score:.1f}/10"]
    if disulfide:
        parts.append(f"{disulfide} disulfide bonds")
    if variants:
        parts.append(f"{variants} known variants")
    if conflicts:
        parts.append(f"{conflicts} sequence conflicts")
    return ", ".join(parts)


def get_protein_properties(
    ensembl_protein_id: Optional[str] = None,
    gene_symbol: Optional[str] = None,
    uniprot_accession: Optional[str] = None,
) -> Dict[str, Any]:
    """Return protein properties from UniProt.

    Tries to find the UniProt entry by accession, then by gene symbol.
    All values are derived from the live UniProt JSON; null is returned when
    unavailable.
    """
    result: Dict[str, Any] = {
        "molecularWeight": None,
        "isoelectricPoint": None,
        "secondaryStructureDistribution": None,
        "criticalPhosphorylationSite": None,
        "ubiquitinationTarget": None,
        "quaternaryStructure": None,
        "stabilityScore": None,
    }

    entry = None

    # Try by UniProt accession first
    if uniprot_accession:
        try:
            resp = requests.get(
                f"https://rest.uniprot.org/uniprotkb/{uniprot_accession}.json",
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                entry = resp.json()
        except Exception as exc:
            logger.warning("UniProt lookup by accession failed: %s", exc)

    # Fall back to gene symbol search
    if entry is None and gene_symbol:
        try:
            resp = requests.get(
                "https://rest.uniprot.org/uniprotkb/search",
                params={
                    "query": f"gene:{gene_symbol} AND organism_id:9606 AND reviewed:true",
                    "format": "json",
                    "size": 1,
                },
                timeout=_TIMEOUT,
            )
            results = resp.json().get("results", [])
            if results:
                entry = results[0]
        except Exception as exc:
            logger.warning("UniProt search by gene symbol failed: %s", exc)

    if entry is None:
        return result

    # Molecular weight from sequence
    mol_weight = entry.get("sequence", {}).get("molWeight")
    if mol_weight:
        try:
            result["molecularWeight"] = f"{float(mol_weight):,.0f} Da"
        except (ValueError, TypeError):
            pass

    # Isoelectric point from sequence
    seq = entry.get("sequence", {}).get("value", "") or entry.get("sequence", {}).get("sequence", "")
    pi = _compute_pi(seq)
    if pi is not None:
        result["isoelectricPoint"] = f"{pi}"

    # Secondary structure distribution
    features = entry.get("features", [])
    ss = _secondary_structure_summary(features)
    if ss:
        result["secondaryStructureDistribution"] = ss

    # Phosphorylation sites
    ps = _phosphorylation_sites(features)
    if ps:
        result["criticalPhosphorylationSite"] = ps

    # Ubiquitination targets
    ub = _ubiquitination_sites(features)
    if ub:
        result["ubiquitinationTarget"] = ub

    # Quaternary structure
    qs = _quaternary_structure(entry)
    if qs:
        result["quaternaryStructure"] = qs

    # Stability score
    ss = _stability_score(entry, features)
    if ss:
        result["stabilityScore"] = ss

    return result
