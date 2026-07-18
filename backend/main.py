import asyncio
import os
import sys
import logging

# Add backend/ to sys.path so services resolve correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import aiohttp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

try:  # ``uvicorn backend.main:app`` from the repository root
    from .services.gene_service import EnsemblLookupUnavailable, clean_synonyms, get_gene_metadata, get_gene_phenotypes, ensembl_gene_url
    from .services.enrichment_service import get_gene_enrichment, get_aso_analysis
    from .services.constraint_service import get_human_constraint_metrics
    from .services.clinical_service import get_clinical_details
    from .services.protein_service import get_protein_db_ids
    from .services.variant_details_service import get_variant_details
    from .services.protein_properties_service import get_protein_properties
    from .services.single_cell_service import get_single_cell_expression
    from .services.rna_halflife_service import get_rna_halflife
    from .services.dependency_service import get_gene_dependency
except ImportError:  # ``uvicorn main:app`` while working in backend/
    from services.gene_service import EnsemblLookupUnavailable, clean_synonyms, get_gene_metadata, get_gene_phenotypes, ensembl_gene_url
    from services.enrichment_service import get_gene_enrichment, get_aso_analysis
    from services.constraint_service import get_human_constraint_metrics
    from services.clinical_service import get_clinical_details
    from services.protein_service import get_protein_db_ids
    from services.variant_details_service import get_variant_details
    from services.protein_properties_service import get_protein_properties
    from services.single_cell_service import get_single_cell_expression
    from services.rna_halflife_service import get_rna_halflife
    from services.dependency_service import get_gene_dependency

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="ASO Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SPECIES_TAXON_IDS = {
    "homo_sapiens": 9606,
    "mus_musculus": 10090,
    "rattus_norvegicus": 10116,
    "macaca_fascicularis": 9541,
    "macaca_mulatta": 9544,
    "danio_rerio": 7955,
    "drosophila_melanogaster": 7227,
    "caenorhabditis_elegans": 6239,
    "saccharomyces_cerevisiae": 4932,
    "schizosaccharomyces_pombe": 4896,
    "canis_lupus_familiaris": 9615,
    "felis_catus": 9685,
    "sus_scrofa": 9823,
    "bos_taurus": 9913,
    "equus_caballus": 9796,
    "ovis_aries": 9940,
    "capra_hircus": 9925,
    "gallus_gallus": 9031,
}

class TargetRequest(BaseModel):
    gene_symbol: str
    organism: str  
    disease_name: Optional[str] = None

def get_safe_ensembl_url(species: str, gene_id: str) -> str:
    """Safely resolves the Ensembl link, bypassing any type conversion conflicts."""
    try:
        if callable(ensembl_gene_url):
            return ensembl_gene_url(species, gene_id)
    except Exception:
        pass
    formatted_species = "Homo_sapiens" if species == "homo_sapiens" else "Mus_musculus"
    return f"https://www.ensembl.org/{formatted_species}/Gene/Summary?g={gene_id}"

async def get_pubmed_count(session: aiohttp.ClientSession, term: str) -> int:
    try:
        async with session.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            params={"db": "pubmed", "term": term, "retmode": "json"},
            timeout=aiohttp.ClientTimeout(total=6),
        ) as response:
            data = await response.json() if response.status == 200 else {}
            return int((data.get("esearchresult") or {}).get("count", 0))
    except Exception:
        return 0


async def get_clinvar_count(session: aiohttp.ClientSession, symbol: str) -> Optional[int]:
    """Return the live ClinVar record count for a human gene."""
    try:
        async with session.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            params={"db": "clinvar", "term": f"{symbol}[gene]", "retmode": "json"},
            timeout=aiohttp.ClientTimeout(total=6),
        ) as response:
            data = await response.json() if response.status == 200 else {}
            count = (data.get("esearchresult") or {}).get("count")
            return int(count) if count is not None else None
    except Exception:
        return None

async def get_dbsnp_count(session: aiohttp.ClientSession, symbol: str) -> Optional[int]:
    """Return the live dbSNP variant count for a gene."""
    try:
        async with session.get(
            "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
            params={"db": "snp", "term": f"{symbol}[gene]", "retmode": "json"},
            timeout=aiohttp.ClientTimeout(total=6),
        ) as response:
            data = await response.json() if response.status == 200 else {}
            count = (data.get("esearchresult") or {}).get("count")
            return int(count) if count is not None else None
    except Exception:
        return None

