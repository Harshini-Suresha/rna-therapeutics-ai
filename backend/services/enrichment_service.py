"""Live enrichment and interaction summaries for the target dashboard."""

import re
import requests


def _as_list(value):
    if not value:
        return []
    return value if isinstance(value, list) else [value]


def _first_annotation(values):
    first = _as_list(values)
    if not first:
        return None
    value = first[0]
    return value.get("term") if isinstance(value, dict) else str(value)


def _first_pathway(values):
    first = _as_list(values)
    if not first:
        return None
    value = first[0]
    name = value.get("name") if isinstance(value, dict) else str(value)
    if name:
        name = name.replace(" - Homo sapiens (human)", "").replace(" - Homo sapiens", "").replace(" (human)", "")
    return name


def get_gene_enrichment(ensembl_gene_id: str, taxon_id: int) -> dict:
    """Fetch GO, pathway and STRING counts without fabricating unavailable data."""
    result = {
        "keggCount": None,
        "reactomeCount": None,
        "goBiologicalProcess": None,
        "goMolecularFunction": None,
        "goCellularComponent": None,
        "geneFunction": None,
        "entrezGeneId": None,
        "pathwayHighlight": None,
        "goBiologicalProcessHighlight": None,
        "goMolecularFunctionHighlight": None,
        "goCellularComponentHighlight": None,
        "stringHighConfidenceCount": None,
        "mediumConfidenceCount": None,
        "totalInteractors": None,
        "experimentalCount": None,
        "databaseCount": None,
    }

    try:
        response = requests.get(
            "https://mygene.info/v3/query",
            params={
                "q": f"ensembl.gene:{ensembl_gene_id}",
                "fields": "summary,go,pathway.kegg,pathway.reactome",
                "species": taxon_id,
                "size": 1,
            },
            timeout=8,
        )
        hits = (response.json() if response.ok else {}).get("hits") or []
        hit = hits[0] if hits else {}
        go = hit.get("go") or {}
        pathway = hit.get("pathway") or {}
        result["geneFunction"] = hit.get("summary") or None
        result["entrezGeneId"] = str(hit.get("entrezgene") or hit.get("_id")) if hit else None

        result["keggCount"] = len(_as_list(pathway.get("kegg")))
        result["reactomeCount"] = len(_as_list(pathway.get("reactome")))
        result["goBiologicalProcess"] = len(_as_list(go.get("BP")))
        result["goMolecularFunction"] = len(_as_list(go.get("MF")))
        result["goCellularComponent"] = len(_as_list(go.get("CC")))
        result["pathwayHighlight"] = _first_pathway(pathway.get("kegg")) or _first_pathway(pathway.get("reactome"))
        result["goBiologicalProcessHighlight"] = _first_annotation(go.get("BP"))
        result["goMolecularFunctionHighlight"] = _first_annotation(go.get("MF"))
        result["goCellularComponentHighlight"] = _first_annotation(go.get("CC"))
    except (requests.RequestException, ValueError):
        pass

    try:
        response = requests.get(
            "https://string-db.org/api/json/network",
            params={"identifiers": ensembl_gene_id, "species": taxon_id, "required_score": 0},
            timeout=8,
        )
        interactions = response.json() if response.ok else []
        if isinstance(interactions, list):
            partners = set()
            high_confidence = 0
            medium_confidence = 0
            experimental_count = 0
            database_count = 0
            scored_partners = []
            
            for interaction in interactions:
                score = float(interaction.get("score") or 0)
                
                # Count by confidence level
                if score >= 0.7:
                    high_confidence += 1
                elif score >= 0.4:
                    medium_confidence += 1
                
                # Count by evidence type
                # Check for experimental evidence (textmining, experiments, database)
                if interaction.get("experiments") and int(interaction.get("experiments", 0)) > 0:
                    experimental_count += 1
                if interaction.get("database") and int(interaction.get("database", 0)) > 0:
                    database_count += 1
                
                # Track unique partners
                for name_key in ("preferredName_A", "preferredName_B"):
                    name = interaction.get(name_key)
                    if name and name.upper() != ensembl_gene_id.upper():
                        partners.add(name)
                        scored_partners.append((name, score))
            
            result["stringHighConfidenceCount"] = high_confidence
            result["mediumConfidenceCount"] = medium_confidence
            result["totalInteractors"] = len(partners)
            result["experimentalCount"] = experimental_count
            result["databaseCount"] = database_count
            
            # Top 5 interactors by score
            scored_partners.sort(key=lambda x: x[1], reverse=True)
            seen = set()
            top_partners = []
            for name, score in scored_partners:
                if name not in seen:
                    seen.add(name)
                    top_partners.append({"name": name, "score": round(score, 2)})
                if len(top_partners) >= 5:
                    break
            result["topInteractors"] = top_partners
    except (requests.RequestException, ValueError, TypeError):
        pass

    return result


ENSEMBL_REST = "https://rest.ensembl.org"


def _ensembl_get(url):
    headers = {"Content-Type": "application/json"}
    return requests.get(url, headers=headers, timeout=10)


def get_aso_analysis(ensembl_gene_id: str, taxon_id: int) -> dict:
    """Compute ASO-relevant metrics: active isoforms, splice switches, G4, CpG."""
    result = {
        "activeIsoforms": None,
        "spliceSwitches": None,
        "gQuadruplexes": None,
        "cpgDensity": None,
    }

    # Fetch transcript count from Ensembl
    try:
        resp = _ensembl_get(f"{ENSEMBL_REST}/lookup/id/{ensembl_gene_id}?expand=1")
        if resp.ok:
            data = resp.json()
            transcripts = data.get("Transcript", [])
            coding = [t for t in transcripts if t.get("biotype") == "protein_coding"]
            result["activeIsoforms"] = len(coding) if coding else len(transcripts)

            # Splice switches: count transcripts with different exon structures
            if len(transcripts) > 1:
                exon_sets = set()
                for t in transcripts:
                    exons = t.get("Exon", [])
                    exon_sets.add(len(exons))
                result["spliceSwitches"] = max(0, len(exon_sets) - 1)
    except Exception:
        pass

    # Fetch genomic sequence for G4 and CpG analysis (human only)
    if taxon_id == 9606:
        try:
            seq_resp = _ensembl_get(f"{ENSEMBL_REST}/sequence/id/{ensembl_gene_id}?type=genomic")
            if seq_resp.ok:
                seq_data = seq_resp.json()
                seq = seq_data.get("seq", "").upper()

                # G-quadruplex detection: pattern GGG(N1-7){3}GGG
                g4_pattern = re.compile(r"(G{3}[\w]{1,7}){3}G{3}")
                g4_matches = g4_pattern.findall(seq)
                g4_count = len(g4_matches)
                if g4_count == 0:
                    result["gQuadruplexes"] = "0 Blocks Found"
                elif g4_count <= 2:
                    result["gQuadruplexes"] = f"{g4_count} Block{'s' if g4_count > 1 else ''} Found"
                else:
                    result["gQuadruplexes"] = f"{g4_count} Blocks Found"

                # CpG density analysis
                cpg_count = seq.count("CG")
                seq_len = len(seq) if len(seq) > 0 else 1
                cpg_density = (cpg_count / seq_len) * 1000
                if cpg_density > 25:
                    result["cpgDensity"] = "High Risk"
                elif cpg_density > 10:
                    result["cpgDensity"] = "Medium Risk"
                else:
                    result["cpgDensity"] = "Low Risk"
        except Exception:
            pass

    return result
