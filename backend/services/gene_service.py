# backend/services/gene_service.py
import time
import logging
import requests
from typing import Optional

REST_API_BASE = "https://rest.ensembl.org"
HGNC_API_BASE = "https://rest.genenames.org"
ENSEMBL_TIMEOUT = 8
MAX_RETRIES = 2
RETRY_BACKOFF = 1.0

logger = logging.getLogger(__name__)


class EnsemblLookupUnavailable(RuntimeError):
    """Raised when Ensembl cannot be contacted, rather than when a gene is absent."""


def get_hgnc_metadata(gene_symbol: str) -> dict:
    """Return the approved HGNC ID and aliases for a human gene when available."""
    try:
        response = requests.get(
            f"{HGNC_API_BASE}/fetch/symbol/{gene_symbol}",
            headers={"Accept": "application/json"},
            timeout=6,
        )
        if not response.ok:
            return {}

        docs = (response.json().get("response") or {}).get("docs") or []
        return docs[0] if docs else {}
    except (requests.RequestException, ValueError):
        # HGNC enrichment is optional; Ensembl remains the source of truth for lookup.
        return {}


def clean_synonyms(values, gene_symbol: str) -> list:
    """Keep only distinct, meaningful aliases (never the approved symbol itself)."""
    clean_values = []
    seen = set()
    excluded = {gene_symbol.strip().casefold(), "none identified", "n/a", "na"}

    for value in values or []:
        if not isinstance(value, str):
            continue
        synonym = value.strip()
        key = synonym.casefold()
        if not synonym or key in excluded or key in seen:
            continue
        seen.add(key)
        clean_values.append(synonym)

    return clean_values


def get_cytoband(species: str, chromosome: str, start: int, end: int) -> Optional[str]:
    """Resolve the cytogenetic band(s) spanning a gene from Ensembl."""
    if not all([chromosome, start, end]):
        return None
    try:
        url = f"{REST_API_BASE}/overlap/region/{species}/{chromosome}:{start}-{end}?feature=band"
        response = _ensembl_get(url)
        bands = response.json() if response.ok else []
        labels = [f"{chromosome}{band.get('id')}" for band in sorted(bands, key=lambda item: item.get("start", 0)) if band.get("id")]
        return "–".join(labels) if labels else None
    except (EnsemblLookupUnavailable, ValueError):
        return None

def ensembl_gene_url(*args):
    """
    Generates a web link to the Ensembl browser page for a given gene ID.
    Intelligently handles calling signatures like (gene_id) or (gene_id, species).
    Accepts both common names (mouse, human) and Ensembl species names (mus_musculus).
    """
    gene_id = ""
    organism = "human"
    
    for arg in args:
        arg_str = str(arg).strip()
        # Match common names
        if any(sp in arg_str.lower() for sp in ["human", "mouse", "sapiens", "musculus", "rat", "norvegicus", "macaque", "zebrafish"]):
            organism = arg_str
        # Also match Ensembl species names directly (e.g. mus_musculus, danio_rerio)
        elif "_" in arg_str and any(part in arg_str.lower() for part in ["sapiens", "musculus", "norvegicus", "fascicularis", "mulatta", "rerio", "melanogaster", "elegans", "cerevisiae", "pombe", "familiaris", "catus", "scrofa", "taurus", "caballus", "aries", "hircus", "gallus", "thaliana", "sativa", "mays", "aestivum", "lycopersicum", "coli", "aureus", "tuberculosis", "aeruginosa"]):
            organism = arg_str
        elif arg_str:
            gene_id = arg_str
            
    org_lower = organism.lower()
    # Direct Ensembl species name (e.g. mus_musculus) — capitalize for URL
    if "_" in org_lower and not any(cn in org_lower for cn in ["human", "mouse", "rat", "zebrafish"]):
        parts = org_lower.split("_")
        species = "_".join(p.capitalize() for p in parts if p)
    elif "sapiens" in org_lower or "human" in org_lower:
        species = "Homo_sapiens"
    elif "musculus" in org_lower or "mouse" in org_lower:
        species = "Mus_musculus"
    elif "norvegicus" in org_lower or "rat" in org_lower:
        species = "Rattus_norvegicus"
    elif "fascicularis" in org_lower:
        species = "Macaca_fascicularis"
    elif "mulatta" in org_lower:
        species = "Macaca_mulatta"
    elif "rerio" in org_lower or "zebrafish" in org_lower:
        species = "Danio_rerio"
    else:
        parts = org_lower.replace(" ", "_").split("_")
        species = "_".join(p.capitalize() for p in parts if p)
        if not species:
            species = "Homo_sapiens"
            
    return f"https://www.ensembl.org/{species}/Gene/Summary?g={gene_id}"

