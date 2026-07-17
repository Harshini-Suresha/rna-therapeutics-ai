import { GeneTargetObject } from "@/types/gene";

// Reference fixture: Duchenne Muscular Dystrophy / DMD gene.
// Used as a local fallback so the UI is fully demoable before the
// Ensembl/NCBI/UniProt/ClinVar/GTEx/Reactome/STRING/PubMed connectors
// (see backend/connectors/*) are wired up to backend/api.
export const MOCK_GENES: Record<string, GeneTargetObject> = {
  DMD: {
    organism: "Homo sapiens (Human)",
    diseaseName: "Duchenne Muscular Dystrophy",
    geneSymbol: "DMD",

    geneName: "Dystrophin",
    geneFunction: "Dystrophin helps stabilize muscle fibers by linking the internal cytoskeleton to the surrounding extracellular matrix.",
    geneId: "1756 (NCBI)",
    entrezGeneId: "1756",
    hgncId: "HGNC:2928",
    chromosome: "X",
    location: "Xp21.2 (32,315,120-33,023,971)",
    cytoband: "Xp21.2–Xp21.1",
    genomeBuild: "GRCh38",
    genomicStart: 31097677,
    genomicEnd: 33339609,
    strand: "Reverse (−)",
    geneType: "protein_coding",
    synonyms: ["Dystrophin", "CMD3D", "BMD"],
    source: ["HGNC", "NCBI", "Ensembl"],
    taxonId: "9606",

    canonicalTranscript: "NM_004006.3",
    canonicalTranscriptLabel: "MANE",
    otherTranscripts: [
      "ENST00000357033.8",
      "ENST00000618900.1",
      "ENST00000493490.8",
      "ENST00000422878.6",
    ],
    totalTranscripts: 23,

    variantExamples: [
      { label: "c.8713C>T (p.Arg2905Ter)", source: "ClinVar" },
      { label: "c.123del (p.Leu42Argfs*18)", source: "ClinVar" },
      { label: "rs1803852", source: "dbSNP" },
    ],
    totalKnownVariantsClinvar: 12531,

    defaultTissue: "Skeletal Muscle",
    tissueExpressionLevel: "High",
    tissueTpm: 45.7,
    topTissues: [
      { name: "Skeletal Muscle", tpm: 45.7 },
      { name: "Heart Left Ventricle", tpm: 31.2 },
      { name: "Nerve Tibial", tpm: 28.5 },
    ],

    defaultCellType: "Myocyte",
    cellExpressionLevel: "High",
    cellTpm: 52.3,

    proteinId: "P11532",
    proteinName: "Dystrophin",
    proteinLength: 3685,
    molecularWeight: "426,778 Da",
    isoelectricPoint: "5.44",
    secondaryStructureDistribution: "35 helices, 9 beta strands, 6 turns",
    criticalPhosphorylationSite: "13x Phosphoserine; 5x Phosphothreonine",
    ubiquitinationTarget: "4x Ubiquitinyl lysine",
    quaternaryStructure: "Monomer",
    stabilityScore: "8.2/10, 4 disulfide bonds, 3 known variants",

    interproId: "IPR001589",
    pfamId: "PF00307",
    pdbId: "1DXX",
    mutationRate: null,
    uniprotAccession: "P11532",

    diseaseAssociation: "Duchenne Muscular Dystrophy",
    disease: "Duchenne Muscular Dystrophy",
    diseaseAssociationSource: ["ClinVar", "OMIM"],
    phenotypes: ["Duchenne muscular dystrophy"],
    associationStatus: "Established",
    omimId: "310200",

    diseaseMechanism: "Duchenne Muscular Dystrophy (DMD) is a rare X-linked recessive disorder caused by mutations in the dystrophin gene, leading to progressive muscle weakness. Dystrophin deficiency drives inflammation, oxidative stress, and myocardial remodeling in DMD cardiomyopathy. Out-of-frame mutations completely disrupt the genetic reading frame, leading to premature stop signals and 0% functional dystrophin (DMD). In-frame mutations preserve the reading frame, producing a shorter, partially functional protein (20–100% dystrophin expression, BMD). Long-term management benefits from early diagnosis and coordinated care involving neurology, cardiology, pulmonology, and rehabilitation. Continued research into targeted molecular interventions holds promise for improved outcomes in DMD-associated cardiomyopathy.",
    diagnosticTests: [
      "Creatine Kinase (CK) levels — 10–100× normal due to muscle cell leakage",
      "MLPA or Next-Generation Sequencing (NGS) for deletion/duplication/point mutation",
      "Muscle biopsy with immunohistochemistry if genetic testing inconclusive",
      "Echocardiography for cardiac function monitoring",
      "Pulmonary function tests (spirometry, forced vital capacity)",
      "Genetic testing for dystrophin gene mutations",
      "Serum biomarkers: cardiac troponin, NT-proBNP for cardiomyopathy detection",
      "MRI for muscle fibrosis and cardiac tissue assessment",
    ],
    clinicalSymptoms: [
      "Gowers' sign — using hands to walk up thighs when standing",
      "Waddling gait and progressive proximal weakness",
      "Severe scoliosis and lumbar lordosis from progressive weakness",
      "Diaphragm weakness leading to pulmonary hypoventilation and respiratory failure",
      "~30% of patients exhibit mild, non-progressive cognitive or learning impairments",
      "Progressive muscle wasting beginning in pelvis, thighs, and shoulders",
      "Pseudohypertrophy of calf muscles (Gastrocnemius)",
      "Delayed motor milestones (sitting, standing, walking)",
      "Loss of ambulation typically by age 10-12",
      "Cardiomyopathy and respiratory failure remain leading causes of mortality",
      "Cognitive impairment in 20-30% of patients",
      "Behavioral and attention difficulties",
    ],
    carrierManifestations: [
      "20% of female carriers experience mild-to-moderate muscle weakness",
      "~8% of female carriers develop dilated cardiomyopathy later in life",
      "Routine cardiac screening recommended for all carriers",
      "X-inactivation mosaicism determines severity of symptoms",
      "Elevated CK levels may be detected in carriers",
      "Asymptomatic carriers still at risk for cardiac complications",
    ],
    therapeuticOptions: [
      "Corticosteroids (prednisone/deflazacort) — standard of care to prolong walking and delay cardiac decline",
      "Exon skipping (eteplirsen, golodirsen, viltolarsen) — converts out-of-frame to in-frame mutations",
      "Gene therapy (delandistrogene moxeparvovec) — delivers micro-dystrophin gene to muscle cells",
      "ACE inhibitors and beta-blockers — cardioprotective therapy for cardiac management",
      "Resilient pulmonary support with mechanical ventilation",
      "Physical therapy and rehabilitation to maintain mobility and prevent contractures",
      "Cardiac MRI monitoring for early detection of cardiomyopathy",
      "Emerging therapies: mitochondrial dysfunction targets, calcium imbalance correction, anti-fibrotic interventions",
      "Multidisciplinary care: neurology, cardiology, pulmonology, rehabilitation",
      "Clinical trials: gene editing (CRISPR), stem cell therapy, myostatin inhibitors",
    ],

    exonCount: 79,
    intronCount: 78,
    cdsLength: 11088,
    geneLength: 2427852,

    dbSnpCount: 462,
    gnomadAvailable: true,
    clinvarVariantCount: 12531,

    topHgvsName: "NM_004006.3(DMD):c.1527_1530del (p.His512fs)",
    topRsId: null,
    populationFrequencyMaf: "2.4014e-04 (gnomAD)",

    gtexAvailable: true,
    humanProteinAtlasLevel: "High",
    gtexExpressionLevel: "Skeletal Muscle (45.7 TPM)",

    intolerantToLossScore: "1.00 (pLI, gnomAD)",
    recessiveConstraintZ: 2.84,
    hetExcessZ: -0.52,
    compositeConstraintIndex: 0.91,

    deepLinks: {
      ensembl: "https://ensembl.org/Homo_sapiens/Gene/Summary?g=ENSG00000198947",
      ncbi: "https://ncbi.nlm.nih.gov/gene/1756",
      gtex: "https://gtexportal.org/home/gene/DMD",
      hpa: "https://proteinatlas.org/ENSG00000198947",
      clinvar: "https://ncbi.nlm.nih.gov/clinvar?term=DMD[gene]",
      kegg: "https://genome.jp/kegg-bin/show_pathway?hsa05414",
      reactome: "https://reactome.org/performQuery/RCBH-284684",
      pubmed: "https://pubmed.ncbi.nlm.nih.gov/?term=DMD+gene",
      omim: "https://omim.org/entry/300377",
      go: "https://amigo.geneontology.org/amigo/gene/SGD:S000001851",
      string: "https://string-db.org/network/9606.ENSG00000198947",
      clinicaltrials: "https://clinicaltrials.gov/search?cond=Duchenne+Muscular+Dystrophy&intr=DMD",
    },

    keggCount: 12,
    reactomeCount: 18,
    pathwayCommonsCount: 24,
    pathwayHighlight: "Dilated cardiomyopathy - Homo sapiens (human)",

    goBiologicalProcess: 1246,
    goMolecularFunction: 215,
    goCellularComponent: 320,
    goBiologicalProcessHighlight: "muscle contraction",
    goMolecularFunctionHighlight: "actin binding",
    goCellularComponentHighlight: "dystrophin-associated glycoprotein complex",

    stringHighConfidenceCount: 156,
    totalInteractors: 1258,
    topInteractors: [],
    mediumConfidenceCount: 423,
    experimentalCount: 89,
    databaseCount: 134,

    pubmedArticleCount: 4823,
    reviewCount: 312,
    clinicalTrialsCount: 47,
    preprintCount: 23,
    caseReportsCount: 89,
  },
};

export function lookupMockGene(symbol: string): GeneTargetObject | null {
  return MOCK_GENES[symbol.trim().toUpperCase()] ?? null;
}
