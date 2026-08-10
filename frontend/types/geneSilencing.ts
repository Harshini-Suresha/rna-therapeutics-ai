export interface ExonInfo {
  id: string | null;
  index: number | null;
  start: number | null;
  end: number | null;
  length: number | null;
}

export interface TargetAnalysis {
  geneId: string;
  canonicalTranscript: { id: string; biotype: string } | null;
  totalCodingTranscripts: number;
  exons: ExonInfo[];
  cdsLength: number | null;
  mrnaSequence: string | null;
}

export interface DesignOption {
  id: string;
  label: string;
  description?: string;
  detail?: string;
}

export interface DesignOptions {
  chemistryOptions: DesignOption[];
  modificationOptions: DesignOption[];
  lengthRange: { min: number; max: number; default: number; step: number };
}

export interface RealMetrics {
  targetDuplexEnergy: number;
  meltingTempC: number;
  selfStructureMfe: number;
  gcContent: number;
  cpgCount: number;
  longestHomopolymer: number;
  purineContent: number;
  gcSkew: number;
  sequenceComplexity: number;
  polyGPass: boolean;
  molecularWeight: number;
  extinctionCoefficient: number;
  duplexStability: string;
}

export interface HeuristicEstimate {
  value: number;
  note: string;
}

export interface VariantParseResult {
  parsed: boolean;
  type?: string;
  cdsStart?: number;
  cdsEnd?: number;
  length?: number;
  reason?: string;
}

export interface HeuristicEstimates {
  nucleaseResistance: HeuristicEstimate;
  cellularUptake: HeuristicEstimate;
  bbbCrossing: HeuristicEstimate;
  synthesisDifficulty: HeuristicEstimate;
  offTargetRisk: HeuristicEstimate;
  immuneStimulation: HeuristicEstimate;
}

export interface AssoCandidate {
  sequence: string;
  length: number;
  compositeScore: number;
  learnedEfficacy: {
    available: boolean;
    value: number | null;
    modelInfo: string;
    scopeCaveat: string | null;
  };
  realMetrics: RealMetrics;
  heuristicEstimates: HeuristicEstimates;
  targetRegion: string;
  mechanismId: string;
  chemistry: string;
  modifications: string[];
  exonNumber: number | null;
  exonLength: number | null;
  deliveryContext: string;
  defectType: string;
  defectNotes: string;
  mechanismNotes?: string;
  silencingScope?: string;
  knownVariant?: string;
  seedSiteStatus?: string | null;
  seedSiteNote?: string | null;
  alleleSpecific?: boolean;
  alleleNotes?: string;
  alleleDiscriminationScore?: number | null;
  alleleDiscriminationNote?: string | null;
  admet?: {
    admetAvailable: boolean;
    absorptionScore: number | null;
    absorptionLevel: string | null;
    distributionScore: number | null;
    distributionLevel: string | null;
    metabolismScore: number | null;
    metabolismLevel: string | null;
    excretionScore: number | null;
    excretionLevel: string | null;
    toxicityScore: number | null;
    toxicityLevel: string | null;
    cellUptake: { score: number; level: string; notes?: string[] } | null;
    proteinBinding: { score: number; level: string } | null;
    nucleaseSensitivity: { score: number; level: string; halfLifeHours?: number } | null;
    renalClearance: { score: number; level: string; mechanism: string } | null;
    immunogenicity: { score: number; level: string; motifs: string[] } | null;
    offTargetRisk: { score: number; level: string } | null;
    hemolysisRisk: { score: number; level: string } | null;
    admetAnalysis: string | null;
    admetWarnings: string[];
    admetStrengths: string[];
  };
}

export interface GenerateResponse {
  geneId: string;
  mechanismId: string;
  targetExons: number[] | null;
  chemistry: string;
  modifications: string[];
  asoLength: number;
  totalExons: number;
  cdsLength: number | null;
  mechanismNotes: string;
  isAlleleSpecific?: boolean;
  variantParse?: VariantParseResult | null;
  admet?: {
    admetAvailable: boolean;
    absorptionScore: number | null;
    absorptionLevel: string | null;
    distributionScore: number | null;
    distributionLevel: string | null;
    metabolismScore: number | null;
    metabolismLevel: string | null;
    excretionScore: number | null;
    excretionLevel: string | null;
    toxicityScore: number | null;
    toxicityLevel: string | null;
    cellUptake: { score: number; level: string; notes?: string[] } | null;
    proteinBinding: { score: number; level: string } | null;
    nucleaseSensitivity: { score: number; level: string; halfLifeHours?: number } | null;
    renalClearance: { score: number; level: string; mechanism: string } | null;
    immunogenicity: { score: number; level: string; motifs: string[] } | null;
    offTargetRisk: { score: number; level: string } | null;
    hemolysisRisk: { score: number; level: string } | null;
    admetAnalysis: string | null;
    admetWarnings: string[];
    admetStrengths: string[];
  };
  candidates: AssoCandidate[];
}

export interface ClinVarVariant {
  variantId: string;
  clinicalSignificance: string;
  hgvsp: string;
  hgvsc: string;
  goldStars: number;
  rsid: string | null;
  alleleFrequency: number | null;
}
