"""
Gene Upregulation design pipeline backend service.

Generates ASO candidates for TG02 mechanisms (Gene Activation /
Upregulation):

- A3   saRNA         — promoter-targeted 21-mer dsRNA duplexes
- A4   uORF_block    — steric-blocking ASOs at 5' UTR / start codon
- A5   poison_exon   — splice-junction ASOs for NMD suppression
- A6   NAT_silencing — RNase H1 gapmers targeting antisense transcripts

Reuses biophysical scoring helpers from ``gene_silencing_service``.
"""

from __future__ import annotations

import logging
import math
from collections import Counter

from services.gene_silencing_service import (
    get_target_analysis,
    _calc_gc,
    _calc_tm,
    _self_complement_mfe,
    _polyg_score,
    _cpg_count,
    _longest_homopolymer,
    _purine_content,
    _sequence_complexity,
    _gc_skew,
    _molecular_weight,
    _extinction_coefficient,
    _nuclease_resistance_score,
    _cellular_uptake_score,
    _bbb_crossing_score,
    _synthesis_difficulty,
    _off_target_risk,
    _immune_stimulation_risk,
    _duplex_stability,
    _reverse_complement,
    _target_duplex_energy,
    CHEMISTRY_OPTIONS,
    MODIFICATION_OPTIONS,
    LENGTH_RANGE,
    MIN_GC,
    MAX_GC,
)

logger = logging.getLogger(__name__)

UPREGULATION_CHEMISTRY_OPTIONS = [
    {"id": "gapmer", "label": "DNA Gapmer (2-10-2)", "description": "RNase H1-recruiting; suitable for NAT silencing (A6).",
     "detail": "Central DNA gap recruits RNase H1. For NAT silencing, the ASO targets the antisense transcript. Validated in AON-based upregulation (e.g., Ataluren-class precedents)."},
    {"id": "lna_gapmer", "label": "LNA-enhanced Gapmer", "description": "High-affinity RNase H1 recruitment; NAT silencing.",
     "detail": "LNA wings boost binding affinity (~2-8 C per substitution). Best for high-specificity NAT targeting where allele discrimination matters."},
    {"id": "pmo", "label": "PMO (Phosphorodiamidate Morpholino)", "description": "Steric blocker; ideal for uORF blocking (A4) and splice modulation (A5).",
     "detail": "Non-ionic backbone blocks RNA interactions without degradation. Gold standard for uORF steric blocking and exon skipping."},
    {"id": "2ome", "label": "2'-O-Methoxyethyl (2'-OMe)", "description": "Steric blocker; uORF and splice modulation.",
     "detail": "2'-O-Me modifications increase nuclease resistance and reduce immunostimulation. Compatible with steric-blocking and splice-switching."},
    {"id": "sirna", "label": "siRNA duplex (21-mer)", "description": "For saRNA (A3) activation — double-stranded 21-mer duplex.",
     "detail": "Small activating RNAs are 21-mer dsRNA duplexes that target promoter-associated RNAs. Delivered as a duplex guide/passenger pair."},
]

UPREGULATION_LENGTH_RANGE = {"min": 18, "max": 25, "default": 21, "step": 1}

UPREGULATION_MECHANISM_DESIGN = {
    "A3": {
        "label": "saRNA (Small Activating RNA)",
        "target_region": "Promoter (-100 to -1000 bp from TSS)",
        "preferred_chemistry": ["sirna", "lna_gapmer", "gapmer"],
        "forced_length": 21,
        "notes": "saRNA targets promoter-associated RNAs to activate transcription. Requires 5' flanking promoter sequence. CDS-derived candidates are approximate; verify with promoter-specific design.",
    },
    "A4": {
        "label": "uORF-blocking ASO",
        "target_region": "5' UTR (uAUG / uORF start site)",
        "preferred_chemistry": ["pmo", "2ome", "lna_gapmer"],
        "notes": "Targets uORF start sites in the 5' UTR to relieve translational repression. Steric-blocking chemistries (PMO/2'-OMe) are preferred — they block ribosome stalling at uORFs without cleaving the transcript.",
    },
    "A5": {
        "label": "TANGO: Poison Exon Skipping / NMD Suppression",
        "target_region": "Exon-exon junctions (poison exon splice sites)",
        "preferred_chemistry": ["pmo", "2ome", "lna_gapmer"],
        "notes": "Masks poison exon splice sites to prevent inclusion of PTC-containing exons, reducing nonsense-mediated decay. Splice-modulating ASOs at exon-exon junctions are most effective. Limited to steric-blocking chemistries only.",
        "tango_fields": [
            {"id": "target_poison_exon", "label": "Target Poison Exon", "type": "dropdown", "description": "Select the poison exon to skip"},
            {"id": "splice_element", "label": "Splice Element", "type": "dropdown", "description": "Select the splice element to mask (5'SS, 3'SS, BPS, or ISS-ISE)"},
        ],
    },
    "A6": {
        "label": "NAT Silencing (RNase H1 Gapmer)",
        "target_region": "Natural antisense transcript (overlapping lncRNA)",
        "preferred_chemistry": ["gapmer", "lna_gapmer"],
        "notes": "Degrades inhibitory antisense lncRNAs that repress the sense gene. Gapmer/LNA chemistry recruits RNase H1 to cleave the NAT transcript. CDS-derived candidates approximate the target complement.",
    },
}


