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
    {"id": "sirna", "label": "siRNA duplex", "description": "Duplex RNA guide/passenger design for RISC-mediated mRNA cleavage.",
     "detail": "A 21\u201323 nt duplex in which the antisense guide strand is loaded into RISC to direct AGO2-mediated cleavage of the complementary mRNA target."},
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


def _cpg_count(seq: str) -> int:
    """Count CpG dinucleotides (immune stimulation risk)."""
    return len(re.findall(r"CG", seq.upper()))


def _longest_homopolymer(seq: str) -> int:
    """Length of the longest homopolymer run."""
    seq = seq.upper()
    if not seq:
        return 0
    max_run = 1
    current = 1
    for i in range(1, len(seq)):
        if seq[i] == seq[i - 1]:
            current += 1
            max_run = max(max_run, current)
        else:
            current = 1
    return max_run


def _purine_content(seq: str) -> float:
    """Fraction of purines (A+G) in the sequence."""
    seq = seq.upper()
    if not seq:
        return 0.0
    purines = sum(1 for b in seq if b in "AG")
    return round(purines / len(seq), 3)


def _sequence_complexity(seq: str) -> float:
    """Shannon entropy-based complexity score (0-1). Higher = more unique."""
    seq = seq.upper()
    if not seq:
        return 0.0
    from collections import Counter
    import math
    counts = Counter(seq)
    n = len(seq)
    entropy = -sum((c / n) * math.log2(c / n) for c in counts.values())
    max_entropy = math.log2(4)  # 4 nucleotides
    return round(entropy / max_entropy, 3)


def _gc_skew(seq: str) -> float:
    """GC skew: (G-C)/(G+C). Measures strand bias."""
    seq = seq.upper()
    g = seq.count("G")
    c = seq.count("C")
    if g + c == 0:
        return 0.0
    return round((g - c) / (g + c), 3)


def _estimated_binding_energy(gc_content: float, tm: float) -> float:
    """Estimated binding free energy (kcal/mol) from GC% and Tm."""
    # Simplified nearest-neighbor approximation
    # ΔG ≈ -RT ln(K) where K relates to Tm
    # Using empirical: ΔG ≈ -0.01 * Tm * seq_length (rough kcal/mol per bp)
    import math
    R = 1.987e-3  # kcal/(mol·K)
    Tm_K = tm + 273.15
    # Rough estimate: more negative = more stable
    dG = -0.36 * gc_content - 0.0048 * Tm_K
    return round(dG * 21, 1)  # scale to ~21-mer length


def _reverse_complement(seq: str) -> str:
    """Return the antisense oligonucleotide sequence for an RNA target site."""
    return seq.upper().translate(str.maketrans("ATGC", "TACG"))[::-1]


def _mechanism_design_constraints(mechanism_id: str, aso_length: int, chemistry: str) -> tuple[int, str, str]:
    """Validate mechanism-specific inputs and return effective design settings.

    Some mechanisms cannot be designed from a coding mRNA sequence alone.
    Refusing those requests is intentional: returning a CDS-derived sequence for
    a microRNA or promoter-associated-RNA mechanism would be biologically wrong.
    """
    if mechanism_id == "A1":
        return aso_length, chemistry, "mrna"
    if mechanism_id == "A2":
        return aso_length, chemistry, "translation_start"
    if mechanism_id == "A21":
        return 21, "sirna", "mrna"
    if mechanism_id == "A12":
        raise ValueError(
            "Anti-miR design requires the mature pathogenic miRNA sequence; a target gene CDS cannot be used as its substitute."
        )
    if mechanism_id == "A15":
        raise ValueError(
            "Promoter-targeting ASO design requires a validated promoter-associated RNA sequence; a coding mRNA sequence cannot be used as its substitute."
        )
    raise ValueError(f"Unsupported gene-silencing mechanism: {mechanism_id}")


