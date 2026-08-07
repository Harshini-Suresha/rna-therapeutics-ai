"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useClientSearchParams } from "@/utils/useClientSearchParams"
import { AlertCircle, ArrowRight, BookOpen, ClipboardCheck, Cpu, Database, Dna, FileText, ChevronRight } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import BasicInfoForm from "@/components/BasicInfoForm";
import GeneOverviewCard from "@/components/GeneOverviewCard";
import GeneTherapyInfoCard from "@/components/GeneTherapyInfoCard";
import InfoGrid from "@/components/InfoGrid";
import StatsRow from "@/components/StatsRow";
import FooterBar from "@/components/FooterBar";
import DiseaseSearchSection from "@/components/DiseaseSearchSection";
import DiseaseMatchIndicator from "@/components/DiseaseMatchIndicator";
import { GeneTargetObject } from "@/types/gene";
import { fetchGene } from "@/lib/api";
import { saveReport } from "@/lib/auth";
import { getOrganism } from "@/lib/organisms";
import { findViralGene } from "@/lib/virusGenes";
import { formatGeneSymbol } from "../shared/geneFormat";

const ANALYSIS_MODULES = [
  "Biological Information Retrieval",
  "Therapeutic Mechanism Configuration",
  "Molecular Defect Identification",
  "Therapeutic Goal Prediction",
  "Rulebook Execution",
  "Mechanism-specific Target Discovery",
  "Candidate Design",
  "Candidate Optimization",
  "Candidate Ranking",
  "Biological Validation",
  "Final Report Generation",
];

const MECHANISM_CATEGORIES = [
  {
    category: "Gene Silencing",
    items: [
      "RNase H-mediated Gapmer Knockdown",
      "Steric-blocking Translation Inhibition",
      "Anti-miR (AntagomiR)",
      "Transcriptional Gene Silencing",
      "RNA Interference (siRNA)",
    ],
  },
  {
    category: "Gene Upregulation",
    items: [
      "Poison Exon Blocking",
      "AntagoNAT",
      "uORF Blocking",
      "Target Protector (BlockmiR)",
      "miRNA Mimic Therapy",
      "saRNA-mediated Transcriptional Activation",
    ],
  },
  {
    category: "RNA Editing / Correction",
    items: [
      "ADAR-mediated RNA Editing",
      "Endogenous ADAR Recruitment",
      "Human-derived Programmable RNA Editing",
      "CRISPR-guided RNA Editing",
      "RNA Trans-splicing (SMaRT)",
    ],
  },
  {
    category: "RNA Processing Modulation",
    items: [
      "Exon Skipping",
      "Exon Inclusion",
      "Pseudoexon Suppression",
      "Cryptic Splice-site Blocking",
      "Alternative Polyadenylation Modulation",
    ],
  },
  {
    category: "RNA Neutralization",
    items: ["Toxic RNA Neutralization"],
  },
  {
    category: "Protein Replacement",
    items: [
      "mRNA Replacement Therapy",
      "circRNA-mediated Protein Replacement",
    ],
  },
  {
    category: "Protein Function Modulation",
    items: ["RNA Aptamer Therapeutics"],
  },
];

