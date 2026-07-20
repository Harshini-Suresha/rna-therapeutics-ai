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
    {"id": "gapmer", "label": "DNA Gapmer (2-10-2)", "description": "Standard RNase H1-recruiting backbone; most validated.",
     "detail": "A chimeric oligonucleotide with a central DNA 'gap' of ~10 nucleotides flanked by 2\u2032-modified wings (typically 2\u2032-O-Me or LNA). The DNA gap recruits RNase H1 to cleave the target RNA, while the wings confer nuclease resistance and binding affinity. Gapmers are the most clinically validated ASO chemistry (e.g., nusinersen/Spinraza, eteplirsen)."},
    {"id": "pmo", "label": "PMO (Phosphorodiamidate Morpholino)", "description": "Steric blocker; splice-switching, no RNase H.",
     "detail": "A non-ionic backbone oligomer where each nucleoside is linked via phosphorodiamidate bonds to morpholine rings. PMOs do not recruit RNase H; instead they sterically block RNA interactions (splice junctions, ribosome binding, miRNA binding). Used in exon-skipping (e.g., eteplirsen) and translational arrest. Requires cell-penetrating peptide (CPP) conjugation for efficient uptake."},
    {"id": "lna_gapmer", "label": "LNA-enhanced Gapmer", "description": "Locked nucleic acid wings boost binding affinity and nuclease resistance.",
     "detail": "A DNA gapmer where the flanking wings contain Locked Nucleic Acids (LNA) \u2014 bicyclic RNA analogues with a methylene bridge locking the ribose in a C3\u2032-endo conformation. Each LNA substitution raises Tm by ~2\u2032-8\u2032C, dramatically increasing target affinity. LNA gapmers also have enhanced nuclease resistance. Used in miravirsen (anti-miR-122) and bepetamers. Higher off-target risk due to increased potency."},
    {"id": "2ome", "label": "2\u2032-O-Methoxyethyl (2\u2032-OMe)", "description": "Steric blocker; splicing modulation and miRNA inhibition.",
     "detail": "A ribose-modified oligonucleotide where the 2\u2032-OH is replaced with a methoxyethyl group. 2\u2032-OMe ASOs sterically block RNA interactions and are commonly used for splice-switching and miRNA inhibition. They have good nuclease resistance, low toxicity, and are often used in combination (e.g., morpholino-2\u2032-OMe mixmers). Lower binding affinity than LNA but fewer off-target effects."},
]

