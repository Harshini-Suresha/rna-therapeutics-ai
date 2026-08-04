import torch.nn as nn


class BaselineMLP(nn.Module):
    def __init__(self, input_dim: int = 9):
        super().__init__()

        self.model = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        return self.model(x).squeeze(-1)
