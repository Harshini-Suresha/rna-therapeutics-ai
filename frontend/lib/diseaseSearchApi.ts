import { DiseaseSearchResponse } from "@/types/diseaseSearch";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function searchDiseaseGenes(query: string): Promise<DiseaseSearchResponse> {
  const res = await fetch(`${API_BASE}/api/disease-search?query=${encodeURIComponent(query)}`, {
    cache: "no-store",
  });
  if (!res.ok) return { diseaseId: null, diseaseName: null, genes: [] };
  return res.json();
}
