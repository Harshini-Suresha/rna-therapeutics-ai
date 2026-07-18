"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Dna } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MechanismCard from "@/components/MechanismCard";
import { Card, SectionHeader, FieldLabel } from "@/components/ui";
import { GeneTargetObject } from "@/types/gene";
import { MechanismOptions, MechanismRankingResponse } from "@/types/mechanism";
import { fetchMechanismOptions, rankGeneSilencingMechanisms } from "@/lib/mechanismApi";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";

export default function MechanismSelectionPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [options, setOptions] = useState<MechanismOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [defectType, setDefectType] = useState("");
  const [silencingScope, setSilencingScope] = useState("");
  const [deliveryContext, setDeliveryContext] = useState("");
  const [knownVariant, setKnownVariant] = useState("");

  const [ranking, setRanking] = useState<MechanismRankingResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem(CONFIRMED_TARGET_KEY);
    if (stored) {
      try {
        setGene(JSON.parse(stored));
      } catch {
        setGene(null);
      }
    }
    fetchMechanismOptions()
      .then(setOptions)
      .catch((e) => setOptionsError(e instanceof Error ? e.message : "Failed to load options."));
  }, []);

  async function handleRank() {
    if (!gene || !defectType || !silencingScope) return;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    try {
      const result = await rankGeneSilencingMechanisms({
        geneSymbol: gene.geneSymbol,
        defectType,
        silencingScope,
        deliveryContext,
        knownVariant,
      });
      setRanking(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectMechanism(id: string) {
    setSelectedId(id);
    const mechanism = ranking?.results.find((r) => r.id === id);
    if (mechanism) {
      sessionStorage.setItem(
        SELECTED_MECHANISM_KEY,
        JSON.stringify({ geneSymbol: gene?.geneSymbol, mechanism })
      );
    }
  }

  if (!gene) {
    return (
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex flex-1 items-center justify-center px-6">
            <Card className="max-w-md p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] font-medium text-slate-700">No confirmed target found</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Go back to Basic Information, load a gene, and hit Confirm &amp; Proceed first.
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Basic Information
              </button>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          {/* Confirmed target banner */}
          <Card className="flex items-center gap-3 px-5 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50">
              <Dna className="h-4.5 w-4.5 text-indigo-500" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-slate-800">
                {gene.geneSymbol} <span className="font-normal text-slate-400">· {gene.organism}</span>
              </p>
              <p className="text-[12px] text-slate-500">
                {gene.geneName ?? "—"}
                {gene.diseaseName ? ` · ${gene.diseaseName}` : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="ml-auto text-[12.5px] font-medium text-brand hover:underline"
            >
              Change target
            </button>
          </Card>

          {/* Step 3: mechanism inputs */}
          <Card>
            <SectionHeader step="3" title="Mechanism Selection — Gene Silencing" />
            {optionsError && (
              <p className="px-6 pb-2 text-[12.5px] text-red-600">{optionsError}</p>
            )}
            <div className="grid grid-cols-1 gap-4 px-6 pb-4 md:grid-cols-3">
              <div>
                <FieldLabel hint="What kind of molecular defect are you trying to counteract?">
                  Molecular Defect Type <span className="text-red-500">*</span>
                </FieldLabel>
                <select
                  value={defectType}
                  onChange={(e) => setDefectType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select defect type</option>
                  {options?.defectTypes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel hint="Do you need to silence the whole transcript, or spare the wild-type allele?">
                  Silencing Scope <span className="text-red-500">*</span>
                </FieldLabel>
                <select
                  value={silencingScope}
                  onChange={(e) => setSilencingScope(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Select scope</option>
                  {options?.silencingScopes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel hint="General delivery/chemistry precedent — a soft tie-breaker, not a hard filter">
                  Delivery / Tissue Context
                </FieldLabel>
                <select
                  value={deliveryContext}
                  onChange={(e) => setDeliveryContext(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Not specified</option>
                  {options?.deliveryContexts.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <FieldLabel hint="Optional — a ClinVar ID, HGVS notation, or free-text description">
                  Known Variant (optional)
                </FieldLabel>
                <input
                  value={knownVariant}
                  onChange={(e) => setKnownVariant(e.target.value)}
                  placeholder="e.g. c.1521_1523delCTT / p.Phe508del"
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
            </div>

            <div className="flex justify-end px-6 pb-5">
              <button
                onClick={handleRank}
                disabled={!defectType || !silencingScope || loading}
                className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Ranking mechanisms..." : "Rank Mechanisms"}
              </button>
            </div>
          </Card>

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {ranking && (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-500">
                Ranked {ranking.results.length} Gene Silencing mechanisms for {ranking.geneSymbol}.
                Eligibility is based on each mechanism&apos;s documented variant/scope compatibility;
                delivery context is a soft tie-breaker only.
              </p>
              {ranking.results.map((m) => (
                <MechanismCard
                  key={m.id}
                  mechanism={m}
                  selected={selectedId === m.id}
                  onSelect={() => handleSelectMechanism(m.id)}
                />
              ))}
            </div>
          )}

          {selectedId && (
            <div className="flex justify-end pt-2">
              <button
                onClick={() => router.push("/gene-silencing")}
                className="flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
              >
                Proceed to Gene Silencing
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
