import {
  TargetAnalysis,
  DesignOptions,
  GenerateResponse,
  ClinVarVariant,
} from "@/types/geneSilencing";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchTargetAnalysis(
  ensemblGeneId: string
): Promise<TargetAnalysis> {
  const res = await fetch(
    `${API_BASE}/api/gene-silencing/target/${ensemblGeneId}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not fetch target analysis.");
  }
  return res.json();
}

export async function fetchDesignOptions(): Promise<DesignOptions> {
  const res = await fetch(`${API_BASE}/api/gene-silencing/options`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not load design options.");
  return res.json();
}

export async function generateCandidates(params: {
  ensemblGeneId: string;
  mechanismId: string;
  targetExonIndices?: number[] | null;
  asoLength: number;
  chemistry: string;
  modifications: string[];
  deliveryContext?: string;
}): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/api/gene-silencing/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ensembl_gene_id: params.ensemblGeneId,
      mechanism_id: params.mechanismId,
      target_exon_indices: params.targetExonIndices ?? null,
      aso_length: params.asoLength,
      chemistry: params.chemistry,
      modifications: params.modifications,
      delivery_context: params.deliveryContext || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not generate candidates.");
  }
  return res.json();
}

export async function fetchClinVarVariants(
  ensemblGeneId: string
): Promise<ClinVarVariant[]> {
  const res = await fetch(
    `${API_BASE}/api/gene-silencing/variants/${ensemblGeneId}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.variants ?? [];
}
