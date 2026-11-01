"""Download MNIST and write a small subset the browser app can fetch.

Standard library only, so any python3 works:
    python3 scripts/prepare_mnist.py

Output (public/mnist/, gitignored):
    train.bin  12,000 images then 12,000 labels, uint8
    test.bin    2,000 images then  2,000 labels, uint8
Each image is 784 bytes (28x28, row-major, 0 = background).
"""
import gzip
import struct
import urllib.request
from pathlib import Path

MIRROR = "https://ossci-datasets.s3.amazonaws.com/mnist/"
FILES = {
    "train_images": "train-images-idx3-ubyte.gz",
    "train_labels": "train-labels-idx1-ubyte.gz",
    "test_images": "t10k-images-idx3-ubyte.gz",
    "test_labels": "t10k-labels-idx1-ubyte.gz",
}
N_TRAIN, N_TEST = 12_000, 2_000

root = Path(__file__).resolve().parent.parent
cache = root / "scripts" / ".cache"
out = root / "public" / "mnist"


def fetch(name: str) -> bytes:
    path = cache / name
    if not path.exists():
        cache.mkdir(parents=True, exist_ok=True)
        print(f"downloading {name}")
        urllib.request.urlretrieve(MIRROR + name, path)
    return gzip.decompress(path.read_bytes())


def idx_images(raw: bytes) -> bytes:
    magic, n, rows, cols = struct.unpack(">IIII", raw[:16])
    assert magic == 2051 and rows == cols == 28, "not an IDX image file"
    return raw[16:]


def idx_labels(raw: bytes) -> bytes:
    magic, n = struct.unpack(">II", raw[:8])
    assert magic == 2049, "not an IDX label file"
    return raw[8:]


def write(split: str, n: int) -> None:
    images = idx_images(fetch(FILES[f"{split}_images"]))[: n * 784]
    labels = idx_labels(fetch(FILES[f"{split}_labels"]))[:n]
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{split}.bin").write_bytes(images + labels)
    print(f"wrote {split}.bin: {n} samples, {len(images) + len(labels):,} bytes")


write("train", N_TRAIN)
write("test", N_TEST)
