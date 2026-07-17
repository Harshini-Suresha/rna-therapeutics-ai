"""Clinical disease details from NCBI E-utilities.

This module fetches comprehensive clinical information for genes including:
- Disease mechanisms
- Diagnostic biomarkers and tests
- Clinical symptoms and manifestations
- Therapeutic options and treatments
- Carrier manifestations (for X-linked disorders)

The service searches PubMed for clinical literature and extracts structured
information using keyword-based pattern matching and sentence extraction.
"""

import re
import xml.etree.ElementTree as ET
from typing import Optional, List

import requests

NCBI_EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

NOISE_PATTERNS = [
    r"keywords?\s+included", r"boolean\s+operators", r"combined\s+with",
    r"this\s+review\s+(aims?|seeks?|attempts?|provides?)\s+to",
    r"systematic\s+(search|review)", r"meta-analysis",
    r"we\s+(sought|aimed|attempted)\s+to",
    r"this\s+study\s+(aims?|seeks?|attempts?)",
    r"the\s+purpose\s+of\s+this", r"in\s+this\s+(review|article|study)",
    r"a\s+literature\s+review", r"to\s+our\s+knowledge",
    r"there\s+is\s+still\s+a\s+lack\s+of",
    r"the\s+genetic\s+counseling\s+capacity",
    r"with\s+the\s+advancement\s+of", r"more\s+and\s+more",
    r"current\s+treatments.*offer\s+limited",
    r"recent\s+research\s+has\s+advanced",
    r"further\s+(research|studies)", r"future\s+studies",
    r"more\s+studies\s+are\s+needed",
    r"in\s+conclusion", r"to\s+conclude",
    r"these\s+findings\s+should\s+be\s+interpreted",
    r"retrospective\s+(design|cohort|study)",
    r"the\s+advent\s+of", r"we\s+conducted\s+a\s+retrospective",
    r"we\s+further\s+explore", r"candidate\s+measures\s+across",
    r"their\s+potential\s+multidimensional",
    r"the\s+identification\s+that",
    r"designed\s+with\s+strong\s+translational",
    r"functional\s+studies\s+showed\s+that",
    r"we\s+developed\s+an?\s+\w+\s+gene\s+therapy",
    r"we\s+describe\s+\d+\s+\w+\s+patients",
    r"both\s+patients\s+lack", r"three\s+cases\s+were\s+subsidiary",
    r"due\s+to\s+their\s+rarity",
    r"evidence-based\s+treatment\s+guidelines",
    r"further\s+study\s+is\s+needed",
    r"using\s+this\s+framework", r"we\s+propose\s+possible",
    r"increased\s+genetic\s+testing\s+is\s+identifying",
    r"conflicting\s+(interpretations|results)",
    r"these\s+findings\s+support",
    r"body\s+mass\s+index", r"z-scores",
    r"a\s+better\s+understanding\s+and\s+systematic",
    r"to\s+evaluate\s+changes\s+in\s+peripheral",
    r"our\s+findings\s+therefore\s+provide",
    r"the\s+extent\s+of\s+surgical\s+resection",
    r"preliminary\s+evidence\s+suggests",
    r"single-cell\s+whole\s+genome\s+sequencing",
    r"artificial\s+intelligence\s+has\s+emerged",
    r"definite\s+AIDs",
    r"homozygosity-by-descent",
    r"analysis\s+of\s+\d+\s+fistulae",
    r"the\s+proposed\s+XNNLM",
    r"the\s+viral\s+vector\s+was\s+tested",
    r"results\s+show\s+that\s+the\s+proposed",
]

