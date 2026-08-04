"""
Gene structural feature analysis for TG02 mechanism filtering.

Queries Ensembl to determine whether a gene has the structural prerequisites
for each upregulation mechanism:
- A3 (TANGO): needs poison exons / non-productive splice variants
- A4 (NAT): needs overlapping natural antisense transcripts
- A5 (uORF): needs upstream open reading frames in 5' UTR
- A6 (miRNA site block): needs 3' UTR with miRNA binding sites (always available)
- A22 (miRNA replacement): always available (deficient miRNA)
- A23 (promoter activation): always available (all genes have promoters)
"""

from __future__ import annotations

import logging
import re
from typing import Optional

import requests

ENSEMBL_REST = "https://rest.ensembl.org"
ENSEMBL_TIMEOUT = 10

logger = logging.getLogger(__name__)

# Species name mapping for Ensembl
_SPECIES_MAP = {
    "homo_sapiens": "human",
    "mus_musculus": "mouse",
    "rattus_norvegicus": "rat",
    "danio_rerio": "zebrafish",
    "drosophila_melanogaster": "fruitfly",
    "caenorhabditis_elegans": "celegans",
    "saccharomyces_cerevisiae": "yeast",
    "bos_taurus": "cow",
    "sus_scrofa": "pig",
    "gallus_gallus": "chicken",
    "canis_lupus_familiaris": "dog",
    "felis_catus": "cat",
}


def _ensembl_get(path: str, params: dict | None = None) -> dict | list | None:
    """GET from Ensembl REST API with timeout."""
    try:
        resp = requests.get(
            f"{ENSEMBL_REST}{path}",
            params=params or {},
            headers={"Content-Type": "application/json"},
            timeout=ENSEMBL_TIMEOUT,
        )
        if resp.status_code == 200:
            return resp.json()
    except (requests.RequestException, ValueError) as e:
        logger.warning("Ensembl GET %s failed: %s", path, e)
    return None


def _get_transcripts(gene_id: str) -> list[dict]:
    """Fetch all transcripts for a gene from Ensembl.

    Uses the expand=1 gene lookup, which returns the transcript list under
    the (singular) "Transcript" key — each transcript carries its own
    "Exon" array. The /overlap/translation endpoint only accepts
    translation IDs (ENSP...), not gene IDs, so it cannot be used here.
    """
    data = _ensembl_get(f"/lookup/id/{gene_id}", {"expand": "1"})
    if isinstance(data, dict):
        return data.get("Transcript", []) or []
    return []


def _get_regulatory_features(region: str) -> list[dict]:
    """Fetch regulatory features (promoters, enhancers) for a genomic region."""
    data = _ensembl_get(f"/overlap/region/human/{region}", {"feature": "regulatory"})
    if isinstance(data, list):
        return data
    return []


def _check_overlapping_nats(
    gene_id: str, species: str, gene_data: dict | None = None
) -> dict:
    """
    Check for overlapping natural antisense transcripts.
    Uses Ensembl overlap API to find antisense lncRNAs.

    hasOverlappingNat is None when the gene cannot be resolved (unknown
    symbol, missing coordinates, or Ensembl unavailable) — callers treat
    that as "unverified" rather than a definitive negative, so NAT
    silencing stays available for genes that can't be checked.
    """
    result = {
        "hasOverlappingNat": False,
        "natCount": 0,
        "natGenes": [],
    }

    if not gene_id:
        result["hasOverlappingNat"] = None
        return result

    if gene_data is None:
        gene_data = _ensembl_get(f"/lookup/id/{gene_id}")
    if not gene_data or not isinstance(gene_data, dict):
        result["hasOverlappingNat"] = None
        return result

    chrom = gene_data.get("seq_region_name")
    start = gene_data.get("start")
    end = gene_data.get("end")
    strand = gene_data.get("strand")

    if not all([chrom, start, end, strand]):
        result["hasOverlappingNat"] = None
        return result

    # Query overlapping features in the region
    region = f"{chrom}:{start - 50000}-{end + 50000}"
    species_name = _SPECIES_MAP.get(species, "human")

    overlap_data = _ensembl_get(
        f"/overlap/region/{species_name}/{region}",
        {"feature": "gene", "content_type": "application/json"},
    )

    if not isinstance(overlap_data, list):
        return result

    for feature in overlap_data:
        feature_type = feature.get("feature_type", "")
        feat_strand = feature.get("strand")
        feat_id = feature.get("id", "")
        feat_desc = feature.get("description", "")

        # Detect antisense: same region, opposite strand, lncRNA biotype
        if feat_strand and feat_strand != strand:
            biotype = (feature.get("biotype") or "").lower()
            if "antisense" in biotype or "lncrna" in biotype or "ncrna" in biotype:
                result["hasOverlappingNat"] = True
                result["natCount"] += 1
                result["natGenes"].append({
                    "id": feat_id,
                    "description": feat_desc or feat_id,
                })

    return result


