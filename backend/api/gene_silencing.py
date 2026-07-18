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

router = APIRouter()


class CandidateRequest(BaseModel):
    ensembl_gene_id: str
    target_exon_index: Optional[int] = None
    aso_length: int = 18
    chemistry: str = "gapmer"
    modifications: list[str] = []


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
    """Generate ranked ASO candidates for the selected exon."""
    target = get_target_analysis(payload.ensembl_gene_id)
    if not target.get("mrnaSequence"):
        raise HTTPException(status_code=404, detail="Could not fetch mRNA sequence.")

    candidates = generate_candidates(
        target_exon_index=payload.target_exon_index,
        aso_length=payload.aso_length,
        chemistry=payload.chemistry,
        modifications=payload.modifications,
        mrna_sequence=target["mrnaSequence"],
        exon_count=len(target.get("exons", [])),
    )

    return {
        "geneId": payload.ensembl_gene_id,
        "targetExon": payload.target_exon_index,
        "chemistry": payload.chemistry,
        "modifications": payload.modifications,
        "asoLength": payload.aso_length,
        "totalExons": len(target.get("exons", [])),
        "cdsLength": target.get("cdsLength"),
        "candidates": candidates,
    }
