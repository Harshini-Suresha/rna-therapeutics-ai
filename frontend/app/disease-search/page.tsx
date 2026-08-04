"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  BookOpen,
  Tag,
  Heart,
  Activity,
  Dna,
  Pill,
  ChevronDown,
  ChevronRight,
  FileText,
  FlaskConical,
  MousePointer2,
  Route,
  Gauge,
  Layers,
} from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card } from "@/components/ui";
import { fetchDiseaseDetail } from "@/lib/diseaseSearchApi";
import { DiseaseDetailResponse, DiseaseGeneMatch, KnownDrug } from "@/types/diseaseSearch";

const PREFILL_KEY = "aso:prefillGeneSearch";

const DB_LABELS: Record<string, string> = {
  OMIM: "OMIM",
  Orphanet: "Orphanet",
  ICD10CM: "ICD-10",
  ICD10WHO: "ICD-10 WHO",
  ICD9: "ICD-9",
  MESH: "MeSH",
  DOID: "Disease Ontology",
  NCIT: "NCI Thesaurus",
  UMLS: "UMLS",
  MedDRA: "MedDRA",
  NORD: "NORD",
  GARD: "GARD",
  SCTID: "SNOMED CT",
};

const EVIDENCE_LABELS: { key: string; label: string }[] = [
  { key: "genetic_association", label: "Genetic assoc." },
  { key: "genetic_literature", label: "Genetic literature" },
  { key: "somatic_mutation", label: "Somatic mutation" },
  { key: "clinical", label: "Clinical" },
  { key: "affected_pathway", label: "Affected pathway" },
  { key: "pathway", label: "Pathways" },
  { key: "drug", label: "Drugs" },
  { key: "text_mining", label: "Text mining" },
  { key: "animal_model", label: "Animal model" },
  { key: "rna_expression", label: "RNA expression" },
];

const TRACTABILITY_MODALITY: Record<string, string> = {
  SM: "Small molecule",
  AB: "Antibody",
  PR: "PROTAC",
  PROTAC: "PROTAC",
  TR: "Traceable",
  OTHER: "Other",
};

function Td({ label, value, link }: { label: string; value?: string | null; link?: string }) {
  if (!value) return null;
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-4 text-[11.5px] font-medium text-slate-500 whitespace-nowrap w-[180px]">{label}</td>
      <td className="py-2 text-[12px] text-slate-700">
        {link ? (
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
            {value} <ExternalLink className="h-3 w-3" />
          </a>
        ) : value}
      </td>
    </tr>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-slate-400" />
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        </div>
      </td>
    </tr>
  );
}

