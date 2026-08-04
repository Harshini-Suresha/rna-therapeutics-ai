from backend.datasets.huesken import HueskenDataset
from backend.datasets.torch_dataset import ASODataset

from torch.utils.data import DataLoader


def test_torch_dataset():
    dataset = HueskenDataset("OligoFormer/data/Hu.csv")
    torch_dataset = ASODataset(dataset)

    x, y = torch_dataset[0]

    print("x:", x)
    print("x.shape:", x.shape)
    print("y:", y)

    assert x.shape == (9,)
    assert y.shape == ()


def test_dataloader():
    dataset = HueskenDataset("OligoFormer/data/Hu.csv")
    torch_dataset = ASODataset(dataset)

    loader = DataLoader(
        torch_dataset,
        batch_size=32,
        shuffle=True,
    )

    for X, y in loader:
        print("X.shape:", X.shape)
        print("y.shape:", y.shape)

        assert X.shape == (32, 9)
        assert y.shape == (32,)
        break


if __name__ == "__main__":
    test_torch_dataset()
    test_dataloader()
    print("All dataset tests passed!")
