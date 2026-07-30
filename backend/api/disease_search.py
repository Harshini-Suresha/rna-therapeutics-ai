from fastapi import APIRouter

from services.disease_search_service import search_disease_genes, get_disease_detail

router = APIRouter()


@router.get("/api/disease-search")
async def disease_search(query: str):
    if not query or not query.strip():
        return {"diseaseId": None, "diseaseName": None, "genes": []}
    return search_disease_genes(query.strip())


@router.get("/api/disease-search/detail")
async def disease_search_detail(query: str):
    if not query or not query.strip():
        return {
            "diseaseId": None,
            "diseaseName": None,
            "description": None,
            "therapeuticAreas": [],
            "genes": [],
            "knownDrugs": [],
        }
    return get_disease_detail(query.strip())
