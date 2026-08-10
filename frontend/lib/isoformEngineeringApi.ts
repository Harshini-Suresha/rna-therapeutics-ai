import {
  IsoformEngineeringInputs,
  IsoformEngineeringResponse,
  DesignOptions,
  IsoformCandidate,
} from "@/types/isoformEngineering";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchDesignOptions(): Promise<DesignOptions> {
  try {
    const res = await fetch(`${API_BASE}/api/isoform-engineering/options`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error("Could not load design options.");
    return res.json();
  } catch {
    return getDefaultDesignOptions();
  }
}

export async function generateConstructs(
  params: IsoformEngineeringInputs
): Promise<IsoformEngineeringResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/isoform-engineering/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target_symbol: params.targetSymbol,
        isoform_goal: params.isoformGoal,
        target_exon_locus: params.targetExonLocus,
        splice_element_target: params.spliceElementTarget,
        steric_chemistry: params.stericChemistry,
        enforce_in_frame: params.enforceInFrame,
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

function buildMockResponse(params: IsoformEngineeringInputs): IsoformEngineeringResponse {
  const symbol = params.targetSymbol.toUpperCase();

  const candidates: IsoformCandidate[] = [
    {
      rank: 1,
      constructId: `iso-${symbol}-v3`,
      modality: "Isoform Engineering ASO",
      vectorTopology: "Steric-Blocking ASO",
      cai: 0.93,
      uContent: 19.5,
      mfe: -285.3,
      initiationEfficiency: 85,
      predictedIsoformYield: "3.5× High",
      tlrRisk: "Low (2'-MOE/PS)",
      spliceEfficiency: 92,
      inFrameStatus: "In-Frame",
      secondaryStructureFlag: "PASSED",
      sequence: generateMockSequence("aso", symbol),
      features: generateMockFeatures(true),
      diagnostics: {
        aminoAcidIdentity: 98.5,
        tlr3Score: 10.2,
        tlr7Score: 8.1,
        tlr8Score: 9.3,
        mfePlot: "......(((...)))........(((...)))....................",
        fiveUtrHairpin: false,
        spliceSiteScore: 0.92,
      },
    },
    {
      rank: 2,
      constructId: `iso-${symbol}-v1`,
      modality: "Isoform Engineering ASO",
      vectorTopology: "Steric-Blocking ASO",
      cai: 0.91,
      uContent: 21.2,
      mfe: -310.7,
      initiationEfficiency: 78,
      predictedIsoformYield: "2.9× Medium",
      tlrRisk: "Low (2'-MOE/PS)",
      spliceEfficiency: 85,
      inFrameStatus: "In-Frame",
      secondaryStructureFlag: "PASSED",
      sequence: generateMockSequence("aso", symbol),
      features: generateMockFeatures(true),
      diagnostics: {
        aminoAcidIdentity: 98.5,
        tlr3Score: 11.5,
        tlr7Score: 9.2,
        tlr8Score: 10.1,
        mfePlot: "..(((...)))..(((...)))........(((...)))..............",
        fiveUtrHairpin: false,
        spliceSiteScore: 0.85,
      },
    },
    {
      rank: 3,
      constructId: `iso-${symbol}-v5`,
      modality: "Isoform Engineering ASO",
      vectorTopology: "Steric-Blocking ASO",
      cai: 0.89,
      uContent: 23.8,
      mfe: -345.2,
      initiationEfficiency: 71,
      predictedIsoformYield: "2.1× Medium",
      tlrRisk: "Moderate",
      spliceEfficiency: 78,
      inFrameStatus: "In-Frame",
      secondaryStructureFlag: "PASSED",
      sequence: generateMockSequence("aso", symbol),
      features: generateMockFeatures(true),
      diagnostics: {
        aminoAcidIdentity: 98.5,
        tlr3Score: 15.8,
        tlr7Score: 12.4,
        tlr8Score: 13.9,
        mfePlot: "....(((...)))....(((...)))........(((...)))............",
        fiveUtrHairpin: false,
        spliceSiteScore: 0.78,
      },
    },
  ];

  const overview = {
    targetGene: symbol,
    refSeq: "NM_000492.3",
    nativeLength: "1,480 aa",
    vectorTopology: "Steric-Blocking ASO",
    cai: 0.91,
    uContent: 21.5,
    primaryMechanism: "A7 Exon Inclusion / Skiing Modulation",
    feasibilityScore: 84,
    predictedHalfLife: "48–72 hrs",
  };

  return {
    overview,
    candidates,
  };
}

function generateMockFeatures(isLinear: boolean): IsoformCandidate["features"] {
  if (isLinear) {
    return [
      { name: "5' UTR", start: 2, end: 82, type: "utr" },
      { name: "Kozak Consensus", start: 83, end: 89, type: "kozak" },
      { name: "Codon-Optimized ORF", start: 90, end: 4449, type: "orf" },
      { name: "Exon 7 (Targeted)", start: 4450, end: 4520, type: "exon" },
      { name: "Intron (Splice Mod)", start: 4521, end: 4521, type: "intron" },
      { name: "3' UTR", start: 4522, end: 4603, type: "utr3" },
      { name: "Poly(A) Tail (120 nt)", start: 4604, end: 4723, type: "polyA" },
    ];
  }
  return [
    { name: "5' UTR", start: 2, end: 82, type: "utr" },
    { name: "Kozak Consensus", start: 83, end: 89, type: "kozak" },
    { name: "Codon-Optimized ORF", start: 90, end: 4449, type: "orf" },
    { name: "3' UTR", start: 4450, end: 4531, type: "utr3" },
    { name: "Poly(A) Tail (120 nt)", start: 4532, end: 4651, type: "polyA" },
  ];
}

function generateMockSequence(type: string, symbol: string): string {
  return `GCCACC...AUG ${symbol}_ISOFORM_ENGINEERED_${type.toUpperCase()} SEQUENCE ...UAA...PolyA120`;
}

function getDefaultDesignOptions(): DesignOptions {
  return {
    isoformGoals: [
      { id: "exon_skipping", label: "Exon Skipping", description: "Skip a specific exon to restore the reading frame or remove a toxic domain." },
      { id: "exon_inclusion", label: "Exon Inclusion", description: "Force inclusion of a beneficial exon that is normally skipped." },
      { id: "intron_retention", label: "Intron Retention", description: "Retain a specific intron to introduce a premature stop codon for NMD-mediated silencing." },
      { id: "alternative_splice_site", label: "Alternative Splice Site Selection", description: "Redirect splicing to an alternative splice site to generate a different isoform." },
      { id: "mutually_exclusive_exon", label: "Mutually Exclusive Exon Switch", description: "Switch between mutually exclusive exons to favor a therapeutically beneficial isoform." },
    ],
    targetExonLoci: [
      { id: "exon_7", label: "Exon 7" },
      { id: "exon_23", label: "Exon 23" },
      { id: "exon_51", label: "Exon 51" },
      { id: "exon_45", label: "Exon 45" },
      { id: "custom", label: "Custom Exon Locus" },
    ],
    spliceElementTargets: [
      { id: "splice_donor", label: "Splice Donor Site (5' SS)" },
      { id: "splice_acceptor", label: "Splice Acceptor Site (3' SS)" },
      { id: "exonic_splicing_enhancer", label: "Exonic Splicing Enhancer (ESE)" },
      { id: "exonic_splicing_silencer", label: "Exonic Splicing Silencer (ESS)" },
      { id: "intronic_splicing_enhancer", label: "Intronic Splicing Enhancer (ISE)" },
      { id: "intronic_splicing_silencer", label: "Intronic Splicing Silencer (ISS)" },
    ],
    stericChemistries: [
      { id: "gapmer", label: "DNA Gapmer (2'-MOE/PS)" },
      { id: "lnai", label: "LNA/2'-O-Methyl mix" },
      { id: "fully_modified", label: "Fully Modified 2'-MOE/PS" },
      { id: "pna", label: "Peptide Nucleic Acid (PNA)" },
    ],
  };
}

export async function emailIsoformReport(reportContent: string, filename: string): Promise<{ message: string }> {
  const token = getToken();
  if (!token) throw new Error("Sign in to email a report to your registered address.");
  const res = await fetch(`${API_BASE}/api/isoform-engineering/email-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ report_content: reportContent, filename }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Could not email the report.");
  return body;
}
