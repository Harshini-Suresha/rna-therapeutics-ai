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
  gcContent: number;
  hairpinRisk: "High" | "Medium" | "Low";
}

export interface ImmuneMotifHit {
  motif: string;
  label: string;
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
  sequenceType: "dna" | "rna" | "unknown";
  length: number;
  gcContent: number;
  offTarget: SpecificityHeuristic;
  secondaryStructure: SecondaryStructureEstimate;
  immuneScreen: ImmuneMotifHit[];
  modality: ModalityAnalysis;
}
