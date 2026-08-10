"""ADMET prediction for RNA therapeutics (ASO, siRNA, aptamer).

Predicts Absorption, Distribution, Metabolism, Excretion, and Toxicity
properties based on sequence heuristics, target gene context, and known
RNA therapeutic design principles.

Sources:
- Sequence-based heuristics (GC content, length, modifications, motifs)
- Target expression profile (tissue distribution, protein abundance)
- gnomAD constraint (essentiality affects therapeutic window)
- UniProt properties (subcellular location, stability)
"""

import logging
import re
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


def _classify_score(value: float, low_thresh: float, high_thresh: float) -> str:
    if value >= high_thresh:
        return "High"
    elif value >= low_thresh:
        return "Moderate"
    else:
        return "Low"


def _compute_gc_content(seq: str) -> float:
    if not seq:
        return 0.0
    seq = seq.upper()
    gc = seq.count("G") + seq.count("C")
    return round((gc / len(seq)) * 100, 1) if seq else 0.0


def _compute_immunogenicity_risk(seq: str) -> Dict[str, Any]:
    """Assess innate immune activation risk from RNA sequence motifs."""
    if not seq:
        return {"score": 0.0, "level": "Unknown", "motifs": []}

    seq = seq.upper()
    motifs = []
    risk_score = 0.0

    # TLR9 activating CpG motifs ( unmethylated CpG in specific contexts )
    cpg_density = (seq.count("CG") / len(seq)) * 100 if seq else 0
    if cpg_density > 2.0:
        motifs.append(f"High CpG density ({cpg_density:.1f}/100 nt) — TLR9 activation risk")
        risk_score += 0.4
    elif cpg_density > 0.5:
        motifs.append(f"Moderate CpG density ({cpg_density:.1f}/100 nt)")
        risk_score += 0.15

    # Poly-G tracts: G-quadruplex formation, aggregation
    polyg = re.findall(r"G{4,}", seq)
    if len(polyg) > 2:
        motifs.append(f"Multiple poly-G tracts ({len(polyg)}) — aggregation risk")
        risk_score += 0.3
    elif len(polyg) > 0:
        motifs.append(f"Poly-G tracts present ({len(polyg)})")
        risk_score += 0.1

    # Poly-U: TLR7/8 activation
    polyu = re.findall(r"U{4,}", seq)
    if len(polyu) > 1:
        motifs.append(f"Multiple poly-U tracts ({len(polyu)}) — TLR7/8 risk")
        risk_score += 0.25
    elif len(polyu) > 0:
        motifs.append(f"Poly-U tracts present ({len(polyu)})")
        risk_score += 0.1

    # 5' triphosphate: RIG-I/MDA5 activation (if unmodified RNA)
    if seq.startswith("PPP") or seq.startswith("ppp"):
        motifs.append("5' triphosphate — RIG-I/MDA5 activation risk")
        risk_score += 0.3

    # dsRNA regions (>6 consecutive Watson-Crick pairs potential)
    if re.search(r"(GC){3,}", seq) or re.search(r"(CG){3,}", seq):
        motifs.append("Extended GC repeats — dsRNA mimicry risk")
        risk_score += 0.2

    risk_score = min(risk_score, 1.0)
    level = _classify_score(1.0 - risk_score, 0.4, 0.7)
    return {
        "score": round(risk_score, 2),
        "level": level,
        "motifs": motifs,
    }


def _predict_nuclease_sensitivity(seq: str) -> Dict[str, Any]:
    """Predict RNA nuclease degradation rate based on sequence composition."""
    if not seq:
        return {"score": 0.5, "level": "Unknown", "halfLifeHours": None}

    seq = seq.upper()
    gc = _compute_gc_content(seq)
    length = len(seq)

    # Higher GC content increases stability against nucleases
    gc_stability = min(gc / 60.0, 1.0)

    # Shorter oligos degrade faster
    length_factor = min(length / 20.0, 1.0)

    # 2' modifications dramatically increase stability (heuristic: assume standard ASO)
    modification_factor = 0.7  # 2'-O-methyl, 2'-F, LNA etc.

    # Avoid AU-rich regions which are nuclease-sensitive
    au_runs = len(re.findall(r"(AU){2,}|(UA){2,}", seq))
    au_penalty = min(au_runs * 0.05, 0.2)

    stability = (0.35 * gc_stability + 0.2 * length_factor + 0.35 * modification_factor) - au_penalty
    stability = max(0.0, min(1.0, stability))

    # Estimate half-life (standard unmodified RNA: ~minutes; modified: hours-days)
    base_half_life = 0.5  # hours for unmodified 20mer
    predicted_half_life = base_half_life + (stability * 47.5)  # up to ~48 hours for highly stable

    level = _classify_score(stability, 0.35, 0.65)
    return {
        "score": round(stability, 2),
        "level": level,
        "halfLifeHours": round(predicted_half_life, 1),
    }


