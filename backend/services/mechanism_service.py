"""
Scores mechanisms within a therapeutic goal against user-provided inputs.

Implements:
- Gene Silencing (TG01): A1, A2, A12, A15, A21
- Gene Activation / Upregulation (TG02): A3, A4, A5, A6, A22, A23
- RNA Processing Modulation (TG04): A7, A8, A9, A10, A11

The eligibility/scope compatibility tables below are read directly from
each mechanism's rule.json (suitableVariantTypes / transcriptRequirement)
— they are not invented.

The delivery-context scoring is explicitly a separate, softer signal: it's
a general chemistry/delivery precedent from known approved ASO drugs
(e.g. GalNAc-siRNA for liver, intrathecal gapmers for CNS), not a field
that exists in the mechanism dataset itself. It's surfaced to the user
labeled as a "general precedent," not as data-backed fact, to avoid
implying more certainty than we actually have.
"""

from __future__ import annotations

import json
import os
import re

RULEBOOKS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "rulebooks")

# ---------------------------------------------------------------------------
# Shared constants
# ---------------------------------------------------------------------------

DELIVERY_CONTEXTS = {
    "cns": "CNS / intrathecal",
    "systemic": "Systemic / subcutaneous",
    "liver": "Liver-targeted",
    "local_intramuscular": "Local / intramuscular",
    "ocular": "Ocular",
    "other": "Other / not yet determined",
}

