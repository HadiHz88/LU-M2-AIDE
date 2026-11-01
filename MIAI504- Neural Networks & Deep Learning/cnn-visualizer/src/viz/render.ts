// Draws the whole network for a given animation stage.
// Everything is already computed in the trace; `stage` only decides how much of it to reveal.

import { C, CC, F, FLAT, H, K, O, P, PP, S, type Params, type Trace } from "../nn/net.ts";
import { PH } from "../engine.ts";
import { COLORS, DIV, GRAY, SEQ, divI, gradI, lutColor, seqI, signColor } from "./colors.ts";
import {
  CONV, DELTA, HGT, HID, IN, KER, OUT, POOL, PROB, W, convY, dKernelY, hidY, kernelY, outY, poolY, rowY,
} from "./layout.ts";

export type Scene = {
  p: Params; // weights to draw (they slide to their new values during "update")
  t: Trace;
  stage: number;
  filter: number; // selected filter
  hidden: number; // selected hidden neuron
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (v: number) => (v < 0.5 ? 2 * v * v : 1 - (-2 * v + 2) ** 2 / 2);

function maxAbs(a: ArrayLike<number>, from = 0, to = a.length) {
  let m = 0;
  for (let i = from; i < to; i++) {
    const v = Math.abs(a[i]);
    if (v > m) m = v;
  }
  return m;
}

// ---------- heatmaps through a reusable offscreen canvas ----------

const scratch = new Map<number, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData }>();

function getScratch(w: number, h: number) {
  const key = w * 1000 + h;
  let s = scratch.get(key);
  if (!s) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    s = { canvas, ctx, img: ctx.createImageData(w, h) };
    scratch.set(key, s);
  }
  return s;
}

// `index(q)` returns a LUT index for pixel q, or −1 for "not computed yet"
function heat(
  ctx: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, cell: number,
  lut: Uint8ClampedArray, index: (q: number) => number,
) {
  const s = getScratch(w, h);
  const d = s.img.data;
  for (let q = 0; q < w * h; q++) {
    const i = index(q);
    if (i < 0) {
      d[q * 4] = 21; d[q * 4 + 1] = 27; d[q * 4 + 2] = 35;
    } else {
      d[q * 4] = lut[i * 3]; d[q * 4 + 1] = lut[i * 3 + 1]; d[q * 4 + 2] = lut[i * 3 + 2];
    }
    d[q * 4 + 3] = 255;
  }
  s.ctx.putImageData(s.img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(s.canvas, x, y, w * cell, h * cell);
}

function frame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color = COLORS.line, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color = COLORS.muted, size = 12, align: CanvasTextAlign = "left", weight = 400) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "JetBrains Mono", ui-monospace, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(s, x, y);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, width: number, alpha: number) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- the scene ----------

