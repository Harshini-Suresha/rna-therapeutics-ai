"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft, Pill, Activity, Dna } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card, Pill as UiPill } from "@/components/ui";
import { fetchDiseaseDetail } from "@/lib/diseaseSearchApi";
import { DiseaseDetailResponse } from "@/types/diseaseSearch";

const PREFILL_KEY = "aso:prefillGeneSearch";

function phaseLabel(phase: number | null, status?: string | null): string {
  if (phase !== null) {
    if (phase >= 4) return "Approved";
    return `Phase ${phase}`;
  }
  if (status) return status;
  return "—";
}

export default function DiseaseSearchResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("query") ?? "";

  const [detail, setDetail] = useState<DiseaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setError("No disease name provided.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchDiseaseDetail(query)
      .then((res) => {
        if (!res.diseaseId) {
          setError(`No matching disease found for "${query}".`);
        }
        setDetail(res);
      })
      .catch(() => setError("Could not reach the disease search service."))
      .finally(() => setLoading(false));
  }, [query]);

  function handleUseGene(symbol: string) {
    sessionStorage.setItem(
      PREFILL_KEY,
      JSON.stringify({ organism: "human", geneSymbol: symbol, diseaseName: detail?.diseaseName ?? query })
    );
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-4xl space-y-5">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to search
            </button>

            {loading && (
              <Card className="flex items-center justify-center gap-2 p-10 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Searching Open Targets for &ldquo;{query}&rdquo;...
              </Card>
            )}

            {!loading && error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {!loading && detail && detail.diseaseId && (
              <>
                {/* Header */}
                <Card className="p-6">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    {detail.diseaseId}
                  </p>
                  <h1 className="mt-1 text-[22px] font-semibold text-slate-800">{detail.diseaseName}</h1>
                  {detail.description && (
                    <p className="mt-2 text-[13.5px] leading-relaxed text-slate-600">{detail.description}</p>
                  )}
                  {detail.therapeuticAreas.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {detail.therapeuticAreas.map((ta) => (
                        <UiPill key={ta} tone="blue">
                          {ta}
                        </UiPill>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 text-[11.5px] text-slate-400">Source: Open Targets Platform</p>
                </Card>

                {/* Associated genes */}
                <Card className="p-5">
                  <div className="flex items-center gap-2">
                    <Dna className="h-4 w-4 text-indigo-500" />
                    <p className="text-[14px] font-semibold text-slate-800">
                      Associated Genes ({detail.genes.length})
                    </p>
                  </div>
                  <p className="mt-1 text-[12px] text-slate-500">
                    Ranked by Open Targets&apos; evidence-based association score. Pick one to proceed
                    into gene verification.
                  </p>
                  <div className="mt-3 space-y-1.5">
                    {detail.genes.map((g) => (
                      <div
                        key={g.symbol}
                        className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5 hover:bg-slate-50"
                      >
                        <div>
                          <p className="text-[13px] font-medium text-slate-800">{g.symbol}</p>
                          {g.name && <p className="text-[12px] text-slate-500">{g.name}</p>}
                        </div>
                        <div className="flex items-center gap-3">
                          {g.score !== null && (
                            <span className="text-[11.5px] text-slate-400">score {g.score.toFixed(2)}</span>
                          )}
                          <button
                            onClick={() => handleUseGene(g.symbol)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:border-brand hover:text-brand"
                          >
                            Use this gene
                          </button>
                        </div>
                      </div>
                    ))}
                    {detail.genes.length === 0 && (
                      <p className="text-[12.5px] text-slate-400">No associated genes returned.</p>
                    )}
                  </div>
                </Card>

                {/* Known drugs */}
                {detail.knownDrugs.length > 0 && (
                  <Card className="p-5">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-emerald-600" />
                      <p className="text-[14px] font-semibold text-slate-800">
                        Known Drugs ({detail.knownDrugs.length})
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {detail.knownDrugs.map((d, i) => (
                        <div key={i} className="border-b border-slate-100 pb-2 last:border-0">
                          <div className="flex items-center justify-between">
                            <p className="text-[13px] font-medium text-slate-800">{d.name}</p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                              {phaseLabel(d.phase, d.status)}
                            </span>
                          </div>
                          {d.mechanismOfAction && (
                            <p className="mt-0.5 text-[12px] text-slate-500">{d.mechanismOfAction}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {detail.genes.length === 0 && detail.knownDrugs.length === 0 && !detail.description && (
                  <Card className="flex items-center gap-2 p-5 text-[12.5px] text-slate-500">
                    <Activity className="h-4 w-4 text-slate-400" />
                    The disease was found, but Open Targets didn&apos;t return additional detail for it.
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
