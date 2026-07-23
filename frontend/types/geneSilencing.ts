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
  meltingTemp: number;
  selfComplementScore: number;
  polygTracts: number;
  qualityScore: number;
  targetRegion: string;
  chemistry: string;
  modifications: string[];
}

export interface GenerateResponse {
  geneId: string;
  targetExons: number[] | null;
  chemistry: string;
  modifications: string[];
  asoLength: number;
  totalExons: number;
  cdsLength: number | null;
  candidates: AssoCandidate[];
}