MODIFICATION_OPTIONS = [
    {"id": "phosphorothioate", "label": "Phosphorothioate (PS) backbone", "description": "Increases nuclease resistance and protein binding.",
     "detail": "Replaces one non-bridging oxygen in the phosphodiester backbone with sulfur. PS linkages dramatically increase nuclease resistance and promote protein binding (e.g., to albumin), extending plasma half-life from minutes to hours. However, PS backbone can increase off-target binding to unintended RNA sequences and may activate complement pathways at high doses. Most ASO drugs incorporate full or partial PS backbones."},
    {"id": "lna_wings", "label": "LNA wings (5\u2032 + 3\u2032)", "description": "Locked nucleic acids at terminal positions for higher Tm.",
     "detail": "Locked Nucleic Acid (LNA) modifications placed at the 5\u2032 and 3\u2032 ends of the oligonucleotide. Each LNA substitution raises the melting temperature (Tm) by 2\u2032-8\u2032C, increasing binding affinity to the target RNA. LNA wings also provide strong nuclease resistance at terminal positions. Typically used in gapmer wings (2-3 LNA at each end). Excessive LNA use can increase off-target activity due to hyper-stabilized binding."},
    {"id": "2omemod", "label": "2\u2032-OMe wing modifications", "description": "Ribose modification at terminal positions.",
     "detail": "2\u2032-O-Methoxyethyl or 2\u2032-O-Methyl modifications at the 5\u2032 and 3\u2032 wings. These RNA-like modifications increase nuclease resistance, improve binding affinity (Tm increase ~1\u2032-2\u2032C per substitution), and reduce immune stimulation compared to unmodified DNA. Commonly used in gapmer wings as a lower-cost alternative to LNA. Well-tolerated clinically with a favorable safety profile."},
    {"id": "pmo_core", "label": "PMO core", "description": "Non-ionic backbone; splice-switching.",
     "detail": "Phosphorodiamidate Morpholino (PMO) modifications at the central region. PMOs are non-ionic, avoiding non-specific protein interactions and reducing toxicity. They work by steric blocking rather than RNase H recruitment. The PMO core is used in splice-switching ASOs (e.g., exon-skipping for DMD) where you want to block splice junctions without degrading the RNA. Requires CPP conjugation (e.g., Vivolen/PP-PMO) for cellular uptake."},
    {"id": "pna_clamp", "label": "PNA clamp (flanking)", "description": "Peptide nucleic acid clamps to block nuclease access.",
     "detail": "Peptide Nucleic Acid (PNA) modifications flanking the ASO. PNAs have a peptide-like backbone instead of sugar-phosphate, making them extremely resistant to nucleases and proteases. PNA clamps create a 'steric shield' around the ASO core, protecting it from exonuclease degradation. They also increase binding affinity (Tm ~1\u2032C per base). PNA synthesis is expensive and delivery is challenging \u2014 typically used in research or specialized applications."},
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
    exons: list[dict],
) -> list[dict]:
    """Generate candidate ASOs targeting the selected exon's splice junctions.

    Uses real exon coordinates (start/end/length) from Ensembl rather than
    splitting the CDS evenly, so a candidate labeled "Exon 5" actually
    targets real exon 5.
    """
    candidates = []
    if not mrna_sequence or len(exons) < 2:
        return candidates

    seq = mrna_sequence.upper()
    seq_len = len(seq)

    # Compute CDS-relative offsets for each exon using real genomic lengths.
    # Ensembl exon lengths include UTR regions, so we proportionally map
    # each exon's share of the CDS based on its genomic length relative
    # to the total genomic span of all exons.
    total_genomic = sum(e.get("length", 0) for e in exons)
    if total_genomic == 0:
        return candidates

    # Build cumulative CDS offset map: exon_index -> (cds_start, cds_end)
    exon_cds_map: list[tuple[int, int]] = []
    cursor = 0
    for exon in exons:
        exon_genomic_len = exon.get("length", 0)
        # Proportional CDS contribution for this exon
        cds_contribution = round(seq_len * exon_genomic_len / total_genomic)
        cds_start = cursor
        cds_end = cursor + cds_contribution
        exon_cds_map.append((cds_start, cds_end))
        cursor = cds_end

    # Clamp the last exon's end to the actual sequence length to avoid
    # floating-point rounding drift
    if exon_cds_map:
        last_start, _ = exon_cds_map[-1]
        exon_cds_map[-1] = (last_start, seq_len)

    exon_count = len(exons)

    # Determine the CDS region for the target exon
    if target_exon_index is not None and 0 < target_exon_index <= exon_count:
        exon_start, exon_end = exon_cds_map[target_exon_index - 1]
    else:
        # Default to middle of CDS
        exon_start = seq_len // 3
        exon_end = 2 * seq_len // 3

    # Generate candidates with sliding window across exon + flanking region.
    # Flank 10 nt into adjacent exons to capture splice junctions.
    flank = min(10, aso_length // 2)
    search_start = max(0, exon_start - flank)
    search_end = min(seq_len - aso_length, exon_end + flank)

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

        # Composite quality score (0-100)
        gc_score = max(0, 100 - abs(gc - 0.50) * 400)
        tm_score = max(0, 100 - abs(tm - 52) * 3)
        sc_penalty = sc * 200
        pg_penalty = pg * 15
        quality = max(0, min(100, gc_score * 0.35 + tm_score * 0.45 - sc_penalty - pg_penalty))

        # Describe which part of the exon this candidate targets
        relative_pos = offset - exon_start
        if relative_pos < 0:
            region_label = f"Exon {target_exon_index or '?'} 5' flank {relative_pos}"
        elif relative_pos >= (exon_end - exon_start - aso_length):
            region_label = f"Exon {target_exon_index or '?'} 3' flank +{relative_pos}"
        else:
            region_label = f"Exon {target_exon_index or '?'} offset +{relative_pos}"

        candidates.append({
            "sequence": candidate_seq,
            "length": aso_length,
            "gcContent": round(gc * 100, 1),
            "meltingTemp": tm,
            "selfComplementScore": round(sc, 4),
            "polygTracts": pg,
            "qualityScore": round(quality, 1),
            "targetRegion": region_label,
            "chemistry": chemistry,
            "modifications": modifications,
        })

    # Sort by quality descending, return top 10
    candidates.sort(key=lambda c: c["qualityScore"], reverse=True)
    return candidates[:10]