def generate_candidates(
    target_exon_indices: list[int] | None,
    aso_length: int,
    chemistry: str,
    modifications: list[str],
    mrna_sequence: str | None,
    exons: list[dict],
    mechanism_id: str,
) -> list[dict]:
    """Generate candidate ASOs for the selected mechanism and target region.

    Uses real exon coordinates (start/end/length) from Ensembl rather than
    splitting the CDS evenly, so a candidate labeled "Exon 5" targets that
    exon. When no exon list is supplied, candidates are generated across all
    exons for total-transcript knockdown.
    """
    candidates = []
    if not mrna_sequence or len(exons) < 2:
        return candidates

    aso_length, chemistry, targeting_mode = _mechanism_design_constraints(
        mechanism_id, aso_length, chemistry
    )

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

    # A2 sterically blocks translation, so it must cover the 5′ initiation
    # region rather than scanning arbitrary exons. The other supported
    # mechanisms use selected exon(s), or the whole transcript when none is
    # specified.
    if targeting_mode == "translation_start":
        search_ranges = [(0, min(seq_len - aso_length, 90), "5′ translation-initiation region")]
    else:
        search_ranges = []

    # A missing list means total-transcript knockdown. Invalid exon numbers
    # are ignored rather than silently using an unrelated default region.
    is_total_knockdown = target_exon_indices is None
    requested_exons = (
        list(range(1, exon_count + 1))
        if is_total_knockdown
        else target_exon_indices
    )
    target_indices = sorted({index for index in requested_exons if 0 < index <= exon_count})
    if not target_indices and targeting_mode != "translation_start":
        return candidates

    seen = set()
    # Generate candidates with a small flanking window. Each selected exon is
    # scanned independently for mRNA-targeting mechanisms.
    flank = min(10, aso_length // 2)
    step = max(1, aso_length // 3)
    if targeting_mode != "translation_start":
        for target_exon_index in target_indices:
            exon_start, exon_end = exon_cds_map[target_exon_index - 1]
            search_ranges.append((
                max(0, exon_start - flank),
                min(seq_len - aso_length, exon_end + flank),
                f"Exon {target_exon_index}",
            ))

    for search_start, search_end, target_label in search_ranges:
        if search_end < search_start:
            continue

        exon_start = exon_end = None
        if targeting_mode != "translation_start" and target_label.startswith("Exon "):
            ei = int(target_label.removeprefix("Exon "))
            exon_start, exon_end = exon_cds_map[ei - 1]

        for offset in range(search_start, search_end + 1, step):
            candidate_seq = seq[offset : offset + aso_length]
            if len(candidate_seq) < aso_length or candidate_seq in seen:
                continue
            seen.add(candidate_seq)

            gc = _calc_gc(candidate_seq)
            if gc < MIN_GC or gc > MAX_GC:
                continue

            tm = _calc_tm(candidate_seq)
            sc = _self_complement_score(candidate_seq)
            pg = _polyg_score(candidate_seq)
            cpg = _cpg_count(candidate_seq)

            # Composite quality score (0-100)
            gc_score = max(0, 100 - abs(gc - 0.50) * 400)
            tm_score = max(0, 100 - abs(tm - 52) * 3)
            sc_penalty = sc * 200
            pg_penalty = pg * 15

            # Chemistry-specific bonuses
            chem_bonus = 0
            if chemistry == "lna_gapmer":
                chem_bonus += 5  # LNA boosts binding affinity
            elif chemistry == "2ome":
                chem_bonus += 3  # 2'-OMe moderate affinity boost
            elif chemistry == "pmo":
                chem_bonus -= 3  # PMO lower uptake without CPP
            elif chemistry == "sirna":
                chem_bonus += 2  # siRNA RISC amplification

            # Modification bonuses
            mod_bonus = 0
            if "phosphorothioate" in modifications:
                mod_bonus += 4  # PS increases nuclease resistance
            if "lna_wings" in modifications:
                mod_bonus += 5  # LNA wings boost Tm significantly
            if "2omemod" in modifications:
                mod_bonus += 3  # 2'-OMe wings moderate boost
            if "pmo_core" in modifications:
                mod_bonus += 2  # PMO core for splice-switching
            if "pna_clamp" in modifications:
                mod_bonus += 3  # PNA clamp protects from exonucleases

            # CpG penalty (immune stimulation risk)
            cpg_penalty = max(0, (cpg - 2)) * 5

            quality = max(0, min(100, gc_score * 0.30 + tm_score * 0.40 - sc_penalty - pg_penalty + chem_bonus + mod_bonus - cpg_penalty))

            if is_total_knockdown:
                region_label = f"Full Transcript offset +{offset}"
                exon_num = None
                exon_len = None
            elif targeting_mode == "translation_start":
                region_label = f"{target_label} offset +{offset}"
                exon_num = None
                exon_len = None
            else:
                relative_pos = offset - exon_start
                if relative_pos < 0:
                    region_label = f"{target_label} 5' flank {relative_pos}"
                elif offset + aso_length > exon_end:
                    region_label = f"{target_label} 3' flank +{relative_pos}"
                else:
                    region_label = f"{target_label} offset +{relative_pos}"
                exon_num = int(target_label.removeprefix("Exon ")) if target_label.startswith("Exon ") else None
                exon_len = (exon_end - exon_start) if (exon_start is not None and exon_end is not None) else None

            candidates.append({
                "sequence": _reverse_complement(candidate_seq),
                "length": aso_length,
                "gcContent": round(gc * 100, 1),
                "meltingTemp": tm,
                "selfComplementScore": round(sc, 4),
                "polygTracts": pg,
                "qualityScore": round(quality, 1),
                "targetRegion": region_label,
                "chemistry": chemistry,
                "modifications": modifications,
                "exonNumber": exon_num,
                "exonLength": exon_len,
                "gcScore": round(gc_score, 1),
                "tmScore": round(tm_score, 1),
                "selfComplementPenalty": round(sc_penalty, 1),
                "polygPenalty": round(pg_penalty, 1),
                "chemBonus": chem_bonus,
                "modBonus": mod_bonus,
                "cpgCount": cpg,
                "cpgPenalty": cpg_penalty,
                "longestHomopolymer": _longest_homopolymer(candidate_seq),
                "purineContent": _purine_content(candidate_seq),
                "sequenceComplexity": _sequence_complexity(candidate_seq),
                "gcSkew": _gc_skew(candidate_seq),
                "bindingEnergy": _estimated_binding_energy(gc, tm),
            })

    # Sort by quality descending, return top 10
    candidates.sort(key=lambda c: c["qualityScore"], reverse=True)
    return candidates[:10]
