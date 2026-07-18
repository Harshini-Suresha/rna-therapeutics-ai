import { GeneTargetObject } from "@/types/gene";
import { lookupMockGene } from "@/lib/mockGene";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchGene(
  organism: string, 
  diseaseName: string,
  geneSymbol: string
): Promise<GeneTargetObject> {
  const response = await fetch(`${API_BASE}/api/pipeline/initialize-target`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gene_symbol: geneSymbol.trim(),
      organism,
      disease_name: diseaseName.trim() || null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Target gene "${geneSymbol.toUpperCase()}" could not be resolved.`
    );
  }

  const data = await response.json();

  const finalSymbol = data.geneSymbol ?? geneSymbol.toUpperCase();
  const fallbackGene = lookupMockGene(finalSymbol);
  const rawSynonyms = Array.isArray(data.synonyms) ? data.synonyms : [];
  const seenSynonyms = new Set<string>();
  const filteredSynonyms = rawSynonyms.filter((syn: unknown): syn is string => {
    if (typeof syn !== "string") return false;
    const normalized = syn.trim().toLocaleUpperCase();
    if (!normalized || normalized === finalSymbol.toLocaleUpperCase() || normalized === "NONE IDENTIFIED") {
      return false;
    }
    if (seenSynonyms.has(normalized)) return false;
    seenSynonyms.add(normalized);
    return true;
  });
  
  return {
    organism: data.organism ?? null,
    diseaseName: data.diseaseName ?? null,
    geneSymbol: finalSymbol,

    geneName: data.geneName ?? null,
    geneFunction: data.geneFunction ?? null,
    geneId: data.geneId ?? null,
    entrezGeneId: data.entrezGeneId ?? null,
    hgncId: data.hgncId ?? `HGNC:${finalSymbol}`,
    chromosome: data.chromosome ?? null,
    location: data.location ?? null,
    cytoband: data.cytoband ?? null,
    genomeBuild: data.genomeBuild ?? null,
    genomicStart: data.genomicStart ?? null,
    genomicEnd: data.genomicEnd ?? null,
    strand: data.strand ?? null,
    geneType: data.geneType ?? "protein_coding",
    
    // Pass the real array values directly downstream without synthetic string wrappers
    synonyms: filteredSynonyms,
    source: data.source ?? [],
    
    // Mapped directly from backend numerical Taxon ID definitions
    taxonId: data.taxonId ?? "9606",

    canonicalTranscript: data.canonicalTranscript ?? null,
    canonicalTranscriptLabel: data.canonicalTranscriptLabel ?? null,
    otherTranscripts: data.otherTranscripts ?? [],
    totalTranscripts: data.totalTranscripts ?? null,

    variantExamples: Array.isArray(data.variantExamples) && data.variantExamples.length > 0
      ? data.variantExamples
      : (fallbackGene?.variantExamples ?? []),
    totalKnownVariantsClinvar: data.totalKnownVariantsClinvar ?? data.clinvarVariantCount ?? fallbackGene?.totalKnownVariantsClinvar ?? null,

    defaultTissue: data.defaultTissue ?? fallbackGene?.defaultTissue ?? null,
    tissueExpressionLevel: data.tissueExpressionLevel ?? fallbackGene?.tissueExpressionLevel ?? null,
    tissueTpm: data.tissueTpm ?? fallbackGene?.tissueTpm ?? null,
    topTissues: Array.isArray(data.topTissues) && data.topTissues.length > 0
      ? data.topTissues
      : (fallbackGene?.topTissues ?? []),
    defaultCellType: data.defaultCellType ?? fallbackGene?.defaultCellType ?? null,
    cellExpressionLevel: data.cellExpressionLevel ?? fallbackGene?.cellExpressionLevel ?? null,
    cellTpm: data.cellTpm ?? fallbackGene?.cellTpm ?? null,

    proteinId: data.proteinId ?? null,
    proteinName: data.proteinName ?? null,
    proteinLength: data.proteinLength ?? null,
    molecularWeight: data.molecularWeight ?? null,
    isoelectricPoint: data.isoelectricPoint ?? null,
    secondaryStructureDistribution: data.secondaryStructureDistribution ?? null,
    criticalPhosphorylationSite: data.criticalPhosphorylationSite ?? null,
    ubiquitinationTarget: data.ubiquitinationTarget ?? null,
    quaternaryStructure: data.quaternaryStructure ?? null,
    stabilityScore: data.stabilityScore ?? null,
    interproId: data.interproId ?? null,
    pfamId: data.pfamId ?? null,
    pdbId: data.pdbId ?? null,
    mutationRate: data.mutationRate ?? null,
    uniprotAccession: data.uniprotAccession ?? null,

    disease: data.disease ?? null,
    diseaseAssociation: data.diseaseAssociation ?? null,
    diseaseAssociationSource: data.diseaseAssociationSource ?? [],
    phenotypes: data.phenotypes ?? [],
    associationStatus: data.associationStatus ?? null,
    omimId: data.omimId ?? null,
    diseaseMechanism: data.diseaseMechanism ?? null,
    diagnosticTests: data.diagnosticTests ?? [],
    clinicalSymptoms: data.clinicalSymptoms ?? [],
    carrierManifestations: data.carrierManifestations ?? [],
    therapeuticOptions: data.therapeuticOptions ?? [],

    exonCount: data.exonCount ?? null,
    intronCount: data.intronCount ?? null,
    cdsLength: data.cdsLength ?? null,
    geneLength: data.geneLength ?? null,

    dbSnpCount: data.dbSnpCount ?? null,
    gnomadAvailable: !!data.gnomadAvailable,
    clinvarVariantCount: data.clinvarVariantCount ?? fallbackGene?.clinvarVariantCount ?? null,

    topHgvsName: data.topHgvsName ?? null,
    topRsId: data.topRsId ?? null,
    populationFrequencyMaf: data.populationFrequencyMaf ?? null,

    gtexAvailable: Boolean(
      data.gtexAvailable ||
      data.defaultTissue ||
      data.tissueTpm ||
      (Array.isArray(data.topTissues) && data.topTissues.length > 0) ||
      fallbackGene?.gtexAvailable
    ),
    humanProteinAtlasLevel: data.humanProteinAtlasLevel ?? fallbackGene?.humanProteinAtlasLevel ?? null,
    gtexExpressionLevel: data.gtexExpressionLevel ?? null,

    intolerantToLossScore: data.intolerantToLossScore ?? null,
    recessiveConstraintZ: data.recessiveConstraintZ ?? null,
    hetExcessZ: data.hetExcessZ ?? null,
    compositeConstraintIndex: data.compositeConstraintIndex ?? null,
    haploinsufficiencyScore: data.haploinsufficiencyScore ?? null,

    loeufDecile: data.loeufDecile ?? null,
    triplosensitivity: data.triplosensitivity ?? null,
    activeIsoforms: data.activeIsoforms ?? null,
    spliceSwitches: data.spliceSwitches ?? null,
    gQuadruplexes: data.gQuadruplexes ?? null,
    cpgDensity: data.cpgDensity ?? null,

    // RNA half-life and gene dependency
    rnaHalflife: data.rnaHalflife ?? null,
    rnaHalflifeHours: data.rnaHalflifeHours ?? null,
    rnaHalflifeSource: data.rnaHalflifeSource ?? null,
    depmapDependency: data.depmapDependency ?? null,
    depmapDependencyScore: data.depmapDependencyScore ?? null,
    essentialGene: data.essentialGene ?? null,
    depmapSource: data.depmapSource ?? null,

    deepLinks: data.deepLinks ?? {},

    keggCount: data.keggCount ?? null,
    reactomeCount: data.reactomeCount ?? null,
    pathwayCommonsCount: data.pathwayCommonsCount ?? null,
    pathwayHighlight: data.pathwayHighlight ?? null,

    goBiologicalProcess: data.goBiologicalProcess ?? null,
    goMolecularFunction: data.goMolecularFunction ?? null,
    goCellularComponent: data.goCellularComponent ?? null,
    goBiologicalProcessHighlight: data.goBiologicalProcessHighlight ?? null,
    goMolecularFunctionHighlight: data.goMolecularFunctionHighlight ?? null,
    goCellularComponentHighlight: data.goCellularComponentHighlight ?? null,

    stringHighConfidenceCount: data.stringHighConfidenceCount ?? null,
    totalInteractors: data.totalInteractors ?? null,
    topInteractors: data.topInteractors ?? [],
    mediumConfidenceCount: data.mediumConfidenceCount ?? null,
    experimentalCount: data.experimentalCount ?? null,
    databaseCount: data.databaseCount ?? null,

    pubmedArticleCount: data.pubmedArticleCount ?? null,
    reviewCount: data.reviewCount ?? null,
    clinicalTrialsCount: data.clinicalTrialsCount ?? null,
    preprintCount: data.preprintCount ?? null,
    caseReportsCount: data.caseReportsCount ?? null,
  };
}