def _mechanism_scoring_adjustments(
    mechanism_id: str,
    chemistry: str,
    modifications: list[str],
    gc: float,
    tm: float,
    seq: str,
) -> dict:
    """Compute upregulation-specific design notes."""
    mech_notes = ""

    if mechanism_id == "A3":
        if chemistry == "sirna":
            mech_notes = "A3 (saRNA): siRNA duplex chemistry is the native modality for transcriptional activation via promoter targeting."
        elif chemistry in ("gapmer", "lna_gapmer"):
            mech_notes = "A3 (saRNA): Gapmer/LNA can activate via RNA-mediated transcriptional activation (RNAa) with promoter proximity."
        elif chemistry in ("pmo", "2ome"):
            mech_notes = "A3 (saRNA): Steric-blocking chemistries are less suitable for promoter activation which requires RNA duplex formation."

    elif mechanism_id == "A4":
        if chemistry in ("pmo", "2ome"):
            mech_notes = "A4 (uORF block): PMO/2'-OMe sterically block ribosome stalling at uORFs — ideal for translational upregulation."
        elif chemistry == "lna_gapmer":
            mech_notes = "A4 (uORF block): LNA gapmer can block with high affinity, though RNase H activity is secondary."
        elif chemistry == "gapmer":
            mech_notes = "A4 (uORF block): Gapmers cleave mRNA — less ideal for steric uORF blocking, but may work if the NAT is the target."

    elif mechanism_id == "A5":
        if chemistry in ("pmo", "2ome"):
            mech_notes = "A5 (TANGO): PMO/2'-OMe sterically block splice sites at exon junctions without transcript cleavage — optimal for poison exon skipping."
        elif chemistry == "lna_gapmer":
            mech_notes = "A5 (TANGO): LNA gapmer offers high affinity for precise splice-junction targeting."
        elif chemistry == "gapmer":
            mech_notes = "A5 (TANGO): Gapmers cleave mRNA — not recommended for TANGO which requires steric blocking for precise splice control."

    elif mechanism_id == "A6":
        if chemistry in ("gapmer", "lna_gapmer"):
            mech_notes = "A6 (NAT silencing): Gapmer/LNA recruits RNase H1 to degrade the antisense lncRNA transcript."
        elif chemistry in ("pmo", "2ome"):
            mech_notes = "A6 (NAT silencing): Steric-blocking chemistries don't recruit RNase H — not optimal for NAT transcript degradation."

    else:
        mech_notes = "No mechanism-specific adjustments."

    return {"mechNotes": mech_notes}


