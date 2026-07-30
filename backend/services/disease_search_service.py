"""
Disease -> gene reverse lookup via the Open Targets Platform.

Human only — Open Targets doesn't cover other species, same boundary
already applied everywhere else disease association appears in this
platform (see main.py's fetch_disease_associations).

This mirrors the query shape of that existing, working gene->disease
lookup (same GraphQL endpoint, same page:{index,size} pagination style)
run in the opposite direction, rather than inventing a new query pattern.
"""

from __future__ import annotations

import requests

OPEN_TARGETS_URL = "https://api.platform.opentargets.org/api/v4/graphql"
_TIMEOUT = 10


def get_disease_detail(query: str, gene_limit: int = 30) -> dict:
    """
    Fuller disease lookup for the dedicated results page: resolves the
    free-text query to a disease (same as search_disease_genes), then
    fetches description, therapeutic areas, a larger ranked gene list,
    and known drugs where Open Targets has them.

    Some of these fields (description, therapeuticAreas, knownDrugs) are
    less exhaustively tested against the live schema than the core
    search->targets query — every field is read defensively, so a schema
    mismatch on any one of them degrades to null/empty rather than
    breaking the whole response.
    """
    result: dict = {
        "diseaseId": None,
        "diseaseName": None,
        "description": None,
        "therapeuticAreas": [],
        "genes": [],
        "knownDrugs": [],
        "synonyms": [],
        "phenotypes": [],
        "relatedDiseases": [],
        "childDiseases": [],
        "databaseRefs": {},
    }
    query = (query or "").strip()
    if not query:
        return result

    try:
        search_query = """
        query diseaseSearch($q: String!) {
          search(queryString: $q, entityNames: ["disease"], page: {index: 0, size: 1}) {
            hits { id name entity }
          }
        }
        """
        resp = requests.post(
            OPEN_TARGETS_URL,
            json={"query": search_query, "variables": {"q": query}},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return result
        data = resp.json().get("data") or {}
        hits = (data.get("search") or {}).get("hits") or []
        if not hits:
            return result

        disease_id = hits[0]["id"]
        result["diseaseId"] = disease_id
        result["diseaseName"] = hits[0]["name"]

        detail_query = """
        query diseaseDetail($efoId: String!, $size: Int!) {
          disease(efoId: $efoId) {
            id
            name
            description
            therapeuticAreas { id name }
            synonyms { relation terms }
            phenotypes { count rows { phenotypeHPO { id name } } }
            children { id name }
            dbXRefs
            similarEntities { category id score }
            associatedTargets(page: {index: 0, size: $size}) {
              count
              rows {
                score
                target { id approvedSymbol approvedName biotype }
              }
            }
            drugAndClinicalCandidates {
              count
              rows {
                drug { id name }
                maxClinicalStage
              }
            }
          }
        }
        """
        resp2 = requests.post(
            OPEN_TARGETS_URL,
            json={"query": detail_query, "variables": {"efoId": disease_id, "size": gene_limit}},
            timeout=_TIMEOUT,
        )
        if resp2.status_code != 200:
            return result

        resp2_data = resp2.json()
        if resp2_data.get("errors"):
            return result

        disease_data = (resp2_data.get("data") or {}).get("disease") or {}

        result["description"] = disease_data.get("description")
        result["therapeuticAreas"] = [
            ta.get("name") for ta in (disease_data.get("therapeuticAreas") or []) if ta.get("name")
        ]

        # Parse synonyms
        synonyms = []
        for syn_group in (disease_data.get("synonyms") or []):
            relation = syn_group.get("relation", "")
            terms = syn_group.get("terms") or []
            for term in terms:
                if term and term.lower() != (result["diseaseName"] or "").lower():
                    synonyms.append({"term": term, "relation": relation})
        result["synonyms"] = synonyms[:15]  # Limit to 15 synonyms

        # Parse phenotypes
        phenotypes = []
        pheno_data = disease_data.get("phenotypes") or {}
        for row in (pheno_data.get("rows") or []):
            hpo = row.get("phenotypeHPO") or {}
            if hpo.get("name"):
                phenotypes.append({"id": hpo.get("id", ""), "name": hpo["name"]})
        result["phenotypes"] = phenotypes[:20]  # Limit to 20 phenotypes

        # Parse child diseases (subtypes)
        child_diseases = []
        for child in (disease_data.get("children") or []):
            if child.get("name"):
                child_diseases.append({"id": child.get("id", ""), "name": child["name"]})
        result["childDiseases"] = child_diseases[:10]

        # Parse database cross-references
        db_refs = {}
        for ref in (disease_data.get("dbXRefs") or []):
            if ":" in ref:
                db, acc = ref.split(":", 1)
                if db not in db_refs:
                    db_refs[db] = acc
        result["databaseRefs"] = db_refs

        # Parse similar diseases (not drugs)
        similar_diseases = []
        for sim in (disease_data.get("similarEntities") or []):
            if sim.get("category") == "disease" and sim.get("id") != result["diseaseId"]:
                similar_diseases.append({"id": sim.get("id", ""), "score": sim.get("score", 0)})
        result["relatedDiseases"] = similar_diseases[:10]

        rows = (disease_data.get("associatedTargets") or {}).get("rows") or []
        genes = []
        for row in rows:
            target = row.get("target") or {}
            symbol = target.get("approvedSymbol")
            if not symbol:
                continue
            score = row.get("score")
            genes.append({
                "symbol": symbol,
                "name": target.get("approvedName"),
                "ensemblId": target.get("id"),
                "biotype": target.get("biotype"),
                "score": round(score, 3) if isinstance(score, (int, float)) else None,
            })
        result["genes"] = genes

        drug_rows = (disease_data.get("drugAndClinicalCandidates") or {}).get("rows") or []
        seen_drugs = set()
        drugs = []
        for row in drug_rows:
            drug = row.get("drug") or {}
            name = drug.get("name")
            if not name or name.lower() in seen_drugs:
                continue
            seen_drugs.add(name.lower())
            stage = row.get("maxClinicalStage") or ""
            drugs.append({
                "name": name,
                "mechanismOfAction": None,
                "phase": None,
                "status": stage.replace("_", " ").title() if stage else None,
            })
        result["knownDrugs"] = drugs[:20]

        return result

    except requests.RequestException:
        return result


def search_disease_genes(query: str, limit: int = 12) -> dict:
    """
    Free-text disease name -> best-matching disease + its top associated
    genes, ranked by Open Targets' real evidence-based association score.

    Returns empty fields (never a fabricated match) if nothing is found
    or the API is unreachable.
    """
    result: dict = {"diseaseId": None, "diseaseName": None, "genes": []}
    query = (query or "").strip()
    if not query:
        return result

    try:
        search_query = """
        query diseaseSearch($q: String!) {
          search(queryString: $q, entityNames: ["disease"], page: {index: 0, size: 1}) {
            hits { id name entity }
          }
        }
        """
        resp = requests.post(
            OPEN_TARGETS_URL,
            json={"query": search_query, "variables": {"q": query}},
            timeout=_TIMEOUT,
        )
        if resp.status_code != 200:
            return result

        resp_data = resp.json()
        if resp_data.get("errors"):
            return result

        hits = ((resp_data.get("data") or {}).get("search") or {}).get("hits") or []
        if not hits:
            return result

        disease_id = hits[0]["id"]
        disease_name = hits[0]["name"]
        result["diseaseId"] = disease_id
        result["diseaseName"] = disease_name

        targets_query = """
        query diseaseTargets($efoId: String!, $size: Int!) {
          disease(efoId: $efoId) {
            id
            name
            associatedTargets(page: {index: 0, size: $size}) {
              rows {
                score
                target { id approvedSymbol approvedName }
              }
            }
          }
        }
        """
        resp2 = requests.post(
            OPEN_TARGETS_URL,
            json={"query": targets_query, "variables": {"efoId": disease_id, "size": limit}},
            timeout=_TIMEOUT,
        )
        if resp2.status_code != 200:
            return result

        resp2_data = resp2.json()
        if resp2_data.get("errors"):
            return result

        disease_data = (resp2_data.get("data") or {}).get("disease") or {}
        rows = (disease_data.get("associatedTargets") or {}).get("rows") or []

        genes = []
        for row in rows:
            target = row.get("target") or {}
            symbol = target.get("approvedSymbol")
            if not symbol:
                continue
            score = row.get("score")
            genes.append({
                "symbol": symbol,
                "name": target.get("approvedName"),
                "ensemblId": target.get("id"),
                "score": round(score, 3) if isinstance(score, (int, float)) else None,
            })

        result["genes"] = genes
        return result

    except requests.RequestException:
        return result