const ARCHITECTURE_STEPS = [
  { label: "Biological Information", icon: Database },
  { label: "Knowledge Retrieval", icon: BookOpen },
  { label: "Mechanism Rulebooks", icon: FileText },
  { label: "Computational Engine", icon: Cpu },
  { label: "Validation & Output", icon: ClipboardCheck },
];

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useClientSearchParams();
  const [organism, setOrganism] = useState("human");
  const [diseaseName, setDiseaseName] = useState("");
  const [geneSymbol, setGeneSymbol] = useState("");
  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSearchTriggered, setAutoSearchTriggered] = useState(false);
  const [diseaseSearchActive, setDiseaseSearchActive] = useState(false);

  useEffect(() => {
    const prefill = sessionStorage.getItem("aso:prefillGeneSearch");
    if (prefill) {
      try {
        const { organism: org, geneSymbol: sym, diseaseName: dis } = JSON.parse(prefill);
        if (org) setOrganism(org);
        if (sym) setGeneSymbol(sym);
        if (dis) setDiseaseName(dis);
        sessionStorage.removeItem("aso:prefillGeneSearch");
      } catch {
        sessionStorage.removeItem("aso:prefillGeneSearch");
      }
    }
  }, []);

  useEffect(() => {
    const query = searchParams?.get("q")?.trim();
    if (query && query !== geneSymbol) {
      setGeneSymbol(query);
    }
  }, [searchParams, geneSymbol]);

  useEffect(() => {
    const query = searchParams?.get("q")?.trim();
    if (!query || query !== geneSymbol || gene || loading) return;
    if (autoSearchTriggered) return;

    setAutoSearchTriggered(true);
    handleLoadGene();
  }, [searchParams, geneSymbol, gene, loading, autoSearchTriggered]);

  async function handleLoadGene() {
    if (!geneSymbol.trim()) return;

    setGene(null);
    setLoading(true);
    setError(null);

    const selectedOrg = getOrganism(organism);
    if (!selectedOrg) {
      setError("Invalid organism selected.");
      setLoading(false);
      return;
    }

    if (selectedOrg.tier === 5) {
      const viralGene = findViralGene(organism, geneSymbol);
      if (!viralGene) {
        setGene(null);
        setError(
          `Gene symbol "${geneSymbol}" isn't in the curated reference set for ${selectedOrg.commonName}.`
        );
        setLoading(false);
        return;
      }

      const formattedSymbol = formatGeneSymbol(viralGene.symbol, organism);
      setGeneSymbol(formattedSymbol);

      const viralTargetPayload: GeneTargetObject = {
        organism: selectedOrg.commonName,
        diseaseName: diseaseName.trim() || null,
        geneSymbol: viralGene.symbol,
        geneName: viralGene.product,
        geneFunction: viralGene.product,
        geneId: null,
        entrezGeneId: null,
        hgncId: `RefSeq:${viralGene.referenceGenome}`,
        chromosome: "Viral genome (single segment)",
        location: viralGene.referenceGenome,
        cytoband: null,
        genomeBuild: viralGene.referenceGenome,
        genomicStart: null,
        genomicEnd: null,
        strand: null,
        geneType: "viral_gene",
        synonyms: [],
        source: ["Curated reference (not a live connector)"],
        taxonId: "Viral Taxon",
        canonicalTranscript: null,
        canonicalTranscriptLabel: null,
        otherTranscripts: [],
        totalTranscripts: null,
        variantExamples: [],
        totalKnownVariantsClinvar: null,
        defaultTissue: null,
        tissueExpressionLevel: null,
        tissueTpm: null,
        topTissues: [],
        defaultCellType: null,
        cellExpressionLevel: null,
        cellTpm: null,
        cellTypeAll: {},
        expressionStabilityCV: null,
        vitalOrganTpm: null,
        vitalOrganTissues: [],
        dominantIsoformFraction: null,
        dominantIsoformId: null,
        diseaseFoldChange: null,
        singleCellPrevalence: null,
        circadianAmplitude: null,
        intronRetentionRatio: null,
        developmentalExpression: null,
        alternativePolyadenylation: null,
        nuclearRetentionIndex: null,
        proteinId: null,
        proteinName: viralGene.product,
        proteinLength: viralGene.approxLengthAa,
        molecularWeight: null,
        isoelectricPoint: null,
        secondaryStructureDistribution: null,
        criticalPhosphorylationSite: null,
        ubiquitinationTarget: null,
        quaternaryStructure: null,
        stabilityScore: null,
        subcellularLocation: null,
        criticalFunctionalDomains: null,
        disorderedContent: null,
        proteosomalTurnover: null,
        alphafoldPlddt: null,
        gravyIndex: null,
        proteinAbundance: null,
        tractability: null,
        interproId: null,
        pfamId: null,
        pdbId: null,
        mutationRate: null,
        uniprotAccession: null,
        disease: diseaseName.trim() || null,
        diseaseAssociation: diseaseName.trim() || null,
        diseaseAssociationSource: [],
        phenotypes: [],
        associationStatus: null,
        omimId: null,
        diseaseMechanism: null,
        diagnosticTests: [],
        clinicalSymptoms: [],
        carrierManifestations: [],
        therapeuticOptions: [],
        exonCount: null,
        intronCount: null,
        cdsLength: viralGene.approxLengthAa ? viralGene.approxLengthAa * 3 + 3 : null,
        geneLength: viralGene.approxLengthAa ? viralGene.approxLengthAa * 3 + 3 : null,
        dbSnpCount: null,
        gnomadAvailable: false,
        clinvarVariantCount: null,
        topHgvsName: null,
        topRsId: null,
        populationFrequencyMaf: null,
        gtexAvailable: false,
        humanProteinAtlasLevel: null,
        gtexExpressionLevel: null,
        deepLinks: {
          ncbi: `https://www.ncbi.nlm.nih.gov/nuccore/${viralGene.referenceGenome}`,
          uniprot: `https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(
            `${selectedOrg.commonName} ${viralGene.symbol}`
          )}`,
          kegg: `https://www.genome.jp/dbget-bin/www_bget?q=${viralGene.symbol}`,
          pubmed: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(
            `${selectedOrg.commonName} ${viralGene.symbol}`
          )}`,
        },
        keggCount: null,
        reactomeCount: null,
        pathwayCommonsCount: null,
        keggPathwayName: null,
        reactomePathwayName: null,
        keggPathwayId: null,
        reactomePathwayId: null,
        pathwayHighlight: null,
        goBiologicalProcess: null,
        goMolecularFunction: null,
        goCellularComponent: null,
        goBiologicalProcessHighlight: null,
        goMolecularFunctionHighlight: null,
        goCellularComponentHighlight: null,
        stringHighConfidenceCount: null,
        totalInteractors: null,
        topInteractors: [],
        mediumConfidenceCount: null,
        experimentalCount: null,
        databaseCount: null,
        interactionNetworkDensity: null,
        pubmedArticleCount: null,
        reviewCount: null,
        clinicalTrialsCount: null,
        preprintCount: null,
        caseReportsCount: null,
        loeufDecile: null,
        triplosensitivity: null,
        activeIsoforms: null,
        spliceSwitches: null,
        structuralAccessibility: null,
        splicingMotifDensity: null,
        preclinicalConservation: null,
        gQuadruplexes: null,
        cpgDensity: null,
        selfDimerRisk: null,
        polygTracts: null,
        transcriptSpecificity: null,
        codonUsageBias: null,
        rnaHalflife: null,
        rnaHalflifeHours: null,
        rnaHalflifeSource: null,
        depmapDependency: null,
        depmapDependencyScore: null,
        essentialGene: null,
        depmapSource: null,
        genomicSize: null,
        mrnaLength: null,
        proteinMass: null,
        fdaApprovedTherapies: [],
        fdaMessage: null,
        targetableExons: null,
        incidence: null,
        orphanetCode: null,
        icd11Code: null,
        orphanetDiseaseNames: [],
        knownPathogenicVariants: null,
        totalClinvarVariants: null,
        mutationBreakdown: {
          largeExonDeletions: null,
          largeExonDuplications: null,
          nonsensePointMutations: null,
          frameshiftMutations: null,
          spliceSiteMutations: null,
        },
      };

      setGene(viralTargetPayload);
      setLoading(false);
      return;
    }

    try {
      const searchSpecies = selectedOrg.ensemblSpecies || "homo_sapiens";
      const result = await fetchGene(searchSpecies, diseaseName, geneSymbol);
      const formattedOfficial = formatGeneSymbol(result.geneSymbol, organism);
      setGeneSymbol(formattedOfficial);
      setGene(result);
      saveReport({
        step: "gene_lookup",
        title: `Gene Lookup: ${result.geneSymbol || geneSymbol}`,
        geneSymbol: result.geneSymbol || geneSymbol,
        disease: diseaseName || "",
        summary: `Retrieved data for ${result.geneSymbol} in ${(searchSpecies || "homo_sapiens").replace("_", " ")}.`,
        data: { geneId: result.geneId, organism: searchSpecies, disease: diseaseName },
      });
    } catch (err) {
      setGene(null);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClearAll() {
    setOrganism("human");
    setDiseaseName("");
    setGeneSymbol("");
    setGene(null);
    setError(null);
    setAutoSearchTriggered(false);
  }

  function handleConfirm() {
    if (!gene) return;
    sessionStorage.setItem("aso:confirmedTarget", JSON.stringify(gene));
    router.push("/mechanisms");
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-4 px-4 py-4 lg:px-[18px]">
          {(gene || loading) && (
            <BasicInfoForm
              organism={organism}
              setOrganism={setOrganism}
              diseaseName={diseaseName}
              setDiseaseName={setDiseaseName}
              geneSymbol={geneSymbol}
              setGeneSymbol={setGeneSymbol}
              onLoadGene={handleLoadGene}
              loading={loading}
              geneFieldsDisabled={diseaseSearchActive}
            />
          )}
          {error && (
            <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-2 text-[12px] text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          {!gene && !loading && (
            <>
              {/* Platform Overview */}
              <section className="rounded-lg border border-[#E5E7EB] bg-white p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="flex h-[119px] w-[110px] shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-slate-50 to-slate-100">
                    <Dna className="h-16 w-16 text-[#0F172A]" strokeWidth={1.35} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-[16px] font-bold text-[#0F172A]">RNA Therapeutics Platform</h1>
                    <p className="mt-1.5 max-w-[640px] text-[11.5px] leading-[1.9] text-[#263d6d]">
                      The RNA Therapeutics Platform is an integrated computational framework for the end-to-end design, optimization, and evaluation of RNA-based therapeutics. The platform combines automated biological information retrieval, mechanism-specific therapeutic rulebooks, molecular defect characterization, target discovery, candidate sequence design, computational optimization, and biological validation within a unified workflow.
                    </p>
                  </div>
                  <div className="grid shrink-0 grid-cols-3 gap-3 xl:w-[465px]">
                    {[
                      ["25", "Therapeutic Mechanisms"],
                      ["7", "Therapeutic Goals"],
                      ["11", "Computational Modules"],
                    ].map(([value, label]) => (
                      <div key={label} className="rounded-md border border-[#E5E7EB] px-3 py-3">
                        <p className="text-[18px] font-bold text-[#0F172A]">{value}</p>
                        <p className="mt-1 text-[9.5px] font-medium text-slate-600">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <BasicInfoForm
                organism={organism}
                setOrganism={setOrganism}
                diseaseName={diseaseName}
                setDiseaseName={setDiseaseName}
                geneSymbol={geneSymbol}
                setGeneSymbol={setGeneSymbol}
                onLoadGene={handleLoadGene}
                loading={loading}
                geneFieldsDisabled={diseaseSearchActive}
              />

              {/* Disease-based gene discovery */}
              <DiseaseSearchSection
                organismId={organism}
                active={diseaseSearchActive}
                onActivate={() => setDiseaseSearchActive(true)}
                onDeactivate={() => setDiseaseSearchActive(false)}
                onSelectGene={(symbol, disease) => {
                  setOrganism("human");
                  setGeneSymbol(symbol);
                  setDiseaseName(disease);
                  setDiseaseSearchActive(false);
                  setTimeout(() => handleLoadGene(), 0);
                }}
              />

              {/* Analysis Modules + Therapeutic Mechanisms */}
              <section className="grid grid-cols-12 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                {/* Analysis Modules - navigation tree style */}
                <div className="col-span-12 xl:col-span-3 border-b border-[#E5E7EB] bg-white px-4 py-4 xl:border-b-0 xl:border-r">
                  <div className="pb-2 mb-2 border-b border-slate-100">
                    <h2 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wide">
                      Analysis Modules
                    </h2>
                  </div>
                  <ul className="space-y-0">
                    {ANALYSIS_MODULES.map((m, i) => (
                      <li key={m} className="flex items-center gap-2 border-b border-slate-100 py-[5px] last:border-b-0">
                        <span className="w-8 shrink-0 rounded bg-slate-100 py-0.5 text-center text-[10px] font-semibold text-[#64748B] tabular-nums">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 text-[10.5px] font-medium text-[#64748B]">{m}</span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#64748B]" />
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Therapeutic Mechanisms - database style */}
                <div className="col-span-12 xl:col-span-9 bg-white px-5 py-4">
                  <div className="pb-2 mb-3 border-b border-slate-100">
                    <h2 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wide">
                      Therapeutic Mechanisms
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {MECHANISM_CATEGORIES.map((cat, catIdx) => (
                      <div key={cat.category} className="rounded-md border border-[#E5E7EB] px-3 py-2.5">
                        <p className="mb-1 text-[10.5px] font-bold text-[#0F172A]">
                          {cat.category} <span className="ml-1 text-slate-400 font-normal">({cat.items.length})</span>
                        </p>
                        <ul className="space-y-0">
                          {cat.items.map((item) => (
                            <li key={item} className="py-[2px] text-[10px] leading-snug text-[#64748B]">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Architecture Diagram */}
              <section className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4">
                <div className="pb-2 mb-3 border-b border-slate-100">
                    <h2 className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wide">
                    Platform Architecture
                  </h2>
                </div>
                <div className="flex flex-col items-center justify-center gap-3 md:flex-row md:gap-5">
                  {ARCHITECTURE_STEPS.map((step, i) => (
                    <div key={step.label} className="flex items-center gap-3 md:gap-5">
                      <div className="flex min-w-[116px] flex-col items-center gap-2 text-center">
                        <step.icon className="h-7 w-7 text-[#18366d]" strokeWidth={1.45} />
                        <span className="text-[10px] font-medium text-[#64748B]">{step.label}</span>
                      </div>
                      {i < ARCHITECTURE_STEPS.length - 1 && (
                        <svg width="72" height="18" viewBox="0 0 72 18" className="hidden text-[#64748B] md:block">
                          <line x1="0" y1="9" x2="66" y2="9" stroke="currentColor" strokeWidth="1.2" />
                          <polyline points="61,4 66,9 61,14" fill="none" stroke="currentColor" strokeWidth="1.2" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </section>

            </>
          )}
          {gene && (
            <>
              <GeneOverviewCard gene={gene} onRefresh={handleLoadGene} />
              {gene.organism === "homo_sapiens" && diseaseName.trim() && (
                <DiseaseMatchIndicator enteredDisease={diseaseName} gene={gene} />
              )}
              <InfoGrid gene={gene} />
              <StatsRow gene={gene} />
              <GeneTherapyInfoCard gene={gene} />
            </>
          )}
        </main>
        {gene && (
          <FooterBar
            onClear={handleClearAll}
            onConfirm={handleConfirm}
          />
        )}
      </div>
    </div>
  );
}