def _estimate_uorf_potential(
    transcripts: list[dict], total_transcripts: int | None = None
) -> dict:
    """
    Estimate whether a gene likely has uORFs based on transcript structure.
    Genes with longer 5' UTRs and multiple transcripts are more likely to
    contain functional uORFs.

    total_transcripts may come from the main gene pipeline (which already
    queried Ensembl) when the live transcript fetch here comes up empty.
    """
    if total_transcripts is None:
        total_transcripts = len(transcripts)

    result = {
        "hasUorfPotential": False,
        "longestUtr5": 0,
        "transcriptCount": total_transcripts,
    }

    # Heuristic: genes with >1 transcript and complex 5' UTRs are more likely
    # to have uORFs. We can't parse actual uORFs without sequence data, but
    # we can flag genes with sufficient transcript complexity.
    if total_transcripts >= 2:
        result["hasUorfPotential"] = True

    return result


def _max_exon_count(transcripts: list[dict]) -> int | None:
    """Largest exon count across a gene's transcripts (from expand=1 lookup)."""
    counts = [
        len(t.get("Exon") or [])
        for t in transcripts
        if isinstance(t, dict) and t.get("Exon")
    ]
    return max(counts) if counts else None


def _check_splicing_complexity(
    transcripts: list[dict],
    exon_count: int | None = None,
    total_transcripts: int | None = None,
) -> dict:
    """
    Determine whether a gene has sufficient splicing complexity for TANGO.
    - Needs multiple transcripts (evidence of alternative splicing)
    - Needs >1 exon (can't have poison exons in single-exon genes)

    exon_count / total_transcripts fall back to pipeline-computed values
    when the live transcript fetch here is empty.
    """
    if total_transcripts is None:
        total_transcripts = len(transcripts)
    if exon_count is None:
        exon_count = _max_exon_count(transcripts)

    has_alt_splicing = total_transcripts > 1
    has_introns = (exon_count or 0) > 1

    # Look for transcripts with "retained_intron" or "nonsense_mediated_decay" biotype
    has_nmd_variants = False
    for t in transcripts:
        biotype = (t.get("biotype") or "").lower()
        if "nonsense" in biotype or "nmd" in biotype or "retained_intron" in biotype:
            has_nmd_variants = True
            break

    return {
        "hasPoisonExonPotential": has_alt_splicing and has_introns,
        "transcriptCount": total_transcripts,
        "hasNmdTranscripts": has_nmd_variants,
        "hasIntrons": has_introns,
        "exonCount": exon_count,
    }


