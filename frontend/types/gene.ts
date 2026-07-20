export interface VariantExample {
  label: string;
  source: string;
}

export interface TissueExpression {
  name: string;
  tpm: number;
}

export interface DeepLinks {
  ensembl?: string | null;
  ncbi?: string | null;
  gtex?: string | null;
  hpa?: string | null;
  uniprot?: string | null;
  clinvar?: string | null;
  kegg?: string | null;
  reactome?: string | null;
  pubmed?: string | null;
  omim?: string | null;
  go?: string | null;
  string?: string | null;
  clinicaltrials?: string | null;
}

export interface GeneTargetObject {
  organism: string | null; // Ensembl species slug, e.g. "homo_sapiens"
  diseaseName: string | null; // user-entered project label
  geneSymbol: string;

  // Basic gene identity
  geneName: string | null;
  geneFunction: string | null;
  geneId: string | null; // Ensembl gene ID (e.g. ENSG00000198947)
  entrezGeneId: string | null;
  hgncId: string | null; // species-appropriate nomenclature ID (HGNC/MGI/RGD/...)
  chromosome: string | null;
  location: string | null;
  cytoband: string | null;
  genomeBuild: string | null;
  genomicStart: number | null;
  genomicEnd: number | null;
  strand: string | null;
  geneType: string | null;
  synonyms: string[];
  source: string[];
  taxonId: string | null;

  // Transcripts
  canonicalTranscript: string | null;
  canonicalTranscriptLabel: string | null;
  otherTranscripts: string[];
  totalTranscripts: number | null;

  // Variants — examples intentionally empty; see deepLinks.clinvar for the
  // authoritative live list rather than fabricated HGVS notation.
  variantExamples: VariantExample[];
  totalKnownVariantsClinvar: number | null;

  // Tissue / cell expression (human only, live GTEx where available)
  defaultTissue: string | null;
  tissueExpressionLevel: "Low" | "Medium" | "High" | null;
  tissueTpm: number | null;
  topTissues: TissueExpression[];
  defaultCellType: string | null;
  cellExpressionLevel: string | null;
  cellTpm: number | null;
  cellTypeAll: Record<string, number>;

  // ASO-relevant expression analytics
  expressionStabilityCV: number | null;
  vitalOrganTpm: number | null;
  vitalOrganTissues: string[];
  dominantIsoformFraction: number | null;
  dominantIsoformId: string | null;
  diseaseFoldChange: number | null;
  singleCellPrevalence: number | null;
  circadianAmplitude: string | null;
  intronRetentionRatio: number | null;
  developmentalExpression: string | null;
  alternativePolyadenylation: string | null;
  nuclearRetentionIndex: number | null;

  // Protein
  proteinId: string | null;
  proteinName: string | null;
  proteinLength: number | null;

  // Protein properties (from UniProt)
  molecularWeight: string | null;
  isoelectricPoint: string | null;
  secondaryStructureDistribution: string | null;
  criticalPhosphorylationSite: string | null;
  ubiquitinationTarget: string | null;
  quaternaryStructure: string | null;
  stabilityScore: string | null;
  subcellularLocation: string | null;
  criticalFunctionalDomains: string | null;
  disorderedContent: string | null;
  proteosomalTurnover: string | null;
  alphafoldPlddt: string | null;
  gravyIndex: string | null;
  proteinAbundance: string | null;
  tractability: string | null;

  // Protein database IDs
  interproId: string | null;
  pfamId: string | null;
  pdbId: string | null;
  mutationRate: string | null;
  uniprotAccession: string | null;

  // Disease association — works across all organisms via Open Targets
  // (human) or Ensembl phenotype annotations (all species)
  disease: string | null;
  diseaseAssociation: string | null;
  diseaseAssociationSource: string[];
  phenotypes: string[];
  associationStatus: string | null;
  omimId: string | null;

  // Clinical disease details — curated from clinical databases
  diseaseMechanism: string | null;
  diagnosticTests: string[];
  clinicalSymptoms: string[];
  carrierManifestations: string[];
  therapeuticOptions: string[];

  // Genomic structure
  exonCount: number | null;
  intronCount: number | null;
  cdsLength: number | null;
  geneLength: number | null;

  // Known variants (counts not fetched — see variantExamples note)
  dbSnpCount: number | null;
  gnomadAvailable: boolean;
  clinvarVariantCount: number | null;

  // Top ClinVar variant details
  topHgvsName: string | null;
  topRsId: string | null;
  populationFrequencyMaf: string | null;

  // Expression profile
  gtexAvailable: boolean;
  humanProteinAtlasLevel: string | null;
  gtexExpressionLevel: string | null;

  // Advanced genetic intelligence — values require specialised curation and
  // may not be available for every gene.
  intolerantToLossScore?: string | number | null;
  recessiveConstraintZ?: number | null;
  hetExcessZ?: number | null;
  compositeConstraintIndex?: number | null;
  haploinsufficiencyScore?: string | null;

  // ASO-specific intelligence
  loeufDecile: string | null;
  triplosensitivity: string | null;
  activeIsoforms: number | null;
  spliceSwitches: number | null;
  structuralAccessibility: string | null;
  splicingMotifDensity: string | null;
  preclinicalConservation: string | null;
  gQuadruplexes: string | null;
  cpgDensity: string | null;
  selfDimerRisk: string | null;
  polygTracts: string | null;
  transcriptSpecificity: string | null;
  codonUsageBias: string | null;

  // RNA half-life and gene dependency
  rnaHalflife: string | null;
  rnaHalflifeHours: number | null;
  rnaHalflifeSource: string | null;
  depmapDependency: string | null;
  depmapDependencyScore: number | null;
  essentialGene: string | null;
  depmapSource: string | null;

  deepLinks: DeepLinks;

  // Pathways — not connected yet
  keggCount: number | null;
  reactomeCount: number | null;
  pathwayCommonsCount: number | null;
  pathwayHighlight: string | null;

  // GO terms — not connected yet
  goBiologicalProcess: number | null;
  goMolecularFunction: number | null;
  goCellularComponent: number | null;
  goBiologicalProcessHighlight: string | null;
  goMolecularFunctionHighlight: string | null;
  goCellularComponentHighlight: string | null;

  // Interactions — real STRING data when available
  stringHighConfidenceCount: number | null;
  totalInteractors: number | null;
  topInteractors: { name: string; score: number }[];
  mediumConfidenceCount: number | null;
  experimentalCount: number | null;
  databaseCount: number | null;
  interactionNetworkDensity: string | null;

  // Literature — real PubMed counts
  pubmedArticleCount: number | null;
  reviewCount: number | null;
  clinicalTrialsCount: number | null;
  preprintCount: number | null;
  caseReportsCount: number | null;
}
