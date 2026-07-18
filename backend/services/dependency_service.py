"""Gene dependency/essentiality data from FAVOR API.

Provides gene indispensability scores and essentiality predictions
from the FAVOR annotations API.
API endpoint: https://api.genohub.org/v1/annotations/{gene_symbol}
"""

import logging

import requests

FAVOR_API_BASE = "https://api.genohub.org/v1/annotations"

logger = logging.getLogger(__name__)


def get_gene_dependency(gene_symbol: str) -> dict:
    """Query FAVOR API for gene dependency/essentiality data.
    
    Returns:
        dict with keys:
            - depmapDependency: str | None - Formatted dependency score
            - depmapDependencyScore: float | None - Raw indispensability score (0-1)
            - essentialGene: str | None - Essentiality prediction ("Essential" or "Non-essential")
            - depmapSource: str - Data source citation
    """
    result = {
        "depmapDependency": None,
        "depmapDependencyScore": None,
        "essentialGene": None,
        "depmapSource": "FAVOR (Xiong et al. 2024)",
    }
    
    if not gene_symbol:
        return result
    
    symbol = gene_symbol.strip()
    
    try:
        response = requests.get(
            f"{FAVOR_API_BASE}/{symbol}",
            timeout=10,
        )
        if response.status_code != 200:
            logger.info(f"FAVOR API returned {response.status_code} for {symbol}")
            return result
        
        data = response.json()
        
        # Extract gene indispensability score (0-1, higher = more essential)
        score_raw = data.get("gene_indispensability_score")
        if score_raw is not None:
            try:
                score = float(score_raw)
                result["depmapDependencyScore"] = round(score, 3)
                if score >= 0.8:
                    result["depmapDependency"] = f"{score:.2f} (Essential)"
                elif score >= 0.5:
                    result["depmapDependency"] = f"{score:.2f} (Moderate)"
                elif score >= 0.2:
                    result["depmapDependency"] = f"{score:.2f} (Low)"
                else:
                    result["depmapDependency"] = f"{score:.2f} (Dispensable)"
            except (ValueError, TypeError):
                pass
        
        # Extract essentiality prediction
        essential_raw = data.get("essential_gene")
        if essential_raw:
            essential_str = str(essential_raw).strip().upper()
            if essential_str == "E":
                result["essentialGene"] = "Essential"
            elif essential_str == "N":
                result["essentialGene"] = "Non-essential"
        
        # Also check CRISPR-based essentiality if available
        crispr_raw = data.get("essential_gene_crispr")
        if crispr_raw and str(crispr_raw).strip().upper() == "Y":
            result["essentialGene"] = "Essential (CRISPR)"
        
        crispr2_raw = data.get("essential_gene_crispr2")
        if crispr2_raw and str(crispr2_raw).strip().upper() == "Y":
            result["essentialGene"] = "Essential (CRISPR2)"
        
    except requests.RequestException as e:
        logger.info(f"FAVOR API request failed for {symbol}: {e}")
    except (KeyError, ValueError, TypeError) as e:
        logger.info(f"Failed to parse FAVOR response for {symbol}: {e}")
    
    return result