function EvidenceBars({ evidence }: { evidence?: Record<string, number> }) {
  const rows = EVIDENCE_LABELS.filter((e) => (evidence?.[e.key] ?? 0) > 0);
  if (rows.length === 0) return <p className="text-[11px] text-slate-400">No evidence breakdown available.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
      {rows.map(({ key, label }) => {
        const value = evidence![key];
        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-28 shrink-0 text-[11px] text-slate-500">{label}</span>
            <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, value * 100)}%` }} />
            </div>
            <span className="w-9 text-right text-[10.5px] tabular-nums text-slate-500">{value.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ConstraintChips({ constraint }: { constraint?: DiseaseGeneMatch["constraint"] }) {
  if (!constraint || Object.keys(constraint).length === 0) return null;
  const colors: Record<string, string> = {
    lof: "bg-rose-50 text-rose-700 border-rose-100",
    mis: "bg-amber-50 text-amber-700 border-amber-100",
    syn: "bg-blue-50 text-blue-700 border-blue-100",
  };
  const labels: Record<string, string> = { lof: "LoF", mis: "Missense", syn: "Synonymous" };
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(constraint).map(([type, c]) => (
        <span key={type} className={`rounded-lg border px-2 py-1 text-[10.5px] ${colors[type] ?? "bg-slate-50 text-slate-600 border-slate-100"}`}>
          {labels[type] ?? type}: obs {c.obs ?? "—"} / exp {c.exp ?? "—"} · OE {c.oe ?? "—"}
        </span>
      ))}
    </div>
  );
}

function GeneRow({ gene, index, expanded, onToggle, onUseGene }: {
  gene: DiseaseGeneMatch;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onUseGene: () => void;
}) {
  const scorePct = gene.score !== null ? Math.round(gene.score * 100) : 0;
  const scoreColor = scorePct >= 70 ? "bg-emerald-500" : scorePct >= 50 ? "bg-blue-500" : scorePct >= 30 ? "bg-amber-500" : "bg-slate-300";
  const topEvidence = EVIDENCE_LABELS.filter((e) => (gene.evidence?.[e.key] ?? 0) > 0).slice(0, 3);
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer"
      >
        <td className="py-2.5 pl-5 pr-2 text-[11.5px] tabular-nums text-slate-400">
          <span className="inline-flex items-center gap-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            {index + 1}
          </span>
        </td>
        <td className="py-2.5 pr-4">
          <p className="text-[12.5px] font-semibold text-slate-800">{gene.symbol}</p>
        </td>
        <td className="py-2.5 pr-4 text-[11.5px] text-slate-500 max-w-[200px] truncate" title={gene.name || ""}>
          {gene.name || "—"}
        </td>
        <td className="py-2.5 pr-4">
          {gene.targetClass && gene.targetClass.length > 0 ? (
            <span className="inline-flex items-center rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600">
              {gene.targetClass[0]}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2.5 pr-4">
          {topEvidence.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {topEvidence.map((e) => (
                <span key={e.key} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600" title={e.label}>
                  {e.label} {gene.evidence![e.key].toFixed(2)}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2.5 pr-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={`h-full rounded-full ${scoreColor}`} style={{ width: `${scorePct}%` }} />
            </div>
            <span className="text-[11.5px] font-medium text-slate-600 tabular-nums w-10 text-right">
              {gene.score !== null ? gene.score.toFixed(2) : "—"}
            </span>
          </div>
        </td>
        <td className="py-2.5 pr-5 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onUseGene}
            className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-brand hover:text-brand transition-colors"
          >
            Use this gene
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={7} className="px-5 py-4">
            <div className="space-y-4">
              {gene.function && (
                <div>
                  <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <FileText className="h-3 w-3" /> Function
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-slate-600">{gene.function}</p>
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <FlaskConical className="h-3 w-3" /> Evidence breakdown (score 0–1)
                  </p>
                  <EvidenceBars evidence={gene.evidence} />
                </div>
                <div className="space-y-3">
                  {gene.tractability && gene.tractability.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <Layers className="h-3 w-3" /> Tractability
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {gene.tractability.map((t, i) => (
                          <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-700">
                            {t.label} · {TRACTABILITY_MODALITY[t.modality] ?? t.modality}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gene.mousePhenotypes && gene.mousePhenotypes.length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <MousePointer2 className="h-3 w-3" /> Mouse models
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {gene.mousePhenotypes.slice(0, 8).map((mp, i) => (
                          <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">
                            {mp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {gene.constraint && Object.keys(gene.constraint).length > 0 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                        <Gauge className="h-3 w-3" /> Genetic constraint (gnomAD)
                      </p>
                      <ConstraintChips constraint={gene.constraint} />
                    </div>
                  )}
                </div>
              </div>
              {gene.pathways && gene.pathways.length > 0 && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
                    <Route className="h-3 w-3" /> Pathways ({gene.pathways.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {gene.pathways.slice(0, 10).map((p, i) => (
                      <span key={i} className="rounded-full bg-violet-50 px-2 py-0.5 text-[10.5px] text-violet-700" title={p.topLevelTerm ?? ""}>
                        {p.pathway}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[10.5px] text-slate-400">
                {gene.ensemblId && (
                  <a
                    href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${gene.ensemblId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono hover:text-brand transition-colors"
                  >
                    {gene.ensemblId} <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
                {gene.biotype && <span>Biotype: {gene.biotype}</span>}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DrugRow({ drug, index, expanded, onToggle }: {
  drug: KnownDrug;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const moa = drug.mechanismsOfAction;
  return (
    <>
      <tr onClick={onToggle} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80 cursor-pointer">
        <td className="py-2 pl-5 pr-2 text-[11.5px] tabular-nums text-slate-400">
          <span className="inline-flex items-center gap-1">
            {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
            {index + 1}
          </span>
        </td>
        <td className="py-2 pr-4 text-[12px] font-medium text-slate-700">{drug.name}</td>
        <td className="py-2 pr-4">
          {drug.drugType ? (
            <span className="inline-flex items-center rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">{drug.drugType}</span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2 pr-4 text-[11.5px] text-slate-500 max-w-[220px]">
          {moa?.actionTypes && moa.actionTypes.length > 0 ? (
            <span className="line-clamp-2">
              {(moa.rows?.[0]?.mechanismOfAction || moa.actionTypes.join(", "))}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400">—</span>
          )}
        </td>
        <td className="py-2 pr-4 text-right text-[11.5px] tabular-nums text-slate-500">
          {drug.clinicalReports?.length ?? 0}
        </td>
        <td className="py-2 pr-5 text-right">
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
            drug.phase === 4 || drug.status?.toLowerCase().includes("approved")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          }`}>
            {drug.phase !== null && drug.phase >= 4 ? "Approved" : drug.phase !== null ? `Phase ${drug.phase}` : drug.status || "—"}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-slate-50/60">
          <td colSpan={6} className="px-5 py-4">
            <div className="space-y-3">
              {moa && (moa.actionTypes?.length || moa.targetTypes?.length) && (
                <div className="flex flex-wrap gap-1.5">
                  {moa.actionTypes?.map((a, i) => (
                    <span key={`a${i}`} className="rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-medium text-blue-700">{a}</span>
                  ))}
                  {moa.targetTypes?.map((t, i) => (
                    <span key={`t${i}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{t}</span>
                  ))}
                </div>
              )}
              {moa?.rows && moa.rows.length > 0 && (
                <ul className="list-disc list-inside space-y-0.5">
                  {moa.rows.slice(0, 6).map((r, i) => (
                    <li key={i} className="text-[11.5px] text-slate-600">
                      {r.mechanismOfAction}
                      {r.actionType ? <span className="text-slate-400"> ({r.actionType})</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {drug.clinicalReports && drug.clinicalReports.length > 0 && (
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">Clinical reports ({drug.clinicalReports.length})</p>
                  <div className="space-y-1.5">
                    {drug.clinicalReports.slice(0, 8).map((cr, i) => (
                      <div key={i} className="flex items-center gap-2 text-[11.5px]">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          cr.clinicalStage === "Approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {cr.clinicalStage || cr.trialPhase || "—"}
                        </span>
                        {cr.trialOverallStatus && <span className="text-slate-500">{cr.trialOverallStatus}</span>}
                        {cr.year && <span className="tabular-nums text-slate-400">{cr.year}</span>}
                        {cr.title ? (
                          <a
                            href={cr.url || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-slate-600 hover:text-brand transition-colors"
                            title={cr.title}
                          >
                            {cr.title}
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function DiseaseSearchResultsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("query") ?? "";

  const [detail, setDetail] = useState<DiseaseDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGenes, setExpandedGenes] = useState<Set<string>>(new Set());
  const [expandedDrugs, setExpandedDrugs] = useState<Set<number>>(new Set());

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

  const omim = detail?.databaseRefs?.OMIM;
  const orphanet = detail?.databaseRefs?.Orphanet;
  const formatCount = (n?: number | null) => (n != null ? n.toLocaleString() : "—");

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-6xl space-y-5">
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
                {/* Main info card */}
                <Card className="p-0 overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{detail.diseaseId}</p>
                    <h1 className="mt-0.5 text-[20px] font-semibold text-slate-800">{detail.diseaseName}</h1>
                    {detail.therapeuticAreas.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detail.therapeuticAreas.map((ta) => (
                          <span key={ta} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">{ta}</span>
                        ))}
                      </div>
                    )}
                    {detail.ancestors && detail.ancestors.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[10.5px] text-slate-400">
                        {[...detail.ancestors].reverse().map((a, i, arr) => (
                          <span key={a.id} className="inline-flex items-center gap-1">
                            <span className="hover:text-slate-600 transition-colors">{a.name}</span>
                            {i < arr.length - 1 && <span className="text-slate-300">›</span>}
                          </span>
                        ))}
                        <span className="text-slate-300">›</span>
                        <span className="font-medium text-slate-600">{detail.diseaseName}</span>
                      </div>
                    )}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <BookOpen className="h-4 w-4 text-slate-400" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatCount(detail.literatureCount)}</p>
                          <p className="text-[10.5px] text-slate-500">Publications</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <Dna className="h-4 w-4 text-indigo-400" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatCount(detail.associatedTargetCount)}</p>
                          <p className="text-[10.5px] text-slate-500">Associated targets</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <Pill className="h-4 w-4 text-emerald-500" />
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">{formatCount(detail.drugCandidateCount)}</p>
                          <p className="text-[10.5px] text-slate-500">Drug candidates</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-2">
                    <table className="w-full">
                      <tbody>
                        <SectionHeader icon={BookOpen} title="Disease Information" />
                        <Td label="Description" value={detail.description} />
                        <Td label="OMIM" value={omim} link={omim ? `https://omim.org/entry/${omim}` : undefined} />
                        <Td label="Orphanet" value={orphanet} link={orphanet ? `https://www.orpha.net/en/disease/detail/${orphanet}` : undefined} />
                        <Td label="MeSH" value={detail.databaseRefs?.MESH} link={detail.databaseRefs?.MESH ? `https://meshb.nlm.nih.gov/record/ui?ui=${detail.databaseRefs.MESH}` : undefined} />
                        <Td label="UMLS" value={detail.databaseRefs?.UMLS} />
                        <Td label="NCI Thesaurus" value={detail.databaseRefs?.NCIT} />

                        {detail.synonyms.length > 0 && (
                          <>
                            <SectionHeader icon={Tag} title="Alternative Names" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.synonyms.map((syn, i) => (
                                    <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                                      {syn.term}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {detail.phenotypes.length > 0 && (
                          <>
                            <SectionHeader icon={Heart} title="Clinical Features (HPO)" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.phenotypes.map((p, i) => (
                                    <a
                                      key={i}
                                      href={`https://hpo.jax.org/browse/term/${p.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-100 transition-colors"
                                    >
                                      {p.name}
                                    </a>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {detail.childDiseases.length > 0 && (
                          <>
                            <SectionHeader icon={Activity} title="Subtypes / Child Diseases" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.childDiseases.map((c, i) => (
                                    <span key={i} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] text-violet-700">
                                      {c.name}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}

                        {detail.relatedDiseases.length > 0 && (
                          <>
                            <SectionHeader icon={Activity} title="Related Diseases" />
                            <tr>
                              <td colSpan={2} className="py-2">
                                <div className="flex flex-wrap gap-1.5">
                                  {detail.relatedDiseases.map((r, i) => (
                                    <span key={i} className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] text-amber-700">
                                      {r.id} <span className="text-amber-500">({(r.score * 100).toFixed(0)}%)</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Known drugs table */}
                {detail.knownDrugs.length > 0 && (
                  <Card className="p-0 overflow-hidden">
                    <div className="border-b border-slate-100 px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-emerald-600" />
                        <p className="text-[13px] font-semibold text-slate-800">Known Drugs / Clinical Candidates ({detail.knownDrugs.length})</p>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-slate-400">Click a row to see mechanism of action and clinical reports.</p>
                    </div>
                    <div className="px-5 py-2">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                            <th className="w-10 py-2 pr-2 text-left">#</th>
                            <th className="py-2 pr-4 text-left">Drug Name</th>
                            <th className="py-2 pr-4 text-left">Type</th>
                            <th className="py-2 pr-4 text-left">Mechanism</th>
                            <th className="py-2 pr-4 text-right">Reports</th>
                            <th className="py-2 pr-5 text-right">Stage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.knownDrugs.map((d, i) => (
                            <DrugRow
                              key={d.name}
                              drug={d}
                              index={i}
                              expanded={expandedDrugs.has(i)}
                              onToggle={() =>
                                setExpandedDrugs((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i);
                                  else next.add(i);
                                  return next;
                                })
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Associated genes table */}
                <Card className="p-0 overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Dna className="h-4 w-4 text-indigo-500" />
                      <p className="text-[13px] font-semibold text-slate-800">Associated Genes ({detail.genes.length})</p>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-slate-400">
                      Ranked by evidence-based association score (0–1). Click a row to expand function, evidence breakdown, pathways, mouse models and genetic constraint. Higher score = stronger evidence linking the gene to this disease.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                          <th className="w-12 py-2.5 pl-5 pr-2 text-left">#</th>
                          <th className="py-2.5 pr-4 text-left">Symbol</th>
                          <th className="py-2.5 pr-4 text-left">Name</th>
                          <th className="py-2.5 pr-4 text-left">Target class</th>
                          <th className="py-2.5 pr-4 text-left">Evidence</th>
                          <th className="py-2.5 pr-4 text-right min-w-[140px]">Association Score</th>
                          <th className="py-2.5 pr-5 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.genes.map((g, gi) => (
                          <GeneRow
                            key={g.symbol}
                            gene={g}
                            index={gi}
                            expanded={expandedGenes.has(g.symbol)}
                            onToggle={() =>
                              setExpandedGenes((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.symbol)) next.delete(g.symbol);
                                else next.add(g.symbol);
                                return next;
                              })
                            }
                            onUseGene={() => handleUseGene(g.symbol)}
                          />
                        ))}
                        {detail.genes.length === 0 && (
                          <tr><td colSpan={7} className="py-4 text-center text-[12px] text-slate-400">No associated genes found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <p className="text-[10.5px] text-center text-slate-400 py-2">Source: Open Targets Platform • HPO • OMIM • Orphanet</p>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
