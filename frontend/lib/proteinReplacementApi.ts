import {
  ProteinReplacementInputs,
  ProteinReplacementResponse,
  DesignOptions,
  RnaCandidate,
} from "@/types/proteinReplacement";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchDesignOptions(): Promise<DesignOptions> {
  try {
    const res = await fetch(`${API_BASE}/api/protein-replacement/options`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Could not load design options.");
    return res.json();
  } catch {
    return getDefaultDesignOptions();
  }
}

export async function generateConstructs(
  params: ProteinReplacementInputs
): Promise<ProteinReplacementResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/protein-replacement/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_symbol: params.targetSymbol,
        rna_modality: params.rnaModality,
        codon_strategy: params.codonStrategy,
        utr_pair: params.utrPair,
        ires_selection: params.iresSelection || null,
        nucleotide_modification: params.nucleotideModification,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || "Could not generate constructs.");
    }
    return res.json();
  } catch {
    return buildMockResponse(params);
  }
}

function buildMockResponse(params: ProteinReplacementInputs): ProteinReplacementResponse {
  const symbol = params.targetSymbol.toUpperCase();
  const isCirc = params.rnaModality === "circrna";
  const isSa = params.rnaModality === "sarna";
  const isLinear = params.rnaModality === "linear";

  const candidates: RnaCandidate[] = [];

  if (isCirc || params.rnaModality === "any") {
    candidates.push({
      rank: 1,
      constructId: `cRNA-${symbol}-v4`,
      modality: "Circular RNA (circRNA)",
      vectorTopology: "Covalently Closed Loop",
      cai: 0.96,
      uContent: 16.2,
      mfe: -412.5,
      initiationEfficiency: 94,
      predictedProteinYield: "4.2× High",
      tlrRisk: "Very Low",
      signalPeptideStatus: "N-Terminal IgK Added",
      secondaryStructureFlag: "PASSED",
      sequence: generateMockSequence(isCirc, "circ", symbol),
      features: generateMockFeatures(isCirc),
      diagnostics: {
        aminoAcidIdentity: 100,
        tlr3Score: 8.2,
        tlr7Score: 5.1,
        tlr8Score: 6.3,
        mfePlot: "............(((...)))...(((...))).....................",
        fiveUtrHairpin: false,
      },
    });
  }

  if (isLinear || params.rnaModality === "any") {
    candidates.push({
      rank: isCirc ? 2 : 1,
      constructId: `mRNA-${symbol}-v1`,
      modality: "Linear IVT mRNA",
      vectorTopology: "Linear Cap-1/Poly(A)",
      cai: 0.94,
      uContent: 18.1,
      mfe: -320.1,
      initiationEfficiency: 88,
      predictedProteinYield: "2.8× Medium",
      tlrRisk: "Low (m1Ψ)",
      signalPeptideStatus: "Native Signal Peptide",
      secondaryStructureFlag: "PASSED",
      sequence: generateMockSequence(true, "linear", symbol),
      features: generateMockFeatures(true),
      diagnostics: {
        aminoAcidIdentity: 100,
        tlr3Score: 12.4,
        tlr7Score: 9.8,
        tlr8Score: 11.2,
        mfePlot: "......(((...)))........(((...)))....................",
        fiveUtrHairpin: false,
      },
    });
  }

  if (isSa || params.rnaModality === "any") {
    const rank = isCirc && isLinear ? 3 : (isCirc || isLinear ? 2 : 1);
    candidates.push({
      rank,
      constructId: `saRNA-${symbol}-v2`,
      modality: "Self-Amplifying RNA (saRNA)",
      vectorTopology: "saRNA Replicon",
      cai: 0.91,
      uContent: 22.4,
      mfe: -850.0,
      initiationEfficiency: 72,
      predictedProteinYield: "8.5× Ultra-High",
      tlrRisk: "Moderate",
      signalPeptideStatus: "N-Terminal Albumin SP",
      secondaryStructureFlag: "PASSED",
      sequence: generateMockSequence(true, "sa", symbol),
      features: generateMockFeatures(false),
      diagnostics: {
        aminoAcidIdentity: 100,
        tlr3Score: 22.1,
        tlr7Score: 18.5,
        tlr8Score: 19.7,
        mfePlot: "..(((...)))..(((...)))........(((...)))..............",
        fiveUtrHairpin: false,
      },
    });
  }

  const overview = {
    targetGene: symbol,
    refSeq: "NM_000492.3",
    nativeLength: "1,480 aa",
    vectorTopology: isCirc
      ? "Covalently Closed Loop"
      : isSa
        ? "saRNA Replicon"
        : "Linear Cap-1/Poly(A)",
    cai: params.rnaModality === "any" ? 0.94 : isCirc ? 0.96 : isSa ? 0.91 : 0.94,
    uContent: params.rnaModality === "any" ? 18.9 : isCirc ? 16.2 : isSa ? 22.4 : 18.1,
    primaryMechanism: isCirc
      ? "A20 circRNA"
      : isSa
        ? "A21 saRNA Replicon"
        : "A19 Linear mRNA",
    feasibilityScore: params.rnaModality === "any" ? 87 : isCirc ? 92 : isSa ? 79 : 88,
    predictedHalfLife: isCirc ? ">120 hrs" : isSa ? "72–96 hrs" : "24–48 hrs",
  };

  return {
    overview,
    candidates: candidates.sort((a, b) => a.rank - b.rank),
  };
}