def generate_upregulation_candidates(
    ensembl_gene_id: str,
    mechanism_id: str,
    aso_length: int,
    chemistry: str,
    modifications: list[str],
    defect_type: str | None = None,
    known_regulatory_element: str | None = None,
    gene_symbol: str = "",
    organism: str = "homo_sapiens",
    target_poison_exon: str | None = None,
    splice_element: str | None = None,
) -> list[dict]:
    """Generate ASO candidates for upregulation mechanisms.

    Uses the CDS sequence from Ensembl and applies mechanism-specific
    targeting logic. For mechanisms that require sequence context beyond
    the CDS (promoter, 5' UTR, NAT), appropriate design notes are included.
    """
    if mechanism_id not in UPREGULATION_MECHANISM_DESIGN:
        raise ValueError(f"Unsupported upregulation mechanism: {mechanism_id}")

    target = get_target_analysis(ensembl_gene_id, gene_symbol, organism)

    candidates = []
    if not target.get("mrnaSequence") or len(target.get("exons", [])) < 1:
        return candidates

    seq = target["mrnaSequence"].upper()
    seq_len = len(seq)
    exons = target["exons"]
    design = UPREGULATION_MECHANISM_DESIGN[mechanism_id]

    # Override length for saRNA
    effective_length = design.get("forced_length", aso_length)

    flank = min(10, effective_length // 2)
    step = max(1, effective_length // 3)
    search_start = 0
    search_end = max(0, seq_len - effective_length)

    # Mechanism-specific search region
    target_label = "Full transcript"
    if mechanism_id == "A4":
        # uORF blocking: focus on 5' region near start codon
        search_end = min(search_end, 90)
        target_label = "5' UTR / Start region"
    elif mechanism_id == "A5":
        # Poison exon: focus on exon junctions
        target_label = "Exon junctions"
    elif mechanism_id == "A3":
        # saRNA: focus on 5' promoter-proximal region of the transcript
        search_end = min(search_end, 90)
        target_label = "Promoter-proximal 5' region"
    elif mechanism_id == "A6":
        # NAT silencing: scan full transcript
        target_label = "Full transcript (NAT complement)"

    seen = set()

    # Build exon CDS mapping (same as gene_silencing_service)
    total_genomic = sum(e.get("length", 0) for e in exons)
    if total_genomic == 0:
        return candidates

    exon_cds_map = []
    cursor = 0
    for exon in exons:
        cds_contribution = round(seq_len * exon.get("length", 0) / total_genomic)
        exon_cds_map.append((cursor, cursor + cds_contribution))
        cursor += cds_contribution
    if exon_cds_map:
        last_start, _ = exon_cds_map[-1]
        exon_cds_map[-1] = (last_start, seq_len)

    is_poison_exon = mechanism_id == "A5"
    
    # TANGO-specific: Parse target poison exon index
    target_exon_idx = None
    if is_poison_exon and target_poison_exon:
        try:
            # Format: "exon_1", "exon_2", etc.
            target_exon_idx = int(target_poison_exon.replace("exon_", "")) - 1
        except (ValueError, AttributeError):
            pass

    for offset in range(search_start, search_end + 1, step):
        candidate_seq = seq[offset : offset + effective_length]
        if len(candidate_seq) < effective_length or candidate_seq in seen:
            continue
        seen.add(candidate_seq)

        gc = _calc_gc(candidate_seq)
        if gc < MIN_GC or gc > MAX_GC:
            continue

        tm = _calc_tm(candidate_seq)
        self_mfe = _self_complement_mfe(candidate_seq)
        pg = _polyg_score(candidate_seq)
        cpg = _cpg_count(candidate_seq)

        mech_adj = _mechanism_scoring_adjustments(
            mechanism_id, chemistry, modifications, gc, tm, candidate_seq
        )

        # Target duplex energy — primary ranking metric
        target_region_seq = seq[offset : offset + effective_length]
        duplex_energy = _target_duplex_energy(candidate_seq, target_region_seq)

        # Upregulation-specific defect notes
        defect_notes = "No defect-specific adjustments applied."
        upreg_defect = (defect_type or "").lower().strip()
        if "haploinsufficiency" in upreg_defect or "loss-of-function" in upreg_defect or "lof" in upreg_defect:
            defect_notes = "Underexpression / haploinsufficiency: upregulation is the appropriate therapeutic strategy."
        elif "dominant" in upreg_defect:
            defect_notes = "Dominant-negative: consider allele-specific upregulation of the wild-type copy."

        # Determine exon number
        exon_number = None
        exon_length = None
        for ei, (es, ee) in enumerate(exon_cds_map):
            if es <= offset < ee:
                exon_number = ei + 1
                exon_length = exons[ei].get("length") if ei < len(exons) else None
                break

        region_label = f"{target_label} offset +{offset}"
        if is_poison_exon and exon_number:
            region_label = f"Exon {exon_number} junction offset +{offset}"

        nuc_res = _nuclease_resistance_score(chemistry, modifications)
        uptake = _cellular_uptake_score(chemistry, effective_length)
        bbb = _bbb_crossing_score(chemistry, effective_length, modifications)
        synth = _synthesis_difficulty(candidate_seq, chemistry, modifications)
        off_target = _off_target_risk(candidate_seq, _sequence_complexity(candidate_seq))
        immune = _immune_stimulation_risk(candidate_seq, chemistry)

        complexity = _sequence_complexity(candidate_seq)
        skew = _gc_skew(candidate_seq)
        mw = _molecular_weight(candidate_seq)
        ec = _extinction_coefficient(candidate_seq)
        ds = _duplex_stability(gc, tm, effective_length)

        # TANGO-specific scoring and fields
        tango_fields = {}
        if is_poison_exon:
            # Splice masking score (higher for splice elements)
            splice_masking_score = 0.0
            if splice_element:
                if splice_element == "5ss":
                    splice_masking_score = 0.85 + (0.1 * (1 - abs(gc - 0.5)))
                elif splice_element == "3ss":
                    splice_masking_score = 0.80 + (0.1 * (1 - abs(gc - 0.5)))
                elif splice_element == "bps":
                    splice_masking_score = 0.75 + (0.1 * (1 - abs(gc - 0.5)))
                elif splice_element == "iss_ise":
                    splice_masking_score = 0.70 + (0.1 * (1 - abs(gc - 0.5)))
            
            # NMD suppression prediction (based on splice masking score)
            predicted_nmd_suppression = min(0.95, splice_masking_score * 0.9)
            
            # Fold restoration estimate (based on NMD suppression)
            estimated_fold_restoration = predicted_nmd_suppression * 0.8
            
            # Canonical off-splice risk (lower is better)
            canonical_off_splice_hits = 0
            if target_exon_idx is not None and exon_number:
                # Check if candidate is near the target exon
                if abs(exon_number - (target_exon_idx + 1)) <= 1:
                    canonical_off_splice_hits = 0
                else:
                    canonical_off_splice_hits = 1
            
            tango_fields = {
                "spliceMaskingScore": round(splice_masking_score, 3),
                "predictedNmdSuppression": round(predicted_nmd_suppression, 3),
                "estimatedFoldRestoration": round(estimated_fold_restoration, 3),
                "canonicalOffSpliceHits": canonical_off_splice_hits,
                "targetPoisonExon": target_poison_exon or "",
                "spliceElement": splice_element or "",
            }

        candidates.append({
            "sequence": candidate_seq,
            "length": effective_length,
            "gcContent": round(gc, 4),
            "meltingTempC": tm,
            "selfStructureMfe": self_mfe,
            "polygTracts": pg,
            "targetDuplexEnergy": duplex_energy,
            "targetRegion": region_label,
            "mechanismId": mechanism_id,
            "chemistry": chemistry,
            "modifications": modifications,
            "exonNumber": exon_number,
            "exonLength": exon_length,
            "mechanismNotes": mech_adj["mechNotes"],
            "cpgCount": cpg,
            "longestHomopolymer": _longest_homopolymer(candidate_seq),
            "purineContent": _purine_content(candidate_seq),
            "sequenceComplexity": complexity,
            "gcSkew": skew,
            "molecularWeight": mw,
            "extinctionCoefficient": ec,
            "nucleaseResistance": nuc_res,
            "cellularUptake": uptake,
            "bbbCrossing": bbb,
            "synthesisDifficulty": synth,
            "offTargetRisk": off_target,
            "immuneStimulation": immune,
            "duplexStability": ds,
            "defectType": defect_type or "",
            "defectNotes": defect_notes,
            "knownRegulatoryElement": known_regulatory_element or "",
            **tango_fields,
        })

    # Sort by target duplex energy (most negative = strongest binding)
    candidates.sort(key=lambda c: c["targetDuplexEnergy"])

    return candidates


def get_upregulation_design_options() -> dict:
    """Return available chemistry, modification, and length options
    for upregulation mechanisms.
    """
    return {
        "chemistryOptions": UPREGULATION_CHEMISTRY_OPTIONS,
        "modificationOptions": MODIFICATION_OPTIONS,
        "lengthRange": UPREGULATION_LENGTH_RANGE,
        "mechanisms": UPREGULATION_MECHANISM_DESIGN,
    }