def analyze_gene_features(
    gene_symbol: str,
    organism: str = "homo_sapiens",
    ensembl_id: str | None = None,
    tissue_tpm: float | None = None,
    exon_count: int | None = None,
    total_transcripts: int | None = None,
    gene_type: str | None = None,
) -> dict:
    """
    Analyze a gene's structural features to determine TG02 mechanism availability.

    Designed to work for every gene:
      - Structural hints already computed by the main gene pipeline
        (exon_count / total_transcripts) are used first; Ensembl is only
        queried to fill in the gaps.
      - If the gene cannot be resolved or verified (unknown symbol,
        non-Ensembl species, or Ensembl unavailable), structure-dependent
        mechanisms are NOT hard-excluded. They are reported as available
        with an honest "could not verify" note, so the TG02 ranking still
        returns candidates for all genes instead of silently dropping them.

    Returns a dict with:
    - features: per-mechanism availability flags
    - warnings: tissue expression / toxicity warnings
    - geneInfo: basic gene metadata used for the analysis
    """
    # Resolve Ensembl ID if not provided
    if not ensembl_id:
        lookup = _ensembl_get(
            f"/lookup/symbol/{organism}/{gene_symbol}",
            {"expand": "0"},
        )
        if isinstance(lookup, dict) and lookup.get("id"):
            ensembl_id = lookup["id"]

    transcripts = _get_transcripts(ensembl_id) if ensembl_id else []
    gene_data = _ensembl_get(f"/lookup/id/{ensembl_id}") if ensembl_id else None

    # Prefer pipeline-computed structural hints; fill gaps from Ensembl.
    if exon_count is None:
        exon_count = _max_exon_count(transcripts)
    if total_transcripts is None:
        total_transcripts = len(transcripts)

    # We can make a real structural determination when we have transcript
    # evidence or the pipeline's structural counts.
    can_verify_structure = bool(transcripts) or exon_count is not None or (total_transcripts or 0) > 0
    gene_verified = bool(gene_data) or bool(transcripts)

    if can_verify_structure:
        splicing = _check_splicing_complexity(transcripts, exon_count, total_transcripts)
        uorf = _estimate_uorf_potential(transcripts, total_transcripts)
    else:
        splicing = {
            "hasPoisonExonPotential": None,
            "transcriptCount": 0,
            "hasNmdTranscripts": False,
            "hasIntrons": None,
            "exonCount": None,
        }
        uorf = {
            "hasUorfPotential": None,
            "longestUtr5": 0,
            "transcriptCount": 0,
        }

    nats = _check_overlapping_nats(ensembl_id, organism, gene_data)

    unverified_reason = (
        "Could not verify gene structure from Ensembl — treated as potentially "
        "applicable for this gene; requires experimental validation."
    )

    # Build feature availability map. A tri-state value (True/False/None) keeps
    # "verified absent" distinct from "could not verify".
    features = {
        "saRNA": {
            "available": True,
            "reason": "All protein-coding genes have promoter regions that can be targeted by saRNA",
        },
        "uORF": _feature_entry(
            uorf["hasUorfPotential"],
            "Gene has multiple transcripts suggesting complex 5' UTR regulation",
            "Gene has few transcripts; validated uORFs not confirmed (requires experimental evidence)",
            unverified_reason,
        ),
        "TANGO": _feature_entry(
            splicing["hasPoisonExonPotential"],
            (
                f"Gene has {splicing['transcriptCount']} transcripts with introns — "
                + (
                    "including NMD-associated variants"
                    if splicing["hasNmdTranscripts"]
                    else "alternative splicing may produce poison exons"
                )
            ),
            "Single-exon gene or insufficient splicing complexity for poison exon targeting",
            unverified_reason,
        ),
        "NAT": _feature_entry(
            nats["hasOverlappingNat"],
            (
                f"Found {nats['natCount']} overlapping antisense transcript(s)"
                + (
                    f": {', '.join(g['description'][:60] for g in nats['natGenes'][:3])}"
                    if nats["natGenes"]
                    else ""
                )
            ),
            "No overlapping natural antisense transcripts detected in genomic databases",
            "Could not verify overlapping antisense transcripts from Ensembl — NAT silencing treated as potentially applicable; requires experimental validation",
        ),
        "miRNA_block": {
            "available": True,
            "reason": "Most protein-coding mRNAs contain miRNA binding sites in their 3' UTR",
        },
        "miRNA_replacement": {
            "available": True,
            "reason": "Applicable when a regulatory miRNA is deficient or downregulated",
        },
    }

    # Tissue expression warnings
    warnings = []
    if tissue_tpm is not None:
        if tissue_tpm > 500:
            warnings.append({
                "type": "overexpression_risk",
                "severity": "high",
                "message": (
                    f"High endogenous expression ({tissue_tpm:.0f} TPM) in target tissue — "
                    "exercise caution against overexpression toxicity. "
                    "Consider whether upregulation is appropriate for this tissue."
                ),
            })
        elif tissue_tpm > 200:
            warnings.append({
                "type": "overexpression_caution",
                "severity": "medium",
                "message": (
                    f"Moderate-high endogenous expression ({tissue_tpm:.0f} TPM) in target tissue — "
                    "monitor for potential overexpression effects."
                ),
            })

    return {
        "features": features,
        "warnings": warnings,
        "geneInfo": {
            "ensemblId": ensembl_id,
            "transcriptCount": total_transcripts or 0,
            "exonCount": splicing["exonCount"],
            "hasIntrons": splicing["hasIntrons"],
            "hasNmdTranscripts": splicing["hasNmdTranscripts"],
            "overlappingNats": nats["natCount"] or 0,
            "verified": gene_verified,
            "geneType": gene_type,
        },
    }


def _feature_entry(
    available: bool | None,
    reason_yes: str,
    reason_no: str,
    reason_unknown: str,
) -> dict:
    """Map a tri-state availability value to a feature dict.

    None means the structural check could not be run — treat the mechanism
    as available (so it is not silently dropped from the ranking) with an
    honest note rather than a definitive negative.
    """
    if available is None:
        return {"available": True, "reason": reason_unknown}
    if available:
        return {"available": True, "reason": reason_yes}
    return {"available": False, "reason": reason_no}
