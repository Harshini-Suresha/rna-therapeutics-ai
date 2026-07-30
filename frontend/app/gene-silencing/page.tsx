"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Dna, Beaker } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TargetAnalysisCard from "@/components/TargetAnalysisCard";
import AssoDesignForm from "@/components/AssoDesignForm";
import AssoCandidateCard from "@/components/AssoCandidateCard";
import AlleleSelector from "@/components/AlleleSelector";
import { Card, SectionHeader } from "@/components/ui";
import { GeneTargetObject } from "@/types/gene";
import { TargetAnalysis, DesignOptions, GenerateResponse, ClinVarVariant } from "@/types/geneSilencing";
import {
  fetchTargetAnalysis,
  fetchDesignOptions,
  generateCandidates,
  fetchClinVarVariants,
} from "@/lib/geneSilencingApi";
import { saveReport } from "@/lib/auth";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";

export default function GeneSilencingPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [mechanism, setMechanism] = useState<{ id: string; name: string } | null>(null);
  const [silencingScope, setSilencingScope] = useState<string | null>(null);

  const [target, setTarget] = useState<TargetAnalysis | null>(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState<string | null>(null);

  const [options, setOptions] = useState<DesignOptions | null>(null);

  const [variants, setVariants] = useState<ClinVarVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ClinVarVariant | null>(null);

  const [selectedExons, setSelectedExons] = useState<number[]>([]);
  const [isTotalKnockdown, setIsTotalKnockdown] = useState(false);
  const [asoLength, setAsoLength] = useState(18);
  const [chemistry, setChemistry] = useState("gapmer");
  const [selectedMods, setSelectedMods] = useState<string[]>(["phosphorothioate"]);

  const [results, setResults] = useState<GenerateResponse | null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Load gene + mechanism from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(CONFIRMED_TARGET_KEY);
    if (stored) {
      try { setGene(JSON.parse(stored)); } catch { setGene(null); }
    }
    const mechStored = sessionStorage.getItem(SELECTED_MECHANISM_KEY);
    if (mechStored) {
      try {
        const parsed = JSON.parse(mechStored);
        setMechanism({ id: parsed.mechanism?.id ?? "", name: parsed.mechanism?.name ?? "" });
        setSilencingScope(parsed.silencingScope ?? null);
        if (parsed.silencingScope === "total_knockdown") {
          setIsTotalKnockdown(true);
        }
      } catch { setMechanism(null); }
    }
  }, []);

  // Fetch target analysis when gene loads
  useEffect(() => {
    if (!gene?.geneId) return;
    setTargetLoading(true);
    setTargetError(null);
    fetchTargetAnalysis(gene.geneId)
      .then(setTarget)
      .catch((e) => setTargetError(e instanceof Error ? e.message : "Failed to load target."))
      .finally(() => setTargetLoading(false));
  }, [gene?.geneId]);

  // Fetch design options
  useEffect(() => {
    fetchDesignOptions().then(setOptions).catch(() => {});
  }, []);

  // Fetch ClinVar variants for allele-specific silencing
  useEffect(() => {
    if (!gene?.geneId) return;
    fetchClinVarVariants(gene.geneId).then(setVariants).catch(() => {});
  }, [gene?.geneId]);

  function handleToggleMod(id: string) {
    setSelectedMods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  function handleToggleExon(idx: number) {
    setSelectedExons((prev) =>
      prev.includes(idx) ? prev.filter((e) => e !== idx) : [...prev, idx]
    );
  }

  function handleSelectAllExons(allIndices: number[]) {
    setSelectedExons((prev) =>
      prev.length === allIndices.length ? [] : [...allIndices]
    );
  }

  function handleToggleTotalKnockdown() {
    setIsTotalKnockdown((prev) => {
      if (!prev) setSelectedExons([]);
      return !prev;
    });
  }

  async function handleGenerate() {
    if (!gene?.geneId) return;
    if (!mechanism?.id) {
      setGenError("Select a mechanism before generating candidates.");
      return;
    }
    setGenLoading(true);
    setGenError(null);
    setResults(null);
    try {
      const res = await generateCandidates({
        ensemblGeneId: gene.geneId,
        mechanismId: mechanism.id,
        targetExonIndices: isTotalKnockdown ? null : selectedExons,
        asoLength,
        chemistry,
        modifications: selectedMods,
      });
      setResults(res);
      saveReport({
        step: "aso_design",
        title: `ASO Design: ${gene.geneSymbol} — ${mechanism.name}`,
        geneSymbol: gene.geneSymbol,
        disease: gene.disease || "",
        summary: `Generated ${res.candidates.length} ASO candidates for ${mechanism.name}. Top candidate: ${res.candidates[0]?.asoLabel || "N/A"}.`,
        data: { mechanismId: mechanism.id, mechanismName: mechanism.name, candidateCount: res.candidates.length },
      });
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setGenLoading(false);
    }
  }

  // No gene → redirect
  if (!gene) {
    return (
      <div className="flex min-h-screen bg-[#F5F6FA]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <Topbar />
          <main className="flex flex-1 items-center justify-center px-6">
            <Card className="max-w-md p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-[14px] font-medium text-slate-700">No confirmed target</p>
              <p className="mt-1 text-[13px] text-slate-500">
                Go back to Basic Information and confirm a target first.
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-medium text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
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
          {/* Gene + mechanism banner */}
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
                {mechanism ? ` · ${mechanism.name}` : ""}
              </p>
            </div>
            <button
              onClick={() => router.push("/mechanisms")}
              className="ml-auto text-[12.5px] font-medium text-brand hover:underline"
            >
              Change mechanism
            </button>
          </Card>

          {/* Step 4: Gene Silencing — ASO Design */}
          <Card>
            <SectionHeader step="4" title="Gene Silencing — ASO Design" />
              <p className="px-6 pb-3 text-[12.5px] text-slate-500">
              {mechanism?.id === "A2"
                ? "Translation-blocking candidates are restricted to the 5′ translation-initiation region."
                : mechanism?.id === "A21"
                  ? "siRNA candidates use 21-nt duplex guide design for RISC-mediated silencing."
                  : "Design antisense oligonucleotides targeting the confirmed gene. Select an exon, choose chemistry and modifications, then generate candidates."}
            </p>
          </Card>

          {/* Step 1: Target Analysis */}
          {targetLoading ? (
            <Card className="flex items-center gap-3 px-6 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
              <span className="text-[13px] text-slate-500">Loading target analysis...</span>
            </Card>
          ) : targetError ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" /> {targetError}
            </div>
          ) : target ? (
            <TargetAnalysisCard
              target={target}
              selectedExons={selectedExons}
              onToggleExon={handleToggleExon}
              onSelectAll={handleSelectAllExons}
              isTotalKnockdown={isTotalKnockdown}
              onToggleTotalKnockdown={handleToggleTotalKnockdown}
            />
          ) : null}

          {/* Allele-specific variant selector */}
          {!isTotalKnockdown && !targetLoading && target && (
            <AlleleSelector
              variants={variants}
              selectedVariant={selectedVariant}
              onSelectVariant={setSelectedVariant}
            />
          )}

          {/* Steps 2 + 3: Design Form */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Card className="p-5">
                <SectionHeader step="2" title="ASO Design Parameters" />
                <div className="px-5 pb-5">
                  <AssoDesignForm
                    options={options}
                    asoLength={asoLength}
                    setAsoLength={setAsoLength}
                    chemistry={chemistry}
                    setChemistry={setChemistry}
                    selectedMods={selectedMods}
                    onToggleMod={handleToggleMod}
                    onGenerate={handleGenerate}
                    loading={genLoading}
                    disabled={!isTotalKnockdown && selectedExons.length === 0 || !target}
                  />
                </div>
              </Card>
            </div>

            <div className="lg:col-span-3 space-y-3">
              <SectionHeader step="3" title="Generated ASO Candidates" />

              {genError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {genError}
                </div>
              )}

              {!results && !genLoading && (
                <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
                  <Beaker className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-[13px] font-medium text-slate-500">
                    {isTotalKnockdown
                      ? "Click Generate to create ASO candidates for total transcript knockdown"
                      : "Select exon(s) and click Generate to create ASO candidates"}
                  </p>
                  <p className="mt-1 text-[12px] text-slate-400">
                    Candidates are ranked by composite quality score (GC%, Tm, self-dimer risk)
                  </p>
                </Card>
              )}

              {results && results.candidates.length === 0 && (
                <Card className="px-6 py-8 text-center">
                  <p className="text-[13px] text-slate-500">
                    No valid candidates generated for this configuration. Try a different exon, length, or chemistry.
                  </p>
                </Card>
              )}

              {results && results.candidates.length > 0 && (
                <>
                  <p className="text-[12.5px] text-slate-500">
                    {results.candidates.length} candidate{results.candidates.length !== 1 ? "s" : ""} for{" "}
                    {results.targetExons && results.targetExons.length > 0
                      ? `Exons ${results.targetExons.join(", ")}`
                      : "all exons (total knockdown)"}{" "}
                    &middot; {results.chemistry} &middot; {results.asoLength} nt
                  </p>
                  {results.candidates.map((c, i) => (
                    <AssoCandidateCard key={c.sequence} candidate={c} rank={i + 1} />
                  ))}
                </>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
