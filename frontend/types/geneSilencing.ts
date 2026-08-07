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

export interface AssoCandidate {
  sequence: string;
  length: number;
  gcContent: number;
  polygTracts?: number;
  meltingTempC: number;
  selfStructureMfe: number;
  targetDuplexEnergy: number;
  targetRegion: string;
  mechanismId: string;
  chemistry: string;
  modifications: string[];
  exonNumber: number | null;
  exonLength: number | null;
  cpgCount: number;
  longestHomopolymer: number;
  purineContent: number;
  sequenceComplexity: number;
  gcSkew: number;
  molecularWeight: number;
  extinctionCoefficient: number;
  nucleaseResistance: number;
  cellularUptake: number;
  bbbCrossing: number;
  synthesisDifficulty: number;
  offTargetRisk: number;
  immuneStimulation: number;
  duplexStability: string;
  deliveryContext?: string;
  tissueUptakeModifier?: number;
  tissueBbbModifier?: number;
  tissueImmuneModifier?: number;
  tissueChemBonus?: number;
  tissueLengthModifier?: number;
  tissueNotes?: string;
  defectType: string;
  defectNotes: string;
  mechanismNotes?: string;
  silencingScope?: string;
  knownVariant?: string;
  alleleSpecific?: boolean;
  alleleNotes?: string;
  knownRegulatoryElement?: string;
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
