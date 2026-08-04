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
  GeneFeaturesResponse,
  TherapeuticGoalId,
  THERAPEUTIC_GOALS,
} from "@/types/mechanism";
import {
  fetchMechanismOptions,
  fetchGeneFeatures,
  rankGeneSilencingMechanisms,
  rankGeneUpregulationMechanisms,
  rankRnaProcessingMechanisms,
  getGoalLabel,
} from "@/lib/mechanismApi";
import { saveReport } from "@/lib/auth";
import { MechanismFeature } from "@/types/mechanism";

const CONFIRMED_TARGET_KEY = "aso:confirmedTarget";
const SELECTED_MECHANISM_KEY = "aso:selectedMechanism";
const SELECTED_GOAL_KEY = "aso:therapeuticGoal";
const PROJECT_TARGET_TISSUE_KEY = "aso:projectTargetTissue";

// Map free-text target tissue to deliveryContext dropdown values
function mapTargetTissueToDeliveryContext(tissue: string): string {
  const t = tissue.toLowerCase().trim();
  if (t.includes("liver") || t.includes("hepatic")) return "liver";
  if (t.includes("kidney") || t.includes("renal")) return "kidney";
  if (t.includes("brain") || t.includes("cns") || t.includes("central nervous")) return "cns";
  if (t.includes("muscle") || t.includes("skeletal") || t.includes("myocyte")) return "muscle";
  if (t.includes("heart") || t.includes("cardiac") || t.includes("myocard")) return "heart";
  if (t.includes("lung") || t.includes("pulmonary") || t.includes("respiratory")) return "lung";
  if (t.includes("eye") || t.includes("retina") || t.includes("ocular") || t.includes("vitreous")) return "eye";
  if (t.includes("tumor") || t.includes("cancer") || t.includes("neoplasm") || t.includes("malignan")) return "tumor";
  if (t.includes("blood") || t.includes("bone marrow") || t.includes("hematopoietic") || t.includes("leukemia") || t.includes("lymphoma")) return "blood";
  if (t.includes("skin") || t.includes("dermal") || t.includes("epidermal") || t.includes("cutaneous")) return "skin";
  if (t.includes("pancreas") || t.includes("pancreatic")) return "pancreas";
  if (t.includes("gut") || t.includes("intestine") || t.includes("intestinal") || t.includes("colon") || t.includes("bowel")) return "gut";
  if (t.includes("spinal") || t.includes("cord")) return "spinal cord";
  return "";
}

// Defect type → compatible mechanism IDs (mirrors UPREGULATION_DEFECT_COMPATIBILITY in backend)
const DEFECT_TO_MECHANISMS: Record<string, string[]> = {
  haploinsufficiency: ["A3", "A4", "A6", "A23"],
  poison_exon_inclusion: ["A3"],
  nat_mediated_repression: ["A4"],
  uorf_mediated_repression: ["A5"],
  mirna_mediated_repression: ["A6"],
  deficient_mirna: ["A22"],
  epigenetic_promoter_silencing: ["A23"],
};

// Mechanism ID → feature key in gene features response
const MECHANISM_TO_FEATURE: Record<string, string> = {
  A3: "TANGO",
  A4: "NAT",
  A5: "uORF",
  A6: "miRNA_block",
  A22: "miRNA_replacement",
  A23: "saRNA",
};

interface MechanismCard {
  key: string;
  label: string;
  mechanism: string;
  description: string;
}

const MECHANISM_CARDS: MechanismCard[] = [
  { key: "saRNA", label: "saRNA (Promoter)", mechanism: "A23", description: "Recruits RNA Pol II & AGO2 to boost transcription" },
  { key: "uORF", label: "uORF Blocking", mechanism: "A5", description: "Blocks inhibitory upstream ORFs to enhance translation" },
  { key: "TANGO", label: "Poison Exon (TANGO)", mechanism: "A3", description: "Prevents poison exon inclusion to restore functional mRNA" },
  { key: "NAT", label: "NAT / lncRNA Silencing", mechanism: "A4", description: "Degrades antisense lncRNAs that repress the gene" },
  { key: "miRNA_block", label: "miRNA Site Blocking", mechanism: "A6", description: "Blocks miRNA binding sites on the target mRNA" },
  { key: "miRNA_replacement", label: "miRNA Replacement", mechanism: "A22", description: "Replaces a deficient regulatory miRNA" },
];

