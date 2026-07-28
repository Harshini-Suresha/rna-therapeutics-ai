"""ClinVar mutation type breakdown for a gene.

Queries ClinVar via NCBI E-utilities to classify pathogenic variants
by mutation type: large deletions, large duplications, nonsense/point,
frameshift, and splice site mutations.

Source: NCBI ClinVar (via ESearch + EFetch)
"""

import logging
import re
import xml.etree.ElementTree as ET
from typing import Optional

import requests

logger = logging.getLogger(__name__)

NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def _clinvar_search_count(session: requests.Session, query: str) -> int:
    """Return ClinVar record count for a query."""
    try:
        resp = session.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={"db": "clinvar", "term": query, "retmode": "json"},
            timeout=10,
        )
        if resp.status_code == 200:
            return int((resp.json().get("esearchresult") or {}).get("count", 0))
    except Exception:
        pass
    return 0


def _clinvar_fetch_types(session: requests.Session, query: str, retmax: int = 200) -> list:
    """Fetch ClinVar variant type annotations via ESummary, batched to avoid URL length limits."""
    try:
        # First get IDs
        resp = session.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={
                "db": "clinvar",
                "term": query,
                "retmax": retmax,
                "retmode": "json",
            },
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        ids = (resp.json().get("esearchresult") or {}).get("idlist", [])
        if not ids:
            return []

        # Batch esummary requests (max ~100 IDs per request to stay under URL length limit)
        types = []
        batch_size = 100
        for i in range(0, len(ids), batch_size):
            batch = ids[i:i + batch_size]
            resp = session.get(
                f"{NCBI_EUTILS}/esummary.fcgi",
                params={"db": "clinvar", "id": ",".join(batch), "retmode": "json"},
                timeout=15,
            )
            if resp.status_code != 200:
                continue

            data = resp.json().get("result", {})
            for uid in batch:
                record = data.get(uid, {})
                if not isinstance(record, dict):
                    continue
                title = record.get("title", "")
                variant_type = record.get("variation_type", "")
                types.append({
                    "title": title,
                    "type": variant_type,
                })
        return types
    except Exception as e:
        logger.info(f"ClinVar type fetch failed: {e}")
        return []


def _classify_variant(title: str, variant_type: str) -> Optional[str]:
    """Classify a ClinVar record into a mutation category.

    ClinVar titles follow HGVS-like patterns:
    - NM_004006.3(DMD):c.9038del (p.Asn3013fs)          → frameshift
    - NM_004006.3(DMD):c.5695A>T (p.Lys1899Ter)          → nonsense (stop gained)
    - NM_004006.3(DMD):c.4344+1G>A                       → splice site
    - NC_000023.10:g.(32383317_32398626)_(...).del        → large deletion
    - GRCh38/hg38 Xp21.1-11.3(chrX:...)x1                → large deletion (copy number)
    """
    combined = f"{title} {variant_type}".lower()
    title_upper = title.upper()

    # Large deletion — genomic coordinate deletion or cytoband-level
    if re.search(r"nc_\d+\.\d+:g\.", combined) and "del" in combined:
        return "large_deletion"
    if re.search(r"grch\d+/hg\d+\s+\w+\(chr", combined):
        # Copy number variant at chromosomal level
        if "x0" in combined or "x1" in combined and "del" in combined:
            return "large_deletion"
        if "x3" in combined or "x4" in combined:
            return "large_duplication"
        return "large_deletion"
    if any(kw in combined for kw in [
        "whole gene deletion", "exon deletion", "multi-exon deletion",
        "gene deletion", "whole-gene deletion",
    ]):
        return "large_deletion"

    # Large duplication — genomic coordinate or known duplication patterns
    if re.search(r"nc_\d+\.\d+:g\.", combined) and "dup" in combined:
        return "large_duplication"
    if any(kw in combined for kw in [
        "whole gene duplication", "exon duplication", "multi-exon duplication",
        "gene duplication", "whole-gene duplication",
    ]):
        return "large_duplication"

    # Splice site — c.XXX+ or c.XXX- with a nucleotide change
    if re.search(r"c\.\d+[+-]\d+[a-z]>[a-z]", combined):
        return "splice_site"
    if any(kw in combined for kw in ["splice", "splicing", "intronic"]):
        return "splice_site"

    # Frameshift — protein change ends with "fs" (e.g. p.Asn3013fs)
    if re.search(r"p\.\w+fs\b", combined) or "frameshift" in combined:
        return "frameshift"

    # Nonsense — protein change contains "Ter" or "ext" or "stop"
    if re.search(r"p\.\w+Ter\b", combined) or re.search(r"p\.\w+ext\d", combined):
        return "nonsense_point"
    if any(kw in combined for kw in ["nonsense", "stop gained", "stop lost"]):
        return "nonsense_point"

    # Missense / single nucleotide — c.XXXA>T style with protein change
    if re.search(r"c\.\d+[a-z]?>[a-z]", combined) and re.search(r"p\.", combined):
        return "nonsense_point"

    # Single nucleotide substitution without protein annotation
    if re.search(r"c\.\d+[a-z]?>[a-z]$", combined.strip()):
        return "nonsense_point"

    return None


def get_mutation_breakdown(gene_symbol: str) -> dict:
    """Classify ClinVar variants by mutation type for a gene.

    Returns:
        dict with keys:
            - knownPathogenicVariants: int | None (pathogenic + likely pathogenic count)
            - mutationBreakdown: dict with:
                - largeExonDeletions: int | None
                - largeExonDuplications: int | None
                - nonsensePointMutations: int | None
                - frameshiftMutations: int | None
                - spliceSiteMutations: int | None
    """
    result = {
        "knownPathogenicVariants": None,
        "mutationBreakdown": {
            "largeExonDeletions": None,
            "largeExonDuplications": None,
            "nonsensePointMutations": None,
            "frameshiftMutations": None,
            "spliceSiteMutations": None,
        },
    }

    if not gene_symbol:
        return result

    symbol = gene_symbol.strip()
    base_query = f"{symbol}[gene] AND (pathogenic[clinsig] OR likely pathogenic[clinsig])"

    with requests.Session() as session:
        # Get total pathogenic variant count
        total = _clinvar_search_count(session, base_query)
        result["knownPathogenicVariants"] = total if total > 0 else None

        if total == 0:
            return result

        # Fetch sample of variant records to classify types
        records = _clinvar_fetch_types(session, base_query, retmax=min(total, 500))

        if not records:
            return result

        counts = {
            "large_deletion": 0,
            "large_duplication": 0,
            "nonsense_point": 0,
            "frameshift": 0,
            "splice_site": 0,
        }

        for rec in records:
            category = _classify_variant(rec.get("title", ""), rec.get("type", ""))
            if category:
                counts[category] += 1

        # Scale up if we only sampled a subset
        scale = total / len(records) if len(records) < total else 1.0

        result["mutationBreakdown"] = {
            "largeExonDeletions": max(round(counts["large_deletion"] * scale), 0) if counts["large_deletion"] else None,
            "largeExonDuplications": max(round(counts["large_duplication"] * scale), 0) if counts["large_duplication"] else None,
            "nonsensePointMutations": max(round(counts["nonsense_point"] * scale), 0) if counts["nonsense_point"] else None,
            "frameshiftMutations": max(round(counts["frameshift"] * scale), 0) if counts["frameshift"] else None,
            "spliceSiteMutations": max(round(counts["splice_site"] * scale), 0) if counts["splice_site"] else None,
        }

    return result
