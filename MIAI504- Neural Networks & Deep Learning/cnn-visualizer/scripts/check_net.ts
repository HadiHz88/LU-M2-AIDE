// Gradient check and a quick training run for src/nn/net.ts.
//   node scripts/check_net.ts
import { readFileSync } from "node:fs";
import { forward, backward, initParams, newTrace, cloneParams, zeroParams, addGrads, zeroGrads, sgdStep, predict, type Params } from "../src/nn/net.ts";

function load(name: string) {
  const buf = new Uint8Array(readFileSync(new URL(`../public/mnist/${name}.bin`, import.meta.url)));
  const n = buf.length / 785;
  return { n, img: buf.subarray(0, n * 784), lab: buf.subarray(n * 784) };
}
const train = load("train");
const test = load("test");
const setSample = (t: ReturnType<typeof newTrace>, d: typeof train, i: number) => {
  for (let q = 0; q < 784; q++) t.x[q] = d.img[i * 784 + q] / 255;
  t.label = d.lab[i];
};

// 1. numerical gradient check on a few weights of every tensor.
// Biases start at 0, which puts every blank background pixel exactly on ReLU's kink (conv = 0),
// where the derivative is undefined. Shift them off zero so the check measures backprop, not the kink.
const p = initParams(7);
p.kb.set([0.13, -0.21, 0.07, 0.31, -0.05, 0.18]);
p.b1.forEach((_, i) => (p.b1[i] = 0.05 * (i % 3)));
const t = newTrace();
setSample(t, train, 3);
forward(p, t);
backward(p, t);
let worst = 0;
for (const key of ["k", "kb", "w1", "b1", "w2", "b2"] as (keyof Params)[]) {
  for (let n = 0; n < 6; n++) {
    const i = Math.floor((n / 6) * p[key].length + (key === "w1" ? 5000 : 0)) % p[key].length;
    const q = cloneParams(p);
    const e = 1e-4;
    q[key][i] += e; forward(q, t); const lp = t.loss;
    q[key][i] -= 2 * e; forward(q, t); const lm = t.loss;
    const num = (lp - lm) / (2 * e);
    const ana = t.g[key][i];
    const rel = Math.abs(num - ana) / Math.max(1e-6, Math.abs(num) + Math.abs(ana));
    if (Math.abs(num) > 1e-5) worst = Math.max(worst, rel);
  }
}
console.log("gradient check, worst relative error:", worst.toExponential(2), "(float32 maths, so a few 1e-2 is a pass; a real bug shows up near 1)");

// 2. one epoch of mini-batch SGD
for (const [lr, batch] of [[0.1, 16]] as const) {
  const params = initParams(1);
  const acc = zeroParams();
  const t0 = performance.now();
  let lossSum = 0;
  for (let i = 0; i < train.n; i++) {
    setSample(t, train, i);
    forward(params, t); backward(params, t);
    lossSum += t.loss;
    addGrads(acc, t.g);
    if ((i + 1) % batch === 0) { sgdStep(params, acc, lr, batch); zeroGrads(acc); }
    if ((i + 1) % 3000 === 0) { console.log(`  lr ${lr} after ${i + 1}: loss ${(lossSum / 3000).toFixed(3)}`); lossSum = 0; }
  }
  const ms = performance.now() - t0;
  let correct = 0;
  for (let i = 0; i < test.n; i++) { setSample(t, test, i); forward(params, t); if (predict(t) === t.label) correct++; }
  console.log(`lr ${lr}, batch ${batch}: test acc ${(100 * correct / test.n).toFixed(1)}%, ${(ms / train.n * 1000).toFixed(0)} µs/sample`);
}
