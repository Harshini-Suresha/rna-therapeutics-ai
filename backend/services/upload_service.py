"""Sequence upload service — parsing, validation, and analysis.

Supports FASTA files, raw DNA/RNA sequences, and auto-detection of sequence type.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# IUPAC sets
# ---------------------------------------------------------------------------

_IUPAC_DNA = set("ACGTRYSWKMBDHVNacgtryswkmbdhvn")
_IUPAC_RNA = set("ACGURYSWKMBDHVNacguryswkmbdhvn")

# Common ASO modifications (simplified detection)
_ASO_PATTERNS = [
    re.compile(r"[acgtuACGTU]{15,30}"),  # typical ASO length
]


def _clean_sequence(raw: str) -> str:
    """Remove FASTA headers, whitespace, and numbering."""
    lines = raw.strip().splitlines()
    seq_lines = [l for l in lines if not l.startswith(">") and not l.startswith(";")]
    return "".join(seq_lines).replace(" ", "").replace("\t", "").replace("\n", "").upper()


def _detect_type(seq: str) -> str:
    """Auto-detect sequence type: dna, rna, or unknown."""
    has_t = "T" in seq
    has_u = "U" in seq
    if has_t and not has_u:
        return "dna"
    if has_u and not has_t:
        return "rna"
    if not has_t and not has_u:
        # Could be either — default to DNA for ASO contexts
        return "dna"
    return "unknown"


def _gc_content(seq: str) -> float:
    gc = sum(1 for b in seq if b in "GCgc")
    return round(gc / len(seq) * 100, 1) if seq else 0.0


def _find_invalid_chars(seq: str, seq_type: str) -> List[str]:
    valid = _IUPAC_DNA if seq_type == "dna" else _IUPAC_RNA
    return sorted(set(b for b in seq if b not in valid))


def _count_motif(seq: str, motif: str) -> int:
    return seq.count(motif.upper())


def _has_poly_g(seq: str, min_run: int = 4) -> bool:
    return bool(re.search(rf"G{{{min_run},}}", seq.upper()))


def _has_poly_a_tail(seq: str, min_run: int = 6) -> bool:
    return bool(re.search(rf"A{{{min_run},}}$", seq.upper()))


def _find_orfs(seq: str) -> List[Dict[str, Any]]:
    """Find open reading frames in a DNA/RNA sequence."""
    orfs = []
    start_codons = {"ATG"} if "T" in seq else {"AUG"}
    stop_codons = {"TAA", "TAG", "TGA"} if "T" in seq else {"UAA", "UAG", "UGA"}

    for frame in range(3):
        i = frame
        while i < len(seq) - 2:
            codon = seq[i:i+3]
            if codon in start_codons:
                start = i
                j = i + 3
                while j < len(seq) - 2:
                    c = seq[j:j+3]
                    if c in stop_codons:
                        orfs.append({
                            "frame": frame + 1,
                            "start": start + 1,
                            "end": j + 3,
                            "length": j + 3 - start,
                            "proteinLength": (j - start) // 3,
                        })
                        break
                    j += 3
                i = j + 3 if j < len(seq) else len(seq)
            else:
                i += 3
    return orfs


def _immunostimulatory_motifs(seq: str) -> List[Dict[str, str]]:
    """Check for TLR7/8 immunostimulatory motifs."""
    motifs = []
    checks = [
        (r"UGUGUG", "UG-rich (TLR7/8 agonist)"),
        (r"GU{2,}G", "GU-rich motif"),
        (r"UUAA", "UU dinucleotide (immune trigger)"),
        (r"CGCG", "CpG motif (TLR9 agonist)"),
        (r"(.)\1{3,}", "Homopolymer run"),
    ]
    for pattern, label in checks:
        matches = re.findall(pattern, seq.upper())
        if matches:
            motifs.append({"motif": matches[0], "label": label})
    return motifs


def _secondary_structure_score(seq: str) -> Dict[str, Any]:
    """Simplified secondary structure prediction based on GC content and self-complementarity."""
    gc = _gc_content(seq)
    length = len(seq)

    # Estimate hairpin propensity
    palindromes = 0
    for i in range(length - 5):
        chunk = seq[i:i+6]
        if chunk == chunk[::-1]:
            palindromes += 1

    # MFE estimate (very simplified)
    gc_stability = gc / 100 * -1.5  # kcal/mol per GC pair estimate
    au_stability = (100 - gc) / 100 * -0.9  # kcal/mol per AU pair
    estimated_mfe = round((gc_stability + au_stability) * length / 2, 1)

    return {
        "estimatedMfe": estimated_mfe,
        "palindromicRegions": palindromes,
        "gcContent": gc,
        "hairpinRisk": "High" if palindromes > 3 else "Medium" if palindromes > 1 else "Low",
    }


def validate_sequence(raw_input: str, filename: Optional[str] = None) -> Dict[str, Any]:
    """Parse and validate an uploaded sequence.

    Returns a validation report with sequence stats, detected type, and any issues.
    """
    seq = _clean_sequence(raw_input)
    if not seq:
        return {"valid": False, "error": "No valid sequence found in the input."}

    seq_type = _detect_type(seq)
    invalid = _find_invalid_chars(seq, seq_type)

    gc = _gc_content(seq)
    length = len(seq)

    features = []
    if _has_poly_a_tail(seq):
        features.append("Poly-A tail detected")
    if _has_poly_g(seq):
        features.append("Poly-G tract detected")

    orfs = _find_orfs(seq) if seq_type == "dna" else []
    if orfs:
        best = max(orfs, key=lambda o: o["proteinLength"])
        features.append(f"Longest ORF: {best['proteinLength']} aa (frame {best['frame']})")

    return {
        "valid": len(invalid) == 0,
        "sequence": seq,
        "sequenceType": seq_type,
        "length": length,
        "gcContent": gc,
        "invalidChars": invalid,
        "features": features,
        "orfs": orfs[:5],  # top 5
        "filename": filename,
        "hasPolyA": _has_poly_a_tail(seq),
        "hasPolyG": _has_poly_g(seq),
    }


def analyze_sequence(seq: str, modality: str) -> Dict[str, Any]:
    """Run full analysis on a validated sequence for a given therapeutic modality."""
    seq_type = _detect_type(seq)
    gc = _gc_content(seq)
    length = len(seq)

    # Off-target estimation (simplified)
    off_target = _estimate_off_targets(seq)

    # Secondary structure
    structure = _secondary_structure_score(seq)

    # Immune screening
    immune = _immunostimulatory_motifs(seq)

    # Modality-specific analysis
    modality_results = _modality_analysis(seq, seq_type, modality)

    return {
        "sequenceType": seq_type,
        "length": length,
        "gcContent": gc,
        "offTarget": off_target,
        "secondaryStructure": structure,
        "immuneScreen": immune,
        "modality": modality_results,
    }


def _estimate_off_targets(seq: str) -> Dict[str, Any]:
    """Simplified off-target estimation based on sequence uniqueness."""
    length = len(seq)
    # Shorter sequences have more off-target risk
    if length < 18:
        risk = "High"
        note = "Short sequence increases off-target probability"
    elif length < 20:
        risk = "Medium"
        note = "Moderate length; some off-target matches possible"
    else:
        risk = "Low"
        note = "Adequate length for high specificity"

    # Check for repetitive elements
    k = 6
    if length >= k:
        kmers = [seq[i:i+k] for i in range(length - k + 1)]
        unique_kmers = len(set(kmers))
        repetitiveness = round(1 - unique_kmers / len(kmers), 3) if kmers else 0
    else:
        repetitiveness = 0

    return {
        "risk": risk,
        "note": note,
        "repetitiveness": repetitiveness,
        "recommendedMinLength": 18 if modality_any(seq) else 20,
    }


def modality_any(seq: str) -> bool:
    return True


def _modality_analysis(seq: str, seq_type: str, modality: str) -> Dict[str, Any]:
    """Modality-specific analysis."""
    gc = _gc_content(seq)
    length = len(seq)

    if modality == "aso":
        return _aso_analysis(seq, seq_type, gc, length)
    elif modality == " sirna":
        return _sirna_analysis(seq, gc, length)
    elif modality == "mrna":
        return _mrna_analysis(seq, seq_type, gc, length)
    elif modality == "sgrna":
        return _sgrna_analysis(seq, seq_type, gc, length)
    else:
        return {"recommendation": "Select a modality for detailed analysis"}


def _aso_analysis(seq: str, seq_type: str, gc: float, length: int) -> Dict[str, Any]:
    """ASO-specific analysis."""
    recommendations = []
    if gc < 30:
        recommendations.append("Low GC% — consider LNA or 2'-OMe modifications to boost Tm")
    elif gc > 70:
        recommendations.append("High GC% — risk of G-quadruplexes; consider shorter ASO")
    else:
        recommendations.append("GC content in optimal range for RNase H recruitment")

    if length < 15:
        recommendations.append("Very short — high off-target risk; minimum 18 nt recommended")
    elif length > 25:
        recommendations.append("Long ASO — may have reduced cellular uptake; consider gapmer design")

    chemistry = "gapmer" if gc >= 35 else "pmo"
    return {
        "recommendedChemistry": chemistry,
        "recommendations": recommendations,
        "optimalLength": "18-22 nt",
        "targetRegion": "Exon junction or mutated region recommended",
    }


def _sirna_analysis(seq: str, gc: float, length: int) -> Dict[str, Any]:
    """siRNA-specific analysis."""
    recommendations = []
    if length < 19 or length > 25:
        recommendations.append("Optimal siRNA length is 19-25 nt")
    if gc < 30 or gc > 52:
        recommendations.append("Optimal GC content for siRNA is 30-52%")

    # Check for 3' UU overhang potential
    if seq.endswith("UU") or seq.endswith("TT"):
        recommendations.append("3' UU/TT dinucleotide overhang detected — good for RISC loading")

    return {
        "strand": "Guide strand (antisense) + Passenger strand",
        "recommendations": recommendations,
        "optimalLength": "21 nt with 2-nt 3' overhangs",
        "thermodynamicBias": "Asymmetry: 5' thermodynamic instability of guide strand preferred",
    }


def _mrna_analysis(seq: str, seq_type: str, gc: float, length: int) -> Dict[str, Any]:
    """mRNA-specific analysis."""
    recommendations = []
    if seq_type != "rna":
        recommendations.append("Convert to RNA (T→U) for mRNA therapeutic design")

    orfs = _find_orfs(seq) if seq_type == "dna" else []
    if orfs:
        best = max(orfs, key=lambda o: o["proteinLength"])
        recommendations.append(f"Longest coding ORF: {best['proteinLength']} amino acids")

    if not _has_poly_a_tail(seq):
        recommendations.append("No poly-A tail — add 100-150 nt poly(A) for stability")

    recommendations.append("Consider 5' Cap analog (Anti-Reverse Cap ARCA)")
    recommendations.append("Evaluate codon optimization for human expression")

    return {
        "recommendations": recommendations,
        "needsCodonOptimization": True,
        "needsPolyA": not _has_poly_a_tail(seq),
        "needsUTR": True,
        "nucleosideModifications": ["N1-methylpseudouridine (m1Ψ)", "5-methylcytidine (m5C)"],
    }


def _sgrna_analysis(seq: str, seq_type: str, gc: float, length: int) -> Dict[str, Any]:
    """sgRNA/CRISPR-specific analysis."""
    recommendations = []
    if length < 17 or length > 21:
        recommendations.append("Optimal sgRNA spacer length is 17-21 nt (20 nt standard)")

    # Check for PAM requirement
    pam = "NGG" if "T" in seq else "NGG"
    recommendations.append(f"Requires {pam} PAM adjacent to target site (SpCas9)")

    if gc < 40 or gc > 80:
        recommendations.append("Optimal GC content for sgRNA is 40-80%")

    # Check for poly-T (Pol III terminator)
    if "TTTT" in seq.upper():
        recommendations.append("Poly-T tract detected — may cause premature transcription termination")

    return {
        "casProtein": "SpCas9 (NGG PAM)",
        "recommendations": recommendations,
        "optimalLength": "20 nt spacer + PAM",
        "offTargetMitigation": "Consider truncated sgRNAs (17-18 nt) for improved specificity",
    }
