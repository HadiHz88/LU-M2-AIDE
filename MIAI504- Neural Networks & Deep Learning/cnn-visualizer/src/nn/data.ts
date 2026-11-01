// Loads the MNIST subset written by scripts/prepare_mnist.py:
// n images of 784 bytes, then n labels of 1 byte.

export type Dataset = { n: number; images: Uint8Array; labels: Uint8Array };

export async function loadSplit(name: "train" | "test"): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}mnist/${name}.bin`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const n = buf.length / 785;
  // a missing file comes back as Vite's index.html, which won't divide evenly
  if (!res.ok || !Number.isInteger(n) || n === 0) {
    throw new Error(`public/mnist/${name}.bin is missing. Run \`npm run data\` first.`);
  }
  return { n, images: buf.subarray(0, n * 784), labels: buf.subarray(n * 784) };
}

// Writes image i into x (scaled to 0..1) and returns its label.
export function fillInput(d: Dataset, i: number, x: Float32Array): number {
  const off = i * 784;
  for (let q = 0; q < 784; q++) x[q] = d.images[off + q] / 255;
  return d.labels[i];
}
