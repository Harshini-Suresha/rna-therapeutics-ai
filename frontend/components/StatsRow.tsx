import {
  GitBranch,
  Share2,
  Tags,
  Network,
  BookMarked,
  ExternalLink,
  Shield,
  BarChart3,
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
  notConnected?: boolean;
  extra?: React.ReactNode;
}

function formatValue(value: React.ReactNode): React.ReactNode {
  if (value === null || value === undefined) return DASH;
  if (typeof value === "number" && value === 0) return "0";
  return value;
}

function StatCard({ icon: Icon, iconBg, iconColor, title, rows, sources, notConnected, extra }: StatCardProps) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ backgroundColor: iconBg }}>
          <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} />
        </span>
        <p className="text-[12.5px] font-semibold text-slate-700">{title}</p>
      </div>
      <div className="flex-1 space-y-1.5 px-4 pb-3 overflow-y-auto max-h-44 card-scroll">
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
          <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
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
  const hasPathways = gene.keggCount !== null || gene.reactomeCount !== null;
  const hasGoTerms = gene.goBiologicalProcess !== null || gene.goMolecularFunction !== null || gene.goCellularComponent !== null;

  return (
    <div className="grid grid-cols-3 gap-4 md:grid-cols-4 lg:grid-cols-7">
      {/* 1. Target Vulnerability */}
      <StatCard
        icon={Shield}
        iconBg="#FEF2F2"
        iconColor="#DC2626"
        title="Target Vulnerability"
        rows={[
          { label: "pHaplo Score", value: isHuman ? (gene.haploinsufficiencyScore ?? DASH) : "Human only" },
          { label: "LOEUF Decile", value: isHuman ? (gene.loeufDecile ?? DASH) : "Human only" },
          { label: "Triplosensitivity", value: isHuman ? (gene.triplosensitivity ?? DASH) : "Human only" },
          { label: "RNA Half-Life (t₁/₂)", value: isHuman ? (gene.rnaHalflife ?? DASH) : "Human only" },
          { label: "DepMap Dependency", value: gene.depmapDependency ?? DASH },
        ]}
        sources={isHuman ? [
          { label: "Source: ClinGen", url: "https://search.clinicalgenome.org/kb/gene-dosage" },
          { label: "Source: gnomAD v2.1.1", url: `https://gnomad.broadinstitute.org/gene/${gene.geneId}?dataset=gnomad_r2_1` },
          { label: "Source: RNAdecayCafe", url: "https://zenodo.org/records/15785218" },
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
        notConnected={!hasPathways}
        rows={[
          { label: "Top pathway", value: gene.pathwayHighlight ?? DASH },
          { label: "KEGG", value: gene.keggCount ?? DASH },
          { label: "Reactome", value: gene.reactomeCount ?? DASH },
          { label: "Total pathways", value: (gene.keggCount ?? 0) + (gene.reactomeCount ?? 0) || DASH },
        ]}
        sources={[
          links.kegg ? { label: "Source: KEGG", url: links.kegg } : null,
          links.reactome ? { label: "Source: Reactome", url: links.reactome } : null,
        ].filter(Boolean) as { label: string; url: string }[]}
      />

      {/* 5. GO Terms */}
      <StatCard
        icon={Tags}
        iconBg="#FDF2F8"
        iconColor="#DB2777"
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
      />

      {/* 6. Interactions */}
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

      {/* 7. Literature */}
      <StatCard
        icon={BookMarked}
        iconBg="#FFF7ED"
        iconColor="#EA580C"
        title="Literature"
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
    </div>
  );
}
