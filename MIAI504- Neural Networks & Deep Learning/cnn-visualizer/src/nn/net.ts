// A tiny CNN, written out by hand so every activation and gradient can be drawn.
//
//   input 28×28  →  conv 3×3, 6 filters  →  26×26×6  →  ReLU  →  max pool 2×2  →  13×13×6
//                →  flatten 1014  →  dense 16 (ReLU)  →  dense 10  →  softmax
//
// 60 + 6 + 16,224 + 16 + 160 + 10 = 16,476 parameters.

export const S = 28; // input side
export const K = 3; // kernel side
export const F = 6; // number of filters
export const C = S - K + 1; // conv output side: 26
export const P = C / 2; // pooled side: 13
export const CC = C * C; // 676 pixels per feature map
export const PP = P * P; // 169 pixels per pooled map
export const FLAT = F * PP; // 1014
export const H = 16; // hidden neurons
export const O = 10; // classes

export type Params = {
  k: Float32Array; // F×3×3 kernels
  kb: Float32Array; // F conv biases
  w1: Float32Array; // H×FLAT, row j holds the weights into hidden neuron j
  b1: Float32Array; // H
  w2: Float32Array; // O×H
  b2: Float32Array; // O
};

// Gradients have exactly the same shapes as the parameters.
export type Grads = Params;

export type Trace = {
  x: Float32Array; // input, 0..1
  label: number;
  conv: Float32Array; // F×26×26, before ReLU
  relu: Float32Array; // F×26×26
  pool: Float32Array; // F×13×13
  arg: Int32Array; // for each pooled pixel, which of the 676 pixels in its map was the max
  hPre: Float32Array;
  h: Float32Array;
  z: Float32Array; // logits
  p: Float32Array; // softmax probabilities
  loss: number;
  // backward pass, named after what they are the gradient of
  dz: Float32Array; // = p − onehot
  dh: Float32Array;
  dhPre: Float32Array;
  dPool: Float32Array;
  dRelu: Float32Array; // sparse: only the max positions receive gradient
  dConv: Float32Array;
  g: Grads; // this sample's weight gradients
};

export function zeroParams(): Params {
  return {
    k: new Float32Array(F * K * K),
    kb: new Float32Array(F),
    w1: new Float32Array(H * FLAT),
    b1: new Float32Array(H),
    w2: new Float32Array(O * H),
    b2: new Float32Array(O),
  };
}

export function cloneParams(p: Params): Params {
  return { k: p.k.slice(), kb: p.kb.slice(), w1: p.w1.slice(), b1: p.b1.slice(), w2: p.w2.slice(), b2: p.b2.slice() };
}

const KEYS = ["k", "kb", "w1", "b1", "w2", "b2"] as const;

export function copyParams(from: Params, to: Params): void {
  for (const key of KEYS) to[key].set(from[key]);
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// He initialisation: weights ~ N(0, 2 / fan_in), biases 0.
export function initParams(seed = Date.now()): Params {
  const rand = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
  const p = zeroParams();
  const fill = (a: Float32Array, fanIn: number) => {
    const std = Math.sqrt(2 / fanIn);
    for (let i = 0; i < a.length; i++) a[i] = gauss() * std;
  };
  fill(p.k, K * K);
  fill(p.w1, FLAT);
  fill(p.w2, H);
  return p;
}

export function newTrace(): Trace {
  return {
    x: new Float32Array(S * S),
    label: 0,
    conv: new Float32Array(F * CC),
    relu: new Float32Array(F * CC),
    pool: new Float32Array(FLAT),
    arg: new Int32Array(FLAT),
    hPre: new Float32Array(H),
    h: new Float32Array(H),
    z: new Float32Array(O),
    p: new Float32Array(O),
    loss: 0,
    dz: new Float32Array(O),
    dh: new Float32Array(H),
    dhPre: new Float32Array(H),
    dPool: new Float32Array(FLAT),
    dRelu: new Float32Array(F * CC),
    dConv: new Float32Array(F * CC),
    g: zeroParams(),
  };
}

export function forward(p: Params, t: Trace): void {
  const { x, conv, relu, pool, arg, hPre, h, z, p: prob } = t;

  // convolution: slide each 3×3 kernel over the image, multiply and sum
  for (let f = 0; f < F; f++) {
    for (let r = 0; r < C; r++) {
      for (let c = 0; c < C; c++) {
        let s = p.kb[f];
        for (let i = 0; i < K; i++) {
          for (let j = 0; j < K; j++) s += x[(r + i) * S + c + j] * p.k[f * 9 + i * K + j];
        }
        const o = f * CC + r * C + c;
        conv[o] = s;
        relu[o] = s > 0 ? s : 0;
      }
    }
  }

  // 2×2 max pooling, remembering where each max came from (needed for backprop)
  for (let f = 0; f < F; f++) {
    for (let r = 0; r < P; r++) {
      for (let c = 0; c < P; c++) {
        let best = -Infinity;
        let at = 0;
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++) {
            const q = (2 * r + i) * C + 2 * c + j;
            const v = relu[f * CC + q];
            if (v > best) {
              best = v;
              at = q;
            }
          }
        }
        const o = f * PP + r * P + c;
        pool[o] = best;
        arg[o] = at;
      }
    }
  }

  for (let j = 0; j < H; j++) {
    let s = p.b1[j];
    const row = j * FLAT;
    for (let i = 0; i < FLAT; i++) s += p.w1[row + i] * pool[i];
    hPre[j] = s;
    h[j] = s > 0 ? s : 0;
  }

  let max = -Infinity;
  for (let k = 0; k < O; k++) {
    let s = p.b2[k];
    for (let j = 0; j < H; j++) s += p.w2[k * H + j] * h[j];
    z[k] = s;
    if (s > max) max = s;
  }
  let sum = 0;
  for (let k = 0; k < O; k++) {
    prob[k] = Math.exp(z[k] - max);
    sum += prob[k];
  }
  for (let k = 0; k < O; k++) prob[k] /= sum;
  t.loss = -Math.log(Math.max(prob[t.label], 1e-12));
}

