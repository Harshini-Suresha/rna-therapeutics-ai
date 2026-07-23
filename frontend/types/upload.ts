export interface ValidationReport {
  valid: boolean;
  error?: string;
  sequence: string;
  sequenceType: "dna" | "rna" | "unknown";
  length: number;
  gcContent: number;
  invalidChars: string[];
  features: string[];
  orfs: OrfInfo[];
  filename?: string;
  hasPolyA: boolean;
  hasPolyG: boolean;
}

export interface OrfInfo {
  frame: number;
  start: number;
  end: number;
  length: number;
  proteinLength: number;
}

export interface OffTargetResult {
  risk: "High" | "Medium" | "Low";
  note: string;
  repetitiveness: number;
  recommendedMinLength: number;
}

export interface SecondaryStructureResult {
  estimatedMfe: number;
  palindromicRegions: number;
  gcContent: number;
  hairpinRisk: "High" | "Medium" | "Low";
}

export interface ImmuneMotif {
  motif: string;
  label: string;
}

export interface ModalityResult {
  recommendedChemistry?: string;
  recommendations: string[];
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

export interface AnalysisReport {
  sequenceType: string;
  length: number;
  gcContent: number;
  offTarget: OffTargetResult;
  secondaryStructure: SecondaryStructureResult;
  immuneScreen: ImmuneMotif[];
  modality: ModalityResult;
}
