export interface OrfHit {
  strand: "+" | "-";
  frame: number;
  start: number;
  end: number;
  length: number;
  proteinLength: number;
}

export interface ValidateResponse {
  valid: boolean;
  error?: string;
  sequence?: string;
  sequenceType?: "dna" | "rna" | "unknown";
  length?: number;
  gcContent?: number;
  invalidChars?: string[];
  features?: string[];
  orfs?: OrfHit[];
  filename?: string | null;
  hasPolyA?: boolean;
  hasPolyG?: boolean;
}

export interface SpecificityHeuristic {
  lengthBasedRiskEstimate: "High" | "Medium" | "Low";
  note: string;
  internalRepetitiveness: number;
  recommendedMinLength: number;
  disclaimer: string;
}

export interface SecondaryStructureEstimate {
  estimatedMfe: number;
  palindromicRegions: number;
  palindromePositions: number[];
  gcContent: number;
  hairpinRisk: "High" | "Medium" | "Low";
}

export interface ImmuneMotifHit {
  motif: string;
  label: string;
  start: number;
  end: number;
}

export interface GcCurvePoint {
  position: number;
  gc: number;
}

export interface NucleotideComposition {
  A: number;
  C: number;
  G: number;
  T: number;
  U: number;
}

export type Modality = "aso" | "sirna" | "mrna" | "sgrna";

export interface ModalityAnalysis {
  recommendations?: string[];
  recommendedChemistry?: string;
  optimalLength?: string;
  targetRegion?: string;
  strand?: string;
  thermodynamicBias?: string;
  needsCodonOptimization?: boolean;
  needsPolyA?: boolean;
  needsUTR?: boolean;
  nucleosideModifications?: string[];
  casProtein?: string;
  offTargetMitigation?: string;
}

export interface AnalyzeResponse {
  sequence: string;
  sequenceType: "dna" | "rna" | "unknown";
  length: number;
  gcContent: number;
  offTarget: SpecificityHeuristic;
  secondaryStructure: SecondaryStructureEstimate;
  immuneScreen: ImmuneMotifHit[];
  modality: ModalityAnalysis;
  gcCurve: GcCurvePoint[];
  composition: NucleotideComposition;
  orfs: OrfHit[];
  meltingTemp?: {
    tmNearestNeighbor: number;
    tmBasicGC: number;
    length: number;
    gcContent?: number;
    method: string;
    note: string;
  };
  complexity?: {
    dinucRepeats: { pattern: string; start: number; end: number; repeats: number }[];
    trinucRepeats: { pattern: string; count: number; positions: number[] }[];
    gcRichRegions: { start: number; end: number; length: number }[];
    atRichRegions: { start: number; end: number; length: number }[];
    selfComplementarity: { sequence: string; position: number; size: number }[];
    complexityScore: number;
  };
  codonUsage?: {
    codons: { codon: string; position: number; adaptiveness: number; isRare: boolean }[];
    cai: number;
    rareCodons: { codon: string; position: number; adaptiveness: number }[];
    totalCodons: number;
    note: string;
  };
  modificationScores?: {
    modality: string;
    scores: Record<string, { score: number; rationale: string }>;
    overallScore: number;
  };
  energyProfile?: { position: number; energy: number }[];
}
