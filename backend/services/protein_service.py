"""Protein database IDs from UniProt REST API and NCBI Gene."""

import requests
from typing import Dict, Optional


def get_protein_db_ids(uniprot_id: Optional[str] = None, gene_symbol: Optional[str] = None, entrez_id: Optional[str] = None) -> Dict:
    """Fetch InterPro, Pfam, PDB, UniProt, and mutation rate from public APIs."""
    result = {
        "interproId": None,
        "pfamId": None,
        "pdbId": None,
        "mutationRate": None,
        "uniprotAccession": None,
    }

    # Always search by gene symbol to get a proper UniProt accession
    if gene_symbol:
        try:
            resp = requests.get(
                "https://rest.uniprot.org/uniprotkb/search",
                params={
                    "query": f"gene:{gene_symbol} AND organism_id:9606 AND reviewed:true",
                    "format": "json",
                    "size": 1,
                },
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    result["uniprotAccession"] = results[0].get("primaryAccession")
        except Exception:
            pass

    # Use provided UniProt ID if search didn't find one
    if not result["uniprotAccession"] and uniprot_id:
        if uniprot_id and not uniprot_id.startswith("ENSP"):
            result["uniprotAccession"] = uniprot_id

    accession = result["uniprotAccession"]
    if accession:
        try:
            resp = requests.get(
                f"https://rest.uniprot.org/uniprotkb/{accession}.json",
                timeout=15,
            )
            if resp.status_code == 200:
                data = resp.json()
                for ref in data.get("uniProtKBCrossReferences", []):
                    db = ref.get("database", "")
                    if db == "InterPro" and not result["interproId"]:
                        result["interproId"] = ref.get("id")
                    elif db == "Pfam" and not result["pfamId"]:
                        result["pfamId"] = ref.get("id")
                    elif db == "PDB" and not result["pdbId"]:
                        result["pdbId"] = ref.get("id")
                for comment in data.get("comments", []):
                    if comment.get("commentType") in ("Polymorphism", "Disease"):
                        for text in comment.get("texts", []):
                            value = text.get("value", "")
                            if value and len(value) > 10:
                                result["mutationRate"] = value[:200]
                                break
                        if result["mutationRate"]:
                            break
        except Exception:
            pass

    # Fallback: fetch mutation rate from NCBI Gene
    if not result["mutationRate"] and entrez_id:
        try:
            resp = requests.get(
                f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi",
                params={"db": "gene", "id": entrez_id, "retmode": "xml"},
                timeout=15,
            )
            if resp.status_code == 200:
                import re
                text = resp.text
                # Look for specific mutation rate patterns
                patterns = [
                    r'mutation\s*rate[:\s]*([\d.eE+\-×10]+\s*(?:per|/)\s*[\w\s]+)',
                    r'mutation\s*rate[:\s]*([^\.<]{5,80})',
                    r'somatic\s*mutation[^<]*?(\d[\d,.]+\s*(?:per|/)\s*[\w\s]+)',
                ]
                for pat in patterns:
                    rate_match = re.search(pat, text, re.IGNORECASE)
                    if rate_match:
                        val = rate_match.group(1).strip()
                        if len(val) > 5 and not val.startswith("http"):
                            result["mutationRate"] = val[:200]
                            break
        except Exception:
            pass

    return result