SYMPTOM_KEYWORDS = [
    # Neuromuscular symptoms
    "weakness", "muscle weakness", "progressive", "dystrophy", "myopathy",
    "contracture", "scoliosis", "cardiomyopathy", "arrhythmia",
    "respiratory", "pulmonary", "failure", "pneumonia",
    "cognitive", "intellectual", "seizure", "epilepsy",
    "gait", "ambulation", "motor", "atrophy", "hypertrophy",
    "skeletal", "pseudohypertrophy", "fasciculation", "spasticity",
    "paresthesia", "hyporeflexia", "hyperreflexia", "myasthenia",
    "ptosis", "ophthalmoplegia", "dysphagia", "dysarthria", "dysphonia",
    # Cancer/tumor symptoms
    "tumor", "cancer", "carcinoma", "sarcoma", "leukemia", "lymphoma",
    "neoplasm", "malignancy", "metastasis", "lesion", "oncogene",
    # Neurological symptoms
    "retinopathy", "neuropathy", "nephropathy", "chorea", "dystonia",
    "tremor", "ataxia", "parkinsonism", "dementia", "psychosis",
    "depression", "anxiety", "behavioral", "insomnia", "sleep",
    # Hematological/immune symptoms
    "immunodeficiency", "hemophilia", "anemia", "thalassemia",
    "coagulopathy", "bleeding", "thrombocytopenia", "pancytopenia",
    # Metabolic symptoms
    "fibrosis", "phenotype", "malformation", "deafness", "blindness",
    "developmental delay", "growth retardation", "short stature",
    "diabetes", "obstructive", "recurrent", "intractable",
    # Age of onset
    "infantile", "childhood", "adolescent", "neonatal", "congenital",
    "juvenile", "adult-onset", "late-onset", "early-onset",
    # Organ-specific symptoms
    "osteoporosis", "fracture", "joint", "limb", "proximal", "distal",
    "bulbar", "respiratory insufficiency", "cardiac", "hepatic", "renal",
    "pancreatic", "endocrine", "pulmonary", "gastrointestinal",
    # Additional clinical manifestations
    "fatigue", "exercise intolerance", "muscle pain", "myalgia",
    "cramps", "stiffness", "rigidity", "bradykinesia", "tremor",
    "coordination", "balance", "falling", " clumsiness",
    "speech", "language", "hearing", "vision", "swallowing",
    "feeding", "failure to thrive", "weight loss", "failure to thrive",
]

DIAGNOSTIC_KEYWORDS = [
    # Genetic testing methods
    "creatine kinase", "CK", "MLPA", "NGS", "next-generation sequencing",
    "whole exome", "WES", "whole genome", "WGS", "Sanger",
    "PCR", "multiplex ligation", "genetic testing", "sequencing",
    "deletion", "duplication", "carrier testing", "prenatal testing",
    "newborn screening", "genotyping", "karyotype", "FISH",
    "chromosomal microarray", "targeted gene panel", "diagnostic gene panel",
    # Tissue/biopsy methods
    "muscle biopsy", "immunohistochemistry", "western blot",
    "immunofluorescence", "histopathology", "electron microscopy",
    "liver biopsy", "skin biopsy", "nerve biopsy", "bone marrow biopsy",
    # Electrophysiology
    "EMG", "electromyography", "nerve conduction", "EEG", "electroencephalogram",
    "EKG", "ECG", "electrocardiogram", "echocardiography", "echocardiogram",
    "evoked potentials", "nerve conduction study",
    # Imaging
    "MRI", "magnetic resonance imaging", "CT scan", "computed tomography",
    "ultrasound", "X-ray", "radiography", "PET scan", "bone scan",
    "DEXA scan", "bone densitometry",
    # Laboratory tests
    "biomarker", "sweat test", "mass spectrometry", "liquid chromatography",
    "immunoassay", "ELISA", "enzyme assay", "metabolic screen",
    "amino acid analysis", "acylcarnitine profile", "organic acids",
    "lactate", "pyruvate", "ammonia", "uric acid",
    # Diagnosis terms
    "diagnosis", "diagnostic", "confirmed", "detect", "laboratory",
    "assay", "elevated", "increased", "plasma", "serum", "blood",
    "urine", "tissue", "genetic counseling", "prenatal diagnosis",
    "preimplantation diagnosis", "predictive testing", "presymptomatic",
    # Specific disease diagnostics
    "alpha-galactosidase", "hexosaminidase", "phenylalanine",
    "tyrosine", "galactose", "biotinidase", "17-hydroxyprogesterone",
    "immunoreactive trypsinogen", "TSH", "hemoglobin",
]

