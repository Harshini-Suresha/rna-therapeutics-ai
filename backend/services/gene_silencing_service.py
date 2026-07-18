"""
Gene Silencing page backend service.

Fetches transcript/exon data from Ensembl, generates ASO candidates
for a target exon, and computes biophysical metrics (GC%, Tm, self-dimer risk).
"""

from __future__ import annotations

import re
import requests

ENSEMBL_REST = "https://rest.ensembl.org"


def _ensembl_get(url: str, timeout: int = 15) -> requests.Response:
    return requests.get(url, headers={"Content-Type": "application/json"}, timeout=timeout)


# ---------------------------------------------------------------------------
# 1. Target Analysis — transcript / exon structure for the confirmed gene
# ---------------------------------------------------------------------------

def get_target_analysis(ensembl_gene_id: str) -> dict:
    """Return transcript and exon structure for the gene."""
    result = {
        "geneId": ensembl_gene_id,
        "canonicalTranscript": None,
        "totalCodingTranscripts": 0,
        "exons": [],
        "cdsLength": None,
        "mrnaSequence": None,
    }

    try:
        resp = _ensembl_get(f"{ENSEMBL_REST}/lookup/id/{ensembl_gene_id}?expand=1")
        if not resp.ok:
            return result
        data = resp.json()

        transcripts = data.get("Transcript", [])
        coding = [t for t in transcripts if t.get("biotype") == "protein_coding"]
        result["totalCodingTranscripts"] = len(coding)

        canonical_id = data.get("canonical_transcript", "")
        canonical = None
        for t in coding:
            if t.get("id", "").split(".")[0] == canonical_id.split(".")[0]:
                canonical = t
                break
        if not canonical and coding:
            canonical = coding[0]

        if canonical:
            result["canonicalTranscript"] = {
                "id": canonical.get("id"),
                "biotype": canonical.get("biotype"),
            }
            exons = canonical.get("Exon", [])
            # Sort by genomic start position — exons don't come pre-ranked
            strand = canonical.get("strand", 1)
            sorted_exons = sorted(exons, key=lambda e: e.get("start", 0), reverse=(strand == -1))
            result["exons"] = [
                {
                    "id": e.get("id"),
                    "index": idx + 1,
                    "start": e.get("start"),
                    "end": e.get("end"),
                    "length": (e.get("end", 0) - e.get("start", 0) + 1),
                }
                for idx, e in enumerate(sorted_exons)
                if e.get("start") and e.get("end")
            ]

            # Fetch CDS length from the sequence endpoint
            tid = canonical.get("id", "").split(".")[0]
            seq_resp = _ensembl_get(f"{ENSEMBL_REST}/sequence/id/{tid}?type=cds")
            if seq_resp.ok:
                seq = seq_resp.json().get("seq", "")
                result["cdsLength"] = len(seq)
                result["mrnaSequence"] = seq
    except Exception:
        pass

    return result


# ---------------------------------------------------------------------------
# 2. ASO Candidate Generation
# ---------------------------------------------------------------------------

CHEMISTRY_OPTIONS = [
    {"id": "gapmer", "label": "DNA Gapmer (2-10-2)", "description": "Standard RNase H1-recruiting backbone; most validated."},
    {"id": "pmo", "label": "PMO (Phosphorodiamidate Morpholino)", "description": "Steric blocker; splice-switching, no RNase H."},
    {"id": "lna_gapmer", "label": "LNA-enhanced Gapmer", "description": "Locked nucleic acid wings boost binding affinity and nuclease resistance."},
    {"id": "2ome", "label": "2\u2032-O-Methoxyethyl (2\u2032-OMe)", "description": "Steric blocker; splicing modulation and miRNA inhibition."},
]

MODIFICATION_OPTIONS = [
    {"id": "phosphorothioate", "label": "Phosphorothioate (PS) backbone", "description": "Increases nuclease resistance and protein binding."},
    {"id": "lna_wings", "label": "LNA wings (5\u2032 + 3\u2032)", "description": "Locked nucleic acids at terminal positions for higher Tm."},
    {"id": "2omemod", "label": "2\u2032-OMe wing modifications", "description": "Ribose modification at terminal positions."},
    {"id": "pmo_core", "label": "PMO core", "description": "Non-ionic backbone; splice-switching."},
    {"id": "pna_clamp", "label": "PNA clamp (flanking)", "description": "Peptide nucleic acid clamps to block nuclease access."},
]

LENGTH_RANGE = {"min": 12, "max": 30, "default": 18, "step": 1}