export function render(ctx: CanvasRenderingContext2D, sc: Scene) {
  const { p, t, stage: s } = sc;
  const prog = (i: number) => clamp01(s - i);
  const during = (i: number) => s >= i && s < i + 1;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, HGT);

  // column titles switch to gradient names once the backward pass reaches them
  const bwd = s >= PH.loss;
  text(ctx, "INPUT 28×28", IN.x, 26);
  text(ctx, s >= PH.bconv ? "K, ∂K" : "K 3×3", KER.x - 6, 26);
  text(ctx, s >= PH.brelu + 1 ? "∂E/∂conv" : s >= PH.bpool ? "∂E/∂relu" : s >= PH.relu ? "CONV → RELU 26×26" : "CONV 26×26", CONV.x, 26, s >= PH.bpool ? COLORS.text : COLORS.muted);
  text(ctx, s >= PH.bdense1 ? "∂E/∂pool" : "MAX POOL 13×13", POOL.x, 26, s >= PH.bdense1 ? COLORS.text : COLORS.muted);
  text(ctx, bwd && s >= PH.bdense2 ? "HIDDEN 16 · δ ring" : "HIDDEN 16 · ReLU", HID.x, 26, COLORS.muted, 12, "center");
  text(ctx, "OUTPUT", OUT.x, 26, COLORS.muted, 12, "center");
  text(ctx, "p", PROB.x, 26);
  if (s > PH.loss) text(ctx, "δ = p − t", DELTA.x, 26, COLORS.text, 12, "center");

  // ----- dense edges (drawn first, behind the neurons) -----

  // map f → hidden j. Forward: how much map f adds to neuron j. Backward: how much of δ_j flows back into map f.
  if (s >= PH.dense1) {
    const back = s >= PH.bdense1;
    const val = new Float32Array(F * H);
    for (let j = 0; j < H; j++) {
      const row = j * FLAT;
      for (let f = 0; f < F; f++) {
        let sum = 0;
        for (let q = 0; q < PP; q++) {
          const i = f * PP + q;
          sum += p.w1[row + i] * (back ? t.dhPre[j] : t.pool[i]);
        }
        val[f * H + j] = sum;
      }
    }
    const m = maxAbs(val);
    const moving = back ? during(PH.bdense1) : during(PH.dense1);
    const pr = ease(back ? prog(PH.bdense1) : prog(PH.dense1));
    for (let f = 0; f < F; f++) {
      const x1 = POOL.x + POOL.size + 2;
      const y1 = rowY(f);
      for (let j = 0; j < H; j++) {
        const v = val[f * H + j];
        const n = m > 0 ? Math.abs(v) / m : 0;
        const x2 = HID.x - HID.r - 2;
        const y2 = hidY(j);
        line(ctx, x1, y1, x2, y2, signColor(v), 0.4 + 2.4 * n, 0.08 + 0.5 * n);
        if (moving && n > 0.04) {
          const a = back ? 1 - pr : pr;
          dot(ctx, x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, 1.2 + 3.5 * n, signColor(v));
        }
      }
    }
  }

  // hidden j → output k. Forward: w·h. Backward: δ_k·w.
  if (s >= PH.dense2) {
    const back = s >= PH.bdense2;
    const val = new Float32Array(O * H);
    for (let k = 0; k < O; k++) {
      for (let j = 0; j < H; j++) val[k * H + j] = p.w2[k * H + j] * (back ? t.dz[k] : t.h[j]);
    }
    const m = maxAbs(val);
    const moving = back ? during(PH.bdense2) : during(PH.dense2);
    const pr = ease(back ? prog(PH.bdense2) : prog(PH.dense2));
    for (let j = 0; j < H; j++) {
      for (let k = 0; k < O; k++) {
        const v = val[k * H + j];
        const n = m > 0 ? Math.abs(v) / m : 0;
        const x1 = HID.x + HID.r + 2;
        const y1 = hidY(j);
        const x2 = OUT.x - OUT.r - 2;
        const y2 = outY(k);
        line(ctx, x1, y1, x2, y2, signColor(v), 0.4 + 2.4 * n, 0.08 + 0.55 * n);
        if (moving && n > 0.04) {
          const a = back ? 1 - pr : pr;
          dot(ctx, x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, 1.2 + 3.5 * n, signColor(v));
        }
      }
    }
  }

  // ----- input -----

  heat(ctx, S, S, IN.x, IN.y, IN.cell, GRAY, (q) => Math.round(t.x[q] * 255));
  frame(ctx, IN.x, IN.y, IN.size, IN.size);
  text(ctx, `target: ${t.label}`, IN.x, IN.y + IN.size + 18, COLORS.text);

  // legend
  const ly = 560;
  text(ctx, "COLOUR KEY", IN.x, ly);
  ctx.fillStyle = COLORS.pos; ctx.fillRect(IN.x, ly + 14, 12, 12);
  text(ctx, "positive", IN.x + 18, ly + 20);
  ctx.fillStyle = COLORS.neg; ctx.fillRect(IN.x, ly + 34, 12, 12);
  text(ctx, "negative", IN.x + 18, ly + 40);
  ctx.fillStyle = COLORS.accent; ctx.fillRect(IN.x, ly + 54, 12, 12);
  text(ctx, "activation", IN.x + 18, ly + 60);
  text(ctx, "line width = |contribution|", IN.x, ly + 84);
  text(ctx, "click a row or neuron", IN.x, ly + 104);
  text(ctx, "to inspect it", IN.x, ly + 120);

  // ----- kernels, and their gradients once the backward pass reaches them -----

  const kMax = maxAbs(p.k);
  const showDK = s >= PH.bconv;
  let dK: Float32Array | null = null;
  let dKMax = 0;
  if (showDK) {
    if (during(PH.bconv)) {
      // accumulate ∂E/∂K only over the positions the window has visited so far
      const count = Math.floor(prog(PH.bconv) * CC);
      dK = new Float32Array(F * 9);
      for (let f = 0; f < F; f++) {
        for (let q = 0; q < count; q++) {
          const g = t.dConv[f * CC + q];
          if (g === 0) continue;
          const r = Math.floor(q / C);
          const c = q % C;
          for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) dK[f * 9 + i * K + j] += g * t.x[(r + i) * S + c + j];
        }
      }
    } else dK = t.g.k;
    dKMax = maxAbs(t.g.k);
  }
  for (let f = 0; f < F; f++) {
    const y = kernelY(f);
    heat(ctx, K, K, KER.x, y, KER.cell, DIV, (q) => divI(p.k[f * 9 + q], kMax));
    frame(ctx, KER.x, y, KER.size, KER.size, f === sc.filter ? COLORS.accent : COLORS.line, f === sc.filter ? 2 : 1);
    text(ctx, `K${f + 1}`, KER.x - 6, y + KER.size / 2, f === sc.filter ? COLORS.accent : COLORS.muted, 10, "right");
    if (dK) {
      const g = dK;
      const yd = dKernelY(f);
      heat(ctx, K, K, KER.x, yd, KER.cell, DIV, (q) => divI(g[f * 9 + q], dKMax));
      frame(ctx, KER.x, yd, KER.size, KER.size, COLORS.line);
      text(ctx, "∂", KER.x - 6, yd + KER.size / 2, COLORS.muted, 10, "right");
    }
  }

  // ----- conv feature maps -----

  const convMax = maxAbs(t.conv);
  const reluMax = maxAbs(t.relu);
  const dReluMax = maxAbs(t.dRelu);
  const dConvMax = maxAbs(t.dConv);
  for (let f = 0; f < F; f++) {
    const o = f * CC;
    const y = convY(f);
    let index: (q: number) => number;
    if (s < PH.conv) index = () => -1;
    else if (during(PH.conv)) {
      const count = Math.floor(prog(PH.conv) * CC);
      index = (q) => (q < count ? divI(t.conv[o + q], convMax) : -1);
    } else if (during(PH.relu)) {
      const rows = prog(PH.relu) * C;
      index = (q) => (Math.floor(q / C) < rows ? seqI(t.relu[o + q], reluMax) : divI(t.conv[o + q], convMax));
    } else if (s < PH.bpool) index = (q) => seqI(t.relu[o + q], reluMax);
    else if (during(PH.bpool)) {
      const blocks = Math.floor(prog(PH.bpool) * PP);
      index = (q) => {
        const b = Math.floor(Math.floor(q / C) / 2) * P + Math.floor((q % C) / 2);
        return b < blocks ? gradI(t.dRelu[o + q], dReluMax) : -1;
      };
    } else if (during(PH.brelu)) {
      const rows = prog(PH.brelu) * C;
      index = (q) => (Math.floor(q / C) < rows ? gradI(t.dConv[o + q], dConvMax) : gradI(t.dRelu[o + q], dReluMax));
    } else index = (q) => gradI(t.dConv[o + q], dConvMax);
    heat(ctx, C, C, CONV.x, y, CONV.cell, s >= PH.bpool || during(PH.conv) ? DIV : SEQ, index);
    // ReLU wipe mixes two palettes, so redraw the not-yet-wiped rows with the signed one
    if (during(PH.relu)) {
      const rows = Math.ceil(prog(PH.relu) * C);
      ctx.save();
      ctx.beginPath();
      ctx.rect(CONV.x, y + rows * CONV.cell, CONV.size, CONV.size - rows * CONV.cell);
      ctx.clip();
      heat(ctx, C, C, CONV.x, y, CONV.cell, DIV, (q) => divI(t.conv[o + q], convMax));
      ctx.restore();
    }
    frame(ctx, CONV.x, y, CONV.size, CONV.size, f === sc.filter ? COLORS.accent : COLORS.line, f === sc.filter ? 2 : 1);
  }

  // ----- pooled maps -----

  const poolMax = maxAbs(t.pool);
  const dPoolMax = maxAbs(t.dPool);
  for (let f = 0; f < F; f++) {
    const o = f * PP;
    const y = poolY(f);
    let index: (q: number) => number;
    let lut = SEQ;
    if (s < PH.pool) index = () => -1;
    else if (during(PH.pool)) {
      const count = Math.floor(prog(PH.pool) * PP);
      index = (q) => (q < count ? seqI(t.pool[o + q], poolMax) : -1);
    } else if (s < PH.bdense1) index = (q) => seqI(t.pool[o + q], poolMax);
    else {
      lut = DIV;
      const rows = during(PH.bdense1) ? prog(PH.bdense1) * P : P;
      index = (q) => (Math.floor(q / P) < rows ? gradI(t.dPool[o + q], dPoolMax) : 128);
    }
    heat(ctx, P, P, POOL.x, y, POOL.cell, lut, index);
    frame(ctx, POOL.x, y, POOL.size, POOL.size, f === sc.filter ? COLORS.accent : COLORS.line, f === sc.filter ? 2 : 1);
  }

  // ----- sliding windows -----

  // convolution (forward) and kernel gradient (backward): the 3×3 window, the kernel it meets, and the pixel it produces
  if (during(PH.conv) || during(PH.bconv)) {
    const pr = during(PH.conv) ? prog(PH.conv) : prog(PH.bconv);
    const q = Math.min(CC - 1, Math.floor(pr * CC));
    const r = Math.floor(q / C);
    const c = q % C;
    const wx = IN.x + c * IN.cell;
    const wy = IN.y + r * IN.cell;
    for (let f = 0; f < F; f++) {
      const strong = f === sc.filter;
      const ky = (during(PH.bconv) ? dKernelY(f) : kernelY(f)) + KER.size / 2;
      const px = CONV.x + (c + 0.5) * CONV.cell;
      const py = convY(f) + (r + 0.5) * CONV.cell;
      if (during(PH.conv)) {
        line(ctx, wx + IN.cell * 3, wy + IN.cell * 1.5, KER.x, ky, COLORS.accent, strong ? 1.4 : 0.8, strong ? 0.8 : 0.3);
        line(ctx, KER.x + KER.size, ky, px, py, COLORS.accent, strong ? 1.4 : 0.8, strong ? 0.8 : 0.3);
      } else {
        // backward: the gradient at the pixel, times the input patch, adds into ∂E/∂K
        line(ctx, px, py, KER.x + KER.size, ky, COLORS.pos, strong ? 1.4 : 0.8, strong ? 0.8 : 0.3);
        line(ctx, wx + IN.cell * 3, wy + IN.cell * 1.5, KER.x, ky, COLORS.pos, strong ? 1.4 : 0.8, strong ? 0.6 : 0.2);
      }
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 1;
      ctx.strokeRect(px - CONV.cell / 2 - 1, py - CONV.cell / 2 - 1, CONV.cell + 2, CONV.cell + 2);
    }
    ctx.strokeStyle = during(PH.conv) ? COLORS.accent : COLORS.pos;
    ctx.lineWidth = 2;
    ctx.strokeRect(wx, wy, IN.cell * 3, IN.cell * 3);
  }

  // pooling (forward) and un-pooling (backward): the 2×2 block and the winner inside it
  if (during(PH.pool) || during(PH.bpool)) {
    const pr = during(PH.pool) ? prog(PH.pool) : prog(PH.bpool);
    const b = Math.min(PP - 1, Math.floor(pr * PP));
    const r = Math.floor(b / P);
    const c = b % P;
    for (let f = 0; f < F; f++) {
      const bx = CONV.x + 2 * c * CONV.cell;
      const by = convY(f) + 2 * r * CONV.cell;
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx, by, 2 * CONV.cell, 2 * CONV.cell);
      const win = t.arg[f * PP + b];
      const wx = CONV.x + (win % C) * CONV.cell;
      const wy = convY(f) + Math.floor(win / C) * CONV.cell;
      ctx.fillStyle = during(PH.pool) ? COLORS.accent : COLORS.pos;
      ctx.fillRect(wx, wy, CONV.cell, CONV.cell);
      const px = POOL.x + (c + 0.5) * POOL.cell;
      const py = poolY(f) + (r + 0.5) * POOL.cell;
      line(ctx, bx + 2 * CONV.cell, by + CONV.cell, px, py, during(PH.pool) ? COLORS.accent : COLORS.pos, 1, f === sc.filter ? 0.9 : 0.35);
      ctx.strokeStyle = COLORS.text;
      ctx.strokeRect(px - POOL.cell / 2, py - POOL.cell / 2, POOL.cell, POOL.cell);
    }
  }

  // ----- hidden neurons -----

  const hMax = maxAbs(t.h);
  const dhMax = maxAbs(t.dhPre);
  const hReveal = s >= PH.dense1 + 1 ? 1 : during(PH.dense1) ? clamp01((prog(PH.dense1) - 0.6) / 0.4) : 0;
  const dhReveal = s >= PH.bdense2 + 1 ? 1 : during(PH.bdense2) ? clamp01((prog(PH.bdense2) - 0.6) / 0.4) : 0;
  for (let j = 0; j < H; j++) {
    const y = hidY(j);
    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.arc(HID.x, y, HID.r, 0, Math.PI * 2);
    ctx.fill();
    if (hReveal > 0) dot(ctx, HID.x, y, HID.r, lutColor(SEQ, seqI(t.h[j], hMax), hReveal));
    ctx.strokeStyle = j === sc.hidden ? COLORS.accent : COLORS.line;
    ctx.lineWidth = j === sc.hidden ? 2 : 1;
    ctx.stroke();
    if (dhReveal > 0 && t.dhPre[j] !== 0) {
      ctx.globalAlpha = dhReveal;
      ctx.strokeStyle = signColor(t.dhPre[j]);
      ctx.lineWidth = 1 + 4 * Math.sqrt(Math.abs(t.dhPre[j]) / (dhMax || 1));
      ctx.beginPath();
      ctx.arc(HID.x, y, HID.r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ----- outputs -----

  const pReveal = s >= PH.softmax + 1 ? 1 : during(PH.softmax) ? ease(prog(PH.softmax)) : 0;
  const dReveal = s >= PH.loss + 1 ? 1 : during(PH.loss) ? ease(prog(PH.loss)) : 0;
  let best = 0;
  for (let k = 1; k < O; k++) if (t.p[k] > t.p[best]) best = k;
  for (let k = 0; k < O; k++) {
    const y = outY(k);
    dot(ctx, OUT.x, y, OUT.r, COLORS.panel);
    if (pReveal > 0) dot(ctx, OUT.x, y, OUT.r, lutColor(SEQ, seqI(t.p[k], 1), pReveal));
    ctx.beginPath();
    ctx.arc(OUT.x, y, OUT.r, 0, Math.PI * 2);
    ctx.strokeStyle = pReveal === 1 && k === best ? COLORS.accent : COLORS.line;
    ctx.lineWidth = pReveal === 1 && k === best ? 2.5 : 1;
    ctx.stroke();
    if (s >= PH.loss && k === t.label) {
      ctx.strokeStyle = COLORS.ok;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(OUT.x, y, OUT.r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    text(ctx, String(k), OUT.x, y + 1, pReveal * t.p[k] > 0.55 ? COLORS.bg : COLORS.text, 14, "center", 600);

    // probability bar
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(PROB.x, y - 7, PROB.w, 14);
    if (pReveal > 0) {
      ctx.fillStyle = k === best ? COLORS.accent : "#8a5a2e";
      ctx.fillRect(PROB.x, y - 7, PROB.w * t.p[k] * pReveal, 14);
      text(ctx, `${(t.p[k] * 100).toFixed(t.p[k] < 0.1 ? 1 : 0)}%`, PROB.x + PROB.w + 6, y, COLORS.muted, 11);
    }

    // δ = p − t, centred on zero
    if (dReveal > 0) {
      const d = t.dz[k];
      ctx.fillStyle = COLORS.line;
      ctx.fillRect(DELTA.x - 0.5, y - 9, 1, 18);
      ctx.fillStyle = signColor(d);
      const w = DELTA.half * d * dReveal;
      ctx.fillRect(w >= 0 ? DELTA.x : DELTA.x + w, y - 5, Math.abs(w), 10);
      text(ctx, d.toFixed(2), DELTA.x + (d >= 0 ? -6 : 6), y, COLORS.muted, 10, d >= 0 ? "right" : "left");
    }
  }
}
