"""
Scores mechanisms within a therapeutic goal against user-provided inputs.

Currently implements Gene Silencing (TG01) ranking across its 5 mapped
mechanisms (A1, A2, A12, A15, A21). The eligibility/scope compatibility
tables below are read directly from each mechanism's rule.json
(suitableVariantTypes / transcriptRequirement) — they are not invented.

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

DELIVERY_CONTEXTS = {
    "cns": "CNS / intrathecal",
    "systemic": "Systemic / subcutaneous",
    "liver": "Liver-targeted",
    "local_intramuscular": "Local / intramuscular",
    "ocular": "Ocular",
    "other": "Other / not yet determined",
}

# Derived from each mechanism's suitableVariantTypes field (rule.json) —
# which molecular defect types each mechanism is described as applicable to.
DEFECT_COMPATIBILITY = {
    "A1": {"gain_of_function", "viral_toxic_rna"},
    "A2": {"gain_of_function", "viral_toxic_rna"},
    "A12": {"mirna_dysregulation"},
    "A15": {"overexpression"},
    "A21": {"gain_of_function", "overexpression", "viral_toxic_rna"},
}

# Derived from each mechanism's transcriptRequirement / designRules text —
# whether allele-specific targeting is described as achievable.
SCOPE_COMPATIBILITY = {
    "A1": {"total_knockdown", "allele_specific"},
    "A2": {"total_knockdown"},
    "A12": {"total_knockdown"},
    "A15": {"total_knockdown"},
    "A21": {"total_knockdown", "allele_specific"},
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
}

GENE_SILENCING_MECHANISM_IDS = ["A1", "A2", "A12", "A15", "A21"]


def _load_rule(mechanism_id: str) -> dict | None:
    path = os.path.join(RULEBOOKS_DIR, mechanism_id, "rule.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


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

        variant_keyword_hit = False
        if known_variant and known_variant.strip():
            haystack = (rule.get("suitableVariantTypes") or "").lower()
            variant_keyword_hit = any(
                token in haystack for token in known_variant.lower().split() if len(token) > 3
            )

        eligible = defect_ok and scope_ok

        # Score: eligibility is the hard gate: score of 0 for genuinely
        # incompatible mechanisms; otherwise combine scope/delivery/keyword
        # signals for ranking among eligible mechanisms.
        score = 0
        if defect_ok:
            score += 10
        if scope_ok:
            score += 5
        score += delivery_score
        if variant_keyword_hit:
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
        if variant_keyword_hit:
            rationale.append("Your noted variant description overlaps with this mechanism's typical variant profile")

        results.append(
            {
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
        )

    results.sort(key=lambda r: r["score"], reverse=True)
    return results
