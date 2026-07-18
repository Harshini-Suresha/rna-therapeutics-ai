"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import BasicInfoForm from "@/components/BasicInfoForm";
import GeneOverviewCard from "@/components/GeneOverviewCard";
import InfoGrid from "@/components/InfoGrid";
import StatsRow from "@/components/StatsRow";
import FooterBar from "@/components/FooterBar";
import { GeneTargetObject } from "@/types/gene";
import { fetchGene } from "@/lib/api";
import { getOrganism } from "@/lib/organisms";
import { findViralGene } from "@/lib/virusGenes";

/**
 * Standardizes gene symbol casing based on organism rules:
 * - Humans: ALL CAPS (e.g., "DMD")
 * - Others: Capitalized (e.g., "Dmd")
 * Ensembl's symbol lookup is case-insensitive, so this is cosmetic —
 * it just keeps the input field looking like conventional nomenclature.
 */
function formatGeneSymbol(symbol: string, organismId: string): string {
  const cleanSymbol = symbol.trim();
  if (!cleanSymbol) return "";

  if (organismId === "human") {
    return cleanSymbol.toUpperCase();
  }

  return cleanSymbol.charAt(0).toUpperCase() + cleanSymbol.slice(1).toLowerCase();
}

export default function NewProjectPage() {
  const [organism, setOrganism] = useState("human");
  const [diseaseName, setDiseaseName] = useState("");
  const [geneSymbol, setGeneSymbol] = useState("");

  const [gene, setGene] = useState<GeneTargetObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLoadGene() {
    if (!geneSymbol.trim()) return;

    const formattedSymbol = formatGeneSymbol(geneSymbol, organism);
    setGeneSymbol(formattedSymbol);

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
      const viralGene = findViralGene(organism, formattedSymbol);
      if (!viralGene) {
        setGene(null);
        setError(
          `Gene symbol "${formattedSymbol}" isn't in the curated reference set for ${selectedOrg.commonName}.`
        );
        setLoading(false);
        return;
      }

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

    // --- Tier 1/2/3: live Ensembl + Open Targets/phenotype data ---
    try {
      const searchSpecies = selectedOrg.ensemblSpecies || "homo_sapiens";
      const result = await fetchGene(searchSpecies, diseaseName, formattedSymbol);
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
    if (gene) {
      alert(`Confirmed target: ${gene.geneSymbol} (${gene.geneName ?? "unknown name"}). Proceeding...`);
    }
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
          {gene && (
            <>
              <GeneOverviewCard gene={gene} onRefresh={handleLoadGene} />
              <InfoGrid gene={gene} />
              <StatsRow gene={gene} />
            </>
          )}
        </main>
        {gene && <FooterBar onClear={handleClearAll} onConfirm={handleConfirm} />}
      </div>
    </div>
  );
}
