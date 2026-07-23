import {
  MechanismOptions,
  MechanismRankingResponse,
  TherapeuticGoalId,
} from "@/types/mechanism";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchMechanismOptions(): Promise<MechanismOptions> {
  const res = await fetch(`${API_BASE}/api/mechanisms/options`, { cache: "no-store" });
  if (!res.ok) throw new Error("Could not load mechanism selection options.");
  return res.json();
}

export async function rankGeneSilencingMechanisms(params: {
  geneSymbol: string;
  defectType: string;
  silencingScope: string;
  deliveryContext?: string | null;
  knownVariant?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/gene-silencing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      defect_type: params.defectType,
      silencing_scope: params.silencingScope,
      delivery_context: params.deliveryContext || null,
      known_variant: params.knownVariant || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export async function rankRnaProcessingMechanisms(params: {
  geneSymbol: string;
  spliceDefectType: string;
  targetExon?: string | null;
  deliveryContext?: string | null;
  knownVariant?: string | null;
}): Promise<MechanismRankingResponse> {
  const res = await fetch(`${API_BASE}/api/mechanisms/rna-processing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: params.geneSymbol,
      splice_defect_type: params.spliceDefectType,
      target_exon: params.targetExon || null,
      delivery_context: params.deliveryContext || null,
      known_variant: params.knownVariant || null,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || "Could not rank mechanisms.");
  }
  return res.json();
}

export function getGoalLabel(goalId: TherapeuticGoalId): string {
  const labels: Record<TherapeuticGoalId, string> = {
    TG01: "Gene Silencing",
    TG02: "Gene Activation / Upregulation",
    TG03: "RNA Editing / Correction",
    TG04: "RNA Processing Modulation",
    TG05: "RNA Neutralization",
    TG06: "Translational Regulation",
    TG07: "Isoform Engineering",
    TG08: "Protein Replacement",
    TG09: "Protein Function Modulation",
  };
  return labels[goalId] ?? goalId;
}
