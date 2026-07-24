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
  strand: string;
  frame: number;
  start: number;
  end: number;
  length: number;
  proteinLength: number;
}

export interface OffTargetResult {
  lengthBasedRiskEstimate: "High" | "Medium" | "Low";
  note: string;
  internalRepetitiveness: number;
  recommendedMinLength: number;
  disclaimer: string;
}

export interface SecondaryStructureResult {
  estimatedMfe: number;
  palindromicRegions: number;
  palindromePositions: number[];
  gcContent: number;
  hairpinRisk: "High" | "Medium" | "Low";
}

export interface ImmuneMotif {
  motif: string;
  label: string;
  start: number;
  end: number;
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

export interface GcWindow {
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

export interface MeltingTemp {
  tmNearestNeighbor: number;
  tmBasicGC: number;
  length: number;
  gcContent?: number;
  method: string;
  note: string;
}

export interface ComplexityRegion {
  start: number;
  end: number;
  length: number;
  pattern?: string;
  repeats?: number;
  count?: number;
  positions?: number[];
}

export interface SequenceComplexity {
  dinucRepeats: (ComplexityRegion & { pattern: string; repeats: number })[];
  trinucRepeats: (ComplexityRegion & { pattern: string; count: number; positions: number[] })[];
  gcRichRegions: ComplexityRegion[];
  atRichRegions: ComplexityRegion[];
  selfComplementarity: { sequence: string; position: number; size: number }[];
  complexityScore: number;
}

export interface CodonInfo {
  codon: string;
  position: number;
  adaptiveness: number;
  isRare: boolean;
}

export interface CodonUsage {
  codons: CodonInfo[];
  cai: number;
  rareCodons: { codon: string; position: number; adaptiveness: number }[];
  totalCodons: number;
  note: string;
}

export interface ModScore {
  score: number;
  rationale: string;
}

export interface ModificationScores {
  modality: string;
  scores: Record<string, ModScore>;
  overallScore: number;
}

export interface EnergyPoint {
  position: number;
  energy: number;
}

export interface AnalysisReport {
  sequence: string;
  sequenceType: string;
  length: number;
  gcContent: number;
  offTarget: OffTargetResult;
  secondaryStructure: SecondaryStructureResult;
  immuneScreen: ImmuneMotif[];
  modality: ModalityResult;
  gcCurve: GcWindow[];
  composition: NucleotideComposition;
  orfs: OrfInfo[];
  meltingTemp?: MeltingTemp;
  complexity?: SequenceComplexity;
  codonUsage?: CodonUsage;
  modificationScores?: ModificationScores;
  energyProfile?: EnergyPoint[];
}

export type Modality = "aso" | "sirna" | "mrna" | "sgrna";
