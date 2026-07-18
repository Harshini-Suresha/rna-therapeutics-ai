"""
Mechanism selection endpoints. Kept separate from main.py's gene retrieval
pipeline since this is a distinct concern (Rulebook Engine, not the
Biological Information Retrieval Engine).
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.mechanism_service import (
    rank_gene_silencing_mechanisms,
    DEFECT_TYPES,
    SILENCING_SCOPES,
    DELIVERY_CONTEXTS,
)

router = APIRouter()


class GeneSilencingRequest(BaseModel):
    gene_symbol: str
    defect_type: str
    silencing_scope: str
    delivery_context: Optional[str] = None
    known_variant: Optional[str] = None


@router.get("/api/mechanisms/options")
async def mechanism_options():
    """Input options for the mechanism selection form (Gene Silencing, for now)."""
    return {
        "defectTypes": [{"id": k, "label": v} for k, v in DEFECT_TYPES.items()],
        "silencingScopes": [{"id": k, "label": v} for k, v in SILENCING_SCOPES.items()],
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