# Minimum GC fraction for a valid candidate
MIN_GC = 0.30
MAX_GC = 0.70

# Melting temperature approximation (nearest-neighbor simplified)
_nn_params = {"A": 2.0, "T": 2.0, "G": 4.0, "C": 4.0}


def _calc_gc(seq: str) -> float:
    if not seq:
        return 0.0
    gc = sum(1 for b in seq if b in "GCgc")
    return gc / len(seq)


def _calc_tm(seq: str) -> float:
    """Simplified Tm (°C) using Wallace rule adjusted for oligos ≤ 20-mer."""
    seq = seq.upper()
    a = sum(1 for b in seq if b == "A")
    t = sum(1 for b in seq if b == "T")
    g = sum(1 for b in seq if b == "G")
    c = sum(1 for b in seq if b == "C")
    n = a + t + g + c
    if n == 0:
        return 0.0
    # Wallace rule for short oligos: Tm = 2*(A+T) + 4*(G+C)
    tm = 2 * (a + t) + 4 * (g + c)
    return round(tm, 1)


def _self_complement_score(seq: str) -> float:
    """Fraction of sequence that can form hairpins (palindromic 4-mers)."""
    seq = seq.upper()
    comp = {"A": "T", "T": "A", "G": "C", "C": "G"}
    n = len(seq)
    if n < 4:
        return 0.0
    count = 0
    for i in range(n - 3):
        sub = seq[i : i + 4]
        rc = "".join(comp.get(b, "N") for b in reversed(sub))
        if sub == rc:
            count += 1
    return round(count / (n - 3), 4) if n > 3 else 0.0


def _polyg_score(seq: str) -> int:
    """Number of G-tracts ≥3 in the sequence."""
    return len(re.findall(r"G{3,}", seq.upper()))


def generate_candidates(
    target_exon_index: int | None,
    aso_length: int,
    chemistry: str,
    modifications: list[str],
    mrna_sequence: str | None,
    exon_count: int,
) -> list[dict]:
    """Generate candidate ASOs targeting the selected exon's splice junctions."""
    candidates = []
    if not mrna_sequence or exon_count < 2:
        return candidates

    # We approximate exon boundaries by splitting the CDS evenly (proportional to exon count)
    # In a real system you'd use Ensembl exon coordinates. For now we use a sliding window
    # approach around the approximate exon region.
    seq = mrna_sequence.upper()
    seq_len = len(seq)
    approx_exon_size = seq_len // exon_count if exon_count else seq_len

    # Target region: the approximate exon plus 20 nt flanking into adjacent introns
    # (splice junction targeting)
    if target_exon_index is not None and 0 < target_exon_index <= exon_count:
        exon_start = int((target_exon_index - 1) * (seq_len / exon_count))
        exon_end = int(target_exon_index * (seq_len / exon_count))
    else:
        # Default to middle of CDS
        exon_start = seq_len // 3
        exon_end = 2 * seq_len // 3

    # Generate candidates with sliding window across exon + flanking region
    search_start = max(0, exon_start - 10)
    search_end = min(seq_len - aso_length, exon_end + 10)

    seen = set()
    for offset in range(search_start, search_end, max(1, aso_length // 3)):
        candidate_seq = seq[offset : offset + aso_length]
        if len(candidate_seq) < aso_length:
            continue
        if candidate_seq in seen:
            continue
        seen.add(candidate_seq)

        gc = _calc_gc(candidate_seq)
        if gc < MIN_GC or gc > MAX_GC:
            continue

        tm = _calc_tm(candidate_seq)
        sc = _self_complement_score(candidate_seq)
        pg = _polyg_score(candidate_seq)

        # Composite quality score (0–100)
        gc_score = max(0, 100 - abs(gc - 0.50) * 400)
        tm_score = max(0, 100 - abs(tm - 52) * 3)
        sc_penalty = sc * 200
        pg_penalty = pg * 15
        quality = max(0, min(100, gc_score * 0.35 + tm_score * 0.45 - sc_penalty - pg_penalty))

        candidates.append({
            "sequence": candidate_seq,
            "length": aso_length,
            "gcContent": round(gc * 100, 1),
            "meltingTemp": tm,
            "selfComplementScore": round(sc, 4),
            "polygTracts": pg,
            "qualityScore": round(quality, 1),
            "targetRegion": f"Exon {target_exon_index or '?'} offset +{offset - exon_start}",
            "chemistry": chemistry,
            "modifications": modifications,
        })

    # Sort by quality descending, return top 10
    candidates.sort(key=lambda c: c["qualityScore"], reverse=True)
    return candidates[:10]