THERAPY_KEYWORDS = [
    # Pharmacological treatments
    "corticosteroid", "prednisone", "deflazacort", "steroid",
    "anti-inflammatory", "NSAID", "analgesic", "pain management",
    "anticonvulsant", "antiepileptic", "sedative", "anxiolytic",
    "antidepressant", "antipsychotic", "mood stabilizer",
    # Gene-based therapies
    "exon skipping", "eteplirsen", "golodirsen", "viltolarsen",
    "risdiplam", "nusinersen", "gene therapy", "AAV",
    "delandistrogene", "olmesartan", "losartan", "ACE inhibitor",
    "siRNA", "ASO", "antisense", "CRISPR", "gene editing",
    "base editing", "prime editing", "lentiviral", "retroviral",
    # Enzyme/protein replacement
    "enzyme replacement", "substrate reduction", "chaperone",
    "protein replacement", "metabolic cofactor", "vitamin",
    "coenzyme", "pharmacological chaperone",
    # Device/surgical interventions
    "pacemaker", "defibrillator", "ICD", "respiratory support",
    "ventilation", "BiPAP", "CPAP", "surgery", "orthosis",
    "bracing", "wheelchair", "assistive device", "prosthesis",
    "deep brain stimulation", "pallidotomy", "DBS",
    # Cell-based therapies
    "stem cell", "bone marrow transplant", "transplant",
    "hematopoietic stem cell", "mesenchymal stem cell",
    "autologous", "allogeneic", "gene corrected",
    # Immunotherapies
    "antibody", "monoclonal", "immunotherapy", "checkpoint inhibitor",
    "CAR-T", "adoptive cell transfer", "vaccine",
    # Supportive care
    "physiotherapy", "rehabilitation", "physical therapy",
    "occupational therapy", "speech therapy", "respiratory therapy",
    "nutritional support", "dietary management", "feeding supplement",
    "palliative care", "hospice", "pain management",
    # Clinical trial terms
    "treatment", "therapy", "therapeutic", "management",
    "clinical trial", "Phase", "FDA", "approved", "compassionate use",
    "expanded access", "investigational", "off-label",
    # Specific drug classes
    "VMAT2", "tetrabenazine", "deutetrabenazine", "valbenazine",
    "cholinesterase inhibitor", "dopamine", "serotonin",
    "GABA", "glutamate", "NMDA", "calcium channel",
    "potassium channel", "sodium channel",
    # Disease-specific treatments
    "chemotherapy", "radiation", "targeted therapy", "hormone therapy",
    "bisphosphonate", "growth hormone", "insulin", "metformin",
    "anticoagulant", "antiplatelet", "fibrinolytic",
]

