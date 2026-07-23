"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Dna } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MechanismCard from "@/components/MechanismCard";
import { Card, SectionHeader, FieldLabel } from "@/components/ui";
import { GeneTargetObject } from "@/types/gene";
import {
  MechanismOptions,
  MechanismRankingResponse,
  TherapeuticGoalId,
  THERAPEUTIC_GOALS,
} from "@/types/mechanism";
import {
  fetchMechanismOptions,
  rankGeneSilencingMechanisms,
  rankRnaProcessingMechanisms,
  getGoalLabel,
} from "@/lib/mechanismApi";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";
const SELECTED_GOAL_KEY = "aso:therapeuticGoal";

export default function MechanismSelectionPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [options, setOptions] = useState<MechanismOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedGoal, setSelectedGoal] = useState<TherapeuticGoalId | null>(null);

  // TG01 fields
  const [defectType, setDefectType] = useState("");
  const [silencingScope, setSilencingScope] = useState("");

  // TG04 fields
  const [spliceDefectType, setSpliceDefectType] = useState("");
  const [targetExon, setTargetExon] = useState("");

  // Shared fields
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

    const savedGoal = sessionStorage.getItem(SELECTED_GOAL_KEY) as TherapeuticGoalId | null;
    if (savedGoal && THERAPEUTIC_GOALS.some((g) => g.id === savedGoal)) {
      setSelectedGoal(savedGoal);
    }

    fetchMechanismOptions()
      .then(setOptions)
      .catch((e) => setOptionsError(e instanceof Error ? e.message : "Failed to load options."));
  }, []);

  function handleSelectGoal(goalId: TherapeuticGoalId) {
    setSelectedGoal(goalId);
    sessionStorage.setItem(SELECTED_GOAL_KEY, goalId);
    setRanking(null);
    setSelectedId(null);
    setDefectType("");
    setSilencingScope("");
    setSpliceDefectType("");
    setTargetExon("");
    setDeliveryContext("");
    setKnownVariant("");
  }

  async function handleRank() {
    if (!gene || !selectedGoal) return;
    setLoading(true);
    setError(null);
    setSelectedId(null);

    try {
      let result: MechanismRankingResponse;

      if (selectedGoal === "TG01") {
        if (!defectType || !silencingScope) return;
        result = await rankGeneSilencingMechanisms({
          geneSymbol: gene.geneSymbol,
          defectType,
          silencingScope,
          deliveryContext,
          knownVariant,
        });
      } else if (selectedGoal === "TG04") {
        if (!spliceDefectType) return;
        result = await rankRnaProcessingMechanisms({
          geneSymbol: gene.geneSymbol,
          spliceDefectType,
          targetExon,
          deliveryContext,
          knownVariant,
        });
      } else {
        return;
      }

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
        JSON.stringify({ geneSymbol: gene?.geneSymbol, mechanism, silencingScope: selectedGoal === "TG01" ? silencingScope : null })
      );
    }
  }

  function isRankDisabled(): boolean {
    if (!gene || !selectedGoal || loading) return true;
    if (selectedGoal === "TG01") return !defectType || !silencingScope;
    if (selectedGoal === "TG04") return !spliceDefectType;
    return true;
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

          {/* Step 2: Therapeutic Goal Selection */}
          <Card>
            <SectionHeader step="2" title="Select Therapeutic Goal" />
            <div className="grid grid-cols-1 gap-3 px-6 pb-5 sm:grid-cols-2 lg:grid-cols-3">
              {THERAPEUTIC_GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => handleSelectGoal(goal.id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    selectedGoal === goal.id
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400">{goal.id}</span>
                    <h3 className="text-[14px] font-semibold text-slate-800">{goal.name}</h3>
                  </div>
                  <p className="mt-1 text-[12.5px] text-slate-500 leading-snug">{goal.description}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Step 3: Mechanism inputs */}
          {selectedGoal && (
            <Card>
              <SectionHeader step="3" title="Mechanism Selection" />
              {optionsError && (
                <p className="px-6 pb-2 text-[12.5px] text-red-600">{optionsError}</p>
              )}

              {selectedGoal === "TG01" && (
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
                      {options?.geneSilencing.defectTypes.map((o) => (
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
                      {options?.geneSilencing.silencingScopes.map((o) => (
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
              )}

              {selectedGoal === "TG04" && (
                <div className="grid grid-cols-1 gap-4 px-6 pb-4 md:grid-cols-3">
                  <div>
                    <FieldLabel hint="What type of RNA processing defect are you targeting?">
                      Splice Defect Type <span className="text-red-500">*</span>
                    </FieldLabel>
                    <select
                      value={spliceDefectType}
                      onChange={(e) => setSpliceDefectType(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="">Select splice defect type</option>
                      {options?.rnaProcessing.spliceDefectTypes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <FieldLabel hint="Optional — the exon number affected by the mutation (e.g. exon 51 for DMD)">
                      Target Exon (optional)
                    </FieldLabel>
                    <input
                      value={targetExon}
                      onChange={(e) => setTargetExon(e.target.value)}
                      placeholder="e.g. exon 51"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
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
                    <FieldLabel hint="Optional — a ClinVar ID, HGVS notation, or free-text description of the known variant">
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
              )}

              {selectedGoal !== "TG01" && selectedGoal !== "TG04" && (
                <div className="px-6 pb-4">
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                    <p className="text-[13px] font-medium text-slate-600">
                      Mechanism selection for {getGoalLabel(selectedGoal)} is coming soon.
                    </p>
                    <p className="mt-1 text-[12px] text-slate-400">
                      The backend ranking engine for this therapeutic goal is under development.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end px-6 pb-5">
                <button
                  onClick={handleRank}
                  disabled={isRankDisabled()}
                  className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "Ranking mechanisms..." : "Rank Mechanisms"}
                </button>
              </div>
            </Card>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {ranking && (
            <div className="space-y-3">
              <p className="text-[13px] text-slate-500">
                Ranked {ranking.results.length} {ranking.therapeuticGoal} mechanisms for {ranking.geneSymbol}.
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
