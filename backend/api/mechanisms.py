"""
Mechanism selection endpoints. Kept separate from main.py's gene retrieval
pipeline since this is a distinct concern (Rulebook Engine, not the
Biological Information Retrieval Engine).

Supports multiple therapeutic goals:
- TG01: Gene Silencing (A1, A2, A12, A15, A21)
- TG02: Gene Activation / Upregulation (A3, A4, A5, A6, A22, A23)
- TG04: RNA Processing Modulation (A7, A8, A9, A10, A11)
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from services.mechanism_service import (
    rank_gene_silencing_mechanisms,
    rank_gene_upregulation_mechanisms,
    rank_rna_processing_mechanisms,
    DEFECT_TYPES,
    SILENCING_SCOPES,
    GENE_UPREGULATION_DEFECT_TYPES,
    DELIVERY_CONTEXTS,
    SPLICE_DEFECT_TYPES,
)
from services.gene_feature_service import analyze_gene_features

router = APIRouter()


class GeneSilencingRequest(BaseModel):
    gene_symbol: str
    defect_type: str
    silencing_scope: str
    delivery_context: Optional[str] = None
    known_variant: Optional[str] = None


class GeneUpregulationRequest(BaseModel):
    gene_symbol: str
    defect_type: str
    delivery_context: Optional[str] = None
    known_regulatory_element: Optional[str] = None
    gene_features: Optional[dict] = None


class RnaProcessingRequest(BaseModel):
    gene_symbol: str
    splice_defect_type: str
    target_exon: Optional[str] = None
    delivery_context: Optional[str] = None
    known_variant: Optional[str] = None


@router.get("/api/mechanisms/options")
async def mechanism_options():
    """Input options for all mechanism selection forms."""
    return {
        "geneSilencing": {
            "defectTypes": [{"id": k, "label": v} for k, v in DEFECT_TYPES.items()],
            "silencingScopes": [{"id": k, "label": v} for k, v in SILENCING_SCOPES.items()],
        },
        "geneUpregulation": {
            "defectTypes": [{"id": k, "label": v} for k, v in GENE_UPREGULATION_DEFECT_TYPES.items()],
        },
        "rnaProcessing": {
            "spliceDefectTypes": [{"id": k, "label": v} for k, v in SPLICE_DEFECT_TYPES.items()],
        },
        "deliveryContexts": [{"id": k, "label": v} for k, v in DELIVERY_CONTEXTS.items()],
    }


@router.post("/api/mechanisms/gene-silencing")
async def gene_silencing_mechanisms(payload: GeneSilencingRequest):
    if payload.defect_type not in DEFECT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown defect_type: {payload.defect_type}")
    if payload.silencing_scope not in SILENCING_SCOPES:
        raise HTTPException(status_code=400, detail=f"Unknown silencing_scope: {payload.silencing_scope}")

    results = rank_gene_silencing_mechanisms(
        defect_type=payload.defect_type,
        silencing_scope=payload.silencing_scope,
        delivery_context=payload.delivery_context,
        known_variant=payload.known_variant,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "Gene Silencing",
        "inputs": {
            "defectType": payload.defect_type,
            "silencingScope": payload.silencing_scope,
            "deliveryContext": payload.delivery_context,
            "knownVariant": payload.known_variant,
        },
        "results": results,
    }


@router.post("/api/mechanisms/gene-upregulation")
async def gene_upregulation_mechanisms(payload: GeneUpregulationRequest):
    if payload.defect_type not in GENE_UPREGULATION_DEFECT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unknown defect_type: {payload.defect_type}")

    results = rank_gene_upregulation_mechanisms(
        defect_type=payload.defect_type,
        delivery_context=payload.delivery_context,
        known_regulatory_element=payload.known_regulatory_element,
        gene_features=payload.gene_features,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "Gene Activation / Upregulation",
        "inputs": {
            "defectType": payload.defect_type,
            "deliveryContext": payload.delivery_context,
            "knownRegulatoryElement": payload.known_regulatory_element,
        },
        "results": results,
    }


@router.post("/api/mechanisms/rna-processing")
async def rna_processing_mechanisms(payload: RnaProcessingRequest):
    if payload.splice_defect_type not in SPLICE_DEFECT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown splice_defect_type: {payload.splice_defect_type}",
        )

    results = rank_rna_processing_mechanisms(
        splice_defect_type=payload.splice_defect_type,
        target_exon=payload.target_exon,
        delivery_context=payload.delivery_context,
        known_variant=payload.known_variant,
    )

    return {
        "geneSymbol": payload.gene_symbol.strip().upper(),
        "therapeuticGoal": "RNA Processing Modulation",
        "inputs": {
            "spliceDefectType": payload.splice_defect_type,
            "targetExon": payload.target_exon,
            "deliveryContext": payload.delivery_context,
            "knownVariant": payload.known_variant,
        },
        "results": results,
    }


@router.get("/api/mechanisms/gene-features")
async def gene_features(
    gene_symbol: str = Query(..., description="Gene symbol to analyze"),
    organism: str = Query("homo_sapiens", description="Species slug"),
    ensembl_id: Optional[str] = Query(None, description="Ensembl gene ID (optional)"),
    tissue_tpm: Optional[float] = Query(None, description="Baseline tissue TPM for overexpression warning"),
):
    """Analyze gene structural features to determine TG02 mechanism availability."""
    result = analyze_gene_features(
        gene_symbol=gene_symbol.strip(),
        organism=organism.strip(),
        ensembl_id=ensembl_id.strip() if ensembl_id else None,
        tissue_tpm=tissue_tpm,
    )
    return result
