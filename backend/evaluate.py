import numpy as np
import torch
from torch.utils.data import DataLoader
from torch.utils.data import random_split

from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASODataset
from backend.models.baseline import BaselineMLP

DATA_PATH = "OligoFormer/data/Hu.csv"
BATCH_SIZE = 32
SEED = 42
WEIGHTS_PATH = "backend/models/baseline_weights.pth"


def evaluate(model, dataloader):
    model.eval()
    all_preds = []
    all_targets = []

    with torch.no_grad():
        for X, y in dataloader:
            pred = model(X)
            all_preds.append(pred.numpy())
            all_targets.append(y.numpy())

    preds = np.concatenate(all_preds)
    targets = np.concatenate(all_targets)

    mse = np.mean((preds - targets) ** 2)
    mae = np.mean(np.abs(preds - targets))

    if preds.std() == 0:
        pearson = 0.0
    else:
        pearson = np.corrcoef(preds, targets)[0, 1]

    ss_res = np.sum((targets - preds) ** 2)
    ss_tot = np.sum((targets - targets.mean()) ** 2)
    r2 = 1 - ss_res / ss_tot if ss_tot > 0 else 0.0

    return {
        "MSE": float(mse),
        "MAE": float(mae),
        "Pearson": float(pearson),
        "R2": float(r2),
    }


def main():
    torch.manual_seed(SEED)

    full_dataset = HueskenDataset(DATA_PATH)
    aso_dataset = ASODataset(full_dataset)

    n = len(aso_dataset)
    n_train = int(n * 0.8)
    n_val = n - n_train

    generator = torch.Generator().manual_seed(SEED)
    _, val_dataset = random_split(
        aso_dataset, [n_train, n_val], generator=generator
    )

    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    model = BaselineMLP(input_dim=9)
    model.load_state_dict(torch.load(WEIGHTS_PATH))

    results = evaluate(model, val_loader)

    print("=== Baseline Evaluation ===")
    for metric, value in results.items():
        print(f"{metric:12s}: {value:.4f}")


if __name__ == "__main__":
    main()