MECHANISM_KEYWORDS = [
    # Mutation types
    "mutation", "deletion", "duplication", "frameshift",
    "nonsense", "missense", "splicing", "reading frame",
    "point mutation", "insertion", "inversion", "translocation",
    "copy number variation", "CNV", "structural variant",
    # Functional consequences
    "loss of function", "gain of function", "pathogenic variant",
    "truncating", "premature termination", "premature stop",
    "protein deficiency", "enzyme deficiency", "protein misfolding",
    "haploinsufficiency", "dominant negative", "dominant-negative",
    "null allele", "amorphic", "hypomorphic", "hypermorphic",
    # Repeat disorders
    "repeat expansion", "trinucleotide repeat", "CAG repeat",
    "CTG repeat", "CGG repeat", "GCC repeat", "GAA repeat",
    "microsatellite instability", "dynamic mutation",
    # Expression defects
    "loss of expression", "reduced expression", "overexpression",
    "aberrant expression", "ectopic expression", "silencing",
    "promoter mutation", "enhancer mutation", "epigenetic",
    # Protein-level mechanisms
    "protein aggregation", "protein misfolding", "protein degradation",
    "protein trafficking", "protein localization", "protein interaction",
    "post-translational modification", "phosphorylation", "glycosylation",
    "acetylation", "methylation", "ubiquitination",
    # Cellular mechanisms
    "oxidative stress", "mitochondrial dysfunction", "calcium dysregulation",
    "apoptosis", "necrosis", "autophagy", "inflammation",
    "fibrosis", "fibrotic", "remodeling", "hypertrophy",
    "atrophy", "degeneration", "necrosis", "excitotoxicity",
    # Pathway disruption
    "signal transduction", "pathway disruption", "dysregulated",
    "aberrant signaling", "constitutive activation", "inhibited",
    "downregulated", "upregulated", "impaired", "defective",
    # Specific disease mechanisms
    "dystrophin deficiency", "sarcoglycan", "dystroglycan",
    "muscular dystrophy", "myotonic", "channelopathy",
    "storage disorder", "lysosomal", "peroxisomal", "mitochondrial",
    "metabolic", "neurodegenerative", "neurodevelopmental",
]


def _is_noise(sentence: str) -> bool:
    lower = sentence.lower()
    for pat in NOISE_PATTERNS:
        if re.search(pat, lower):
            return True
    return False


