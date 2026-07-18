export interface MechanismOption {
  id: string;
  label: string;
}

export interface MechanismOptions {
  geneSilencing: {
    defectTypes: MechanismOption[];
    silencingScopes: MechanismOption[];
  };
  rnaProcessing: {
    spliceDefectTypes: MechanismOption[];
  };
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
    defectType?: string;
    silencingScope?: string;
    spliceDefectType?: string;
    targetExon?: string | null;
    deliveryContext: string | null;
    knownVariant: string | null;
  };
  results: RankedMechanism[];
}

export type TherapeuticGoalId = "TG01" | "TG04";

export interface TherapeuticGoal {
  id: TherapeuticGoalId;
  name: string;
  description: string;
}

export const THERAPEUTIC_GOALS: TherapeuticGoal[] = [
  {
    id: "TG01",
    name: "Gene Silencing",
    description: "Reduce expression of a pathogenic gene or transcript through transcriptional or post-transcriptional mechanisms.",
  },
  {
    id: "TG04",
    name: "RNA Processing Modulation",
    description: "Modify RNA maturation, including splicing, polyadenylation, transcript processing, and RNA stability.",
  },
];
