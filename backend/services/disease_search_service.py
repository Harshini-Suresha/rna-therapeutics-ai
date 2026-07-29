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

        hits = ((resp.json().get("data") or {}).get("search") or {}).get("hits", [])
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

        disease_data = (resp2.json().get("data") or {}).get("disease") or {}
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
