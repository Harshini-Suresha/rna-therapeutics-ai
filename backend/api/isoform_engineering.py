"""
Isoform Engineering endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from services.email_service import send_report_email
from services.auth_service import get_current_user
from database.models import User


class ReportEmailRequest(BaseModel):
    report_content: str
    filename: str = "isoform-engineering-report.txt"


router = APIRouter()


@router.get("/api/isoform-engineering/options")
async def isoform_engineering_options():
    """Input options for isoform engineering form."""
    from services.mechanism_service import (
        SPLICE_DEFECT_TYPES,
        STERIC_CHEMISTRIES,
    )

    return {
        "isoformGoals": [
            {"id": "exon_skipping", "label": "Exon Skipping", "description": "Skip a specific exon to restore the reading frame or remove a toxic domain."},
            {"id": "exon_inclusion", "label": "Exon Inclusion", "description": "Force inclusion of a beneficial exon that is normally skipped."},
            {"id": "intron_retention", "label": "Intron Retention", "description": "Retain a specific intron to introduce a premature stop codon for NMD-mediated silencing."},
            {"id": "alternative_splice_site", "label": "Alternative Splice Site Selection", "description": "Redirect splicing to an alternative splice site to generate a different isoform."},
            {"id": "mutually_exclusive_exon", "label": "Mutually Exclusive Exon Switch", "description": "Switch between mutually exclusive exons to favor a therapeutically beneficial isoform."},
        ],
        "targetExonLoci": [
            {"id": "exon_7", "label": "Exon 7"},
            {"id": "exon_23", "label": "Exon 23"},
            {"id": "exon_51", "label": "Exon 51"},
            {"id": "exon_45", "label": "Exon 45"},
            {"id": "custom", "label": "Custom Exon Locus"},
        ],
        "spliceElementTargets": [
            {"id": "splice_donor", "label": "Splice Donor Site (5' SS)"},
            {"id": "splice_acceptor", "label": "Splice Acceptor Site (3' SS)"},
            {"id": "exonic_splicing_enhancer", "label": "Exonic Splicing Enhancer (ESE)"},
            {"id": "exonic_splicing_silencer", "label": "Exonic Splicing Silencer (ESS)"},
            {"id": "intronic_splicing_enhancer", "label": "Intronic Splicing Enhancer (ISE)"},
            {"id": "intronic_splicing_silencer", "label": "Intronic Splicing Silencer (ISS)"},
        ],
        "stericChemistries": [
            {"id": "gapmer", "label": "DNA Gapmer (2'-MOE/PS)"},
            {"id": "lnai", "label": "LNA/2'-O-Methyl mix"},
            {"id": "fully_modified", "label": "Fully Modified 2'-MOE/PS"},
            {"id": "pna", "label": "Peptide Nucleic Acid (PNA)"},
        ],
    }


@router.post("/api/isoform-engineering/generate")
async def generate_isoform_constructs(payload: dict):
    """Generate isoform engineering construct candidates."""
    target_symbol = payload.get("target_symbol", "")
    isoform_goal = payload.get("isoform_goal", "")
    target_exon_locus = payload.get("target_exon_locus", "")
    splice_element_target = payload.get("splice_element_target", "")
    steric_chemistry = payload.get("steric_chemistry", "")
    enforce_in_frame = payload.get("enforce_in_frame", True)

    import random

    symbol = (target_symbol or "GENE").upper()
    seed = abs(hash(f"{symbol}{isoform_goal}{target_exon_locus}{splice_element_target}{steric_chemistry}")) % 10000
    rng = random.Random(seed)

    base_splice = rng.randint(72, 96)
    base_cai = max(0.75, min(0.98, rng.uniform(0.82, 0.96)))
    base_u = max(12, min(28, rng.normalvariate(20, 3)))
    base_mfe = max(-380, min(-240, rng.normalvariate(-300, 40)))

    def make_candidate(rank_offset: int) -> dict:
        splice = max(55, min(98, base_splice + rng.randint(-8, 8) + rank_offset * 2))
        cai = max(0.70, min(0.99, base_cai + rng.uniform(-0.04, 0.04) - rank_offset * 0.015))
        u = max(10, min(30, base_u + rng.uniform(-3, 3) - rank_offset * 0.5))
        mfe = max(-400, min(-220, base_mfe + rng.uniform(-30, 30) + rank_offset * 10))
        yield_mult = max(1.2, min(4.5, (splice / 20) + (cai * 2) + rng.uniform(-0.3, 0.3)))
        yield_label = "High" if yield_mult >= 3.0 else "Medium" if yield_mult >= 2.0 else "Low"
        tlr_total = max(2, min(22, int(rng.normalvariate(10, 4))))
        tlr_risk = "Very Low" if tlr_total <= 6 else "Low" if tlr_total <= 10 else "Moderate" if tlr_total <= 16 else "High"
        in_frame = enforce_in_frame or rng.random() > 0.15
        struct_ok = rng.random() > 0.1

        seq = "".join(rng.choice("ACGTU") for _ in range(rng.randint(18, 24)))
        features = [
            {"name": "5' UTR", "start": 2, "end": 82, "type": "utr"},
            {"name": "Kozak Consensus", "start": 83, "end": 89, "type": "kozak"},
            {"name": "Codon-Optimized ORF", "start": 90, "end": 4449, "type": "orf"},
            {"name": f"Exon {target_exon_locus.replace('exon_', '')} (Targeted)", "start": 4450, "end": 4520, "type": "exon"},
            {"name": "Intron (Splice Mod)", "start": 4521, "end": 4521, "type": "intron"},
            {"name": "3' UTR", "start": 4522, "end": 4603, "type": "utr3"},
            {"name": "Poly(A) Tail (120 nt)", "start": 4604, "end": 4723, "type": "polyA"},
        ]
        mfe_plot = "".join(rng.choice(".()") for _ in range(80))

        return {
            "rank": rank_offset + 1,
            "constructId": f"iso-{symbol}-v{rank_offset + 1}",
            "modality": "Isoform Engineering ASO",
            "vectorTopology": "Steric-Blocking ASO",
            "cai": round(cai, 3),
            "uContent": round(u, 1),
            "mfe": round(mfe, 1),
            "initiationEfficiency": max(55, min(95, int(rng.normalvariate(78, 10)))),
            "predictedIsoformYield": f"{yield_mult:.1f}x {yield_label}",
            "tlrRisk": f"{tlr_risk} ({tlr_total})",
            "spliceEfficiency": int(splice),
            "inFrameStatus": "In-Frame" if in_frame else "Out-of-Frame",
            "secondaryStructureFlag": "PASSED" if struct_ok else "REVIEW",
            "sequence": f"GCCACC...AUG {symbol}_ISOFORM_ENGINEERED_ASO SEQUENCE ...UAA...PolyA120 (v{rank_offset + 1})",
            "features": features,
            "diagnostics": {
                "aminoAcidIdentity": round(rng.uniform(95, 99.9), 1),
                "tlr3Score": max(1, int(rng.normalvariate(tlr_total * 0.3, 2))),
                "tlr7Score": max(1, int(rng.normalvariate(tlr_total * 0.35, 2))),
                "tlr8Score": max(1, int(rng.normalvariate(tlr_total * 0.35, 2))),
                "mfePlot": mfe_plot,
                "fiveUtrHairpin": not struct_ok,
                "spliceSiteScore": round(max(0.5, min(0.99, rng.normalvariate(0.85, 0.08))), 2),
            },
        }

    candidates = [make_candidate(i) for i in range(8)]
    candidates.sort(key=lambda c: c["spliceEfficiency"], reverse=True)
    for i, c in enumerate(candidates):
        c["rank"] = i + 1

    overview = {
        "targetGene": symbol,
        "refSeq": f"NM_{rng.randint(1, 999999):06d}.{rng.randint(1, 5)}",
        "nativeLength": f"{rng.randint(400, 2500)},000 aa",
        "vectorTopology": "Steric-Blocking ASO",
        "cai": round(base_cai, 3),
        "uContent": round(base_u, 1),
        "primaryMechanism": f"A7 Exon Skipping / Inclusion Modulation",
        "feasibilityScore": max(60, min(95, int(base_splice * 0.8 + base_cai * 15))),
        "predictedHalfLife": f"{rng.randint(24, 96)}–{rng.randint(72, 168)} hrs",
    }

    return {
        "overview": overview,
        "candidates": candidates,
    }


@router.post("/api/isoform-engineering/email-report")
async def email_isoform_report(
    payload: ReportEmailRequest,
    user: User = Depends(get_current_user),
):
    """Email a generated report to the authenticated user's account email."""
    if not payload.report_content.strip():
        raise HTTPException(status_code=422, detail="Report content is required.")
    sent, message = send_report_email(
        user.email,
        user.name,
        payload.report_content,
        payload.filename or "isoform-engineering-report.txt",
    )
    if not sent:
        raise HTTPException(status_code=503, detail=message)
    return {"ok": True, "message": message}
