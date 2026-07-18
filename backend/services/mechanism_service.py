"""
Scores mechanisms within a therapeutic goal against user-provided inputs.

Implements:
- Gene Silencing (TG01): A1, A2, A12, A15, A21
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

# Derived from each mechanism's suitableVariantTypes field (rule.json)
DEFECT_COMPATIBILITY = {
    "A1": {"gain_of_function", "viral_toxic_rna"},
    "A2": {"gain_of_function", "viral_toxic_rna"},
    "A12": {"mirna_dysregulation"},
    "A15": {"overexpression"},
    "A21": {"gain_of_function", "overexpression", "viral_toxic_rna"},
}

# Derived from each mechanism's transcriptRequirement / designRules text
SCOPE_COMPATIBILITY = {
    "A1": {"total_knockdown", "allele_specific"},
    "A2": {"total_knockdown"},
    "A12": {"total_knockdown"},
    "A15": {"total_knockdown"},
    "A21": {"total_knockdown", "allele_specific"},
}

GENE_SILENCING_MECHANISM_IDS = ["A1", "A2", "A12", "A15", "A21"]

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

# Derived from each mechanism's suitableVariantTypes field (rule.json)
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

        rationale = []
        rationale.append(
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{DEFECT_TYPES.get(defect_type, defect_type)}' defect type"
        )
        rationale.append(
            f"{'Supports' if scope_ok else 'Not described as supporting'} {SILENCING_SCOPES.get(silencing_scope, silencing_scope).lower()}"
        )
        if delivery_context and delivery_score > 0:
            rationale.append(
                f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery (general reference, not gene-specific)"
            )
        if vkh:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")

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

        # Exon relevance bonus: if user specified a target exon and the
        # mechanism's rnaTargetRegion mentions exon-related keywords.
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

        rationale = []
        rationale.append(
            f"{'Matches' if defect_ok else 'Does not clearly match'} the '{SPLICE_DEFECT_TYPES.get(splice_defect_type, splice_defect_type)}' defect type"
        )
        if delivery_context and delivery_score > 0:
            rationale.append(
                f"Has precedent for {DELIVERY_CONTEXTS.get(delivery_context, delivery_context).lower()} delivery (general reference, not gene-specific)"
            )
        if vkh:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")
        if exon_rationale:
            rationale.append(exon_rationale)

        results.append(_build_mechanism_result(rule, eligible, score, rationale))

    results.sort(key=lambda r: r["score"], reverse=True)
    return results
