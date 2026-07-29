export interface DiseaseGeneMatch {
  symbol: string;
  name: string | null;
  ensemblId: string | null;
  score: number | null;
}

export interface DiseaseSearchResponse {
  diseaseId: string | null;
  diseaseName: string | null;
  genes: DiseaseGeneMatch[];
}
