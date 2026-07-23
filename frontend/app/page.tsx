"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import BasicInfoForm from "@/components/BasicInfoForm";
import GeneOverviewCard from "@/components/GeneOverviewCard";
import InfoGrid from "@/components/InfoGrid";
import StatsRow from "@/components/StatsRow";
import FooterBar from "@/components/FooterBar";
import { GeneTargetObject } from "@/types/gene";
import { TherapeuticGoalId, THERAPEUTIC_GOALS } from "@/types/mechanism";
import { fetchGene } from "@/lib/api";
import { getOrganism } from "@/lib/organisms";
import { findViralGene } from "@/lib/virusGenes";
import { formatGeneSymbol } from "../shared/geneFormat";

const SELECTED_GOAL_KEY = "aso:therapeuticGoal";

export default function NewProjectPage() {
  const router = useRouter();
  const [organism, setOrganism] = useState("human");
  const [diseaseName, setDiseaseName] = useState("");
  const [geneSymbol, setGeneSymbol] = useState("");
  const [selectedGoal, setSelectedGoal] = useState<TherapeuticGoalId | null>(null);

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // --- TIER 5 (viruses): curated reference data, no live connector ---
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

      // Apply organism-specific formatting to the curated symbol
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
      };

      setGene(viralTargetPayload);
      setLoading(false);
      return;
    }

    // --- Tier 1/2/3/4/6: live Ensembl + Open Targets/phenotype data ---
    try {
      const searchSpecies = selectedOrg.ensemblSpecies || "homo_sapiens";
      const result = await fetchGene(searchSpecies, diseaseName, geneSymbol);
      // Apply organism-specific formatting to the official symbol returned by the server
      const formattedOfficial = formatGeneSymbol(result.geneSymbol, organism);
      setGeneSymbol(formattedOfficial);
      setGene(result);
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
  }

  function handleConfirm() {
    if (!gene || !selectedGoal) return;
    sessionStorage.setItem("aso:confirmedTarget", JSON.stringify(gene));
    sessionStorage.setItem(SELECTED_GOAL_KEY, selectedGoal);
    router.push("/mechanisms");
  }

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 space-y-5 px-6 py-6">
          <BasicInfoForm
            organism={organism}
            setOrganism={setOrganism}
            diseaseName={diseaseName}
            setDiseaseName={setDiseaseName}
            geneSymbol={geneSymbol}
            setGeneSymbol={setGeneSymbol}
            onLoadGene={handleLoadGene}
            loading={loading}
          />
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {!gene && !loading && (
            <>
              {/* Hero */}
              <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white text-[15px] font-bold">
                    ASO
                  </div>
                  <div>
                    <h2 className="text-[18px] font-semibold text-slate-800">
                      ASO Therapeutic Target Discovery Platform
                    </h2>
                    <p className="text-[13px] text-slate-500 mt-1 leading-relaxed max-w-3xl">
                      An integrated computational platform for the design, optimization and
                      validation of RNA therapeutics including antisense oligonucleotides,
                      siRNA, miRNA therapeutics, mRNA replacement, circRNA therapeutics,
                      RNA editing and splice modulation.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {[
                    "26 Mechanisms",
                    "Integrated Databases",
                    "Automated Discovery",
                    "Candidate Optimization",
                    "Validation Pipeline",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-brand/15 bg-brand/5 px-3 py-1 text-[11px] font-medium text-brand"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Platform Overview — 3 columns */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                {/* ABOUT */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card flex flex-col">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                      </svg>
                    </div>
                    <h2 className="text-[15px] font-semibold text-slate-800">About the Platform</h2>
                  </div>

                  <p className="text-[12px] text-slate-500 leading-6 mb-5">
                    An integrated computational platform for the design,
                    optimization and validation of RNA therapeutics including
                    antisense oligonucleotides, siRNA, miRNA therapeutics,
                    mRNA replacement, circRNA therapeutics, RNA editing and
                    splice modulation.
                  </p>

                  <div className="border-t border-slate-100 my-4" />

                  <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-3">
                    Platform Features
                  </h3>

                  <ul className="space-y-2.5">
                    {[
                      "26 Therapeutic Mechanisms",
                      "Integrated Biological Databases",
                      "Mechanism-specific Rulebooks",
                      "Automated Target Discovery",
                      "Multi-stage Candidate Optimization",
                      "Biological Validation Pipeline",
                      "Comprehensive Reporting",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2 text-[12px] text-slate-600">
                        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* WORKFLOW */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card flex flex-col">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                      </svg>
                    </div>
                    <h2 className="text-[15px] font-semibold text-slate-800">Platform Workflow</h2>
                  </div>

                  <div className="flex-1">
                    {[
                      "Biological Information",
                      "Knowledge Retrieval",
                      "User Verification",
                      "Mechanism Selection",
                      "Additional Information",
                      "Molecular Defect Identification",
                      "Therapeutic Goal Prediction",
                      "Rulebook Execution",
                      "Target Discovery",
                      "Candidate Design",
                      "Optimization",
                      "Validation",
                      "Final Report",
                    ].map((step, index) => (
                      <div key={step} className="flex items-center gap-3 py-1.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/8 text-[11px] font-semibold text-brand">
                          {index + 1}
                        </div>
                        <span className="text-[12px] text-slate-600">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* REQUIRED */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card flex flex-col">
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <h2 className="text-[15px] font-semibold text-slate-800">Before You Start</h2>
                  </div>

                  <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
                    Required Information
                  </h3>

                  <ul className="space-y-2 mb-5">
                    {["Organism", "Disease Name", "Gene Symbol"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[12px] text-slate-600">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-brand text-white text-[10px] font-bold">
                          !
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-slate-100 my-4" />

                  <h3 className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    May be requested later
                  </h3>
                  <p className="text-[11px] text-slate-400 mb-3">
                    Depending on the selected therapeutic mechanism
                  </p>

                  <ul className="space-y-2">
                    {[
                      "HGVS Variant",
                      "VCF File",
                      "Deleted Exon(s)",
                      "Transcript ID",
                      "Custom Sequence",
                      "Target Protein",
                      "Target Tissue / Cell Type",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-[12px] text-slate-500">
                        <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* OUTPUTS */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <h2 className="text-[15px] font-semibold text-slate-800">What You Will Get</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  {[
                    { label: "Target Information", icon: "🎯" },
                    { label: "Candidate Sequences", icon: "🧬" },
                    { label: "Optimization Results", icon: "⚡" },
                    { label: "Biological Validation", icon: "✅" },
                    { label: "Final Report", icon: "📄" },
                    { label: "Export Formats", icon: "📦" },
                  ].map(({ label, icon }) => (
                    <div
                      key={label}
                      className="group rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-center transition-all hover:border-brand/20 hover:bg-brand/[0.03] hover:shadow-sm"
                    >
                      <div className="mb-2 text-[20px]">{icon}</div>
                      <div className="text-[12px] font-medium text-slate-700">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 border-t border-slate-100 pt-4 text-[12px] text-slate-400 leading-relaxed">
                  Start by providing the basic biological information above. The platform
                  will automatically retrieve biological annotations, guide you through
                  therapeutic mechanism selection, perform mechanism-specific design,
                  optimize therapeutic candidates, and generate comprehensive
                  downloadable reports.
                </div>
              </div>

              {/* Therapeutic Goals */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-800">Therapeutic Goals</h2>
                    <p className="text-[12px] text-slate-400 mt-0.5">9 supported mechanisms of action across RNA therapeutics</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {THERAPEUTIC_GOALS.map((goal) => (
                    <div
                      key={goal.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-colors hover:border-brand/15 hover:bg-brand/[0.02]"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md bg-brand/10 px-1.5 text-[10px] font-bold text-brand">
                          {goal.id}
                        </span>
                        <h3 className="text-[13px] font-semibold text-slate-700">{goal.name}</h3>
                      </div>
                      <p className="text-[11.5px] text-slate-500 leading-relaxed">{goal.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {gene && (
            <>
              <GeneOverviewCard gene={gene} onRefresh={handleLoadGene} />
              <InfoGrid gene={gene} />
              <StatsRow gene={gene} />
            </>
          )}
        </main>
        {gene && (
          <FooterBar
            onClear={handleClearAll}
            onConfirm={handleConfirm}
            selectedGoal={selectedGoal}
            onSelectGoal={setSelectedGoal}
          />
        )}
      </div>
    </div>
  );
}
