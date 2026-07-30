"""
Gene Silencing API — target analysis + ASO candidate generation.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.gene_silencing_service import (
    get_target_analysis,
    generate_candidates,
    CHEMISTRY_OPTIONS,
    MODIFICATION_OPTIONS,
    LENGTH_RANGE,
)
from services.variant_details_service import get_clinvar_variants
from services.notification_service import add_notification

router = APIRouter()


class CandidateRequest(BaseModel):
    ensembl_gene_id: str
    mechanism_id: str
    target_exon_indices: Optional[list[int]] = None
    aso_length: int = 18
    chemistry: str = "gapmer"
    modifications: list[str] = []
    delivery_context: Optional[str] = None
    defect_type: Optional[str] = None
    silencing_scope: Optional[str] = None


@router.get("/api/gene-silencing/target/{ensembl_gene_id}")
async def target_analysis(ensembl_gene_id: str):
    """Fetch transcript / exon structure for the confirmed gene."""
    result = get_target_analysis(ensembl_gene_id)
    if not result.get("exons"):
        raise HTTPException(status_code=404, detail="No exon data found for this gene.")
    return result


@router.get("/api/gene-silencing/options")
async def design_options():
    """Available chemistry, modification, and length options."""
    return {
        "chemistryOptions": CHEMISTRY_OPTIONS,
        "modificationOptions": MODIFICATION_OPTIONS,
        "lengthRange": LENGTH_RANGE,
    }


@router.post("/api/gene-silencing/generate")
async def generate_aso_candidates(payload: CandidateRequest):
    """Generate ranked candidates using the selected mechanism's design rules."""
    target = get_target_analysis(payload.ensembl_gene_id)
    if not target.get("mrnaSequence"):
        raise HTTPException(status_code=404, detail="Could not fetch mRNA sequence.")

    try:
        candidates = generate_candidates(
            target_exon_indices=payload.target_exon_indices,
            aso_length=payload.aso_length,
            chemistry=payload.chemistry,
            modifications=payload.modifications,
            mrna_sequence=target["mrnaSequence"],
            exons=target.get("exons", []),
            mechanism_id=payload.mechanism_id,
            delivery_context=payload.delivery_context,
            defect_type=payload.defect_type,
            silencing_scope=payload.silencing_scope,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    add_notification(
        "analysis",
        f"Generated {len(candidates)} ASO candidates",
        f"Candidate design completed for {payload.ensembl_gene_id}.",
    )

    return {
        "geneId": payload.ensembl_gene_id,
        "mechanismId": payload.mechanism_id,
        "targetExons": None if payload.mechanism_id == "A2" else payload.target_exon_indices,
        "chemistry": candidates[0]["chemistry"] if candidates else payload.chemistry,
        "modifications": payload.modifications,
        "asoLength": candidates[0]["length"] if candidates else payload.aso_length,
        "totalExons": len(target.get("exons", [])),
        "cdsLength": target.get("cdsLength"),
        "candidates": candidates,
    }


@router.get("/api/gene-silencing/variants/{ensembl_gene_id}")
async def clinvar_variants(ensembl_gene_id: str):
    """Fetch ClinVar pathogenic variants for allele-specific silencing."""
    variants = get_clinvar_variants(ensembl_gene_id)
    return {"geneId": ensembl_gene_id, "variants": variants}
