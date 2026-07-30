"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle, ArrowLeft, Pill, Activity, Dna, Tag, Heart, ExternalLink, BookOpen } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { Card } from "@/components/ui";
import { fetchDiseaseDetail } from "@/lib/diseaseSearchApi";
import { DiseaseDetailResponse } from "@/types/diseaseSearch";

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

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ComponentType<{ className?: string }> }) {
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

  const omim = detail?.databaseRefs?.OMIM;
  const orphanet = detail?.databaseRefs?.Orphanet;

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto max-w-5xl space-y-5">
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
                {/* Main info table */}
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
                  </div>
                  <div className="px-5 py-2">
                    <table className="w-full">
                      <tbody>
                        <SectionHeader title="Disease Information" icon={BookOpen} />
                        <Td label="Description" value={detail.description} />
                        <Td label="OMIM" value={omim} link={omim ? `https://omim.org/entry/${omim}` : undefined} />
                        <Td label="Orphanet" value={orphanet} link={orphanet ? `https://www.orpha.net/en/disease/detail/${orphanet}` : undefined} />
                        <Td label="MeSH" value={detail.databaseRefs?.MESH} link={detail.databaseRefs?.MESH ? `https://meshb.nlm.nih.gov/record/ui?ui=${detail.databaseRefs.MESH}` : undefined} />
                        <Td label="UMLS" value={detail.databaseRefs?.UMLS} />
                        <Td label="NCI Thesaurus" value={detail.databaseRefs?.NCIT} />

                        {detail.synonyms.length > 0 && (
                          <>
                            <SectionHeader title="Alternative Names" icon={Tag} />
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
                            <SectionHeader title="Clinical Features (HPO)" icon={Heart} />
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
                            <SectionHeader title="Subtypes / Child Diseases" icon={Activity} />
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
                            <SectionHeader title="Related Diseases" icon={Activity} />
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
                    </div>
                    <div className="px-5 py-2">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                            <th className="py-2 pr-4 text-left">Drug Name</th>
                            <th className="py-2 pr-4 text-left">Mechanism</th>
                            <th className="py-2 text-right">Stage</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.knownDrugs.map((d, i) => (
                            <tr key={i} className="border-b border-slate-100 last:border-0">
                              <td className="py-2 pr-4 text-[12px] font-medium text-slate-700">{d.name}</td>
                              <td className="py-2 pr-4 text-[11.5px] text-slate-500">{d.mechanismOfAction || "—"}</td>
                              <td className="py-2 text-right">
                                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                                  d.phase === 4 || d.status?.toLowerCase().includes("approved")
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-600"
                                }`}>
                                  {d.phase !== null && d.phase >= 4 ? "Approved" : d.phase !== null ? `Phase ${d.phase}` : d.status || "—"}
                                </span>
                              </td>
                            </tr>
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
                    <p className="mt-0.5 text-[11.5px] text-slate-400">Ranked by evidence-based association score. Click to proceed.</p>
                  </div>
                  <div className="px-5 py-2">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                          <th className="py-2 pr-4 text-left">Symbol</th>
                          <th className="py-2 pr-4 text-left">Name</th>
                          <th className="py-2 pr-4 text-left">Biotype</th>
                          <th className="py-2 pr-4 text-right">Score</th>
                          <th className="py-2 text-right"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.genes.map((g) => (
                          <tr key={g.symbol} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                            <td className="py-2.5 pr-4 text-[12.5px] font-semibold text-slate-800">{g.symbol}</td>
                            <td className="py-2.5 pr-4 text-[11.5px] text-slate-500 max-w-[250px] truncate">{g.name || "—"}</td>
                            <td className="py-2.5 pr-4 text-[11px] text-slate-400">{g.biotype || "—"}</td>
                            <td className="py-2.5 pr-4 text-right text-[11.5px] text-slate-500">{g.score !== null ? g.score.toFixed(3) : "—"}</td>
                            <td className="py-2.5 text-right">
                              <button
                                onClick={() => handleUseGene(g.symbol)}
                                className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-brand hover:text-brand transition-colors"
                              >
                                Use this gene
                              </button>
                            </td>
                          </tr>
                        ))}
                        {detail.genes.length === 0 && (
                          <tr><td colSpan={5} className="py-4 text-center text-[12px] text-slate-400">No associated genes found.</td></tr>
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