def _predict_cell_uptake(seq: str, gc: float, length: int) -> Dict[str, Any]:
    """Predict cellular uptake efficiency."""
    if not seq:
        return {"score": 0.5, "level": "Unknown", "notes": []}

    seq = seq.upper()
    notes = []

    # Optimal ASO length: 15-22 nt
    if 15 <= length <= 22:
        length_score = 0.8
        notes.append(f"Optimal length ({length} nt)")
    elif 12 <= length <= 25:
        length_score = 0.6
        notes.append(f"Acceptable length ({length} nt)")
    else:
        length_score = 0.3
        notes.append(f"Suboptimal length ({length} nt)")

    # Moderate GC preferred for uptake
    if 30 <= gc <= 55:
        gc_score = 0.8
        notes.append(f"Favorable GC content ({gc}%)")
    elif 20 <= gc <= 65:
        gc_score = 0.5
        notes.append(f"Moderate GC content ({gc}%)")
    else:
        gc_score = 0.3
        notes.append(f"Extreme GC content ({gc}%)")

    # Charge-neutralizing modifications improve uptake
    mod_score = 0.7  # Assumes standard modified ASO

    # Lipid conjugate or GalNAc conjugation (assumed for ASOs targeting liver)
    conjugate_score = 0.75

    uptake = 0.3 * length_score + 0.25 * gc_score + 0.25 * mod_score + 0.2 * conjugate_score
    level = _classify_score(uptake, 0.35, 0.6)
    return {"score": round(uptake, 2), "level": level, "notes": notes}


def _predict_protein_binding(seq: str) -> Dict[str, Any]:
    """Predict non-specific protein binding (reduces free concentration)."""
    if not seq:
        return {"score": 0.5, "level": "Unknown"}

    seq = seq.upper()
    gc = _compute_gc_content(seq)

    # High GC increases protein binding
    if gc > 65:
        score = 0.8
        level = "High"
    elif gc > 45:
        score = 0.5
        level = "Moderate"
    else:
        score = 0.2
        level = "Low"

    return {"score": score, "level": level}


def _predict_renal_clearance(length: int, gc: float) -> Dict[str, Any]:
    """Predict renal clearance based on size and charge."""
    # Oligos < 30 nt are cleared renally; larger ones are not
    if length < 20:
        clearance = 0.9
        level = "High"
    elif length < 30:
        clearance = 0.6
        level = "Moderate"
    else:
        clearance = 0.2
        level = "Low"

    return {
        "score": clearance,
        "level": level,
        "mechanism": "Glomerular filtration" if length < 30 else "Reticuloendothelial",
    }


def _predict_off_target_risk(seq: str, transcript_count: int = 5) -> Dict[str, Any]:
    """Predict off-target hybridization risk."""
    if not seq:
        return {"score": 0.5, "level": "Unknown"}

    seq = seq.upper()
    length = len(seq)

    # Longer sequences have more potential off-targets
    length_factor = min(length / 22.0, 1.0)

    # More transcripts = more potential off-targets
    transcript_factor = min(transcript_count / 10.0, 1.0)

    # GC content affects specificity
    gc = _compute_gc_content(seq)
    gc_factor = 1.0 if 40 <= gc <= 60 else 0.7

    # Seed region match potential
    seed = seq[2:8] if len(seq) >= 8 else seq
    seed_gc = _compute_gc_content(seed)
    seed_factor = 0.8 if 30 <= seed_gc <= 60 else 0.5

    risk = 0.25 * length_factor + 0.25 * transcript_factor + 0.25 * (1 - gc_factor) + 0.25 * (1 - seed_factor)
    risk = max(0.0, min(1.0, risk))

    level = _classify_score(1.0 - risk, 0.4, 0.7)
    return {"score": round(risk, 2), "level": level}