function MechanismAvailabilityCards({
  features,
  selectedDefectType,
  geneSymbol,
}: {
  features: Record<string, MechanismFeature>;
  selectedDefectType: string;
  geneSymbol: string;
}) {
  // Which mechanisms are compatible with the selected defect type?
  const compatibleMechanisms = selectedDefectType
    ? new Set(DEFECT_TO_MECHANISMS[selectedDefectType] || [])
    : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Mechanism Availability for {geneSymbol}
        </p>
        {compatibleMechanisms && (
          <p className="text-[10.5px] text-brand font-medium">
            {compatibleMechanisms.size} mechanism{compatibleMechanisms.size !== 1 ? "s" : ""} match this defect
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {MECHANISM_CARDS.map(({ key, label, mechanism, description }) => {
          const feat = features[key];
          const structurallyAvailable = feat?.available ?? true;
          const isCompatible = compatibleMechanisms ? compatibleMechanisms.has(mechanism) : null;

          // Card state: eligible (green), compatible but structurally unavailable (yellow),
          // incompatible with selected defect (grey), or no defect selected (default)
          let borderColor = "border-slate-200 bg-white";
          let dotColor = "bg-slate-300";
          let labelColor = "text-slate-700";
          let badge = null;

          if (!selectedDefectType) {
            // No defect selected — show structural availability only
            if (structurallyAvailable) {
              borderColor = "border-emerald-200 bg-emerald-50/50";
              dotColor = "bg-emerald-500";
              labelColor = "text-emerald-800";
            } else {
              borderColor = "border-slate-200 bg-white opacity-60";
            }
          } else if (isCompatible && structurallyAvailable) {
            // Compatible AND structurally available — highlight as eligible
            borderColor = "border-brand bg-brand/5 ring-1 ring-brand/30";
            dotColor = "bg-brand";
            labelColor = "text-brand";
            badge = (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-brand/10 px-1.5 py-0.5 text-[9px] font-bold text-brand">
                ELIGIBLE
              </span>
            );
          } else if (isCompatible && !structurallyAvailable) {
            // Compatible but gene lacks the feature — show warning
            borderColor = "border-amber-200 bg-amber-50/50";
            dotColor = "bg-amber-400";
            labelColor = "text-amber-700";
            badge = (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-600">
                GENE LACKS FEATURE
              </span>
            );
          } else {
            // Not compatible with this defect type
            borderColor = "border-slate-200 bg-white opacity-50";
            dotColor = "bg-slate-300";
            labelColor = "text-slate-500";
          }

          return (
            <div
              key={key}
              className={`flex items-start gap-2 rounded-md border p-2.5 text-[11.5px] transition-all ${borderColor}`}
            >
              <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-0.5">
                  <p className={`font-semibold ${labelColor}`}>
                    {label}
                    <span className="ml-1 font-mono text-[10px] opacity-60">({mechanism})</span>
                  </p>
                  {badge}
                </div>
                <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                  {feat?.reason || description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MechanismSelectionPage() {
  const router = useRouter();

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [options, setOptions] = useState<MechanismOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [selectedGoal, setSelectedGoal] = useState<TherapeuticGoalId | null>(null);

  // TG01 fields
  const [defectType, setDefectType] = useState("");
  const [silencingScope, setSilencingScope] = useState("");

  // TG02 fields
  const [upregDefectType, setUpregDefectType] = useState("");
  const [knownRegulatoryElement, setKnownRegulatoryElement] = useState("");
  const [geneFeatures, setGeneFeatures] = useState<GeneFeaturesResponse | null>(null);
  const [geneFeaturesLoading, setGeneFeaturesLoading] = useState(false);

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

    // Load project target tissue and map to deliveryContext
    const projectTissue = sessionStorage.getItem(PROJECT_TARGET_TISSUE_KEY);
    if (projectTissue) {
      const mapped = mapTargetTissueToDeliveryContext(projectTissue);
      if (mapped) {
        setDeliveryContext(mapped);
      }
    }

    fetchMechanismOptions()
      .then(setOptions)
      .catch((e) => setOptionsError(e instanceof Error ? e.message : "Failed to load options."));
  }, []);

  // Fetch gene structural features when TG02 is selected
  useEffect(() => {
    if (selectedGoal !== "TG02" || !gene) {
      setGeneFeatures(null);
      return;
    }

    setGeneFeaturesLoading(true);
    fetchGeneFeatures({
      geneSymbol: gene.geneSymbol,
      organism: gene.organism || "homo_sapiens",
      ensemblId: gene.geneId,
      tissueTpm: gene.tissueTpm,
    })
      .then(setGeneFeatures)
      .catch(() => setGeneFeatures(null))
      .finally(() => setGeneFeaturesLoading(false));
  }, [selectedGoal, gene]);

  function handleSelectGoal(goalId: TherapeuticGoalId) {
    setSelectedGoal(goalId);
    sessionStorage.setItem(SELECTED_GOAL_KEY, goalId);
    setRanking(null);
    setSelectedId(null);
    setDefectType("");
    setSilencingScope("");
    setUpregDefectType("");
    setKnownRegulatoryElement("");
    setSpliceDefectType("");
    setTargetExon("");
    setDeliveryContext("");
    setKnownVariant("");
  }

  function clearRanking() {
    setRanking(null);
    setSelectedId(null);
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
      } else if (selectedGoal === "TG02") {
        if (!upregDefectType) return;
        result = await rankGeneUpregulationMechanisms({
          geneSymbol: gene.geneSymbol,
          defectType: upregDefectType,
          deliveryContext,
          knownRegulatoryElement,
          geneFeatures: geneFeatures as unknown as Record<string, unknown> | null,
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
      saveReport({
        step: "mechanism",
        title: `Mechanism Analysis: ${gene.geneSymbol} (${selectedGoal || "N/A"})`,
        geneSymbol: gene.geneSymbol,
        disease: gene.disease || "",
        summary: `Ranked ${result.results.length} mechanisms for ${gene.geneSymbol}. Top: ${result.results[0]?.name || "N/A"}.`,
        data: { goal: selectedGoal, topMechanisms: result.results.slice(0, 5).map((m: any) => ({ id: m.id, name: m.name, score: m.score })) },
      });
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
        JSON.stringify({
          geneSymbol: gene?.geneSymbol,
          mechanism,
          silencingScope: selectedGoal === "TG01" ? silencingScope : null,
          defectType: selectedGoal === "TG01" ? defectType : null,
          therapeuticGoal: selectedGoal,
          knownVariant,
        })
      );
    }
  }

  function isRankDisabled(): boolean {
    if (!gene || !selectedGoal || loading) return true;
    if (selectedGoal === "TG01") return !defectType || !silencingScope;
    if (selectedGoal === "TG02") return !upregDefectType;
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
                      onChange={(e) => {
                        setDefectType(e.target.value);
                        clearRanking();
                      }}
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
                      onChange={(e) => {
                        setSilencingScope(e.target.value);
                        clearRanking();
                      }}
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
                      onChange={(e) => {
                        setDeliveryContext(e.target.value);
                        clearRanking();
                      }}
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
                      onChange={(e) => {
                        setKnownVariant(e.target.value);
                        clearRanking();
                      }}
                      placeholder="e.g. c.1521_1523delCTT / p.Phe508del"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </div>
              )}

              {selectedGoal === "TG02" && (
                <div className="space-y-4 px-6 pb-4">
                  {/* Gene feature analysis loading */}
                  {geneFeaturesLoading && (
                    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[12.5px] text-blue-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing gene structural features...
                    </div>
                  )}

                  {/* Defect type selection — this drives which mechanisms are eligible */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <FieldLabel hint="Select the molecular defect to see which upregulation mechanisms apply">
                        Molecular Defect Type <span className="text-red-500">*</span>
                      </FieldLabel>
                      <select
                        value={upregDefectType}
                        onChange={(e) => {
                          setUpregDefectType(e.target.value);
                          clearRanking();
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      >
                        <option value="">Select defect type</option>
                        {options?.geneUpregulation.defectTypes.map((o) => (
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
                        onChange={(e) => {
                          setDeliveryContext(e.target.value);
                          clearRanking();
                        }}
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
                      <FieldLabel hint="Optional — known poison exon, NAT, uORF, or miRNA binding site for this gene">
                        Known Regulatory Element (optional)
                      </FieldLabel>
                      <input
                        value={knownRegulatoryElement}
                        onChange={(e) => {
                          setKnownRegulatoryElement(e.target.value);
                          clearRanking();
                        }}
                        placeholder="e.g. BDNF-AS antisense transcript / chr11:53886643 poison exon"
                        className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                  </div>

                  {/* Mechanism availability — filtered by selected defect type */}
                  {geneFeatures && !geneFeaturesLoading && (
                    <MechanismAvailabilityCards
                      features={geneFeatures.features}
                      selectedDefectType={upregDefectType}
                      geneSymbol={gene?.geneSymbol || ""}
                    />
                  )}

                  {/* Overexpression warnings */}
                  {geneFeatures?.warnings.map((w, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border px-4 py-3 text-[12.5px] ${
                        w.severity === "high"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : "border-yellow-200 bg-yellow-50 text-yellow-700"
                      }`}
                    >
                      {w.message}
                    </div>
                  ))}

                  {/* Hint when no defect type selected */}
                  {!upregDefectType && (
                    <p className="text-[12px] text-slate-500 italic">
                      Select a Molecular Defect Type above to see which mechanisms are eligible for this gene.
                    </p>
                  )}
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
                      onChange={(e) => {
                        setSpliceDefectType(e.target.value);
                        clearRanking();
                      }}
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
                      onChange={(e) => {
                        setTargetExon(e.target.value);
                        clearRanking();
                      }}
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
                      onChange={(e) => {
                        setDeliveryContext(e.target.value);
                        clearRanking();
                      }}
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
                      onChange={(e) => {
                        setKnownVariant(e.target.value);
                        clearRanking();
                      }}
                      placeholder="e.g. c.1521_1523delCTT / p.Phe508del"
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 px-3 text-[13.5px] text-slate-700 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </div>
              )}

              {selectedGoal !== "TG01" && selectedGoal !== "TG02" && selectedGoal !== "TG04" && (
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
                Eligible mechanisms match your selected defect type and scope; poor-fit mechanisms are shown below for reference.
              </p>
              {(() => {
                const eligible = ranking.results.filter((m) => m.eligible);
                const poorFit = ranking.results.filter((m) => !m.eligible);
                return (
                  <>
                    {eligible.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                          Eligible Mechanisms ({eligible.length})
                        </p>
                        {eligible.map((m) => (
                          <MechanismCard
                            key={m.id}
                            mechanism={m}
                            selected={selectedId === m.id}
                            onSelect={() => handleSelectMechanism(m.id)}
                          />
                        ))}
                      </div>
                    )}
                    {poorFit.length > 0 && (
                      <div className="space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Poor Fit ({poorFit.length})
                        </p>
                        {poorFit.map((m) => (
                          <MechanismCard
                            key={m.id}
                            mechanism={m}
                            selected={selectedId === m.id}
                            onSelect={() => handleSelectMechanism(m.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {selectedId && (
            <div className="flex justify-end pt-2">
              {selectedGoal === "TG02" ? (
                <div className="flex items-center gap-3">
                  <p className="text-[12px] text-slate-500">
                    The ASO design pipeline for gene upregulation mechanisms is under development.
                  </p>
                  <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 text-[13px] font-medium text-slate-400">
                    Design pipeline coming soon
                  </span>
                </div>
              ) : (
                <button
                  onClick={() => router.push("/gene-silencing")}
                  className="flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-[14px] font-medium text-white shadow-sm transition-colors hover:bg-brand-dark"
                >
                  Proceed to Gene Silencing
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