def _ensembl_get(url: str, retries: int = MAX_RETRIES) -> requests.Response:
    """GET with retries and exponential backoff for transient Ensembl failures."""
    last_exc: Optional[Exception] = None
    for attempt in range(1, retries + 1):
        try:
            response = requests.get(
                url,
                headers={"Accept": "application/json"},
                timeout=ENSEMBL_TIMEOUT,
            )
            if response.status_code == 404:
                return response
            if response.ok:
                return response
            if response.status_code >= 500:
                last_exc = RuntimeError(f"HTTP {response.status_code}")
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.warning("Ensembl returned %d (attempt %d/%d), retrying in %.1fs",
                               response.status_code, attempt, retries, wait)
                time.sleep(wait)
                continue
            return response
        except requests.RequestException as exc:
            last_exc = exc
            if attempt < retries:
                wait = RETRY_BACKOFF * (2 ** (attempt - 1))
                logger.warning("Ensembl request failed (attempt %d/%d), retrying in %.1fs: %s",
                               attempt, retries, wait, exc)
                time.sleep(wait)
    raise EnsemblLookupUnavailable("Ensembl could not be reached after multiple attempts. Please try again shortly.") from last_exc


def get_gene_metadata(gene_symbol: str, organism: str):
    species = organism.lower().strip().replace(" ", "_")

    # CRITICAL FIX: Appended &synonyms=1 to populate the synonyms array correctly
    url = f"{REST_API_BASE}/lookup/symbol/{species}/{gene_symbol}?expand=1&synonyms=1"

    response = _ensembl_get(url)

    if response.status_code == 404:
        return None
    # 400 = species/symbol not on this Ensembl instance (e.g. plants, bacteria).
    # Return None so the NCBI fallback in main.py can try.
    if response.status_code == 400:
        return None
    if not response.ok:
        raise EnsemblLookupUnavailable(
            f"Ensembl lookup is unavailable (HTTP {response.status_code}). Please try again shortly."
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise EnsemblLookupUnavailable("Ensembl returned an invalid lookup response. Please try again shortly.") from exc
    
    transcripts = data.get("Transcript", [])
    canonical = next((t for t in transcripts if t.get("is_canonical")), transcripts[0] if transcripts else {})
    canonical_id = canonical.get("id")
    
    # Extract transcripts data needed by main.py
    other_transcripts = [t.get("id") for t in transcripts if t.get("id") != canonical_id and t.get("id")]
    
    hgnc_data = get_hgnc_metadata(gene_symbol) if species == "homo_sapiens" else {}
    aliases = clean_synonyms(
        [*(data.get("synonyms") or []), *(hgnc_data.get("alias_symbol") or []), *(hgnc_data.get("prev_symbol") or [])],
        gene_symbol,
    )

    # Ensembl appends provenance in square brackets; keep the actual gene name only.
    gene_name = (data.get("description") or "Unknown").split(" [Source:", 1)[0].strip()
    chromosome, start, end = data.get("seq_region_name"), data.get("start"), data.get("end")

    return {
        "geneName": gene_name,
        "officialSymbol": data.get("display_name"),
        "id": data.get("id"),
        "seq_region_name": chromosome,
        "start": start,
        "end": end,
        "cytoband": get_cytoband(species, chromosome, start, end),
        "genomeBuild": data.get("assembly_name"),
        "strand": data.get("strand"),
        "biotype": data.get("biotype"),
        "synonyms": aliases,
        "nomenclatureId": hgnc_data.get("hgnc_id"),
        "canonicalTranscript": canonical_id or "N/A",
        # Added missing items for main.py to read:
        "otherTranscripts": other_transcripts,
        "totalTranscripts": len(transcripts),
        "exonCount": len(canonical.get("Exon", [])) if canonical else 0,
        "proteinLength": canonical.get("Translation", {}).get("length", 0) if canonical.get("Translation") else 0,
        "proteinId": canonical.get("Translation", {}).get("id", "N/A") if canonical.get("Translation") else "N/A"
    }

def get_gene_phenotypes(gene_symbol: str, organism: str):
    """Fetch phenotype associations from Ensembl.

    Uses the /phenotype/gene/{species}/{symbol} endpoint which returns
    cross-species phenotype data (MGI, ZFIN, RGD, etc.).
    Phenotype responses can be large; use a longer timeout than typical lookups.
    """
    species = organism.lower().strip().replace(" ", "_")
    url = f"{REST_API_BASE}/phenotype/gene/{species}/{gene_symbol}"
    try:
        response = requests.get(
            url,
            headers={"Accept": "application/json"},
            timeout=8,
        )
        if not response.ok:
            return []
        return response.json()
    except Exception:
        return []
