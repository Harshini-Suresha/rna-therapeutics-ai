import torch
from torch.utils.data import Dataset


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
    def __init__(self, dataset):
        self.dataset = dataset
        self.feature_keys = FEATURE_KEYS

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
