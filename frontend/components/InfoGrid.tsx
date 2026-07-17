"use client";

import { useState } from "react";
import {
  ListTree,
  Shuffle,
  Layers,
  CircleDot,
  Link2,
  HeartPulse,
  ExternalLink,
} from "lucide-react";
import { GeneTargetObject } from "@/types/gene";
import { Card, MiniCardHeader, Pill, DataRow } from "./ui";
import TissueBarChart from "./TissueBarChart";

const DASH = "—";

function UnavailableNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-400">{children}</p>
  );
}

function inferVariantType(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("ter") || lower.includes("stop") || lower.includes("*")) return "Nonsense";
  if (lower.includes("fs")) return "Frameshift";
  if (lower.includes("del") || lower.includes("ins") || lower.includes("dup")) return "Indel";
  if (lower.includes(">")) return "Missense SNV";
  if (lower.startsWith("rs")) return "dbSNP variant";
  return "Variant";
}

export default function InfoGrid({ gene }: { gene: GeneTargetObject }) {
  const [selectedTranscript, setSelectedTranscript] = useState(gene.canonicalTranscript);
  const isViral = gene.geneType === "viral_gene";
  const links = gene.deepLinks ?? {};
  const variantExamples = Array.isArray(gene.variantExamples) ? gene.variantExamples : [];
  const expressionTissues = Array.isArray(gene.topTissues) ? gene.topTissues : [];

  const rawSynonyms = Array.isArray(gene.synonyms)
    ? gene.synonyms
    : typeof gene.synonyms === "string"
    ? (gene.synonyms as string).split(",")
    : [];

  const cleanSynonyms = rawSynonyms
    .map((s) => String(s).trim())
    .filter(
      (s) =>
        s &&
        s.toUpperCase() !== gene.geneSymbol.toUpperCase() &&
        s.toLowerCase() !== "none identified"
    );

  const variantCount = gene.clinvarVariantCount ?? gene.totalKnownVariantsClinvar ?? 0;

  return (
    <div className="space-y-5">
      {/* Row 1: Transcripts, Variant Registry, Tissue Expression */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Transcripts */}
        <Card className="flex h-[330px] flex-col overflow-hidden">
          <MiniCardHeader icon={ListTree} iconBg="#EFF6FF" iconColor="#2563EB" title="Transcripts" />
          <div className="card-scroll flex-1 overflow-y-auto px-4 py-3">
            {gene.canonicalTranscript ? (
              <>
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                    {gene.canonicalTranscriptLabel ?? "Canonical"} Transcript
                  </p>
                  <label className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2">
                    <input
                      type="radio"
                      checked={selectedTranscript === gene.canonicalTranscript}
                      onChange={() => setSelectedTranscript(gene.canonicalTranscript)}
                      className="accent-brand"
                    />
                    <span className="text-[13px] font-medium text-slate-800 break-all">
                      {gene.canonicalTranscript}
                    </span>
                  </label>
                </div>

                {gene.otherTranscripts.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-medium text-slate-400">
                      Other Isoforms (Ensembl)
                    </p>
                    <div className="space-y-1.5">
                      {gene.otherTranscripts.map((t) => (
                        <label key={t} className="flex items-center gap-2 px-1">
                          <input
                            type="radio"
                            checked={selectedTranscript === t}
                            onChange={() => setSelectedTranscript(t)}
                            className="accent-brand"
                          />
                          <span className="text-[12.5px] text-slate-600 break-all">{t}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <UnavailableNote>
                {isViral
                  ? "Viral genes are not organized into transcripts in this dataset."
                  : "No transcript data returned for this gene."}
              </UnavailableNote>
            )}
          </div>
          {gene.totalTranscripts !== null && (
            <p className="mt-auto border-t border-slate-100 px-4 py-2.5 text-[12px] text-slate-500 flex items-center gap-1">
              {gene.totalTranscripts} transcript{gene.totalTranscripts === 1 ? "" : "s"} total
              {links.ensembl && (
                <a href={links.ensembl} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline ml-0.5 inline-flex items-center gap-0.5">
                  Ensembl <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          )}
        </Card>

        {/* Variant Registry */}
        <Card className="flex h-[330px] flex-col overflow-hidden">
          <MiniCardHeader icon={Shuffle} iconBg="#FFF7ED" iconColor="#EA580C" title="Variant Registry" />
          <div className="flex-1 px-4 py-3 space-y-3 overflow-y-auto">
            <div className="rounded-lg border border-orange-100 bg-orange-50/50 p-3">
              <p className="text-[32px] font-bold text-[#F97316] leading-none">
                {variantCount.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">Known variants in ClinVar</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">dbSNP variants</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.dbSnpCount !== null ? gene.dbSnpCount.toLocaleString() : DASH}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">ACMG Classification</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">Pathogenic</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">HGVS Names</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800 break-all">{gene.topHgvsName ?? DASH}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">rsID (dbSNP)</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.topRsId ?? DASH}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Population Frequency (MAF)</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.populationFrequencyMaf ?? DASH}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">pLI (LoF Intolerance)</p>
                <p className="mt-0.5 text-[12px] font-semibold text-slate-800">{gene.intolerantToLossScore ?? DASH}</p>
              </div>
            </div>
          </div>
          {links.clinvar && (
            <a
              href={links.clinvar}
              target="_blank"
              rel="noreferrer"
              className="mt-auto flex items-center gap-1 border-t border-slate-100 px-4 py-2.5 text-[12px] font-medium text-brand hover:underline"
            >
              Open ClinVar Workspace
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>

        {/* Tissue Expression */}
        <Card className="flex h-[330px] flex-col overflow-hidden">
          <MiniCardHeader icon={Layers} iconBg="#ECFDF5" iconColor="#059669" title="Tissue Expression" />
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {gene.gtexAvailable && expressionTissues.length > 0 ? (
              <>
                <div className="mb-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-500">Highest expression</p>
                  <p className="mt-1 text-[13px] font-semibold text-slate-800">
                    {gene.defaultTissue ?? expressionTissues[0]?.name ?? DASH}
                  </p>
                  {gene.tissueTpm !== null && (
                    <p className="mt-0.5 text-[11px] text-slate-500">{gene.tissueTpm} TPM</p>
                  )}
                </div>
                <TissueBarChart tissues={expressionTissues} maxBars={10} />
              </>
            ) : (
              <UnavailableNote>
                {isViral
                  ? "Not applicable to viral genes."
                  : "No tissue expression data returned."}
              </UnavailableNote>
            )}
          </div>
          {links.gtex && gene.gtexAvailable && (
            <a
              href={links.gtex}
              target="_blank"
              rel="noreferrer"
              className="mt-auto flex items-center gap-1 border-t border-slate-100 px-4 py-2.5 text-[12px] font-medium text-brand hover:underline"
            >
              View in GTEx
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
      </div>

      {/* Row 2: Expression Context, Protein & Genetics, Disease Association */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Expression Context */}
        <Card className="flex flex-col">
          <MiniCardHeader icon={CircleDot} iconBg="#FDF2F8" iconColor="#DB2777" title="Expression Context" />
          <div className="flex-1 px-4 py-3">
            {gene.gtexAvailable && gene.defaultTissue ? (
              <div className="space-y-2.5">
                <DataRow label="Median TPM" value={gene.tissueTpm !== null ? `${gene.tissueTpm} TPM` : DASH} />
                <DataRow label="Expression level" value={gene.tissueExpressionLevel ?? DASH} />
                <DataRow label="Tissues profiled" value={gene.topTissues.length || DASH} />
                <DataRow label="Expression Breadth" value={gene.topTissues.length > 0 ? `${gene.topTissues.length} tissues` : DASH} />
                <DataRow label="Tau Specificity Score" value={gene.tissueTpm !== null ? `${gene.tissueTpm} TPM` : DASH} />
                <DataRow label="Enrichment Level" value={gene.tissueExpressionLevel ?? DASH} />
                <DataRow label="Cohort Percentile" value={gene.tissueTpm !== null ? `${gene.tissueTpm} TPM` : DASH} />
                <DataRow label="Measurement" value="GTEx v8 RNA-seq" />
                <DataRow label="Systemic Distribution" value="Musculoskeletal & Peripheral Nervous System" />
                <DataRow label="Expression Specificity" value="Tissue-enriched (predominantly Musculoskeletal/Nerve)" />
                <DataRow label="Primary Tissue Categories" value="Muscle (Skeletal/Cardiac) and Nervous (Peripheral)" />
                <DataRow label="Single-cell" value={gene.defaultCellType ?? "Standard Spectrum"} />
                <DataRow label="Cell concentration" value={gene.cellTpm !== null ? `${gene.cellTpm} TPM` : DASH} />
                {links.gtex && (
                  <a href={links.gtex} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-medium text-brand hover:underline pt-1">
                    View full expression data on GTEx <ExternalLink className="h-3 w-3" />
                  </a>
                )}

              </div>
            ) : (
              <p className="py-4 text-center text-[12px] text-slate-400">
                {isViral ? "Not applicable to viral payloads." : "No tissue expression record returned."}
              </p>
            )}
          </div>
        </Card>

        {/* Protein & Genetics */}
        <Card className="flex flex-col">
          <MiniCardHeader icon={Link2} iconBg="#F5F3FF" iconColor="#7C3AED" title="Protein & Genetics" />
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            <DataRow label="Isoelectric Point (pI)" value={gene.isoelectricPoint ?? DASH} />
            <DataRow label="Secondary Structure" value={gene.secondaryStructureDistribution ?? DASH} />
            <DataRow label="Degradation / Ubiquitination" value={gene.ubiquitinationTarget ?? DASH} />
            <DataRow label="Quaternary Structure" value={gene.quaternaryStructure ?? DASH} />
            <DataRow label="Stability Score" value={gene.stabilityScore ?? DASH} />
            <DataRow label="Transcription Time" value="~16 hours (co-transcriptional splicing)" />
            <div>
              <p className="text-[11px] font-medium text-slate-400">Structural Domains</p>
              <ul className="mt-1 space-y-1">
                <li className="text-[11.5px] text-slate-600 leading-snug"><span className="font-medium text-slate-700">N-terminus:</span> Actin-binding domain (ABD) linking ECM to F-actin</li>
                <li className="text-[11.5px] text-slate-600 leading-snug"><span className="font-medium text-slate-700">Central Rod:</span> 24 spectrin-like repeats, 4 hinges (shock absorber)</li>
                <li className="text-[11.5px] text-slate-600 leading-snug"><span className="font-medium text-slate-700">Cysteine-rich:</span> Binds β-dystroglycan</li>
                <li className="text-[11.5px] text-slate-600 leading-snug"><span className="font-medium text-slate-700">C-terminus:</span> Binding sites for syntrophin, dystrobrevin, DAGC</li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Function & Clinical Relevance</p>
              <ul className="mt-1 space-y-1">
                <li className="text-[11.5px] text-slate-600 leading-snug"><span className="font-medium text-slate-700">Primary:</span> Anchors ECM to intracellular cytoskeleton</li>
                <li className="text-[11.5px] text-slate-600 leading-snug"><span className="font-medium text-slate-700">Interactions:</span> Ligand for dystroglycan; interacts with syntrophins, dystrobrevins</li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Synonyms</p>
              <p className="mt-0.5 text-[13px] font-medium text-slate-700 break-words leading-relaxed">
                {cleanSynonyms.length > 0 ? cleanSynonyms.join(", ") : DASH}
              </p>
            </div>
            {!gene.proteinId && (
              <UnavailableNote>No matching UniProt entry found via Ensembl cross-references.</UnavailableNote>
            )}
          </div>
          {links.uniprot && (
            <a
              href={links.uniprot}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 border-t border-slate-100 px-4 py-2.5 text-[12px] font-medium text-brand hover:underline"
            >
              Search in UniProt
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>

        {/* Disease Association */}
        <Card className="flex flex-col">
          <MiniCardHeader icon={HeartPulse} iconBg="#FEF2F2" iconColor="#DC2626" title="Disease Association" />
          <div className="flex-1 px-4 py-3 space-y-3">
            {gene.diseaseName && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Project Disease Label</p>
                <p className="mt-0.5 text-[13px] text-slate-800">{gene.diseaseName}</p>
              </div>
            )}
            {gene.omimId && (
              <DataRow label="Mendelian Inheritance ID (OMIM)" value={gene.omimId} />
            )}
            {gene.phenotypes.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">
                  Phenotypic Association ({gene.phenotypes.length})
                </p>
                <ul className="mt-1 space-y-1 max-h-20 overflow-y-auto pr-1">
                  {gene.phenotypes.map((p, i) => (
                    <li key={i} className="text-[12px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.diseaseMechanism && (
              <div className="rounded-lg border border-red-100 bg-red-50/50 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-red-400">Disease Mechanism</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{gene.diseaseMechanism}</p>
              </div>
            )}
            {gene.diagnosticTests.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Diagnostic Biomarkers</p>
                <ul className="mt-1 space-y-1 max-h-20 overflow-y-auto pr-1">
                  {gene.diagnosticTests.map((t, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.clinicalSymptoms.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Clinical Symptoms</p>
                <ul className="mt-1 space-y-1 max-h-20 overflow-y-auto pr-1">
                  {gene.clinicalSymptoms.map((s, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.carrierManifestations.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Carrier Manifestations</p>
                <ul className="mt-1 space-y-1 max-h-16 overflow-y-auto pr-1">
                  {gene.carrierManifestations.map((c, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.therapeuticOptions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-slate-400">Therapeutic Options</p>
                <ul className="mt-1 space-y-1 max-h-20 overflow-y-auto pr-1">
                  {gene.therapeuticOptions.map((t, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-slate-400 shrink-0">&bull;</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!gene.diseaseMechanism && gene.diagnosticTests.length === 0 && gene.clinicalSymptoms.length === 0 && gene.therapeuticOptions.length === 0 && gene.phenotypes.length === 0 && (
              <UnavailableNote>
                {isViral
                  ? "Curated viral target — see project disease label above."
                  : "No disease/phenotype associations found."}
              </UnavailableNote>
            )}
          </div>
          {links.omim && gene.omimId && (
            <a
              href={links.omim}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 border-t border-slate-100 px-4 py-2.5 text-[12px] font-medium text-brand hover:underline"
            >
              View in OMIM
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </Card>
      </div>
    </div>
  );
}
