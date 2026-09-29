# AIDE500- AI Programming Techniques

## Description

Python programming for AI: language fundamentals, scientific computing with NumPy and Matplotlib, and building, training and evaluating neural networks with PyTorch.

## Contents

| Folder | Description |
| ------ | ----------- |
| `resources/` | Course slides (Intro to AI, Software & Hardware for AI, How Programs Work, NumPy, setup guide) |
| `intro/` | Python fundamentals notebooks (syntax, control flow, lists, functions, exceptions, files, NumPy, classes) |
| `labs/` | Lab notebooks: Jupyter, plotting, NumPy, and the PyTorch tutorial series (tensors → autograd → neural networks → dataloaders → training a CIFAR-10 classifier) |

## Setup

```bash
uv sync
uv run jupyter lab
```

Datasets (CIFAR-10, Fashion-MNIST) are downloaded by torchvision into `data/` on first run and are not committed.