async def get_rxiv_count(session: aiohttp.ClientSession, symbol: str) -> int:
    """Fetch preprint count from bioRxiv/medRxiv via Europe PMC."""
    try:
        async with session.get(
            "https://www.ebi.ac.uk/europepmc/webservices/rest/search",
            params={"query": f"{symbol}[title] AND SRC:PPR", "format": "json", "resultType": "lite"},
            timeout=aiohttp.ClientTimeout(total=8),
        ) as response:
            data = await response.json() if response.status == 200 else {}
            return int(data.get("hitCount", 0))
    except Exception:
        return 0

async def fetch_expression_details(session: aiohttp.ClientSession, symbol: str, ensembl_gene_id: str, species: str) -> dict:
    expr_data = {
        "available": False,
        "top_tissue": None,
        "tpm": None,
        "gtex_level": None,
        "hpa_level": None,
        "top_tissues": [],
    }

    if species != "homo_sapiens" or not ensembl_gene_id:
        return expr_data

    try:
        # GTEx expression endpoints require a versioned GENCODE ID, not a symbol
        # or an unversioned Ensembl ID. Resolve it first from the official API.
        async with session.get(
            "https://gtexportal.org/api/v2/reference/geneSearch",
            params={
                "geneId": symbol,
                "gencodeVersion": "v26",
                "genomeBuild": "GRCh38/hg38",
            },
            timeout=aiohttp.ClientTimeout(total=6),
        ) as response:
            search_data = await response.json() if response.status == 200 else {}

        matches = search_data.get("data", [])
        gene_record = next(
            (record for record in matches if record.get("geneSymbol", "").upper() == symbol.upper()),
            None,
        )
        gencode_id = gene_record.get("gencodeId") if gene_record else None
        if not gencode_id:
            return expr_data

        async with session.get(
            "https://gtexportal.org/api/v2/expression/medianGeneExpression",
            params={"gencodeId": gencode_id, "datasetId": "gtex_v8"},
            timeout=aiohttp.ClientTimeout(total=6),
        ) as response:
            data = await response.json() if response.status == 200 else {}

        records = data.get("data", [])
        if records:
            sorted_records = sorted(records, key=lambda x: x.get("median", 0.0), reverse=True)
            top_record = sorted_records[0]
            tissue = top_record.get("tissueSiteDetailId", "Tissue").replace("_", " ")
            tpm = round(top_record.get("median", 0.0), 1)
            expr_data["available"] = True
            expr_data["top_tissue"] = tissue.title()
            expr_data["tpm"] = tpm
            expr_data["gtex_level"] = f"{tissue.title()} ({tpm} TPM)"
            expr_data["top_tissues"] = [
                {
                    "name": record.get("tissueSiteDetailId", "Tissue").replace("_", " ").title(),
                    "tpm": round(record.get("median", 0.0), 1),
                }
                for record in sorted_records[:12]
            ]
    except Exception as e:
        logger.info(f"GTEx lookup unavailable for {symbol}: {e}")

    return expr_data

async def fetch_disease_associations(session: aiohttp.ClientSession, symbol: str, ensembl_id: str, species: str) -> dict:
    result = {"diseases": [], "omim_id": None, "source": []}
    is_human = species == "homo_sapiens"

    if is_human and ensembl_id and ensembl_id.startswith("ENSG"):
        try:
            ot_url = "https://api.platform.opentargets.org/api/v4/graphql"
            query = """
            query targetInfo($ensemblId: String!) {
              target(ensemblId: $ensemblId) {
                associatedDiseases(page: {index: 0, size: 5}) {
                  rows {
                    disease { name dbXRefs }
                  }
                }
              }
            }
            """
            async with session.post(
                ot_url,
                json={"query": query, "variables": {"ensemblId": ensembl_id}},
                timeout=aiohttp.ClientTimeout(total=6),
            ) as ot_res:
                if ot_res.status == 200:
                    ot_data = await ot_res.json()
                    target_data = (ot_data.get("data") or {}).get("target")
                    if target_data:
                        rows = (target_data.get("associatedDiseases") or {}).get("rows", [])
                        diseases, omim_id = [], None
                        for row in rows:
                            disease_node = row.get("disease") or {}
                            d_name = disease_node.get("name")
                            if d_name:
                                diseases.append(d_name.strip())
                            if not omim_id:
                                for xref in disease_node.get("dbXRefs", []) or []:
                                    if xref.startswith("OMIM:"):
                                        omim_id = xref.replace("OMIM:", "").strip()
                                        break
                        if diseases:
                            result["diseases"] = diseases
                            result["omim_id"] = omim_id
                            result["source"] = ["Open Targets Platform"]
                            return result
        except Exception as e:
            logger.warning(f"Open Targets lookup failed for {symbol}: {e}")

    phenotypes = get_gene_phenotypes(ensembl_id, species)
    if phenotypes:
        result["diseases"] = [p.get("description", "") for p in phenotypes if p.get("description")][:6]
        result["source"] = sorted({p.get("source", "Ensembl Phenotype") for p in phenotypes if p.get("source")})

    return result