def _ncbi_search(query: str, db: str = "pubmed", retmax: int = 5) -> list:
    try:
        resp = requests.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={"db": db, "term": query, "retmax": retmax, "retmode": "json"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json().get("esearchresult", {}).get("idlist", [])
    except Exception:
        return []


def _ncbi_fetch_abstracts(pmids: list) -> str:
    if not pmids:
        return ""
    try:
        resp = requests.get(
            f"{NCBI_EUTILS}/efetch.fcgi",
            params={
                "db": "pubmed",
                "id": ",".join(pmids),
                "rettype": "abstract",
                "retmode": "xml",
            },
            timeout=20,
        )
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
        texts = []
        for article in root.findall(".//Article"):
            for abstract_text in article.findall(".//AbstractText"):
                texts.append(abstract_text.text or "")
        return " ".join(texts)
    except Exception:
        return ""


def _extract_matching_terms(text: str, keywords: list, max_items: int = 5) -> list:
    sentences = re.split(r'(?<=[.!?])\s+', text)
    matched = []
    seen = set()
    for sentence in sentences:
        cleaned = sentence.strip()
        if not cleaned or len(cleaned) < 25 or cleaned in seen:
            continue
        if _is_noise(cleaned):
            continue
        if len(cleaned) > 250:
            cleaned = cleaned[:247] + "..."
        lower = cleaned.lower()
        for kw in keywords:
            if kw.lower() in lower:
                seen.add(cleaned)
                matched.append(cleaned)
                break
        if len(matched) >= max_items:
            break
    return matched


def _get_gene_summary(gene_symbol: str) -> dict:
    result = {"summary": None, "omim_id": None, "description": None}
    try:
        resp = requests.get(
            f"{NCBI_EUTILS}/esearch.fcgi",
            params={
                "db": "gene",
                "term": f"{gene_symbol}[Symbol] AND human[Organism]",
                "retmax": 5,
                "retmode": "json",
            },
            timeout=10,
        )
        resp.raise_for_status()
        gene_ids = resp.json().get("esearchresult", {}).get("idlist", [])
        if not gene_ids:
            return result

        # Fetch summaries for all candidates, pick exact symbol match
        for gid in gene_ids:
            resp = requests.get(
                f"{NCBI_EUTILS}/esummary.fcgi",
                params={"db": "gene", "id": gid, "retmode": "json"},
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json().get("result", {}).get(gid, {})
            name = (data.get("name") or "").upper().strip()
            if name != gene_symbol.upper():
                continue
            result["summary"] = data.get("summary")
            result["description"] = data.get("description")
            mim = data.get("mim")
            if mim and isinstance(mim, list) and mim:
                result["omim_id"] = str(mim[0])
            elif mim and isinstance(mim, str) and mim.isdigit():
                result["omim_id"] = mim
            break
    except Exception:
        pass
    return result


def _extract_mechanism_from_summary(summary: str) -> Optional[str]:
    """Extract disease mechanism from gene summary.
    
    This function parses the NCBI gene summary to find sentences that describe
    the disease mechanism, focusing on causal relationships and functional consequences.
    
    Args:
        summary: NCBI gene summary text
        
    Returns:
        Extracted mechanism text or None if not found
    """
    if not summary:
        return None
    sentences = re.split(r'(?<=[.!?])\s+', summary)
    
    # Disease-related keywords
    disease_kw = [
        "disease", "disorder", "syndrome", "cancer", "tumor",
        "dystrophy", "myopathy", "deficiency", "insufficiency",
        "failure", "malformation", "abnormality", "pathology",
        "degeneration", "neurodegenerative", "disability", "condition",
        "lethal", "fatal", "severe", "progressive", "chronic",
    ]
    
    # Mechanism-related keywords (causal relationships)
    mechanism_kw = [
        "cause", "causes", "caused", "results in", "leads to",
        "responsible for", "mutations", "deletion", "duplication",
        "deficiency", "loss of function", "trinucleotide",
        "CAG repeat", "expansion", "frameshift", "nonsense",
        "missense", "splicing", "reading frame", "premature",
        "haploinsufficiency", "dominant negative", "pathogenic",
    ]
    
    # Enhanced mechanism keywords for more comprehensive extraction
    enhanced_mechanism_kw = [
        "mutation", "variant", "alteration", "aberration",
        "dysfunction", "impairment", "disruption", "defect",
        "abnormal", "altered", "reduced", "increased", "loss",
        "gain", "overexpression", "underexpression", "silencing",
    ]
    
    # Strategy 1: Look for sentences with both disease and mechanism keywords
    for sentence in sentences:
        lower = sentence.lower()
        has_disease = any(dk in lower for dk in disease_kw)
        has_mechanism = any(mk in lower for mk in mechanism_kw)
        if has_disease and has_mechanism:
            cleaned = sentence.strip()
            if len(cleaned) > 30:
                if len(cleaned) > 250:
                    cleaned = cleaned[:247] + "..."
                return cleaned
    
    # Strategy 2: Look for sentences with mechanism keywords only
    for sentence in sentences:
        lower = sentence.lower()
        for mk in mechanism_kw:
            if mk in lower:
                cleaned = sentence.strip()
                if len(cleaned) > 30:
                    if len(cleaned) > 250:
                        cleaned = cleaned[:247] + "..."
                    return cleaned
    
    # Strategy 3: Look for sentences with enhanced mechanism keywords
    for sentence in sentences:
        lower = sentence.lower()
        for mk in enhanced_mechanism_kw:
            if mk in lower:
                cleaned = sentence.strip()
                if len(cleaned) > 30:
                    if len(cleaned) > 250:
                        cleaned = cleaned[:247] + "..."
                    return cleaned
    
    return None


def _get_clinical_trials(gene_symbol: str, disease_name: Optional[str] = None) -> List[str]:
    """Fetch clinical trials information from ClinicalTrials.gov API.
    
    Args:
        gene_symbol: Official gene symbol
        disease_name: Associated disease name if known
        
    Returns:
        List of clinical trial-related therapeutic terms
    """
    trials = []
    try:
        search_term = gene_symbol
        if disease_name:
            search_term = f"{gene_symbol} AND {disease_name}"
        
        url = "https://clinicaltrials.gov/api/v2/studies"
        params = {
            "query.term": search_term,
            "pageSize": 5,
            "format": "json"
        }
        
        resp = requests.get(url, params=params, timeout=5)  # Reduced timeout
        resp.raise_for_status()
        data = resp.json()
        
        studies = data.get("studies", [])
        for study in studies[:3]:
            try:
                protocol = study.get("protocolSection", {})
                ident = protocol.get("identificationModule", {})
                title = ident.get("briefTitle", "")
                
                # Extract intervention names
                interventions = protocol.get("armsInterventionsModule", {})
                for intervention in interventions.get("interventions", []):
                    name = intervention.get("name", "")
                    if name and len(name) > 5:
                        trials.append(f"Clinical trial: {name}")
                
                # Extract status/phase if relevant
                status_mod = protocol.get("statusModule", {})
                phase = status_mod.get("phases", [])
                if phase:
                    phase_str = ", ".join(phase)
                    trial_phase = f"Clinical trials in Phase {phase_str}"
                    if trial_phase not in trials:
                        trials.append(trial_phase)
            except Exception:
                continue
                    
    except Exception:
        pass
    
    return trials[:4]


def get_clinical_details(
    gene_symbol: str,
    disease_name: Optional[str] = None,
    omim_id: Optional[str] = None,
    phenotypes: Optional[List[str]] = None,
) -> dict:
    """Fetch comprehensive clinical details for a gene.
    
    This function retrieves disease mechanism, diagnostic tests, clinical symptoms,
    therapeutic options, and carrier manifestations for a given gene by searching
    PubMed clinical literature.
    
    Args:
        gene_symbol: Official gene symbol (e.g., "DMD", "TP53")
        disease_name: Associated disease name if known
        omim_id: OMIM identifier if available
        phenotypes: List of associated phenotype terms
        
    Returns:
        Dictionary containing:
        - diseaseMechanism: Text describing the disease mechanism
        - diagnosticTests: List of diagnostic tests/biomarkers
        - clinicalSymptoms: List of clinical symptoms
        - carrierManifestations: List of carrier-related information
        - therapeuticOptions: List of treatment options
    """
    result = {
        "diseaseMechanism": None,
        "diagnosticTests": [],
        "clinicalSymptoms": [],
        "carrierManifestations": [],
        "therapeuticOptions": [],
    }

    gene_info = _get_gene_summary(gene_symbol)
    if not omim_id and gene_info["omim_id"]:
        omim_id = gene_info["omim_id"]

    if gene_info["summary"] and not result["diseaseMechanism"]:
        mech = _extract_mechanism_from_summary(gene_info["summary"])
        if mech:
            result["diseaseMechanism"] = mech

    # Build search terms: prefer disease name over gene symbol
    search_terms = []
    if disease_name:
        search_terms.append(disease_name)
    if phenotypes:
        search_terms.extend(phenotypes[:2])
    search_terms.append(gene_symbol)
    query_parts = " AND ".join(search_terms)

    # Strategy 1: Disease-in-title PubMed search (most specific)
    disease_for_title = disease_name or (phenotypes[0] if phenotypes else gene_symbol)
    pmids = _ncbi_search(
        f"({disease_for_title}[Title]) AND (diagnosis[Title] OR clinical[Title] OR "
        f"treatment[Title] OR management[Title] OR phenotype[Title])",
        retmax=12,  # Increased from 8 to 12
    )
    abstract_text = _ncbi_fetch_abstracts(pmids)

    if abstract_text:
        if not result["clinicalSymptoms"]:
            result["clinicalSymptoms"] = _extract_matching_terms(
                abstract_text, SYMPTOM_KEYWORDS, max_items=8  # Increased from 5 to 8
            )
        if not result["diagnosticTests"]:
            result["diagnosticTests"] = _extract_matching_terms(
                abstract_text, DIAGNOSTIC_KEYWORDS, max_items=6  # Increased from 4 to 6
            )
        if not result["therapeuticOptions"]:
            result["therapeuticOptions"] = _extract_matching_terms(
                abstract_text, THERAPY_KEYWORDS, max_items=6  # Increased from 4 to 6
            )

    # Strategy 2: Broader PubMed with gene symbol + disease name
    if not result["clinicalSymptoms"] or not result["therapeuticOptions"]:
        pmids2 = _ncbi_search(
            f"({query_parts}) AND (clinical review[Title] OR diagnosis[Title] OR "
            f"management[Title] OR therapy[Title] OR treatment[Title])",
            retmax=12,  # Increased from 8 to 12
        )
        abstract_text2 = _ncbi_fetch_abstracts(pmids2)
        if abstract_text2:
            if not result["clinicalSymptoms"]:
                result["clinicalSymptoms"] = _extract_matching_terms(
                    abstract_text2, SYMPTOM_KEYWORDS, max_items=8
                )
            if not result["diagnosticTests"]:
                result["diagnosticTests"] = _extract_matching_terms(
                    abstract_text2, DIAGNOSTIC_KEYWORDS, max_items=6
                )
            if not result["therapeuticOptions"]:
                result["therapeuticOptions"] = _extract_matching_terms(
                    abstract_text2, THERAPY_KEYWORDS, max_items=6
                )

    # Strategy 3: Gene-specific clinical features search
    if not result["clinicalSymptoms"] or not result["diagnosticTests"]:
        pmids3 = _ncbi_search(
            f"({gene_symbol}[Title]) AND (clinical features[Title] OR "
            f"phenotype[Title] OR manifestations[Title])",
            retmax=8,
        )
        abstract_text3 = _ncbi_fetch_abstracts(pmids3)
        if abstract_text3:
            if not result["clinicalSymptoms"]:
                result["clinicalSymptoms"] = _extract_matching_terms(
                    abstract_text3, SYMPTOM_KEYWORDS, max_items=8
                )
            if not result["diagnosticTests"]:
                result["diagnosticTests"] = _extract_matching_terms(
                    abstract_text3, DIAGNOSTIC_KEYWORDS, max_items=6
                )

    # Strategy 4: Carrier manifestations (X-linked genes)
    if gene_info["summary"] and any(w in (gene_info["summary"] or "").lower()
                                     for w in ["x-linked", "x linked", "xlink"]):
        result["carrierManifestations"] = [
            "X-linked inheritance: female carriers are typically asymptomatic or mildly affected due to skewed X-inactivation.",
            "Carrier testing available through molecular genetic testing of the causative gene.",
            "Routine cardiac and neurological screening recommended for female carriers.",
            "Variable expressivity in carriers depends on X-inactivation patterns.",
        ]

    # Strategy 5: Fetch clinical trials information for therapeutic options
    if not result["therapeuticOptions"] or len(result["therapeuticOptions"]) < 3:
        trial_therapies = _get_clinical_trials(gene_symbol, disease_name)
        if trial_therapies:
            result["therapeuticOptions"].extend(trial_therapies)

    # Deduplicate results while preserving order
    result["clinicalSymptoms"] = list(dict.fromkeys(result["clinicalSymptoms"]))
    result["diagnosticTests"] = list(dict.fromkeys(result["diagnosticTests"]))
    result["therapeuticOptions"] = list(dict.fromkeys(result["therapeuticOptions"]))
    result["carrierManifestations"] = list(dict.fromkeys(result["carrierManifestations"]))

    # Limit final counts to reasonable numbers
    result["clinicalSymptoms"] = result["clinicalSymptoms"][:8]
    result["diagnosticTests"] = result["diagnosticTests"][:6]
    result["therapeuticOptions"] = result["therapeuticOptions"][:8]
    result["carrierManifestations"] = result["carrierManifestations"][:4]

    return result
