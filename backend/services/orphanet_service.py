"""Orphanet disease data: Orphanet code, ICD-11 code, and incidence.

Uses the Open Targets Platform GraphQL API and NCBI Gene database to extract
Orphanet codes, ICD-11 codes, and disease classification from cross-references
associated with the gene's top disease association.

Sources:
- Open Targets Platform (https://api.platform.opentargets.org)
- NCBI Gene / OMIM cross-references
- Orphanet public data pages
"""

import logging
import re
from typing import Optional, List

import requests

logger = logging.getLogger(__name__)

OT_GRAPHQL = "https://api.platform.opentargets.org/api/v4/graphql"
NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def _get_disease_xrefs(ensembl_id: str) -> list:
    """Fetch cross-references for the top disease associated with a gene via Open Targets."""
    query = """
    query targetDiseaseXrefs($ensemblId: String!) {
      target(ensemblId: $ensemblId) {
        associatedDiseases(page: {index: 0, size: 5}) {
          rows {
            disease {
              name
              dbXRefs
            }
          }
        }
      }
    }
    """
    try:
        resp = requests.post(
            OT_GRAPHQL,
            json={"query": query, "variables": {"ensemblId": ensembl_id}},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            rows = (data.get("data") or {}).get("target", {}).get("associatedDiseases", {}).get("rows", [])
            return rows
    except Exception as e:
        logger.info(f"Open Targets xref fetch failed for {ensembl_id}: {e}")
    return []


def _extract_orphanet_code(xrefs: list) -> Optional[str]:
    """Extract Orphanet code from Open Targets disease cross-references."""
    for row in xrefs:
        disease = row.get("disease") or {}
        for xref in disease.get("dbXRefs", []) or []:
            if isinstance(xref, str) and xref.lower().startswith("orphanet:"):
                code = xref.split(":", 1)[1].strip()
                if code:
                    return f"ORPHA:{code}"
    return None


def _extract_icd11_code(xrefs: list) -> Optional[str]:
    """Extract ICD-11 code from Open Targets disease cross-references."""
    for row in xrefs:
        disease = row.get("disease") or {}
        for xref in disease.get("dbXRefs", []) or []:
            if isinstance(xref, str) and xref.lower().startswith("icd11"):
                # Format: "icd11.foundation:1479561744" or "icd11:8A95"
                code = xref.split(":", 1)[1].strip()
                if code:
                    return code
    return None


def _extract_disease_names(xrefs: list) -> List[str]:
    """Extract disease names from Open Targets cross-references."""
    names = []
    for row in xrefs:
        disease = row.get("disease") or {}
        name = disease.get("name")
        if name and isinstance(name, str) and len(name) > 2:
            names.append(name)
    return names[:5]


def _get_orphanet_incidence(orpha_code: str) -> Optional[str]:
    """Try to fetch incidence data from Orphanet public pages (best effort)."""
    try:
        # Orphanet public data pages have prevalence info
        resp = requests.get(
            f"https://www.orpha.net/en/disease/detail/{orpha_code}",
            timeout=8,
            headers={"User-Agent": "Mozilla/5.0"},
        )
        if resp.status_code == 200:
            text = resp.text
            # Look for prevalence patterns in the HTML
            prevalence_match = re.search(
                r"prevalence[^<]*<[^>]*>([^<]+)",
                text, re.IGNORECASE
            )
            if prevalence_match:
                return prevalence_match.group(1).strip()[:200]
    except Exception:
        pass
    return None


def _get_orphanet_by_gene_name(gene_symbol: str) -> Optional[str]:
    """Search Orphanet API directly by gene symbol to find associated diseases.

    Uses the Orphanet REST API to search for diseases linked to a gene.
    """
    try:
        resp = requests.get(
            f"https://api.orphacode.org/EN/ClinicalEntity/gene/{gene_symbol}",
            headers={"Accept": "application/json"},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            # Extract Orphanet codes from the response
            if isinstance(data, list):
                for item in data:
                    code = item.get("orphaCode") or item.get("entityId")
                    if code:
                        return f"ORPHA:{code}"
            elif isinstance(data, dict):
                code = data.get("orphaCode") or data.get("entityId")
                if code:
                    return f"ORPHA:{code}"
    except Exception:
        pass
    return None


def _get_omim_orphanet_via_ncbi(gene_symbol: str) -> dict:
    """Fetch OMIM and disease cross-references from NCBI Gene database.

    NCBI Gene entries contain cross-references to Orphanet, OMIM, and ICD-11
    which can be used when Open Targets doesn't have the data.
    """
    result = {"orphanetCode": None, "icd11Code": None, "diseaseNames": []}
    try:
        # Search NCBI Gene for the gene
        resp = requests.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={
                "db": "gene",
                "term": f"{gene_symbol}[Symbol] AND human[Organism]",
                "retmax": 3,
                "retmode": "json",
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return result

        gene_ids = resp.json().get("esearchresult", {}).get("idlist", [])
        if not gene_ids:
            return result

        # Fetch gene summary which contains cross-references
        resp = requests.get(
            f"{NCBI_EUTILS}/esummary.fcgi",
            params={"db": "gene", "id": gene_ids[0], "retmode": "json"},
            timeout=10,
        )
        if resp.status_code != 200:
            return result

        data = resp.json().get("result", {}).get(gene_ids[0], {})
        if not data:
            return result

        # Extract OMIM IDs
        mim = data.get("mim")
        if mim:
            if isinstance(mim, list) and mim:
                result["omimId"] = str(mim[0])
            elif isinstance(mim, str) and mim.isdigit():
                result["omimId"] = mim

        # Extract disease names from description
        desc = data.get("description") or data.get("summary") or ""
        if desc:
            # Look for disease-related terms
            disease_kw = ["disease", "disorder", "syndrome", "deficiency", "dystrophy",
                         "myopathy", "cancer", "tumor", "carcinoma", "leukemia"]
            sentences = re.split(r'(?<=[.!?])\s+', desc)
            for sent in sentences:
                if any(kw in sent.lower() for kw in disease_kw):
                    cleaned = sent.strip(".,;: ")
                    if len(cleaned) > 10:
                        result["diseaseNames"].append(cleaned[:200])
                        break

    except Exception as e:
        logger.info(f"NCBI Gene cross-ref fetch failed for {gene_symbol}: {e}")

    return result


def get_orphanet_data(
    gene_symbol: str,
    ensembl_id: str = None,
    disease_name: str = None,
    phenotypes: list = None,
) -> dict:
    """Fetch Orphanet classification, ICD-11 code, and incidence data.

    Uses multiple sources to find Orphanet and ICD-11 codes:
    1. Open Targets cross-references (already queried in the main pipeline)
    2. NCBI Gene database cross-references
    3. Orphanet API direct gene search
    4. Best-effort incidence from Orphanet public pages

    Returns:
        dict with keys:
            - orphanetCode: str | None (e.g. "ORPHA:98896")
            - icd11Code: str | None (e.g. "1479561744")
            - incidence: str | None (prevalence/incidence description)
            - diseaseNames: list of associated disease names
    """
    result = {
        "orphanetCode": None,
        "icd11Code": None,
        "incidence": None,
        "diseaseNames": [],
    }

    # Strategy 1: Open Targets cross-references
    if ensembl_id:
        xrefs = _get_disease_xrefs(ensembl_id)
        if xrefs:
            result["orphanetCode"] = _extract_orphanet_code(xrefs)
            result["icd11Code"] = _extract_icd11_code(xrefs)
            result["diseaseNames"] = _extract_disease_names(xrefs)

    # Strategy 2: NCBI Gene cross-references (fallback)
    if not result["orphanetCode"] and not result["icd11Code"]:
        ncbi_data = _get_omim_orphanet_via_ncbi(gene_symbol)
        if ncbi_data.get("diseaseNames"):
            result["diseaseNames"] = ncbi_data["diseaseNames"]

    # Strategy 3: Orphanet API direct search (fallback)
    if not result["orphanetCode"]:
        orpha_code = _get_orphanet_by_gene_name(gene_symbol)
        if orpha_code:
            result["orphanetCode"] = orpha_code

    # Best-effort incidence from Orphanet
    if result["orphanetCode"]:
        orpha_num = result["orphanetCode"].replace("ORPHA:", "")
        result["incidence"] = _get_orphanet_incidence(orpha_num)

    # Deduplicate disease names
    result["diseaseNames"] = list(dict.fromkeys(result["diseaseNames"]))[:5]

    return result
