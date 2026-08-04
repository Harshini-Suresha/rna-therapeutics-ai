import torch
from torch.utils.data import DataLoader
from torch.utils.data import Subset

from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASODataset
from backend.models.baseline import BaselineMLP

DATA_PATH = "OligoFormer/data/Hu.csv"
EPOCHS = 20
BATCH_SIZE = 32
LR = 1e-3
SEED = 42


def main():
    torch.manual_seed(SEED)

    full_dataset = HueskenDataset(DATA_PATH)
    aso_dataset = ASODataset(full_dataset)

    n = len(aso_dataset)
    n_train = int(n * 0.8)
    n_val = n - n_train

    generator = torch.Generator().manual_seed(SEED)
    train_dataset, val_dataset = torch.utils.data.random_split(
        aso_dataset, [n_train, n_val], generator=generator
    )

    train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False)

    model = BaselineMLP(input_dim=9)

    optimizer = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = torch.nn.MSELoss()

    for epoch in range(EPOCHS):
        model.train()
        epoch_loss = 0.0
        n_batches = 0

        for X, y in train_loader:
            pred = model(X)
            loss = loss_fn(pred, y)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            n_batches += 1

        avg_train_loss = epoch_loss / n_batches

        model.eval()
        val_loss = 0.0
        n_val_batches = 0

        with torch.no_grad():
            for X, y in val_loader:
                pred = model(X)
                loss = loss_fn(pred, y)
                val_loss += loss.item()
                n_val_batches += 1

        avg_val_loss = val_loss / max(n_val_batches, 1)

        print(
            f"Epoch {epoch:2d} | "
            f"train MSE: {avg_train_loss:.4f} | "
            f"val MSE: {avg_val_loss:.4f}"
        )

    torch.save(model.state_dict(), "backend/models/baseline_weights.pth")
    print("Model saved to backend/models/baseline_weights.pth")


if __name__ == "__main__":
    main()
