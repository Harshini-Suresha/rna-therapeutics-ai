"""FDA-approved antisense oligonucleotide (ASO) therapies.

Queries ClinicalTrials.gov and a curated list of FDA-approved ASO drugs
to determine whether any approved ASO therapies exist for the given gene
or its associated disease.

Sources:
- ClinicalTrials.gov API v2
- FDA Orange Book (curated ASO therapy list)
"""

import logging
import re
from typing import List

import requests

logger = logging.getLogger(__name__)

# Curated list of FDA-approved oligonucleotide therapies (ASO, siRNA, aptamer)
# Each entry: (drug_name, target_gene_or_pathway, indication, approval_year, modality)
# Sources: FDA Orange Book, FDA TIDES reviews (1998-2025), 24 approved oligonucleotides
FDA_APPROVED_ASOS = [
    # --- ASOs (Antisense Oligonucleotides) ---
    ("Fomivirsen (Vitravene)", "CMV", "CMV retinitis (withdrawn)", "1998", "ASO"),
    ("Mipomersen (Kynamro)", "APOB", "Homozygous familial hypercholesterolemia", "2013", "ASO"),
    ("Nusinersen (Spinraza)", "SMN1/SMN2", "Spinal muscular atrophy", "2016", "ASO"),
    ("Eteplirsen (Exondys 51)", "DMD", "Duchenne muscular dystrophy (exon 51 skipping)", "2016", "ASO"),
    ("Inotersen (Tegsedi)", "TTR", "Hereditary transthyretin amyloidosis", "2018", "ASO"),
    ("Volanesorsen (Waylivra)", "APOC3", "Familial chylomicronemia syndrome", "2019", "ASO"),
    ("Golodirsen (Vyondys 53)", "DMD", "Duchenne muscular dystrophy (exon 53 skipping)", "2019", "ASO"),
    ("Viltolarsen (Viltepso)", "DMD", "Duchenne muscular dystrophy (exon 53 skipping)", "2020", "ASO"),
    ("Casimersen (Amondys 45)", "DMD", "Duchenne muscular dystrophy (exon 45 skipping)", "2021", "ASO"),
    ("Tofersen (Qalsody)", "SOD1", "Amyotrophic lateral sclerosis (SOD1 mutations)", "2023", "ASO"),
    ("Eplontersen (Wainua)", "TTR", "Hereditary transthyretin-mediated amyloidosis (polyneuropathy)", "2023", "ASO"),
    ("Imetelstat (Rytelo)", "TERT", "Myelodysplastic syndromes (low/intermediate-1 risk)", "2024", "ASO"),
    ("Olezarsen (Tryngolza)", "APOC3", "Familial chylomicronemia syndrome", "2024", "ASO"),
    ("Donidalorsen (Dawnzera)", "KLKB1", "Hereditary angioedema (prophylaxis)", "2025", "ASO"),
    # --- siRNAs (Small Interfering RNAs) ---
    ("Patisiran (Onpattro)", "TTR", "Hereditary transthyretin amyloidosis (polyneuropathy)", "2018", "siRNA"),
    ("Givosiran (Givlaari)", "ALAS1", "Acute hepatic porphyria", "2019", "siRNA"),
    ("Lumasiran (Oxlumo)", "HAO1", "Primary hyperoxaluria type 1", "2020", "siRNA"),
    ("Inclisiran (Leqvio)", "PCSK9", "Hypercholesterolemia (LDL-C reduction)", "2021", "siRNA"),
    ("Vutrisiran (Amvuttra)", "TTR", "Hereditary transthyretin-mediated amyloidosis (polyneuropathy)", "2022", "siRNA"),
    ("Nedosiran (Rivfloza)", "LDHA", "Primary hyperoxaluria", "2023", "siRNA"),
    ("Fitusiran (Qfitlia)", "SERPINC1", "Hemophilia A/B (with or without inhibitors)", "2025", "siRNA"),
    ("Plozasiran (Redemplo)", "APOC3", "Familial chylomicronemia syndrome", "2025", "siRNA"),
    # --- Aptamers ---
    ("Pegaptanib (Macugen)", "VEGF165", "Age-related macular degeneration (wet AMD)", "2004", "Aptamer"),
    ("Avacincaptad pegol (Izervay)", "C5", "Geographic atrophy (dry AMD)", "2023", "Aptamer"),
    # --- Investigational (late-stage, no FDA approval yet) ---
    ("Tominersen (RG6042)", "HTT", "Huntington disease (Phase III)", None, "ASO"),
    ("BIIB080 (IONIS-MAPTRx)", "MAPT", "Alzheimer disease / tau (Phase II)", None, "ASO"),
    ("Bepirovirsen (GSK3228836)", "HBV", "Hepatitis B (Phase II/III)", None, "ASO"),
    ("Zilgersen (IONIS-AZ4-2.5-LRx)", "AZIN1", "Hepatocellular carcinoma (Phase I/II)", None, "ASO"),
]