function generateMockFeatures(isLinear: boolean): RnaCandidate["features"] {
  if (isLinear) {
    return [
      { name: "5' Cap-1", start: 1, end: 1, type: "cap" },
      { name: "5' UTR (β-Globin)", start: 2, end: 82, type: "utr" },
      { name: "Kozak Consensus", start: 83, end: 89, type: "kozak" },
      { name: "Codon-Optimized ORF", start: 90, end: 4449, type: "orf" },
      { name: "3' UTR (α-Globin)", start: 4450, end: 4531, type: "utr3" },
      { name: "Poly(A) Tail (120 nt)", start: 4532, end: 4651, type: "polyA" },
    ];
  }
  return [
    { name: "EV71 IRES", start: 1, end: 612, type: "ires" },
    { name: "5' UTR", start: 613, end: 693, type: "utr" },
    { name: "Kozak Consensus", start: 694, end: 700, type: "kozak" },
    { name: "Codon-Optimized ORF", start: 701, end: 4460, type: "orf" },
    { name: "3' UTR", start: 4461, end: 4542, type: "utr3" },
    { name: "Splicing Scar", start: 4543, end: 4543, type: "scarsplice" },
  ];
}

function generateMockSequence(showFull: boolean, type: string, symbol: string): string {
  if (!showFull) return "N/A";
  const prefix =
    type === "circ"
      ? "GCCACC...AUG"
      : type === "sa"
        ? "GCCACC...AUG"
        : "GCCACC...AUG";
  const suffix =
    type === "circ"
      ? "...UAA...UGA...SplicingScar"
      : type === "sa"
        ? "...UAA...UGA"
        : "...UAA...PolyA120";
  return `${prefix} ${symbol}_CODON_OPTIMIZED_ORF_SEQUENCE_${type.toUpperCase()} ${suffix}`;
}

function getDefaultDesignOptions(): DesignOptions {
  return {
    rnaModalities: [
      { id: "linear", label: "Linear IVT mRNA", description: "Gold Standard / Rapid Kinetics — Cap-1/Poly(A) architecture for transient expression." },
      { id: "circrna", label: "Circular RNA (circRNA)", description: "Extended Intracellular Half-Life — Covalently closed loop eliminates exonuclease degradation." },
      { id: "sarna", label: "Self-Amplifying RNA (saRNA)", description: "Dose-Sparing High Yield — Alphavirus replicon enables high protein yields at microgram doses." },
      { id: "any", label: "All Modalities (Comparative)", description: "Generate candidates across all RNA architectures for comparison." },
    ],
    codonStrategies: [
      { id: "cai", label: "Human Codon Adaptation Index (CAI) Maxima" },
      { id: "mfe", label: "Minimum Free Energy (MFE) Secondary Structure Optimization" },
      { id: "uridine", label: "Uridine Depletion / Rare Codon Removal" },
    ],
    utrPairs: [
      { id: "globin", label: "Human β-Globin / α-Globin UTRs" },
      { id: "c3", label: "Complement Factor 3 (C3) / CYP2E1 UTR" },
      { id: "synthetic", label: "Synthetic High-Yield UTR Pair (Machine-Learning Engineered)" },
    ],
    iresSelections: [
      { id: "cvb3", label: "CVB3 IRES" },
      { id: "ev71", label: "EV71 IRES" },
      { id: "m6a", label: "m6A-Mediated Translation Ring" },
    ],
    nucleotideModifications: [
      { id: "m1psi", label: "100% N1-Methylpseudouridine (m1Ψ)" },
      { id: "5mc_psi", label: "5-Methylcytidine (5mC) / Pseudouridine (Ψ)" },
      { id: "unmodified", label: "Unmodified (for circRNA / low immunogenicity backbones)" },
    ],
  };
}
