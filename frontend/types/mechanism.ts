export interface MechanismOption {
  id: string;
  label: string;
}

export interface MechanismOptions {
  defectTypes: MechanismOption[];
  silencingScopes: MechanismOption[];
  deliveryContexts: MechanismOption[];
}

export interface MechanismReference {
  refId: string;
  paper: string;
  doi: string | null;
  usedFor: string | null;
}

export interface RankedMechanism {
  id: string;
  name: string;
  category: string | null;
  eligible: boolean;
  score: number;
  rationale: string[];
  evidenceLevel: { rating: string | null; note: string | null } | null;
  fdaApprovedDrugs: string | null;
  clinicalTrialExamples: string | null;
  suitableVariantTypes: string | null;
  rnaTargetRegion: string | null;
  asoChemistry: string | null;
  designRules: string | null;
  advantages: string | null;
  limitations: string | null;
  offTargetConsiderations: string | null;
  references: MechanismReference[];
}

export interface MechanismRankingResponse {
  geneSymbol: string;
  therapeuticGoal: string;
  inputs: {
    defectType: string;
    silencingScope: string;
    deliveryContext: string | null;
    knownVariant: string | null;
  };
  results: RankedMechanism[];
}