def _predict_hemolysis_risk(seq: str) -> Dict[str, Any]:
    """Predict hemolysis risk from sequence."""
    if not seq:
        return {"score": 0.5, "level": "Unknown"}

    seq = seq.upper()

    # Positively charged sequences interact with RBC membranes
    gc = _compute_gc_content(seq)
    length = len(seq)

    # High GC, long sequences with G-rich motifs are more hemolytic
    g_count = seq.count("G")
    g_ratio = g_count / length if length else 0

    score = 0.3 * (gc / 100.0) + 0.3 * g_ratio + 0.2 * (min(length / 25.0, 1.0))
    score = max(0.0, min(1.0, score))

    level = _classify_score(1.0 - score, 0.4, 0.7)
    return {"score": round(score, 2), "level": level}


def _generate_admet_analysis(
    admet: Dict[str, Any],
    gene_context: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate human-readable ADMET analysis text."""
    lines = []

    lines.append("### Absorption & Uptake")
    uptake = admet.get("cellUptake", {})
    lines.append(f"**Cellular uptake:** {uptake.get('level', 'Unknown')} (score {uptake.get('score', 'N/A')})")
    if uptake.get("notes"):
        for note in uptake["notes"]:
            lines.append(f"- {note}")

    lines.append("\n### Distribution")
    prot_bind = admet.get("proteinBinding", {})
    renal = admet.get("renalClearance", {})
    lines.append(f"**Protein binding:** {prot_bind.get('level', 'Unknown')} — reduces free plasma concentration")
    lines.append(f"**Renal clearance:** {renal.get('level', 'Unknown')} ({renal.get('mechanism', 'N/A')})")

    lines.append("\n### Metabolism")
    nuclease = admet.get("nucleaseSensitivity", {})
    lines.append(f"**Nuclease stability:** {nuclease.get('level', 'Unknown')} (score {nuclease.get('score', 'N/A')})")
    if nuclease.get("halfLifeHours"):
        lines.append(f"- Predicted plasma half-life: ~{nuclease['halfLifeHours']} h")

    lines.append("\n### Excretion")
    lines.append(f"**Clearance route:** {renal.get('mechanism', 'N/A')}")

    lines.append("\n### Toxicity & Safety")
    immuno = admet.get("immunogenicity", {})
    off_target = admet.get("offTargetRisk", {})
    hemolysis = admet.get("hemolysisRisk", {})

    lines.append(f"**Immunogenicity:** {immuno.get('level', 'Unknown')} (score {immuno.get('score', 'N/A')})")
    if immuno.get("motifs"):
        for motif in immuno["motifs"]:
            lines.append(f"- {motif}")

    lines.append(f"**Off-target hybridization:** {off_target.get('level', 'Unknown')} (score {off_target.get('score', 'N/A')})")
    lines.append(f"**Hemolysis risk:** {hemolysis.get('level', 'Unknown')} (score {hemolysis.get('score', 'N/A')})")

    # Gene context warnings
    if gene_context:
        vital_organ = gene_context.get("vitalOrganTpm")
        if vital_organ and vital_organ > 10:
            lines.append(f"\n### Safety Warning")
            lines.append(f"High expression in vital organs (TPM {vital_organ}) increases on-target toxicity risk. Evaluate tissue-specific delivery strategies.")

    return "\n".join(lines)


def get_admet_prediction(
    aso_sequence: Optional[str] = None,
    gene_context: Optional[Dict[str, Any]] = None,
    transcript_count: int = 5,
) -> Dict[str, Any]:
    """Compute ADMET predictions for an RNA therapeutic candidate.

    Args:
        aso_sequence: The ASO/siRNA/aptamer RNA sequence
        gene_context: Dict with target gene expression/constraint data
        transcript_count: Number of transcripts for off-target risk estimation

    Returns:
        Dict with ADMET scores, levels, and analysis text
    """
    result = {
        "admetAvailable": False,
        "absorptionScore": None,
        "absorptionLevel": None,
        "distributionScore": None,
        "distributionLevel": None,
        "metabolismScore": None,
        "metabolismLevel": None,
        "excretionScore": None,
        "excretionLevel": None,
        "toxicityScore": None,
        "toxicityLevel": None,
        "cellUptake": None,
        "proteinBinding": None,
        "nucleaseSensitivity": None,
        "renalClearance": None,
        "immunogenicity": None,
        "offTargetRisk": None,
        "hemolysisRisk": None,
        "admetAnalysis": None,
        "admetWarnings": [],
        "admetStrengths": [],
    }

    if not aso_sequence or len(aso_sequence) < 8:
        result["admetAnalysis"] = "Insufficient sequence data for ADMET prediction. Provide an ASO sequence (≥8 nt) for full analysis."
        return result

    seq = aso_sequence.upper().replace("T", "U")
    gc = _compute_gc_content(seq)
    length = len(seq)

    # Absoption
    uptake = _predict_cell_uptake(seq, gc, length)
    result["cellUptake"] = uptake
    result["absorptionScore"] = uptake["score"]
    result["absorptionLevel"] = uptake["level"]

    # Distribution
    prot_bind = _predict_protein_binding(seq)
    renal = _predict_renal_clearance(length, gc)
    dist_score = 0.5 * (1 - prot_bind["score"]) + 0.5 * (1 - renal["score"])
    result["proteinBinding"] = prot_bind
    result["renalClearance"] = renal
    result["distributionScore"] = round(dist_score, 2)
    result["distributionLevel"] = _classify_score(dist_score, 0.35, 0.65)

    # Metabolism
    nuclease = _predict_nuclease_sensitivity(seq)
    result["nucleaseSensitivity"] = nuclease
    result["metabolismScore"] = nuclease["score"]
    result["metabolismLevel"] = nuclease["level"]

    # Excretion
    result["excretionScore"] = round(1 - renal["score"], 2)
    result["excretionLevel"] = _classify_score(1 - renal["score"], 0.35, 0.65)

    # Toxicity
    immuno = _compute_immunogenicity_risk(seq)
    off_target = _predict_off_target_risk(seq, transcript_count)
    hemolysis = _predict_hemolysis_risk(seq)
    tox_score = 0.35 * immuno["score"] + 0.35 * off_target["score"] + 0.3 * hemolysis["score"]
    tox_score = max(0.0, min(1.0, tox_score))

    result["immunogenicity"] = immuno
    result["offTargetRisk"] = off_target
    result["hemolysisRisk"] = hemolysis
    result["toxicityScore"] = round(tox_score, 2)
    result["toxicityLevel"] = _classify_score(1.0 - tox_score, 0.4, 0.7)

    result["admetAvailable"] = True

    # Generate analysis
    result["admetAnalysis"] = _generate_admet_analysis(result, gene_context)

    # Warnings and strengths
    if immuno["score"] > 0.3:
        result["admetWarnings"].append("Immunogenicity risk detected — consider 2'-O-methyl or 2'-F modifications to reduce TLR activation")
    if off_target["score"] > 0.4:
        result["admetWarnings"].append("Elevated off-target risk — validate specificity with RNA-seq off-target mapping")
    if hemolysis["score"] > 0.4:
        result["admetWarnings"].append("Hemolysis potential — assess RBC compatibility in preclinical species")
    if uptake["score"] < 0.4:
        result["admetWarnings"].append("Low predicted uptake — consider GalNAc conjugation or lipid nanoparticle delivery")
    if nuclease["halfLifeHours"] and nuclease["halfLifeHours"] < 4:
        result["admetWarnings"].append("Short predicted half-life — increase modification density or use phosphorothioate backbone")

    if uptake["score"] >= 0.6:
        result["admetStrengths"].append("Strong cellular uptake predicted")
    if nuclease["score"] >= 0.6:
        result["admetStrengths"].append("Good nuclease stability predicted")
    if immuno["score"] < 0.2:
        result["admetStrengths"].append("Low immunogenicity risk")
    if off_target["score"] < 0.3:
        result["admetStrengths"].append("High specificity predicted")

    return result