@app.post("/api/pipeline/initialize-target")
async def initialize_target(payload: TargetRequest):
    try:
        symbol_upper = payload.gene_symbol.strip().upper()
        species = payload.organism or "homo_sapiens"
        ORGANISM_ID_TO_ENSEMBL = {
            "human": "homo_sapiens", "mouse": "mus_musculus", "rat": "rattus_norvegicus",
            "cynomolgus": "macaca_fascicularis", "rhesus": "macaca_mulatta",
            "zebrafish": "danio_rerio", "fruitfly": "drosophila_melanogaster",
            "celegans": "caenorhabditis_elegans", "yeast": "saccharomyces_cerevisiae",
            "fissionyeast": "schizosaccharomyces_pombe", "dog": "canis_lupus_familiaris",
            "cat": "felis_catus", "pig": "sus_scrofa", "cow": "bos_taurus",
            "horse": "equus_caballus", "sheep": "ovis_aries", "goat": "capra_hircus",
            "chicken": "gallus_gallus",
        }
        species = ORGANISM_ID_TO_ENSEMBL.get(species.lower(), species)
        is_human = species == "homo_sapiens"

        meta = get_gene_metadata(symbol_upper, species)
        if not meta or not meta.get("id"):
            raise HTTPException(
                status_code=404,
                detail=f'Gene "{symbol_upper}" was not found in {species.replace("_", " ")} (Ensembl).',
            )

        gene_id = meta["id"]
        taxon_id = SPECIES_TAXON_IDS.get(species, 9606)

        async with aiohttp.ClientSession() as session:
            pubmed_task = get_pubmed_count(session, f"{symbol_upper}[gene]")
            review_task = get_pubmed_count(session, f"{symbol_upper}[gene] AND review[pt]")
            clinical_trial_task = get_pubmed_count(session, f"{symbol_upper}[gene] AND clinical trial[pt]")
            case_report_task = get_pubmed_count(session, f"{symbol_upper}[gene] AND case reports[pt]")
            biorxiv_task = get_rxiv_count(session, symbol_upper)
            medrxiv_task = asyncio.sleep(0, result=0)
            disease_task = fetch_disease_associations(session, symbol_upper, gene_id, species)
            expr_task = fetch_expression_details(session, symbol_upper, gene_id, species)
            clinvar_task = get_clinvar_count(session, symbol_upper) if is_human else None
            dbsnp_task = get_dbsnp_count(session, symbol_upper) if is_human else None

            pubmed_count, review_count, clinical_trial_count, case_report_count, biorxiv_count, medrxiv_count, disease_info, expr_details, clinvar_count, dbsnp_count = await asyncio.gather(
                pubmed_task,
                review_task,
                clinical_trial_task,
                case_report_task,
                biorxiv_task,
                medrxiv_task,
                disease_task,
                expr_task,
                clinvar_task if clinvar_task else asyncio.sleep(0, result=None),
                dbsnp_task if dbsnp_task else asyncio.sleep(0, result=None),
            )

        try:
            enrichment_data = get_gene_enrichment(gene_id, taxon_id)
        except Exception as e:
            logger.warning(f"Enrichment lookup failed for {symbol_upper}: {e}")
            enrichment_data = {}

        constraint_data = get_human_constraint_metrics(symbol_upper) if is_human else {}

        # ASO-specific analysis (G-quadruplexes, CpG density, isoforms, splice switches)
        try:
            aso_data = get_aso_analysis(gene_id, taxon_id)
        except Exception as e:
            logger.warning(f"ASO analysis failed for {symbol_upper}: {e}")
            aso_data = {}

        # RNA half-life from RNAdecayCafe (human only)
        rna_halflife_data = {}
        if is_human:
            try:
                rna_halflife_data = get_rna_halflife(symbol_upper)
            except Exception as e:
                logger.warning(f"RNA half-life lookup failed for {symbol_upper}: {e}")
                rna_halflife_data = {}

        # Gene dependency from FAVOR API (human only)
        dependency_data = {}
        if is_human:
            try:
                dependency_data = get_gene_dependency(symbol_upper)
            except Exception as e:
                logger.warning(f"Dependency lookup failed for {symbol_upper}: {e}")
                dependency_data = {}

        # Fetch top ClinVar variant details (HGVS, rsID)
        variant_details = {}
        if is_human:
            try:
                variant_details = get_variant_details(
                    gene_symbol=symbol_upper,
                    ensembl_gene_id=meta.get("id"),
                    entrez_id=meta.get("entrezGeneId"),
                )
            except Exception as exc:
                logger.warning("Variant details lookup failed for %s: %s", symbol_upper, exc)
                variant_details = {}

        synonyms_list = clean_synonyms(meta.get("synonyms"), symbol_upper)
        
        disease_resolved = "; ".join(disease_info["diseases"][:3]) if disease_info["diseases"] else None
        if not disease_resolved and payload.disease_name:
            disease_resolved = payload.disease_name.strip()
            
        omim_id = f"#{disease_info['omim_id']}" if disease_info.get("omim_id") else None

        # Fetch protein properties from UniProt
        protein_props = {}
        protein_db = {}
        if is_human:
            try:
                # First get UniProt accession from protein service
                protein_db = get_protein_db_ids(
                    uniprot_id=meta.get("proteinId"),
                    gene_symbol=symbol_upper,
                    entrez_id=meta.get("entrezGeneId"),
                )
                uniprot_acc = protein_db.get("uniprotAccession")
                protein_props = get_protein_properties(
                    ensembl_protein_id=meta.get("proteinId"),
                    gene_symbol=symbol_upper,
                    uniprot_accession=uniprot_acc,
                )
            except Exception as exc:
                logger.warning("Protein properties lookup failed for %s: %s", symbol_upper, exc)
                protein_props = {}
                protein_db = {}

        # Fetch single-cell expression from HPA
        single_cell = {}
        if is_human:
            try:
                single_cell = get_single_cell_expression(
                    ensembl_id=gene_id,
                    gene_symbol=symbol_upper,
                )
            except Exception as exc:
                logger.warning("Single-cell lookup failed for %s: %s", symbol_upper, exc)
                single_cell = {}

        # Fetch clinical details from NCBI/OMIM
        clinical_details = {}
        if is_human:
            try:
                clinical_details = get_clinical_details(
                    gene_symbol=symbol_upper,
                    disease_name=disease_resolved,
                    omim_id=disease_info.get("omim_id"),
                    phenotypes=disease_info.get("diseases"),
                )
            except Exception as e:
                logger.warning(f"Clinical details lookup failed for {symbol_upper}: {e}")
                clinical_details = {}

        raw_strand = meta.get("strand")
        if str(raw_strand) in ["-1", "-"]:
            strand_display = "Reverse (−)"
        elif str(raw_strand) in ["1", "+1", "+"]:
            strand_display = "Forward (+)"
        else:
            strand_display = None

        hgnc_display = meta.get("nomenclatureId") or meta.get("hgncId")
        if not hgnc_display:
            hgnc_display = None

        gene_type_display = meta.get("biotype") or meta.get("geneType") or "protein_coding"

        start, end = meta.get("start"), meta.get("end")
        gene_length = (end - start + 1) if (start is not None and end is not None) else None
        exon_count = meta.get("exonCount")
        protein_length = meta.get("proteinLength")
        cds_length = (protein_length * 3 + 3) if protein_length else None

        ensembl_url = get_safe_ensembl_url(species, gene_id)

        deep_links = {
            "ensembl": ensembl_url,
            "ncbi": f"https://www.ncbi.nlm.nih.gov/gene/?term={symbol_upper}",
            "gtex": f"https://gtexportal.org/home/gene/{symbol_upper}" if is_human else None,
            "hpa": f"https://www.proteinatlas.org/search/{symbol_upper}" if is_human else None,
            "uniprot": f"https://www.uniprot.org/uniprotkb?query={symbol_upper}",
            "clinvar": f"https://www.ncbi.nlm.nih.gov/clinvar/?term={symbol_upper}%5Bgene%5D",
            "kegg": f"https://www.genome.jp/dbget-bin/www_bget?q={symbol_upper}",
            "reactome": f"https://reactome.org/content/query?q={symbol_upper}",
            "pubmed": f"https://pubmed.ncbi.nlm.nih.gov/?term={symbol_upper}%5Bgene%5D",
            "clinicaltrials": f"https://clinicaltrials.gov/search?cond={symbol_upper}",
            "omim": f"https://www.omim.org/search?search={symbol_upper}",
            "go": f"https://www.ebi.ac.uk/QuickGO/annotations?geneProductId=ENSEMBL%3A{gene_id}",
            "string": f"https://string-db.org/cgi/network?identifiers={symbol_upper}&species={taxon_id}",
        }

        tissue_level = None
        if expr_details["available"]:
            tpm_value = expr_details["tpm"] or 0
            tissue_level = "High" if tpm_value > 25 else ("Medium" if tpm_value > 5 else "Low")

        return {
            "organism": species,
            "diseaseName": payload.disease_name.strip() if payload.disease_name else None,
            "geneSymbol": symbol_upper,
            "geneName": meta.get("geneName"),
            "geneFunction": enrichment_data.get("geneFunction"),
            "geneId": gene_id,  
            "entrezGeneId": meta.get("entrezGeneId") or enrichment_data.get("entrezGeneId"),
            "hgncId": hgnc_display,
            "chromosome": meta.get("seq_region_name"),
            "location": f"{meta.get('seq_region_name')}:{start}-{end}" if start and end else None,
            "cytoband": meta.get("cytoband"),
            "genomeBuild": meta.get("genomeBuild"),
            "genomicStart": start,
            "genomicEnd": end,
            "strand": strand_display,
            "geneType": gene_type_display,
            "synonyms": synonyms_list,
            "source": ["Ensembl"],
            "taxonId": str(taxon_id),

            "canonicalTranscript": meta.get("canonicalTranscript"),
            "canonicalTranscriptLabel": "Canonical (MANE Select)" if is_human else "Canonical",
            
            # Explicitly tie these to the parsed Ensembl values from service layer
            "otherTranscripts": meta.get("otherTranscripts", []),
            "totalTranscripts": meta.get("totalTranscripts") or len(meta.get("otherTranscripts", [])) + 1,

            "variantExamples": [],
            "totalKnownVariantsClinvar": None,

            "defaultTissue": expr_details["top_tissue"],
            "tissueExpressionLevel": tissue_level,
            "tissueTpm": expr_details["tpm"],
            "topTissues": expr_details["top_tissues"],

            "defaultCellType": single_cell.get("cellType"),
            "cellExpressionLevel": single_cell.get("cellType"),
            "cellTpm": single_cell.get("cellTpm"),

            "proteinId": meta.get("proteinId"),
            "proteinName": meta.get("geneName"),
            "proteinLength": protein_length,

            # Protein properties from UniProt
            "molecularWeight": protein_props.get("molecularWeight"),
            "isoelectricPoint": protein_props.get("isoelectricPoint"),
            "secondaryStructureDistribution": protein_props.get("secondaryStructureDistribution"),
            "criticalPhosphorylationSite": protein_props.get("criticalPhosphorylationSite"),
            "ubiquitinationTarget": protein_props.get("ubiquitinationTarget"),
            "quaternaryStructure": protein_props.get("quaternaryStructure"),
            "stabilityScore": protein_props.get("stabilityScore"),

            # Protein database IDs from UniProt + NCBI
            "interproId": protein_db.get("interproId") if is_human else None,
            "pfamId": protein_db.get("pfamId") if is_human else None,
            "pdbId": protein_db.get("pdbId") if is_human else None,
            "uniprotAccession": protein_db.get("uniprotAccession") if is_human else None,

            # Use gnomAD mutation rate if available (overrides protein service)
            **({"mutationRate": constraint_data["mutationRate"]} if constraint_data.get("mutationRate") else {}),

            # Top ClinVar variant details
            "topHgvsName": variant_details.get("topHgvsName"),
            "topRsId": variant_details.get("topRsId"),
            **({"populationFrequencyMaf": constraint_data["populationFrequencyMaf"]} if constraint_data.get("populationFrequencyMaf") else {}),

            "disease": disease_resolved,
            "diseaseAssociation": disease_resolved if disease_resolved else "None identified",
            "diseaseAssociationSource": disease_info.get("source", ["Ensembl Phenotype"] if disease_resolved else []),
            "phenotypes": disease_info.get("diseases", []),
            "associationStatus": "Reported" if disease_resolved else None,
            "omimId": omim_id,
            "diseaseMechanism": clinical_details.get("diseaseMechanism"),
            "diagnosticTests": clinical_details.get("diagnosticTests", []),
            "clinicalSymptoms": clinical_details.get("clinicalSymptoms", []),
            "carrierManifestations": clinical_details.get("carrierManifestations", []),
            "therapeuticOptions": clinical_details.get("therapeuticOptions", []),

            "exonCount": exon_count,
            "intronCount": (exon_count - 1) if exon_count else None,
            "cdsLength": cds_length,
            "geneLength": gene_length,

            # Provide actual counts from live API lookups
            "dbSnpCount": dbsnp_count,
            "gnomadAvailable": bool(constraint_data.get("intolerantToLossScore") or constraint_data.get("loeufScore")),
            "clinvarVariantCount": clinvar_count,

            "gtexAvailable": expr_details["available"],
            "humanProteinAtlasLevel": expr_details["hpa_level"] or ("Profile linked" if is_human else None),
            "gtexExpressionLevel": expr_details["gtex_level"],

            "haploinsufficiencyScore": constraint_data.get("haploinsufficiencyScore"),
            "intolerantToLossScore": constraint_data.get("intolerantToLossScore"),
            "recessiveConstraintZ": constraint_data.get("recessiveConstraintZ"),
            "hetExcessZ": constraint_data.get("hetExcessZ"),
            "compositeConstraintIndex": constraint_data.get("compositeConstraintIndex"),

            "loeufDecile": constraint_data.get("loeufDecile"),
            "triplosensitivity": constraint_data.get("triplosensitivity"),
            "activeIsoforms": aso_data.get("activeIsoforms"),
            "spliceSwitches": aso_data.get("spliceSwitches"),
            "structuralAccessibility": aso_data.get("structuralAccessibility"),
            "splicingMotifDensity": aso_data.get("splicingMotifDensity"),
            "preclinicalConservation": aso_data.get("preclinicalConservation"),
            "gQuadruplexes": aso_data.get("gQuadruplexes"),
            "cpgDensity": aso_data.get("cpgDensity"),
            "selfDimerRisk": aso_data.get("selfDimerRisk"),
            "polygTracts": aso_data.get("polygTracts"),
            "transcriptSpecificity": aso_data.get("transcriptSpecificity"),

            # RNA half-life and dependency
            "rnaHalflife": rna_halflife_data.get("rnaHalflife"),
            "rnaHalflifeHours": rna_halflife_data.get("rnaHalflifeHours"),
            "rnaHalflifeSource": rna_halflife_data.get("rnaHalflifeSource"),
            "depmapDependency": dependency_data.get("depmapDependency"),
            "depmapDependencyScore": dependency_data.get("depmapDependencyScore"),
            "essentialGene": dependency_data.get("essentialGene"),
            "depmapSource": dependency_data.get("depmapSource"),

            "deepLinks": deep_links,

            "keggCount": enrichment_data.get("keggCount"),
            "reactomeCount": enrichment_data.get("reactomeCount"),
            "pathwayCommonsCount": None,

            "goBiologicalProcess": enrichment_data.get("goBiologicalProcess"),
            "goMolecularFunction": enrichment_data.get("goMolecularFunction"),
            "goCellularComponent": enrichment_data.get("goCellularComponent"),
            "pathwayHighlight": enrichment_data.get("pathwayHighlight"),
            "goBiologicalProcessHighlight": enrichment_data.get("goBiologicalProcessHighlight"),
            "goMolecularFunctionHighlight": enrichment_data.get("goMolecularFunctionHighlight"),
            "goCellularComponentHighlight": enrichment_data.get("goCellularComponentHighlight"),

            "stringHighConfidenceCount": enrichment_data.get("stringHighConfidenceCount"),
            "mediumConfidenceCount": enrichment_data.get("mediumConfidenceCount"),
            "totalInteractors": enrichment_data.get("totalInteractors"),
            "experimentalCount": enrichment_data.get("experimentalCount"),
            "databaseCount": enrichment_data.get("databaseCount"),
            "topInteractors": enrichment_data.get("topInteractors", []),

            "pubmedArticleCount": pubmed_count,
            "reviewCount": review_count,
            "clinicalTrialsCount": clinical_trial_count,
            "caseReportsCount": case_report_count,
            "preprintCount": biorxiv_count,
        }
    except HTTPException:
        raise
    except EnsemblLookupUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error in initialize_target route: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
