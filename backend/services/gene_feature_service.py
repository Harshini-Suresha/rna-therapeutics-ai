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
    """Fetch all transcripts for a gene from Ensembl."""
    data = _ensembl_get(f"/overlap/translation/{gene_id}", {"feature": "translation"})
    if isinstance(data, list):
        return data

    data = _ensembl_get(f"/lookup/id/{gene_id}", {"expand": "1"})
    if isinstance(data, dict):
        return data.get("Transcripts", []) or []
    return []


def _get_regulatory_features(region: str) -> list[dict]:
    """Fetch regulatory features (promoters, enhancers) for a genomic region."""
    data = _ensembl_get(f"/overlap/region/human/{region}", {"feature": "regulatory"})
    if isinstance(data, list):
        return data
    return []


def _check_overlapping_nats(gene_id: str, species: str) -> dict:
    """
    Check for overlapping natural antisense transcripts.
    Uses Ensembl overlap API to find antisense lncRNAs.
    """
    result = {
        "hasOverlappingNat": False,
        "natCount": 0,
        "natGenes": [],
    }

    gene_data = _ensembl_get(f"/lookup/id/{gene_id}")
    if not gene_data or not isinstance(gene_data, dict):
        return result

    chrom = gene_data.get("seq_region_name")
    start = gene_data.get("start")
    end = gene_data.get("end")
    strand = gene_data.get("strand")

    if not all([chrom, start, end, strand]):
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


def _estimate_uorf_potential(transcripts: list[dict]) -> dict:
    """
    Estimate whether a gene likely has uORFs based on transcript structure.
    Genes with longer 5' UTRs and multiple transcripts are more likely to
    contain functional uORFs.
    """
    result = {
        "hasUorfPotential": False,
        "longestUtr5": 0,
        "transcriptCount": len(transcripts),
    }

    # Heuristic: genes with >2 transcripts and complex 5' UTRs are more likely
    # to have uORFs. We can't parse actual uORFs without sequence data, but
    # we can flag genes with sufficient transcript complexity.
    if len(transcripts) >= 2:
        result["hasUorfPotential"] = True

    return result


def _check_splicing_complexity(transcripts: list[dict], exon_count: int | None) -> dict:
    """
    Determine whether a gene has sufficient splicing complexity for TANGO.
    - Needs multiple transcripts (evidence of alternative splicing)
    - Needs >1 exon (can't have poison exons in single-exon genes)
    """
    transcript_count = len(transcripts)
    has_alt_splicing = transcript_count > 1
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
        "transcriptCount": transcript_count,
        "hasNmdTranscripts": has_nmd_variants,
        "hasIntrons": has_introns,
        "exonCount": exon_count,
    }


def analyze_gene_features(
    gene_symbol: str,
    organism: str = "homo_sapiens",
    ensembl_id: str | None = None,
    tissue_tpm: float | None = None,
) -> dict:
    """
    Analyze a gene's structural features to determine TG02 mechanism availability.

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

    if not ensembl_id:
        return {
            "features": {
                "saRNA": {"available": True, "reason": "All genes have promoter regions"},
                "uORF": {"available": False, "reason": "Could not verify gene structure"},
                "TANGO": {"available": False, "reason": "Could not verify gene structure"},
                "NAT": {"available": False, "reason": "Could not verify gene structure"},
                "miRNA_block": {"available": True, "reason": "Most mRNAs have 3' UTR miRNA sites"},
                "miRNA_replacement": {"available": True, "reason": "Applicable when a regulatory miRNA is deficient"},
            },
            "warnings": [],
            "geneInfo": {"ensemblId": None, "transcriptCount": 0, "exonCount": None},
        }

    # Fetch transcript data
    transcripts = _get_transcripts(ensembl_id)

    # Get gene metadata for exon count
    gene_data = _ensembl_get(f"/lookup/id/{ensembl_id}")
    exon_count = None
    if isinstance(gene_data, dict):
        exon_count = gene_data.get("Exon")

    # Check structural features
    splicing = _check_splicing_complexity(transcripts, exon_count)
    uorf = _estimate_uorf_potential(transcripts)
    nats = _check_overlapping_nats(ensembl_id, organism)

    # Build feature availability map
    features = {
        "saRNA": {
            "available": True,
            "reason": "All protein-coding genes have promoter regions that can be targeted by saRNA",
        },
        "uORF": {
            "available": uorf["hasUorfPotential"],
            "reason": (
                "Gene has multiple transcripts suggesting complex 5' UTR regulation"
                if uorf["hasUorfPotential"]
                else "Gene has few transcripts; validated uORFs not confirmed (requires experimental evidence)"
            ),
        },
        "TANGO": {
            "available": splicing["hasPoisonExonPotential"],
            "reason": (
                f"Gene has {splicing['transcriptCount']} transcripts with introns — "
                + ("including NMD-associated variants" if splicing["hasNmdTranscripts"] else "alternative splicing may produce poison exons")
                if splicing["hasPoisonExonPotential"]
                else "Single-exon gene or insufficient splicing complexity for poison exon targeting"
            ),
        },
        "NAT": {
            "available": nats["hasOverlappingNat"],
            "reason": (
                f"Found {nats['natCount']} overlapping antisense transcript(s)"
                + (f": {', '.join(g['description'][:60] for g in nats['natGenes'][:3])}" if nats["natGenes"] else "")
                if nats["hasOverlappingNat"]
                else "No overlapping natural antisense transcripts detected in genomic databases"
            ),
        },
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
            "transcriptCount": splicing["transcriptCount"],
            "exonCount": splicing["exonCount"],
            "hasIntrons": splicing["hasIntrons"],
            "hasNmdTranscripts": splicing["hasNmdTranscripts"],
            "overlappingNats": nats["natCount"],
        },
    }
