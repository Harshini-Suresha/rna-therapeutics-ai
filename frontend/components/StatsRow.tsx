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
  rows: { label: string; value: React.ReactNode }[];
  sources?: { label: string; url: string }[];
  sourcesColumns?: number;
  notConnected?: boolean;
  extra?: React.ReactNode;
}

function formatValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "number" && value === 0) return "0";
  return value;
}

function StatCard({ icon: Icon, iconBg, iconColor, title, rows, sources, sourcesColumns, notConnected, extra }: StatCardProps) {
  return (
    <Card className="flex flex-col rounded-xl">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: iconBg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
        <p className="text-[12.5px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className="flex-1 space-y-1.5 px-4 pb-3 overflow-y-auto max-h-60 card-scroll">
        {notConnected ? (
          <p className="text-[11.5px] text-slate-400">Not yet connected</p>
        ) : (
          rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-2 text-[12px]">
              <span className="text-slate-400 shrink-0">{r.label}</span>
              <span className="font-medium text-slate-700 text-right break-words">{formatValue(r.value)}</span>
            </div>
            ))
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
        rows={
          gene.admetAvailable
            ? [
                { label: "Absorption", value: gene.absorptionLevel ? `${gene.absorptionLevel} (${gene.absorptionScore})` : DASH },
                { label: "Distribution", value: gene.distributionLevel ? `${gene.distributionLevel} (${gene.distributionScore})` : DASH },
                { label: "Metabolism", value: gene.metabolismLevel ? `${gene.metabolismLevel} (${gene.metabolismScore})` : DASH },
                { label: "Excretion", value: gene.excretionLevel ? `${gene.excretionLevel} (${gene.excretionScore})` : DASH },
                { label: "Toxicity", value: gene.toxicityLevel ? `${gene.toxicityLevel} (${gene.toxicityScore})` : DASH },
                { label: "Immunogenicity", value: gene.immunogenicity?.level ?? DASH },
                { label: "Off-target Risk", value: gene.offTargetRisk?.level ?? DASH },
                { label: "Nuclease Stability", value: gene.nucleaseSensitivity?.level ?? DASH },
              ]
            : [{ label: "Status", value: "Provide ASO sequence for prediction" }]
        }
        extra={
          gene.admetAvailable && gene.admetAnalysis ? (
            <div className="mt-2 space-y-1.5 text-[11px] leading-4 text-slate-600">
              {gene.admetWarnings?.length > 0 && (
                <div>
                  <div className="font-medium text-amber-700">Warnings</div>
                  <ul className="mt-0.5 list-disc list-inside">
                    {gene.admetWarnings.slice(0, 3).map((w, i) => (
                      <li key={`warn-${i}`} className="truncate">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {gene.admetStrengths?.length > 0 && (
                <div>
                  <div className="font-medium text-emerald-700">Strengths</div>
                  <ul className="mt-0.5 list-disc list-inside">
                    {gene.admetStrengths.slice(0, 3).map((s, i) => (
                      <li key={`str-${i}`} className="truncate">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
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