// Fills every gradient in the trace. Call forward first.
export function backward(p: Params, t: Trace): void {
  const { x, conv, pool, arg, hPre, h, dz, dh, dhPre, dPool, dRelu, dConv, g } = t;

  // softmax + cross-entropy: δ = p − t
  for (let k = 0; k < O; k++) dz[k] = t.p[k] - (k === t.label ? 1 : 0);

  for (let k = 0; k < O; k++) {
    g.b2[k] = dz[k];
    for (let j = 0; j < H; j++) g.w2[k * H + j] = dz[k] * h[j];
  }
  for (let j = 0; j < H; j++) {
    let s = 0;
    for (let k = 0; k < O; k++) s += dz[k] * p.w2[k * H + j];
    dh[j] = s;
    dhPre[j] = hPre[j] > 0 ? s : 0;
  }

  dPool.fill(0);
  for (let j = 0; j < H; j++) {
    const d = dhPre[j];
    const row = j * FLAT;
    g.b1[j] = d;
    for (let i = 0; i < FLAT; i++) {
      g.w1[row + i] = d * pool[i];
      dPool[i] += d * p.w1[row + i];
    }
  }

  // max pooling sends each gradient back only to the pixel that won
  dRelu.fill(0);
  for (let f = 0; f < F; f++) {
    for (let q = 0; q < PP; q++) dRelu[f * CC + arg[f * PP + q]] += dPool[f * PP + q];
  }
  for (let i = 0; i < F * CC; i++) dConv[i] = conv[i] > 0 ? dRelu[i] : 0;

  // a kernel weight is shared by all 676 positions, so its gradient is a sum over them
  for (let f = 0; f < F; f++) {
    let bsum = 0;
    for (let i = 0; i < K; i++) {
      for (let j = 0; j < K; j++) {
        let s = 0;
        for (let r = 0; r < C; r++) {
          for (let c = 0; c < C; c++) s += dConv[f * CC + r * C + c] * x[(r + i) * S + c + j];
        }
        g.k[f * 9 + i * K + j] = s;
      }
    }
    for (let q = 0; q < CC; q++) bsum += dConv[f * CC + q];
    g.kb[f] = bsum;
  }
}

export function addGrads(acc: Grads, g: Grads): void {
  for (const key of KEYS) {
    const a = acc[key];
    const b = g[key];
    for (let i = 0; i < a.length; i++) a[i] += b[i];
  }
}

export function zeroGrads(g: Grads): void {
  for (const key of KEYS) g[key].fill(0);
}

// w ← w − η · ∂E/∂w, with the gradient averaged over `n` samples
export function sgdStep(p: Params, g: Grads, lr: number, n = 1): void {
  const s = lr / n;
  for (const key of KEYS) {
    const a = p[key];
    const b = g[key];
    for (let i = 0; i < a.length; i++) a[i] -= s * b[i];
  }
}

export function predict(t: Trace): number {
  let best = 0;
  for (let k = 1; k < O; k++) if (t.p[k] > t.p[best]) best = k;
  return best;
}
