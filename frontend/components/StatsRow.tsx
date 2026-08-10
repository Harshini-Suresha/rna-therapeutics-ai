import {
  GitBranch,
  Share2,
  Tags,
  Network,
  BookMarked,
  ExternalLink,
  Shield,
  BarChart3,
  Stethoscope,
  Dna,
  Pill,
  AlertTriangle,
  Building2,
  FlaskConical,
} from "lucide-react";
import { GeneTargetObject } from "@/types/gene";
import { Card } from "./ui";



const DASH = "—";

interface StatCardProps {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  rows: { label: string; value: React.ReactNode; bar?: number }[];
  sources?: { label: string; url: string }[];
  sourcesColumns?: number;
  notConnected?: boolean;
  extra?: React.ReactNode;
  className?: string;
}

function formatValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "number" && value === 0) return "0";
  return value;
}

function StatCard({ icon: Icon, iconBg, iconColor, title, rows, sources, sourcesColumns, notConnected, extra, className }: StatCardProps) {
  return (
    <Card className={`flex flex-col rounded-xl transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${className ?? ""}`}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: iconBg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
        <p className="text-[12.5px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className="flex-1 space-y-1.5 px-4 pb-3 overflow-y-auto max-h-60 card-scroll">
        {notConnected ? (
          <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-dashed border-slate-200 px-3 py-2.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100">
              <svg className="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </span>
            <p className="text-[11px] text-slate-400">Data source not yet connected</p>
          </div>
        ) : (
          rows.map((r) => {
            const pct = typeof r.bar === "number" ? Math.min(100, Math.max(0, r.bar)) : null;
            const barColor = pct !== null ? (pct >= 70 ? "bg-emerald-400" : pct >= 50 ? "bg-blue-400" : pct >= 30 ? "bg-amber-400" : "bg-red-400") : undefined;
            return (
              <div key={r.label} className="flex flex-col gap-0.5 text-[12px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400 shrink-0">{r.label}</span>
                  <span className="font-medium text-slate-700 text-right break-words">{formatValue(r.value)}</span>
                </div>
                {pct !== null && (
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 w-7 text-right">{pct}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
        {sources && sources.length > 0 && (
          <div
            className={`mt-2 border-t border-slate-100 pt-2 ${
              (typeof (sourcesColumns ?? 1) === "number" && (sourcesColumns ?? 1) > 1) ? "grid grid-cols-2 gap-2" : "space-y-1"
            }`}
          >
            {sources.map((s) => (
              <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10px] text-brand hover:underline">
                {s.label} <ExternalLink className="h-2.5 w-2.5" />
              </a>
            ))}
          </div>
        )}
        {extra}
      </div>
    </Card>
  );
}

export default function StatsRow({ gene }: { gene: GeneTargetObject }) {
  const links = gene.deepLinks ?? {};
  const organism = gene.organism ?? "homo_sapiens";
  const isHuman = organism === "homo_sapiens";
  const hasInteractions = gene.stringHighConfidenceCount !== null || gene.totalInteractors !== null;
  const hasLiterature = gene.pubmedArticleCount !== null || gene.reviewCount !== null || gene.clinicalTrialsCount !== null || gene.preprintCount !== null || gene.caseReportsCount !== null;
  const hasPathways = gene.keggCount !== null || gene.reactomeCount !== null || gene.pathwayCommonsCount !== null || gene.keggPathwayName !== null || gene.reactomePathwayName !== null || gene.keggPathwayId !== null || gene.reactomePathwayId !== null;
  const hasGoTerms = gene.goBiologicalProcess !== null || gene.goMolecularFunction !== null || gene.goCellularComponent !== null;
  const hasClinical = gene.omimId !== null || gene.phenotypes.length > 0 || gene.therapeuticOptions.length > 0 || gene.diagnosticTests.length > 0 || gene.clinicalSymptoms.length > 0;
  const hasMutations = gene.knownPathogenicVariants !== null || Object.values(gene.mutationBreakdown ?? {}).some((value) => value !== null);
  const hasFda = gene.fdaApprovedTherapies.length > 0;
  const hasOrphanet = gene.orphanetCode !== null || gene.icd11Code !== null || gene.incidence !== null || (gene.orphanetDiseaseNames?.length ?? 0) > 0;
  const clinVarGeneSearch = `https://www.ncbi.nlm.nih.gov/clinvar/?term=${encodeURIComponent(`${gene.geneSymbol}[gene]`)}`;

  return (
    <div className="grid grid-cols-2 gap-4 py-6 md:grid-cols-4">
      {/* Row 1 */}
      {/* 1. Target Vulnerability */}
      <StatCard
        icon={Shield}
        iconBg="#FEF2F2"
        iconColor="#DC2626"
        title="Target Vulnerability"
        sourcesColumns={2}
        rows={[
          { label: "LOEUF Decile", value: isHuman ? (gene.loeufDecile ?? DASH) : "Human only" },
          { label: "pLI (gnomAD)", value: isHuman ? (gene.intolerantToLossScore ?? DASH) : "Human only" },
          { label: "Recessive Constraint (Z)", value: isHuman ? (gene.recessiveConstraintZ ?? DASH) : "Human only" },
          { label: "Composite Constraint", value: isHuman ? (gene.compositeConstraintIndex ?? DASH) : "Human only" },
          { label: "Het Excess (Z)", value: isHuman ? (gene.hetExcessZ ?? DASH) : "Human only" },
          { label: "DepMap Dependency", value: gene.depmapDependency ?? DASH },
          { label: "Essential Gene", value: gene.essentialGene ?? DASH },
        ]}
        sources={isHuman ? [
          { label: "Source: gnomAD v2.1.1", url: `https://gnomad.broadinstitute.org/gene/${gene.geneId}?dataset=gnomad_r2_1` },
          { label: "Source: FAVOR", url: "https://xionglab.org/favor/" },
        ] : []}
      />

      {/* 2. Transcript Architecture */}
      <StatCard
        icon={GitBranch}
        iconBg="#ECFDF5"
        iconColor="#059669"
        title="Transcript Architecture"
        rows={[
          { label: "Active Isoforms", value: gene.activeIsoforms ?? DASH },
          { label: "Structural Accessibility", value: gene.structuralAccessibility ?? DASH },
          { label: "Splicing Motif Density", value: gene.splicingMotifDensity ?? DASH },
          { label: "Preclinical Conservation", value: gene.preclinicalConservation ?? DASH },
          { label: "Splice Switches", value: gene.spliceSwitches ?? DASH },
          { label: "Coding Length", value: gene.mrnaLength != null ? `${gene.mrnaLength.toLocaleString()} bp` : DASH },
          { label: "Exon Count", value: gene.exonCount ?? DASH },
        ]}
        sources={[{ label: "Source: Ensembl", url: links.ensembl ?? "#" }]}
      />

      {/* 3. Oligo Design Barriers */}
      <StatCard
        icon={BarChart3}
        iconBg="#FFF7ED"
        iconColor="#EA580C"
        title="Oligo Design Barriers"
        rows={[
          { label: "Population SNPs", value: gene.dbSnpCount !== null ? gene.dbSnpCount.toLocaleString() : DASH },
          { label: "G-Quadruplexes", value: gene.gQuadruplexes ?? DASH },
          { label: "CpG Density", value: gene.cpgDensity ?? DASH },
          { label: "Self-Dimerization Risk", value: gene.selfDimerRisk ?? DASH },
          { label: "Poly-G Tracts", value: gene.polygTracts ?? DASH },
          { label: "Transcript Specificity", value: gene.transcriptSpecificity ?? DASH },
          { label: "Codon Usage Bias", value: gene.codonUsageBias ?? DASH },
        ]}
        sources={links.ncbi ? [{ label: "Source: NCBI dbSNP", url: links.ncbi }] : []}
      />

      {/* 4. Pathways */}
      <StatCard
        icon={Share2}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="Pathways"
        sourcesColumns={2}
        notConnected={!hasPathways}
        rows={[
          { label: "Top pathway", value: gene.pathwayHighlight ?? DASH },
          { label: "KEGG", value: gene.keggCount != null && links.kegg ? <a href={links.kegg} target="_blank" rel="noreferrer" className="text-brand hover:underline">{gene.keggCount} <ExternalLink className="inline h-2.5 w-2.5" /></a> : (gene.keggCount ?? DASH) },
          { label: "Reactome", value: gene.reactomeCount != null && links.reactome ? <a href={links.reactome} target="_blank" rel="noreferrer" className="text-brand hover:underline">{gene.reactomeCount} <ExternalLink className="inline h-2.5 w-2.5" /></a> : (gene.reactomeCount ?? DASH) },
          { label: "Pathway Commons", value: gene.pathwayCommonsCount ?? DASH },
          { label: "Top KEGG ID", value: gene.keggPathwayId ?? DASH },
          { label: "Total", value: (gene.keggCount ?? 0) + (gene.reactomeCount ?? 0) + (gene.pathwayCommonsCount ?? 0) || DASH },
        ]}
        sources={[
          links.kegg ? { label: "KEGG", url: links.kegg } : null,
          links.reactome ? { label: "Reactome", url: links.reactome } : null,
        ].filter(Boolean) as { label: string; url: string }[]}
      />

      {/* Row 2 */}
      {/* 5. Genomic Overview */}
      <StatCard
        icon={Dna}
        iconBg="#EFF6FF"
        iconColor="#2563EB"
        title="Genomic Overview"
        rows={[
          { label: "Genomic Size", value: gene.genomicSize !== null ? `${gene.genomicSize.toLocaleString()} bp` : DASH },
          { label: "mRNA Length (CDS)", value: gene.mrnaLength !== null ? `${gene.mrnaLength.toLocaleString()} bp` : DASH },
          { label: "Protein Mass", value: gene.proteinMass ?? DASH },
          { label: "Exon Count", value: gene.exonCount ?? DASH },
          { label: "Intron Count", value: gene.intronCount ?? DASH },
          { label: "Targetable Exons", value: gene.targetableExons ?? DASH },
        ]}
        sources={[{ label: "Source: Ensembl", url: links.ensembl ?? "#" }]}
        extra={
          <div className="mt-2 space-y-3 text-[12px] leading-5">
            {gene.proteinId && (
              <div>
                <div className="text-[11px] text-slate-500">Protein entry</div>
                <div className="mt-1">
                  {links.uniprot ? (
                    <a href={links.uniprot} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                      {gene.proteinId}
                    </a>
                  ) : (
                    <span>{gene.proteinId}</span>
                  )}
                </div>
              </div>
            )}
            {gene.proteinLength !== null && (
              <div>
                <div className="text-[11px] text-slate-500">Protein length</div>
                <div className="mt-1">{`${gene.proteinLength.toLocaleString()} aa`}</div>
              </div>
            )}
          </div>
        }
      />

      {/* 6. Clinical Profile */}
      <StatCard
        icon={Stethoscope}
        iconBg="#FEF2F2"
        iconColor="#DC2626"
        title="Clinical Profile"
        rows={[
          { label: "OMIM", value: gene.omimId ?? DASH },
          { label: "Phenotypes", value: gene.phenotypes.length > 0 ? gene.phenotypes.length : DASH },
          { label: "Mechanism", value: gene.diseaseMechanism ?? DASH },
          { label: "Diagnostic tests", value: gene.diagnosticTests.length > 0 ? gene.diagnosticTests.length : DASH },
          { label: "Clinical symptoms", value: gene.clinicalSymptoms.length > 0 ? gene.clinicalSymptoms.length : DASH },
          { label: "Therapeutic options", value: gene.therapeuticOptions.length > 0 ? gene.therapeuticOptions.length : DASH },
        ]}
        sources={links.omim && gene.omimId ? [{ label: "Source: OMIM", url: links.omim }] : []}
        extra={
          <div className="mt-2 space-y-1">
            {gene.diagnosticTests.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Diagnostic tests</div>
                <ul className="mt-1 text-[12px] leading-5 list-disc list-inside">
                  {gene.diagnosticTests.slice(0, 3).map((test, i) => (
                    <li key={`dt-${i}`}>
                      {test}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />

      {/* 7. GO Terms */}
      <StatCard
        icon={Tags}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="GO Terms"
        notConnected={!hasGoTerms}
        rows={[
          { label: "Biological Process", value: gene.goBiologicalProcess ?? DASH },
          { label: "Top BP term", value: gene.goBiologicalProcessHighlight ?? DASH },
          { label: "Molecular Function", value: gene.goMolecularFunction ?? DASH },
          { label: "Top MF term", value: gene.goMolecularFunctionHighlight ?? DASH },
          { label: "Cellular Component", value: gene.goCellularComponent ?? DASH },
          { label: "Top CC term", value: gene.goCellularComponentHighlight ?? DASH },
        ]}
        sources={links.go ? [{ label: "Source: Gene Ontology", url: links.go }] : []}
        extra={
          <div className="mt-2 space-y-1">
            {gene.goBiologicalProcessAnnotations && gene.goBiologicalProcessAnnotations.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Top BP annotations</div>
                <ul className="mt-1 text-[12px] list-disc list-inside">
                  {gene.goBiologicalProcessAnnotations.slice(0, 3).map((a, i) => (
                    <li key={`bp-${i}`} className="truncate">
                      {a.url ? (
                        <a className="text-brand hover:underline" href={a.url} target="_blank" rel="noreferrer">
                          {a.term || a.id}
                        </a>
                      ) : (
                        <span>{a.term || a.id}</span>
                      )}
                      {a.evidence ? <span className="text-slate-400"> — {a.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.goMolecularFunctionAnnotations && gene.goMolecularFunctionAnnotations.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Top MF annotations</div>
                <ul className="mt-1 text-[12px] list-disc list-inside">
                  {gene.goMolecularFunctionAnnotations.slice(0, 3).map((a, i) => (
                    <li key={`mf-${i}`} className="truncate">
                      {a.url ? (
                        <a className="text-brand hover:underline" href={a.url} target="_blank" rel="noreferrer">
                          {a.term || a.id}
                        </a>
                      ) : (
                        <span>{a.term || a.id}</span>
                      )}
                      {a.evidence ? <span className="text-slate-400"> — {a.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {gene.goCellularComponentAnnotations && gene.goCellularComponentAnnotations.length > 0 && (
              <div>
                <div className="text-[11px] text-slate-500">Top CC annotations</div>
                <ul className="mt-1 text-[12px] list-disc list-inside">
                  {gene.goCellularComponentAnnotations.slice(0, 3).map((a, i) => (
                    <li key={`cc-${i}`} className="truncate">
                      {a.url ? (
                        <a className="text-brand hover:underline" href={a.url} target="_blank" rel="noreferrer">
                          {a.term || a.id}
                        </a>
                      ) : (
                        <span>{a.term || a.id}</span>
                      )}
                      {a.evidence ? <span className="text-slate-400"> — {a.evidence}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        }
      />

      {/* 8. Interactions */}
      <StatCard
        icon={Network}
        iconBg="#EFF6FF"
        iconColor="#2563EB"
        title="Interactions"
        notConnected={!hasInteractions}
        rows={[
          { label: "STRING (high conf.)", value: gene.stringHighConfidenceCount ?? DASH },
          { label: "STRING (med. conf.)", value: gene.mediumConfidenceCount ?? DASH },
          { label: "Total interactors", value: gene.totalInteractors ?? DASH },
          { label: "Experimental", value: gene.experimentalCount ?? DASH },
          { label: "Database-curated", value: gene.databaseCount ?? DASH },
          { label: "Network Density", value: gene.interactionNetworkDensity ?? DASH },
          ...(gene.topInteractors.length > 0
            ? gene.topInteractors.slice(0, 2).map((p) => ({
                label: p.name,
                value: p.score,
              }))
            : []),
        ]}
        sources={links.string ? [{ label: "Source: STRING", url: links.string }] : []}
      />

      {/* Row 3 */}
      {/* 9. Mutation Distribution */}
      <StatCard
        icon={AlertTriangle}
        iconBg="#FEF3C7"
        iconColor="#D97706"
        title="Mutation Distribution"
        notConnected={!hasMutations && !gene.mutationBreakdown}
        rows={
          hasMutations
            ? [
                { label: "Pathogenic / likely pathogenic", value: gene.knownPathogenicVariants ?? DASH },
                { label: "Large Exon Deletions", value: gene.mutationBreakdown?.largeExonDeletions ?? DASH },
                { label: "Large Exon Duplications", value: gene.mutationBreakdown?.largeExonDuplications ?? DASH },
                { label: "Nonsense / Point", value: gene.mutationBreakdown?.nonsensePointMutations ?? DASH },
                { label: "Frameshift", value: gene.mutationBreakdown?.frameshiftMutations ?? DASH },
                { label: "Splice Site", value: gene.mutationBreakdown?.spliceSiteMutations ?? DASH },
              ]
            : isHuman
              ? [
                  { label: "Pathogenic / likely pathogenic", value: "0" },
                  { label: "Total ClinVar Variants", value: gene.totalClinvarVariants ?? "Search ClinVar" },
                  { label: "ClinVar", value: `Search ClinVar for ${gene.geneSymbol} variants` },
                  { label: "OMIM", value: `Check OMIM for ${gene.geneSymbol} phenotype data` },
                ]
              : [{ label: "Status", value: "Human gene data only" }]
        }
        sources={isHuman ? [
          { label: "NCBI ClinVar", url: links.clinvar ?? clinVarGeneSearch },
          { label: "OMIM", url: `https://omim.org/search/${encodeURIComponent(gene.geneSymbol)}` },
          { label: "UniProt Variants", url: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(gene.geneSymbol)}+variant` },
        ] : []}
      />

      {/* 10. FDA Therapies */}
      <StatCard
        icon={Pill}
        iconBg="#ECFDF5"
        iconColor="#059669"
        title="Oligonucleotide Therapies"
        sourcesColumns={2}
        rows={
          hasFda
            ? gene.fdaApprovedTherapies.map((t) => ({
                label: t.name,
                value: [
                  t.indication,
                  t.modality ?? "Oligonucleotide",
                  t.approvalYear ? `FDA approved ${t.approvalYear}` : "Investigational",
                  t.source,
                ].join(" · "),
              }))
            : isHuman
              ? [
                  { label: "Status", value: gene.fdaMessage ?? "No approved or investigational oligonucleotide therapy found" },
                  { label: "Clinical Trials", value: `Search ClinicalTrials.gov for ${gene.geneSymbol} oligonucleotide studies` },
                  { label: "Research", value: `Check PubMed for ${gene.geneSymbol} ASO/siRNA publications` },
                ]
              : [{ label: "Status", value: "Human gene data only" }]
        }
        sources={
          hasFda
            ? [
                { label: "FDA nucleic-acid therapies", url: "https://www.fda.gov/drugs/nucleic-acid-therapies-and-gene-therapies-approved-and-regulated-fda" },
                { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide` },
                { label: "PubMed Literature", url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide+therapy` },
              ]
              : [
                  { label: "ClinicalTrials.gov", url: `https://clinicaltrials.gov/search?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide` },
                  { label: "PubMed Literature", url: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(gene.geneSymbol)}+oligonucleotide+therapy` },
                  { label: "FDA Approved Oligos", url: "https://www.fda.gov/drugs/nucleic-acid-therapies-and-gene-therapies-approved-and-regulated-fda" },
                ]
        }
      />

      {/* 11. Orphanet / Rare Disease */}
      <StatCard
        icon={Building2}
        iconBg="#F5F3FF"
        iconColor="#7C3AED"
        title="Orphanet / Rare Disease"
        rows={
          isHuman
            ? [
                { label: "Orphanet Code", value: gene.orphanetCode ?? DASH },
                { label: "ICD-11 Code", value: gene.icd11Code ?? DASH },
                { label: "Incidence", value: gene.incidence ?? DASH },
                { label: "Known Pathogenic", value: gene.knownPathogenicVariants ?? DASH },
                ...(gene.orphanetDiseaseNames?.length > 0
                  ? gene.orphanetDiseaseNames.slice(0, 2).map((name) => ({
                      label: "Associated Disease",
                      value: name,
                    }))
                  : []),
              ]
            : [{ label: "Status", value: "Human only" }]
        }
        sources={isHuman ? [
          { label: "Source: Orphanet", url: "https://www.orpha.net" },
        ] : []}
      />

      {/* 12. Literature */}
      <StatCard
        icon={BookMarked}
        iconBg="#FFF7ED"
        iconColor="#EA580C"
        title="Literature"
        sourcesColumns={2}
        notConnected={!hasLiterature}
        rows={[
          { label: "PubMed Articles", value: gene.pubmedArticleCount ?? DASH },
          { label: "Reviews", value: gene.reviewCount ?? DASH },
          { label: "Clinical Trials", value: gene.clinicalTrialsCount ?? DASH },
          { label: "Preprints", value: gene.preprintCount ?? DASH },
          { label: "Case Reports", value: gene.caseReportsCount ?? DASH },
        ]}
        sources={[
          links.pubmed ? { label: "Source: PubMed", url: links.pubmed } : null,
          links.clinicaltrials ? { label: "Source: ClinicalTrials.gov", url: links.clinicaltrials } : null,
        ].filter(Boolean) as { label: string; url: string }[]}
      />

      {/* 13. ADMET Prediction */}
      <StatCard
        icon={FlaskConical}
        iconBg="#ECFDF5"
        iconColor="#059669"
        title="ADMET Prediction"
        notConnected={!gene.admetAvailable}
        className="col-span-2 md:col-span-4"
        rows={gene.admetAvailable ? [] : [{ label: "Status", value: "Provide ASO sequence for prediction" }]}
        extra={
          gene.admetAvailable ? (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const bars = [
                    { label: "Absorption", score: gene.absorptionScore != null ? Math.round(gene.absorptionScore * 100) : null, color: "bg-emerald-400" },
                    { label: "Distribution", score: gene.distributionScore != null ? Math.round(gene.distributionScore * 100) : null, color: "bg-blue-400" },
                    { label: "Metabolism", score: gene.metabolismScore != null ? Math.round(gene.metabolismScore * 100) : null, color: "bg-violet-400" },
                    { label: "Excretion", score: gene.excretionScore != null ? Math.round(gene.excretionScore * 100) : null, color: "bg-violet-400" },
                    { label: "Toxicity", score: gene.toxicityScore != null ? Math.round((1 - gene.toxicityScore) * 100) : null, color: "bg-amber-400" },
                    { label: "Immunogenicity", score: gene.immunogenicity?.score != null ? Math.round((1 - gene.immunogenicity.score) * 100) : null, color: "bg-amber-400" },
                    { label: "Off-target Risk", score: gene.offTargetRisk?.score != null ? Math.round((1 - gene.offTargetRisk.score) * 100) : null, color: "bg-amber-400" },
                    { label: "Nuclease Stability", score: gene.nucleaseSensitivity?.score != null ? Math.round(gene.nucleaseSensitivity.score * 100) : null, color: "bg-violet-400" },
                    { label: "Protein Binding", score: gene.proteinBinding?.score != null ? Math.round((1 - gene.proteinBinding.score) * 100) : null, color: "bg-blue-400" },
                    { label: "Renal Clearance", score: gene.renalClearance?.score != null ? Math.round(gene.renalClearance.score * 100) : null, color: "bg-blue-400" },
                    { label: "Hemolysis Risk", score: gene.hemolysisRisk?.score != null ? Math.round((1 - gene.hemolysisRisk.score) * 100) : null, color: "bg-red-400" },
                    { label: "Cell Uptake", score: gene.cellUptake?.score != null ? Math.round(gene.cellUptake.score * 100) : null, color: "bg-emerald-400" },
                  ];
                  return (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ADMET Scores</div>
                      {bars.map((item) => {
                        const pct = typeof item.score === "number" ? Math.min(100, Math.max(0, item.score)) : null;
                        return (
                          <div key={item.label} className="space-y-0.5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-slate-500 shrink-0">{item.label}</span>
                              <span className="font-medium text-slate-700">{pct != null ? `${pct}%` : "—"}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct ?? 0}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                {(() => {
                  const labels = ["Absorption", "Distribution", "Metabolism", "Excretion", "Toxicity"];
                  const scores = [
                    gene.absorptionScore != null ? Math.round(gene.absorptionScore * 100) : null,
                    gene.distributionScore != null ? Math.round(gene.distributionScore * 100) : null,
                    gene.metabolismScore != null ? Math.round(gene.metabolismScore * 100) : null,
                    gene.excretionScore != null ? Math.round(gene.excretionScore * 100) : null,
                    gene.toxicityScore != null ? Math.round((1 - gene.toxicityScore) * 100) : null,
                  ];
                  const cx = 70;
                  const cy = 65;
                  const r = 50;
                  const n = 5;
                  const points = labels.map((_, i) => {
                    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                    const score = scores[i] != null ? scores[i] : 0;
                    const rr = (score / 100) * r;
                    return `${cx + rr * Math.cos(angle)},${cy + rr * Math.sin(angle)}`;
                  }).join(" ");
                  return (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Radar View</div>
                      <div className="flex justify-center">
                        <svg viewBox="0 0 140 130" className="h-[130px] w-[140px]">
                          <polygon points={`${cx},${cy - r} ${cx + r * Math.cos(Math.PI / 2)},${cy - r * Math.sin(Math.PI / 2)} ${cx + r * Math.cos(Math.PI)},${cy - r * Math.sin(Math.PI)} ${cx + r * Math.cos(Math.PI * 1.5)},${cy - r * Math.sin(Math.PI * 1.5)}`} fill="none" stroke="#E2E8F0" strokeWidth="1" />
                          <polygon points={`${cx},${cy - r * 0.66} ${cx + r * 0.66 * Math.cos(Math.PI / 2)},${cy - r * 0.66 * Math.sin(Math.PI / 2)} ${cx + r * 0.66 * Math.cos(Math.PI)},${cy - r * 0.66 * Math.sin(Math.PI)} ${cx + r * 0.66 * Math.cos(Math.PI * 1.5)},${cy - r * 0.66 * Math.sin(Math.PI * 1.5)}`} fill="none" stroke="#E2E8F0" strokeWidth="1" />
                          <polygon points={`${cx},${cy - r * 0.33} ${cx + r * 0.33 * Math.cos(Math.PI / 2)},${cy - r * 0.33 * Math.sin(Math.PI / 2)} ${cx + r * 0.33 * Math.cos(Math.PI)},${cy - r * 0.33 * Math.sin(Math.PI)} ${cx + r * 0.33 * Math.cos(Math.PI * 1.5)},${cy - r * 0.33 * Math.sin(Math.PI * 1.5)}`} fill="none" stroke="#E2E8F0" strokeWidth="1" />
                          <line x1={cx} y1={cy} x2={cx + r * Math.cos(0)} y2={cy - r * Math.sin(0)} stroke="#E2E8F0" strokeWidth="1" />
                          <line x1={cx} y1={cy} x2={cx + r * Math.cos(Math.PI / 2)} y2={cy - r * Math.sin(Math.PI / 2)} stroke="#E2E8F0" strokeWidth="1" />
                          <line x1={cx} y1={cy} x2={cx + r * Math.cos(Math.PI)} y2={cy - r * Math.sin(Math.PI)} stroke="#E2E8F0" strokeWidth="1" />
                          <line x1={cx} y1={cy} x2={cx + r * Math.cos(Math.PI * 1.5)} y2={cy - r * Math.sin(Math.PI * 1.5)} stroke="#E2E8F0" strokeWidth="1" />
                          <line x1={cx} y1={cy} x2={cx + r * Math.cos(Math.PI * 2.5)} y2={cy - r * Math.sin(Math.PI * 2.5)} stroke="#E2E8F0" strokeWidth="1" />
                          <polygon points={points} fill="rgba(5, 150, 105, 0.15)" stroke="#059669" strokeWidth="2" strokeLinejoin="round" />
                          {labels.map((label, i) => {
                            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                            const score = scores[i] != null ? scores[i] : 0;
                            const tx = cx + (r + 14) * Math.cos(angle);
                            const ty = cy + (r + 14) * Math.sin(angle);
                            const textAnchor = Math.abs(Math.cos(angle)) < 0.1 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
                            return <text key={label} x={tx} y={ty} textAnchor={textAnchor} dominantBaseline="middle" className="text-[8px] fill-slate-500 font-medium">{label}</text>;
                          })}
                          {labels.map((label, i) => {
                            const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
                            const score = scores[i] != null ? scores[i] : 0;
                            const rr = (score / 100) * r;
                            return <circle key={`dot-${label}`} cx={cx + rr * Math.cos(angle)} cy={cy + rr * Math.sin(angle)} r="2.5" fill="#059669" />;
                          })}
                        </svg>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                {[
                  { label: "Absorption (Uptake)", value: gene.absorptionLevel ?? DASH, bar: gene.absorptionScore != null ? Math.round(gene.absorptionScore * 100) : undefined, color: "bg-emerald-400" },
                  { label: "Distribution", value: gene.distributionLevel ?? DASH, bar: gene.distributionScore != null ? Math.round(gene.distributionScore * 100) : undefined, color: "bg-blue-400" },
                  { label: "Metabolism (Nuclease)", value: gene.metabolismLevel ?? DASH, bar: gene.metabolismScore != null ? Math.round(gene.metabolismScore * 100) : undefined, color: "bg-violet-400" },
                  { label: "Excretion", value: gene.excretionLevel ?? DASH, bar: gene.excretionScore != null ? Math.round(gene.excretionScore * 100) : undefined, color: "bg-violet-400" },
                  { label: "Toxicity (Safety)", value: gene.toxicityLevel ?? DASH, bar: gene.toxicityScore != null ? Math.round((1 - gene.toxicityScore) * 100) : undefined, color: "bg-amber-400" },
                ].map((item) => {
                  const pct = typeof item.bar === "number" ? Math.min(100, Math.max(0, item.bar)) : null;
                  return (
                    <div key={item.label} className="space-y-0.5">
                      <div className="flex justify-between gap-2 text-[10px]">
                        <span className="text-slate-500 shrink-0">{item.label}</span>
                        <span className="font-medium text-slate-700 text-right">{item.value ?? "—"}</span>
                      </div>
                      {pct !== null && (
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-[9px] font-semibold text-slate-500 w-6 text-right">{pct}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {gene.admetWarnings?.length > 0 || gene.admetStrengths?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {gene.admetWarnings?.length > 0 && (
                    <div className="flex-1 min-w-[140px] rounded-lg bg-amber-50 border border-amber-100 px-2 py-1.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">Warnings</div>
                      <ul className="space-y-0.5 text-[9px] text-amber-800 list-disc list-inside">
                        {gene.admetWarnings.slice(0, 3).map((w, i) => (
                          <li key={`warn-${i}`} className="truncate">{w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {gene.admetStrengths?.length > 0 && (
                    <div className="flex-1 min-w-[140px] rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-1.5">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 mb-0.5">Strengths</div>
                      <ul className="space-y-0.5 text-[9px] text-emerald-800 list-disc list-inside">
                        {gene.admetStrengths.slice(0, 3).map((s, i) => (
                          <li key={`str-${i}`} className="truncate">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null
        }
        sources={gene.admetAvailable ? [
          { label: "ADMET Analysis", url: "#" },
        ] : []}
      />
    </div>
  );
}
