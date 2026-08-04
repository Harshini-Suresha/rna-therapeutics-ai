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