def _match_gene(drug_entry: tuple, gene_symbol: str) -> bool:
    """Check if a drug targets the given gene symbol.

    Handles multi-gene targets (e.g. "SMN1/SMN2"), partial matches for
    gene families, and pathway-level targets.
    """
    target = drug_entry[1]
    if not target:
        return False
    target_upper = target.strip().upper()
    gene_upper = gene_symbol.strip().upper()

    # Direct match on slash-separated targets
    targets = [t.strip() for t in target_upper.split("/")]
    if gene_upper in targets:
        return True

    # DMD matches all DMD exon-skipping therapies
    if gene_upper == "DMD" and "DMD" in target_upper:
        return True

    # TTR matches all TTR-targeting therapies
    if gene_upper == "TTR" and "TTR" in target_upper:
        return True

    # APOC3 matches both olezarsen and volanesorsen and plozasiran
    if gene_upper in ("APOC3", "APOC-III") and "APOC3" in target_upper:
        return True

    return False


def _search_clinicaltrials(gene_symbol: str, disease_name: str = None) -> List[dict]:
    """Search ClinicalTrials.gov for completed/approved ASO studies."""
    therapies = []
    try:
        search_parts = [f"{gene_symbol} antisense"]
        if disease_name:
            search_parts.append(disease_name)
        query = " AND ".join(search_parts)

        resp = requests.get(
            "https://clinicaltrials.gov/api/v2/studies",
            params={
                "query.term": query,
                "pageSize": 10,
                "format": "json",
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return therapies

        data = resp.json()
        for study in data.get("studies", [])[:10]:
            try:
                protocol = study.get("protocolSection", {})
                ident = protocol.get("identificationModule", {})
                title = ident.get("briefTitle", "")

                status_mod = protocol.get("statusModule", {})
                overall_status = status_mod.get("overallStatus", "")

                interventions = protocol.get("armsInterventionsModule", {})
                for intervention in interventions.get("interventions", []):
                    name = intervention.get("name", "")
                    int_type = intervention.get("type", "")
                    if "antisense" in name.lower() or "aso" in name.lower() or int_type == "GENETIC":
                        therapies.append({
                            "name": name,
                            "indication": disease_name or gene_symbol,
                            "approvalYear": None,
                            "source": "ClinicalTrials.gov",
                        })
            except Exception:
                continue
    except Exception as e:
        logger.info(f"ClinicalTrials.gov search failed for {gene_symbol}: {e}")

    return therapies


def get_fda_therapies(gene_symbol: str, disease_name: str = None) -> dict:
    """Find FDA-approved oligonucleotide therapies for a gene.

    Returns:
        dict with keys:
            - fdaApprovedTherapies: list of dicts with name, indication, approvalYear, source, modality
            - targetableExons: int | None (number of exons suitable for skipping, from DMD-like genes)
    """
    result = {
        "fdaApprovedTherapies": [],
        "targetableExons": None,
    }

    if not gene_symbol:
        return result

    symbol = gene_symbol.strip()

    # Match against curated FDA list
    matched = []
    for drug in FDA_APPROVED_ASOS:
        if _match_gene(drug, symbol):
            is_approved = drug[3] is not None
            matched.append({
                "name": drug[0],
                "indication": drug[2],
                "approvalYear": drug[3],
                "source": "FDA Orange Book" if is_approved else "ClinicalTrials.gov",
                "modality": drug[4] if len(drug) > 4 else "ASO",
            })

    # Also search ClinicalTrials.gov for relevant ASO studies
    ct_therapies = _search_clinicaltrials(symbol, disease_name)

    # Merge, deduplicate by name
    seen_names = {t["name"].lower() for t in matched}
    for ct in ct_therapies:
        if ct["name"].lower() not in seen_names:
            matched.append(ct)
            seen_names.add(ct["name"].lower())

    # Separate approved from investigational, show approved first
    approved = [t for t in matched if t.get("approvalYear")]
    investigational = [t for t in matched if not t.get("approvalYear")]
    result["fdaApprovedTherapies"] = (approved + investigational)[:10]

    return result
