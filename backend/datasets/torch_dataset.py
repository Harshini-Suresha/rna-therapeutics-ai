import os

import torch
from torch.utils.data import Dataset

from backend.features.rnafm import RNAFMEmbedder
from backend.features.embed_cache import load_embeddings

FEATURE_KEYS = [
    "gc_content",
    "length",
    "au_content",
    "gc_ratio",
    "has_poly_u",
    "has_poly_g",
    "mfe",
    "ensemble_energy",
    "centroid_distance",
]


class ASODataset(Dataset):
    """Dataset that combines handcrafted features into a 9-dim tensor."""

    def __init__(self, dataset, feature_keys=None):
        self.dataset = dataset
        self.feature_keys = feature_keys or FEATURE_KEYS

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        sample = self.dataset[idx]

        x = torch.tensor(
            [
                sample["features"]["gc_content"],
                sample["features"]["length"],
                sample["features"]["au_content"],
                sample["features"]["gc_ratio"],
                float(sample["features"]["has_poly_u"]),
                float(sample["features"]["has_poly_g"]),
                sample["features"]["mfe"],
                sample["features"]["ensemble_energy"],
                sample["features"]["centroid_distance"],
            ],
            dtype=torch.float32,
        )

        y = torch.tensor(sample["efficacy"], dtype=torch.float32)

        return x, y


class ASOEmbeddingDataset(Dataset):
    """Dataset that produces RNA-FM embeddings for siRNA and mRNA.

    Loads from a precomputed cache if *cache_path* points to an
    existing file; otherwise extracts embeddings on-the-fly using
    the RNA-FM model.

    Returns a concatenated 1280-dim tensor (640 for siRNA + 640 for
    mRNA) as input features.
    """

    def __init__(self, dataset, embedder=None, cache_path=None):
        self.dataset = dataset
        self._embedder = embedder
        self._cache_path = cache_path
        self._use_cache = cache_path is not None and os.path.exists(cache_path)

        if self._use_cache:
            self._cached_embeddings, self._cached_labels = load_embeddings(
                cache_path
            )
            self._n = len(self._cached_embeddings)
        else:
            if embedder is None:
                embedder = RNAFMEmbedder()
            self._embedder = embedder
            self._n = len(dataset)

    def __len__(self):
        return self._n

    def __getitem__(self, idx):
        if self._use_cache:
            x = self._cached_embeddings[idx]
            y = self._cached_labels[idx]
        else:
            sample = self.dataset[idx]
            si_rna_emb = self._embedder.embed(sample["aso_sequence"])
            mrna_emb = self._embedder.embed(sample["mrna_sequence"])
            x = torch.cat([si_rna_emb, mrna_emb], dim=0)
            y = torch.tensor(sample["efficacy"], dtype=torch.float32)

        if not isinstance(y, torch.Tensor):
            y = torch.tensor(y, dtype=torch.float32)

        return x, y


class ASOFusedDataset(Dataset):
    """Dataset that fuses RNA-FM embeddings (1280-dim) with
    handcrafted features (9-dim) for a 1289-dim input.

    This is the stronger long-term model input.
    """

    def __init__(self, dataset, embedder=None):
        self.dataset = dataset
        if embedder is None:
            embedder = RNAFMEmbedder()
        self.embedder = embedder

    def __len__(self):
        return len(self.dataset)

    def __getitem__(self, idx):
        sample = self.dataset[idx]

        si_rna_emb = self.embedder.embed(sample["aso_sequence"])
        mrna_emb = self.embedder.embed(sample["mrna_sequence"])

        handcrafted = torch.tensor(
            [
                sample["features"]["gc_content"],
                sample["features"]["length"],
                sample["features"]["au_content"],
                sample["features"]["gc_ratio"],
                float(sample["features"]["has_poly_u"]),
                float(sample["features"]["has_poly_g"]),
                sample["features"]["mfe"],
                sample["features"]["ensemble_energy"],
                sample["features"]["centroid_distance"],
            ],
            dtype=torch.float32,
        )

        x = torch.cat([si_rna_emb, mrna_emb, handcrafted], dim=0)

        y = torch.tensor(sample["efficacy"], dtype=torch.float32)

        return x, y