# NOT from the mechanism dataset — a general precedent heuristic from known
# approved ASO/siRNA drug delivery routes. Soft tie-breaker only, scored
# 0-2, clearly labeled as such in the API response.
DELIVERY_PRECEDENT = {
    "A1": {"cns": 2, "systemic": 2, "liver": 1, "local_intramuscular": 1, "ocular": 1, "other": 0},
    "A2": {"cns": 1, "local_intramuscular": 2, "systemic": 1, "liver": 0, "ocular": 1, "other": 0},
    "A12": {"systemic": 1, "liver": 1, "cns": 0, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A15": {"systemic": 1, "local_intramuscular": 1, "cns": 0, "liver": 0, "ocular": 0, "other": 0},
    "A21": {"liver": 2, "systemic": 2, "cns": 1, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A7": {"systemic": 1, "local_intramuscular": 2, "cns": 1, "ocular": 1, "liver": 0, "other": 0},
    "A8": {"systemic": 1, "cns": 2, "local_intramuscular": 0, "liver": 0, "ocular": 0, "other": 0},
    "A9": {"systemic": 1, "ocular": 2, "cns": 1, "local_intramuscular": 0, "liver": 0, "other": 0},
    "A10": {"systemic": 1, "ocular": 1, "cns": 1, "local_intramuscular": 0, "liver": 0, "other": 0},
    "A11": {"systemic": 1, "liver": 0, "cns": 0, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A3": {"cns": 2, "systemic": 1, "liver": 1, "local_intramuscular": 1, "ocular": 0, "other": 0},
    "A4": {"cns": 1, "systemic": 2, "liver": 1, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A5": {"cns": 1, "systemic": 1, "liver": 0, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A6": {"systemic": 1, "liver": 1, "cns": 0, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A22": {"systemic": 1, "liver": 2, "cns": 0, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A23": {"cns": 1, "systemic": 1, "liver": 1, "local_intramuscular": 1, "ocular": 0, "other": 0},
    # TG03 — RNA Editing / Correction
    "A13": {"cns": 2, "systemic": 2, "liver": 1, "local_intramuscular": 1, "ocular": 2, "other": 0},
    "A16": {"systemic": 2, "liver": 2, "cns": 1, "local_intramuscular": 0, "ocular": 0, "other": 0},
    "A17": {"cns": 2, "systemic": 1, "liver": 1, "local_intramuscular": 0, "ocular": 2, "other": 0},
    "A18": {"systemic": 2, "cns": 1, "liver": 1, "local_intramuscular": 0, "ocular": 1, "other": 0},
    "A19": {"cns": 2, "systemic": 1, "liver": 1, "local_intramuscular": 0, "ocular": 1, "other": 0},
    "A20": {"systemic": 2, "local_intramuscular": 1, "liver": 1, "cns": 0, "ocular": 1, "other": 0},
    # TG05 — RNA Neutralization
    # A14 steric repeat masking: PMO/steric blockers are delivered systemically
    # for muscle (myotonic dystrophy) or intrathecally for CNS (C9orf72 ALS/FTD).
    "A14": {"systemic": 2, "cns": 2, "local_intramuscular": 2, "liver": 0, "ocular": 0, "other": 0},
    # A25 aptamer decoy: systemic exposure typical; Pegaptanib is intravitreal.
    "A25": {"ocular": 2, "systemic": 1, "cns": 0, "liver": 0, "local_intramuscular": 0, "other": 0},
}

# ---------------------------------------------------------------------------
# TG01 — Gene Silencing
# ---------------------------------------------------------------------------

DEFECT_TYPES = {
    "gain_of_function": "Gain-of-function / dominant pathogenic variant",
    "overexpression": "Gene overexpression / oncogene activation",
    "mirna_dysregulation": "Pathogenic microRNA dysregulation",
    "viral_toxic_rna": "Viral RNA / toxic transcript",
}

SILENCING_SCOPES = {
    "total_knockdown": "Total transcript knockdown",
    "allele_specific": "Allele-specific silencing (spare wild-type)",
}

DEFECT_COMPATIBILITY = {
    "A1": {"gain_of_function", "viral_toxic_rna"},
    "A2": {"gain_of_function", "viral_toxic_rna"},
    "A12": {"mirna_dysregulation"},
    "A15": {"overexpression"},
    "A21": {"gain_of_function", "overexpression", "viral_toxic_rna"},
}

SCOPE_COMPATIBILITY = {
    "A1": {"total_knockdown", "allele_specific"},
    "A2": {"total_knockdown"},
    "A12": {"total_knockdown"},
    "A15": {"total_knockdown"},
    "A21": {"total_knockdown", "allele_specific"},
}

GENE_SILENCING_MECHANISM_IDS = ["A1", "A2", "A12", "A15", "A21"]

# ---------------------------------------------------------------------------
# TG02 — Gene Activation / Upregulation
#
# Defect types below are derived directly from each mechanism's real
# suitableVariantTypes / transcriptRequirement text (backend/rulebooks/A*/
# rule.json), same as TG01/TG04 — not invented categories. Two mechanisms
# (A6, A22) both involve microRNAs but in opposite directions: A6 blocks a
# pathogenic miRNA that is repressing the target gene; A22 replaces a
# beneficial miRNA that is itself deficient. They are kept as distinct
# defect types rather than merged, because conflating them would be a
# real biological error, not just imprecise categorization.
# ---------------------------------------------------------------------------

GENE_UPREGULATION_DEFECT_TYPES = {
    "haploinsufficiency": "Haploinsufficiency / reduced gene dosage (general)",
    "poison_exon_inclusion": "Deep intronic or splice-regulatory variant causing poison exon inclusion",
    "nat_mediated_repression": "A validated disease-associated natural antisense transcript (NAT) repressing the gene",
    "uorf_mediated_repression": "A validated inhibitory upstream ORF (uORF) limiting translation",
    "mirna_mediated_repression": "A validated pathogenic microRNA binding site repressing the target transcript",
    "deficient_mirna": "Loss or downregulation of a regulatory (e.g. tumor-suppressive) microRNA itself",
    "epigenetic_promoter_silencing": "Epigenetic silencing or promoter dysfunction reducing transcription",
}

# Derived from each mechanism's suitableVariantTypes field (rule.json)
UPREGULATION_DEFECT_COMPATIBILITY = {
    "A3": {"haploinsufficiency", "poison_exon_inclusion"},
    "A4": {"haploinsufficiency", "nat_mediated_repression"},
    "A5": {"uorf_mediated_repression"},
    "A6": {"haploinsufficiency", "mirna_mediated_repression"},
    "A22": {"deficient_mirna"},
    "A23": {"haploinsufficiency", "epigenetic_promoter_silencing"},
}

GENE_UPREGULATION_MECHANISM_IDS = ["A3", "A4", "A5", "A6", "A22", "A23"]

# ---------------------------------------------------------------------------
# TG04 — RNA Processing Modulation
# ---------------------------------------------------------------------------

SPLICE_DEFECT_TYPES = {
    "exon_skipping_mutation": "Exon-skipping mutation (frameshift / nonsense in target exon)",
    "exon_inclusion_defect": "Exon-inclusion defect (exon not recognized by spliceosome)",
    "cryptic_splice_site": "Cryptic splice-site activation (aberrant donor/acceptor)",
    "pseudoexon_activation": "Deep-intronic pseudoexon activation",
    "apa_dysregulation": "Alternative polyadenylation (APA) dysregulation",
}

SPLICE_DEFECT_COMPATIBILITY = {
    "A7": {"exon_skipping_mutation"},
    "A8": {"exon_inclusion_defect"},
    "A9": {"pseudoexon_activation"},
    "A10": {"cryptic_splice_site"},
    "A11": {"apa_dysregulation"},
}

RNA_PROCESSING_MECHANISM_IDS = ["A7", "A8", "A9", "A10", "A11"]

# ---------------------------------------------------------------------------
# TG03 — RNA Editing / Correction
#
# Editing modality options (the "edit type" the user picks) map onto the
# rulebook mechanisms below. ADAR-based mechanisms share the A→I edit; the
# SMaRT trans-splicing mechanisms share the spliceosomal replacement path.
# ---------------------------------------------------------------------------

EDIT_TYPES = {
    "a_to_i": "A-to-I Editing (ADAR Recruitment)",
    "c_to_u": "C-to-U Editing (APOBEC / RESCUE)",
    "trans_splicing": "Trans-Splicing / Pre-mRNA Repair (SMaRT)",
}

ENZYME_RECRUITMENT = {
    "adar1": "Endogenous ADAR1 (p110/p150)",
    "adar2": "Endogenous ADAR2",
    "exogenous_deaminase": "Exogenous Deaminase (engineered)",
}

MISMATCH_POCKET = {
    "c": "C (A-C Mismatch — High Efficiency)",
    "g": "G",
    "u": "U",
}

SPLICING_DIRECTIONS = {
    "three_prime": "3' Exon Replacement",
    "five_prime": "5' Exon Replacement",
}

EDIT_TYPE_MECHANISMS = {
    "a_to_i": ["A13", "A17", "A18", "A19"],
    "c_to_u": ["A16"],
    "trans_splicing": ["A20"],
}

RNA_EDITING_MECHANISM_IDS = [
    m for group in EDIT_TYPE_MECHANISMS.values() for m in group
]

# Soft heuristic (NOT in the rulebook dataset): baseline tissue expression of
# the endogenous editing enzymes used to execute each edit. ADAR1 is broadly
# expressed (esp. liver/systemic), ADAR2 is CNS- and retina-enriched, and
# APOBEC1 is concentrated in the gut/liver axis. Used only as a small
# tie-breaker and surfaced as a "general reference," like DELIVERY_PRECEDENT.
EDIT_ENZYME_TISSUE_PRECEDENT = {
    "adar1": {"cns": 1, "systemic": 2, "liver": 2, "local_intramuscular": 1, "ocular": 1, "other": 0},
    "adar2": {"cns": 2, "systemic": 1, "liver": 1, "local_intramuscular": 0, "ocular": 2, "other": 0},
    "exogenous_deaminase": {"cns": 1, "systemic": 1, "liver": 1, "local_intramuscular": 1, "ocular": 1, "other": 1},
}


# ---------------------------------------------------------------------------
# TG05 — RNA Neutralization
#
# Neutralization strategies map onto rulebook mechanisms below. A14 is the
# canonical toxic-RNA neutralization mechanism (repeat masking / foci
# disruption). A12 (anti-miR / antagomir) and A25 (RNA aptamer) are shared
# with TG01 / TG09 because they genuinely fit the multi-goal rulebook
# philosophy used elsewhere (A2, A5, A7, A9, A10 each serve two goals).
# ---------------------------------------------------------------------------

NEUTRALIZATION_MODES = {
    "steric_repeat_masking": "Steric Repeat Masking (RNase H-Independent)",
    "microrna_antagomir": "MicroRNA / ncRNA Antagomir",
    "aptamer_decoy": "Aptamer Decoy Sequestration",
}

STERIC_CHEMISTRIES = {
    "pmo": "PMO (Morpholino)",
    "moe_full_ps": "2'-O-MOE Full Phosphorothioate",
    "lna_dna_mixmer": "LNA / DNA Mixmer",
}

# Molecular defect types for TG05. Neutralization treats *toxic gain-of-function*
# — cases where the RNA itself is the disease driver (expanded repeats, foci
# sequestration, or a pathogenic small ncRNA). A pure loss-of-function defect
# suppresses every TG05 mechanism and redirects to TG02 / TG08 instead.
NEUTRALIZATION_DEFECT_TYPES = {
    "toxic_rna_gain_of_function": "Toxic RNA gain-of-function (expanded repeats / RNA foci)",
    "rbp_sequestration": "RNA-binding protein sequestration by toxic RNA",
    "pathogenic_mirna": "Pathogenic microRNA / ncRNA overexpression",
    "loss_of_function": "Pure loss-of-function (haploinsufficiency / null)",
}

NEUTRALIZATION_MODE_MECHANISMS = {
    "steric_repeat_masking": ["A14"],
    "microrna_antagomir": ["A12"],
    "aptamer_decoy": ["A25"],
}

RNA_NEUTRALIZATION_MECHANISM_IDS = [
    m for group in NEUTRALIZATION_MODE_MECHANISMS.values() for m in group
]

# Well-documented pathogenic repeat motifs and their associated gene / disease.
# Used ONLY as a soft reference and small ranking bonus when the user's repeat
# unit matches a curated entry — it is never a hard gate, so repeat masking
# stays eligible for any valid nucleotide repeat motif, including those not
# listed here. (The same motif can be entered as DNA or RNA letters, e.g.
# CTG vs CUG.)
KNOWN_REPEAT_UNITS = {
    "CUG": "DMPK (Myotonic Dystrophy Type 1)",
    "CTG": "DMPK (Myotonic Dystrophy Type 1)",
    "CAG": "HTT / ATXN1 / ATXN2 / ATN1 (polyglutamine disorders)",
    "GGGGCC": "C9orf72 (ALS / FTD)",
    "G4C2": "C9orf72 (ALS / FTD)",
    "CCUG": "CNBP (Myotonic Dystrophy Type 2)",
    "CGG": "FMR1 / FXN (FXTAS, Fragile X)",
    "GAA": "FXN (Friedreich Ataxia)",
    "TTC": "FXN (Friedreich Ataxia)",
}

# Approximate lower bound for an expanded / pathogenic repeat tract. Used only
# to flag clearly non-pathogenic inputs (e.g. "10 copies"), never as a gate on
# verified disease genes.
PATHOGENIC_REPEAT_THRESHOLD = 30


def _extract_repeat_count(repeat_text: str | None) -> int | None:
    """Pull the largest number out of free text like '>50 copies' or '55–200'."""
    if not repeat_text or not repeat_text.strip():
        return None
    numbers = [int(n) for n in re.findall(r"\d[\d,]*", repeat_text)]
    return max(numbers) if numbers else None


def _normalize_repeat_unit(repeat_unit: str | None) -> str | None:
    """Strip punctuation / non-nucleotide characters and uppercase the unit."""
    if not repeat_unit:
        return None
    cleaned = re.sub(r"[^ACGTUacgtu]", "", repeat_unit).upper()
    return cleaned or None


# ---------------------------------------------------------------------------
# TG05 — RNA Neutralization ranking
# ---------------------------------------------------------------------------

def rank_rna_neutralization_mechanisms(
    molecular_defect: str,
    neutralization_mode: str,
    repeat_unit: str | None = None,
    estimated_repeat_count: str | None = None,
    steric_chemistry: str | None = None,
    target_rbp: str | None = None,
    oligo_length: int | None = None,
    delivery_context: str | None = None,
    target_gene_type: str | None = None,
) -> list[dict]:
    """
    Ranks the rulebook mechanisms belonging to a single TG05 neutralization
    strategy.

    Exclusion rules implemented (mirror the RNA-neutralization spec):
      1. Pure loss-of-function defect → ALL TG05 mechanisms ineligible
         (redirect the user to TG02 gene activation / TG08 protein
         replacement instead).
      2. Steric repeat masking suppressed only for invalid repeat-unit
         input (non-nucleotide text) or a clearly sub-pathogenic repeat
         count. Recognition of the motif is NOT a gate — any clean
         nucleotide repeat is accepted, so repeat masking works for every
         repeat-expansion gene, not just the well-documented ones in
         KNOWN_REPEAT_UNITS.
      3. MicroRNA / ncRNA antagomir suppressed when the target is a
         protein-coding mRNA rather than a small non-coding RNA.
    """
    results = []
    mechanism_ids = NEUTRALIZATION_MODE_MECHANISMS.get(neutralization_mode, [])

    loss_of_function = molecular_defect == "loss_of_function"

    # Gate 2 — repeat-expansion sanity check (steric repeat masking only).
    # Any valid nucleotide motif (2–6 nt) is accepted; the curated
    # KNOWN_REPEAT_UNITS list is used only as a soft reference/bonus, never
    # as a hard gate, so genes with less-documented repeat expansions rank
    # normally instead of being excluded.
    repeat_count = _extract_repeat_count(estimated_repeat_count)
    repeat_normalized = _normalize_repeat_unit(repeat_unit)
    repeat_motif_invalid = bool(repeat_unit and repeat_unit.strip() and not repeat_normalized)
    repeat_confirmed = bool(repeat_normalized and repeat_normalized in KNOWN_REPEAT_UNITS)
    repeat_non_pathogenic = (
        repeat_motif_invalid
        or (repeat_count is not None and repeat_count < PATHOGENIC_REPEAT_THRESHOLD)
    )

    # Gate 3 — protein-coding target suppresses antagomirs (they act on small
    # non-coding RNAs, not protein-coding pre-mRNAs)
    protein_coding = bool(
        target_gene_type and target_gene_type.lower().startswith("protein")
    )

    for mechanism_id in mechanism_ids:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        rationale: list[str] = []
        eligible = True
        score = 0

        if loss_of_function:
            eligible = False
            rationale.append(
                "This defect is a pure loss-of-function — neutralizing the RNA cannot restore "
                "the missing protein. Consider TG02 (Gene Activation) or TG08 (Protein Replacement) instead."
            )

        if eligible and mechanism_id == "A14" and repeat_non_pathogenic:
            eligible = False
            if repeat_count is not None and repeat_count < PATHOGENIC_REPEAT_THRESHOLD:
                rationale.append(
                    f"Estimated repeat count (~{repeat_count} copies) is below the pathogenic "
                    f"expansion threshold (~{PATHOGENIC_REPEAT_THRESHOLD} copies) — repeat masking "
                    "targets expanded tracts, not normal-length repeats."
                )
            else:
                rationale.append(
                    f"'{repeat_unit}' is not a valid nucleotide repeat motif — repeat masking "
                    "requires an expanded nucleotide repeat (e.g. CUG, CAG, GGGGCC, CCUG)."
                )

        if eligible and mechanism_id == "A12" and protein_coding:
            eligible = False
            rationale.append(
                f"Target gene is {target_gene_type} — antagomirs / anti-miRs act on small "
                "non-coding RNAs (miRNAs / ncRNAs), not protein-coding mRNAs."
            )

        if eligible:
            score += 10  # member of the selected neutralization strategy
            rationale.append(
                f"Matches the '{NEUTRALIZATION_MODES.get(neutralization_mode, neutralization_mode)}' strategy"
            )

        if delivery_context:
            delivery_score = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context, 0)
            score += delivery_score
            if delivery_score > 0:
                rationale.append(
                    f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery "
                    "(general reference, not gene-specific)"
                )

        # Steric repeat masking — design-fit bonuses
        if mechanism_id == "A14":
            if repeat_confirmed:
                score += 2
                rationale.append(
                    f"Repeat unit {repeat_normalized} recognized ({KNOWN_REPEAT_UNITS[repeat_normalized]})"
                )
            elif repeat_normalized:
                rationale.append(
                    f"Repeat unit {repeat_normalized} accepted as a nucleotide repeat motif "
                    "(not in the known-repeat reference list — treated as potentially applicable for this gene)"
                )
            if target_rbp and target_rbp.strip():
                score += 1
                rationale.append(
                    f"Oligo designed to displace sequestered RBP {target_rbp.strip()} from repeat-bound foci"
                )
            if steric_chemistry == "pmo":
                score += 1
                rationale.append(
                    "PMO selected — an RNase H-independent steric blocker, well suited to masking repeat tracts"
                )

        # Antagomir — design-fit bonus
        if mechanism_id == "A12" and steric_chemistry == "moe_full_ps":
            score += 1
            rationale.append(
                "2'-O-MOE full-PS chemistry selected — the standard fully modified backbone for anti-miR oligos"
            )

        if oligo_length is not None and 15 <= oligo_length <= 25:
            score += 1

        results.append(_build_mechanism_result(rule, eligible, score, rationale))

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_rule(mechanism_id: str) -> dict | None:
    path = os.path.join(RULEBOOKS_DIR, mechanism_id, "rule.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _variant_keyword_hit(rule: dict, known_variant: str | None) -> bool:
    if not known_variant or not known_variant.strip():
        return False
    haystack = (rule.get("suitableVariantTypes") or "").lower()
    return any(
        token in haystack for token in known_variant.lower().split() if len(token) > 3
    )


def _build_mechanism_result(rule: dict, eligible: bool, score: int, rationale: list[str]) -> dict:
    return {
        "id": rule["id"],
        "name": rule["name"],
        "category": rule.get("category"),
        "eligible": eligible,
        "score": score,
        "rationale": rationale,
        "evidenceLevel": rule.get("evidenceLevel"),
        "fdaApprovedDrugs": rule.get("fdaApprovedDrugs"),
        "clinicalTrialExamples": rule.get("clinicalTrialExamples"),
        "suitableVariantTypes": rule.get("suitableVariantTypes"),
        "rnaTargetRegion": rule.get("rnaTargetRegion"),
        "asoChemistry": rule.get("asoChemistry"),
        "designRules": rule.get("designRules"),
        "advantages": rule.get("advantages"),
        "limitations": rule.get("limitations"),
        "offTargetConsiderations": rule.get("offTargetConsiderations"),
        "references": rule.get("references", [])[:3],
    }


# ---------------------------------------------------------------------------
# TG01 — Gene Silencing ranking
# ---------------------------------------------------------------------------

def rank_gene_silencing_mechanisms(
    defect_type: str,
    silencing_scope: str,
    delivery_context: str | None,
    known_variant: str | None,
) -> list[dict]:
    results = []
    for mechanism_id in GENE_SILENCING_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = defect_type in DEFECT_COMPATIBILITY.get(mechanism_id, set())
        scope_ok = silencing_scope in SCOPE_COMPATIBILITY.get(mechanism_id, set())

        delivery_score = 0
        if delivery_context:
            delivery_score = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context, 0)

        vkh = _variant_keyword_hit(rule, known_variant)
        eligible = defect_ok and scope_ok

        score = 0
        if defect_ok:
            score += 10
        if scope_ok:
            score += 5
        score += delivery_score
        if vkh:
            score += 2

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{DEFECT_TYPES.get(defect_type, defect_type)}' defect type",
            f"{'Supports' if scope_ok else 'Not described as supporting'} {SILENCING_SCOPES.get(silencing_scope, silencing_scope).lower()}",
        ]
        if delivery_context and delivery_score > 0:
            rationale.append(f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery (general reference, not gene-specific)")
        if vkh:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")

        results.append(_build_mechanism_result(rule, eligible, score, rationale))

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# TG02 — Gene Activation / Upregulation ranking
# ---------------------------------------------------------------------------

def rank_gene_upregulation_mechanisms(
    defect_type: str,
    delivery_context: str | None,
    known_regulatory_element: str | None,
    gene_features: dict | None = None,
) -> list[dict]:
    """
    known_regulatory_element: optional free text describing a known
    poison exon / NAT / uORF / miRNA site for this gene, if the user has
    one. Soft keyword-overlap bonus only — these mechanisms all require a
    *validated* regulatory element in the real world, which we cannot
    verify against a database here, so this never acts as a hard gate.

    gene_features: optional dict from analyze_gene_features() containing
    per-mechanism availability flags. When provided, mechanisms that are
    structurally impossible for this gene are marked ineligible and
    given a low score.
    """
    # Map mechanism IDs to gene feature keys
    MECHANISM_FEATURE_MAP = {
        "A3": "TANGO",       # Poison exon blocking
        "A4": "NAT",         # Natural antisense transcript knockdown
        "A5": "uORF",        # uORF blocking
        "A6": "miRNA_block", # miRNA binding site blocking
        "A22": "miRNA_replacement",  # miRNA replacement
        "A23": "saRNA",      # Promoter activation
    }

    feature_flags = {}
    if gene_features and isinstance(gene_features.get("features"), dict):
        feature_flags = gene_features["features"]

    results = []
    for mechanism_id in GENE_UPREGULATION_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = defect_type in UPREGULATION_DEFECT_COMPATIBILITY.get(mechanism_id, set())

        delivery_score = 0
        if delivery_context:
            delivery_score = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context, 0)

        element_hit = _variant_keyword_hit(rule, known_regulatory_element)

        # Check gene feature availability
        feature_key = MECHANISM_FEATURE_MAP.get(mechanism_id)
        feature_available = True
        feature_reason = None
        if feature_key and feature_key in feature_flags:
            feat = feature_flags[feature_key]
            feature_available = feat.get("available", True)
            feature_reason = feat.get("reason")

        # Mechanism is eligible only if defect matches AND gene has the required features
        eligible = defect_ok and feature_available

        score = 0
        if defect_ok:
            score += 10
        score += delivery_score
        if element_hit:
            score += 2
        if not feature_available:
            # Penalize unavailable mechanisms so they sort to the bottom
            score = max(score - 15, -5)

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{GENE_UPREGULATION_DEFECT_TYPES.get(defect_type, defect_type)}' defect type",
        ]
        transcript_req = rule.get("transcriptRequirement")
        if transcript_req:
            rationale.append(f"Requires: {transcript_req}")
        if delivery_context and delivery_score > 0:
            rationale.append(f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery (general reference, not gene-specific)")
        if element_hit:
            rationale.append("Your noted regulatory element description overlaps with this mechanism's typical profile")
        if not feature_available and feature_reason:
            rationale.append(f"Gene feature check: {feature_reason}")

        results.append(_build_mechanism_result(rule, eligible, score, rationale))

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# TG04 — RNA Processing Modulation ranking
# ---------------------------------------------------------------------------

def rank_rna_processing_mechanisms(
    splice_defect_type: str,
    target_exon: str | None,
    delivery_context: str | None,
    known_variant: str | None,
) -> list[dict]:
    results = []
    for mechanism_id in RNA_PROCESSING_MECHANISM_IDS:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        defect_ok = splice_defect_type in SPLICE_DEFECT_COMPATIBILITY.get(mechanism_id, set())

        delivery_score = 0
        if delivery_context:
            delivery_score = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context, 0)

        vkh = _variant_keyword_hit(rule, known_variant)

        exon_bonus = 0
        exon_rationale = None
        if target_exon and target_exon.strip():
            region_text = (rule.get("rnaTargetRegion") or "").lower()
            if any(kw in region_text for kw in ["exon", "splice donor", "splice acceptor", "ese", "ess"]):
                exon_bonus = 3
                exon_rationale = f"Mechanism targets exon-adjacent splice elements relevant to {target_exon}"

        eligible = defect_ok
        score = 0
        if defect_ok:
            score += 10
        score += delivery_score
        if vkh:
            score += 2
        score += exon_bonus

        rationale = [
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{SPLICE_DEFECT_TYPES.get(splice_defect_type, splice_defect_type)}' defect type",
        ]
        if delivery_context and delivery_score > 0:
            rationale.append(f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery (general reference, not gene-specific)")
        if vkh:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")
        if exon_rationale:
            rationale.append(exon_rationale)

        results.append(_build_mechanism_result(rule, eligible, score, rationale))

    results.sort(key=lambda r: r["score"], reverse=True)
    return results


# ---------------------------------------------------------------------------
# TG03 — RNA Editing / Correction ranking
# ---------------------------------------------------------------------------

# Substitution HGVS like c.82G>A, g.12345C>T, or NC_...:c.5A>G. Handles both
# DNA and RNA base letters. Non-substitution variants (del / ins / delins)
# return None — those cannot be base-classified, so the edit-type selector
# alone determines which editing modality is eligible.
def _parse_hgvs_substitution(variant_hgvs: str | None) -> tuple[str, str] | None:
    if not variant_hgvs:
        return None
    match = re.search(
        r"(?<![ACGTUacgtu])([ACGTUacgtu])\s*>\s*([ACGTUacgtu])(?![ACGTUacgtu])",
        variant_hgvs,
    )
    if not match:
        return None
    ref = match.group(1).upper()
    alt = match.group(2).upper()
    if ref in ("T", "U"):
        ref = "U"
    if alt in ("T", "U"):
        alt = "U"
    return ref, alt


def _editing_base_compatible(edit_type: str, sub: tuple[str, str]) -> bool:
    """RNA editing acts on the CURRENT (mutant) base in the transcript.

    ADAR deaminates an adenosine (A→I, read as G) so the mutant base must be
    A (i.e. a G>A transition). APOBEC deaminates a cytidine (C→U) so the
    mutant base must be C (i.e. a T>C transition). Trans-splicing replaces an
    entire segment and is not base-restricted.
    """
    _ref, alt = sub
    if edit_type == "a_to_i":
        return alt == "A"
    if edit_type == "c_to_u":
        return alt == "C"
    return True


def _base_mismatch_reason(edit_type: str, sub: tuple[str, str]) -> str:
    ref, alt = sub
    if edit_type == "a_to_i":
        return (
            f"Variant {ref}>{alt} is not an adenosine alteration — ADAR cannot repair it "
            "(A→I editing requires the mutant base to be A, e.g. a G>A transition)."
        )
    return (
        f"Variant {ref}>{alt} is not editable by C→U deamination — APOBEC requires the "
        "mutant base to be C (e.g. a T>C transition)."
    )


def rank_rna_editing_mechanisms(
    edit_type: str,
    variant_hgvs: str | None,
    enzyme_recruitment: str | None,
    delivery_context: str | None,
    guide_length: int | None,
    mismatch_pocket: str | None,
    max_bystander_edits: int | None,
    exon_count: int | None = None,
    intron_count: int | None = None,
    total_transcripts: int | None = None,
) -> list[dict]:
    """
    Ranks the rulebook mechanisms belonging to a single TG03 editing modality.

    Exclusion rules implemented (mirror the RNA-editing spec):
      1. Whole-gene deletion / no transcript → ALL editing mechanisms ineligible
         (redirect the user to TG08 protein replacement instead).
      2. A-to-I (ADAR) suppressed when the target mutation is not an adenosine
         alteration (e.g. trying to fix a C>T mutation).
      3. C-to-U (APOBEC) suppressed when the mutant base is not a cytidine.
      4. Trans-splicing (SMaRT) suppressed for single-exon / intronless genes,
         which have no intronic splice junctions for the spliceosome to use.
    """
    results = []
    mechanism_ids = EDIT_TYPE_MECHANISMS.get(edit_type, [])

    sub = _parse_hgvs_substitution(variant_hgvs)

    # Gate 1 — whole-gene deletion / no transcript
    whole_gene_deletion = (
        (total_transcripts is not None and total_transcripts <= 0)
        or (exon_count == 0)
    )

    # Gate 4 pre-check — single-exon / intronless gene (SMaRT only)
    single_exon = (exon_count is not None and exon_count <= 1) or (intron_count == 0)

    for mechanism_id in mechanism_ids:
        rule = _load_rule(mechanism_id)
        if not rule:
            continue

        rationale: list[str] = []
        eligible = True
        score = 0

        if whole_gene_deletion:
            eligible = False
            rationale.append(
                "No RNA transcripts detected — a whole-gene deletion leaves nothing to edit; "
                "consider TG08 (Protein Replacement) or mRNA therapy instead."
            )
        elif sub and edit_type in ("a_to_i", "c_to_u"):
            if not _editing_base_compatible(edit_type, sub):
                eligible = False
                rationale.append(_base_mismatch_reason(edit_type, sub))

        # A20 is the SMaRT trans-splicing mechanism; only it needs intronic
        # splice junctions. A16 (C-to-U editing) is not splice-dependent.
        if mechanism_id == "A20" and single_exon:
            eligible = False
            rationale.append(
                "Gene appears to be single-exon / intronless — trans-splicing relies on "
                "spliceosomal intron junctions and cannot be applied."
            )

        if eligible:
            score += 10  # member of the selected editing modality

        if delivery_context:
            delivery_score = DELIVERY_PRECEDENT.get(mechanism_id, {}).get(delivery_context, 0)
            score += delivery_score
            if delivery_score > 0:
                rationale.append(
                    f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery "
                    "(general reference, not gene-specific)"
                )

        # Endogenous enzyme expression feasibility (soft, general reference)
        if enzyme_recruitment and enzyme_recruitment in EDIT_ENZYME_TISSUE_PRECEDENT:
            if delivery_context:
                enzyme_score = EDIT_ENZYME_TISSUE_PRECEDENT[enzyme_recruitment].get(
                    delivery_context, 0
                )
                if enzyme_score > 0:
                    score += enzyme_score
                    rationale.append(
                        f"{ENZYME_RECRUITMENT.get(enzyme_recruitment, enzyme_recruitment)} is expressed in "
                        f"{DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} tissue (general GTEx-based reference)"
                    )

        # Guide design parameters — soft design-fit bonuses
        if guide_length is not None and 30 <= guide_length <= 120:
            score += 1
        if edit_type == "a_to_i" and mismatch_pocket == "c":
            score += 1
            rationale.append("A-C orphan mismatch selected — the configuration reported to give the highest ADAR editing efficiency")
        if max_bystander_edits is not None and max_bystander_edits == 0:
            score += 1

        results.append(_build_mechanism_result(rule, eligible, score, rationale))

    results.sort(key=lambda r: r["score"], reverse=True)
    return results
