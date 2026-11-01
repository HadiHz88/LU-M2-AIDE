// The live arithmetic behind whatever the canvas is animating right now.

import type { ReactNode } from "react";
import { C, CC, F, FLAT, H, K, O, P, PP, S } from "../nn/net.ts";
import { PHASES, type Engine } from "../engine.ts";
import { useEngine } from "./useEngine.ts";

function Mat({ values, cols, digits = 2, label }: { values: ArrayLike<number>; cols: number; digits?: number; label?: string }) {
  const arr = Array.from(values);
  const m = Math.max(1e-9, ...arr.map(Math.abs));
  return (
    <figure className="mat">
      <div className="cells" style={{ gridTemplateColumns: `repeat(${cols}, auto)` }}>
        {arr.map((v, i) => {
          const a = Math.min(1, Math.abs(v) / m) * 0.55;
          const bg = v >= 0 ? `rgba(106,166,248,${a})` : `rgba(242,123,163,${a})`;
          return <span key={i} style={{ background: bg }}>{v.toFixed(digits)}</span>;
        })}
      </div>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  );
}

const n = (v: number, d = 3) => v.toFixed(d);
const patchAt = (x: Float32Array, r: number, c: number) => {
  const out: number[] = [];
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) out.push(x[(r + i) * S + c + j]);
  return out;
};

export function Detail({ engine: e }: { engine: Engine }) {
  useEngine(e);
  if (e.status !== "ready") return null;
  const t = e.trace;
  const f = e.selectedFilter;
  const j = e.selectedHidden;

  if (e.mode === "train") {
    return (
      <section className="card detail">
        <h3>What one training frame does</h3>
        <p>
          For each of the <b>{e.perFrame}</b> samples in a frame: run the forward pass, compute δ = p − t at the output,
          backpropagate it to every weight, and add those gradients up. Every <b>{e.batch}</b> samples, the summed gradient is
          averaged and the weights move: <code>w ← w − {e.lr}·∂E/∂w</code>.
        </p>
        <p>
          The canvas shows the last sample of the frame (target <b>{t.label}</b>, loss {n(t.loss)}).
          Switch to <b>Gradients</b> to see where its error lands, and watch the kernels on the left sharpen into edge detectors.
        </p>
      </section>
    );
  }

  const idx = e.phaseIndex;
  const ph = PHASES[idx];
  const pr = e.phaseProgress;
  let body: ReactNode = null;

  switch (ph.id) {
    case "input":
      body = (
        <p>
          The digit is 784 numbers between 0 (black) and 1 (white), here a <b>{t.label}</b>
          {e.source === "drawn" ? " (your drawing; pick its target below the draw pad)" : " from the MNIST test set"}.
        </p>
      );
      break;

    case "conv": {
      const q = Math.min(CC - 1, Math.floor(pr * CC));
      const r = Math.floor(q / C);
      const c = q % C;
      const patch = patchAt(t.x, r, c);
      const k = Array.from(e.shown.k.subarray(f * 9, f * 9 + 9));
      const sum = patch.reduce((s, v, i) => s + v * k[i], 0);
      body = (
        <>
          <p>Each kernel slides over the image. At every position it multiplies the 3×3 patch it covers by its own 9 weights and adds them up: one output pixel. All 676 positions reuse the same 9 weights.</p>
          <div className="eqrow">
            <Mat values={patch} cols={3} label={`patch at (${r}, ${c})`} />
            <span className="op">⊙</span>
            <Mat values={k} cols={3} label={`K${f + 1}`} />
            <span className="op">→</span>
            <div className="res">
              Σ = {n(sum)}<br />+ b = {n(e.shown.kb[f])}<br /><b>z = {n(t.conv[f * CC + q])}</b>
            </div>
          </div>
        </>
      );
      break;
    }

    case "relu": {
      let neg = 0;
      for (let i = 0; i < F * CC; i++) if (t.conv[i] <= 0) neg++;
      body = (
        <p>
          ReLU keeps positive values and sets everything else to 0: <code>max(0, z)</code>. Here {neg.toLocaleString()} of {(F * CC).toLocaleString()} values
          ({Math.round((neg / (F * CC)) * 100)}%) become 0. The signed blue/rose map turns into an amber activation map.
        </p>
      );
      break;
    }

    case "pool": {
      const b = Math.min(PP - 1, Math.floor(pr * PP));
      const r = Math.floor(b / P);
      const c = b % P;
      const vals = [0, 1, C, C + 1].map((d) => t.relu[f * CC + 2 * r * C + 2 * c + d]);
      body = (
        <>
          <p>Max pooling keeps the largest value in each 2×2 block, halving the size to 13×13. It has no weights. It remembers which pixel won, because backprop will need it.</p>
          <div className="eqrow">
            <Mat values={vals} cols={2} label={`K${f + 1}, block (${r}, ${c})`} />
            <span className="op">→ max →</span>
            <div className="res"><b>{n(t.pool[f * PP + b])}</b></div>
          </div>
        </>
      );
      break;
    }

    case "dense1": {
      const per = Array.from({ length: F }, (_, m) => {
        let s = 0;
        for (let q = 0; q < PP; q++) s += e.shown.w1[j * FLAT + m * PP + q] * t.pool[m * PP + q];
        return s;
      });
      body = (
        <>
          <p>The 6 pooled maps are flattened into 1,014 numbers. Each hidden neuron has its own 1,014 weights: <code>h = ReLU(Σ w·x + b)</code>. Each line is how much one map contributed to one neuron. Showing hidden neuron <b>{j + 1}</b> (click another).</p>
          <div className="eqrow">
            <Mat values={per} cols={6} label="contribution of each map" />
            <div className="res">+ b = {n(e.shown.b1[j])}<br />z = {n(t.hPre[j])}<br /><b>h = {n(t.h[j])}</b>{t.hPre[j] <= 0 && <><br /><span className="muted">(ReLU: inactive)</span></>}</div>
          </div>
        </>
      );
      break;
    }

    case "dense2":
    case "softmax":
      body = (
        <>
          <p>
            {ph.id === "dense2"
              ? "Each output neuron sums the 16 hidden values times its weights: the logits z."
              : "Softmax turns the logits into probabilities: pₖ = e^zₖ / Σ e^z. They are all positive and add up to 1."}
          </p>
          <div className="eqrow">
            <Mat values={t.z} cols={O} label="logits z, digits 0–9" />
          </div>
          {ph.id === "softmax" && <div className="eqrow"><Mat values={t.p} cols={O} digits={3} label="probabilities p" /></div>}
        </>
      );
      break;

    case "loss":
      body = (
        <>
          <p>
            Cross-entropy loss: <code>E = −ln p[{t.label}] = −ln {n(t.p[t.label])} = {n(t.loss)}</code>. With softmax, the output error is simply{" "}
            <code>δ = p − t</code>: negative on the target (push it up), positive on the others (push them down).
          </p>
          <div className="eqrow"><Mat values={t.dz} cols={O} label="δ at the output, digits 0–9" /></div>
        </>
      );
      break;

    case "bdense2": {
      const terms = Array.from({ length: O }, (_, k) => t.dz[k] * e.shown.w2[k * H + j]);
      body = (
        <>
          <p>Each hidden neuron collects the error of every output it feeds: <code>∂E/∂hⱼ = Σₖ δₖ·wₖⱼ</code>, then multiplies by ReLU′ (1 if it was active, else 0). The ring shows the result. Weight gradients: <code>∂E/∂wₖⱼ = δₖ·hⱼ</code>.</p>
          <div className="eqrow">
            <Mat values={terms} cols={O} label={`δₖ·wₖⱼ for hidden ${j + 1}`} />
            <div className="res">Σ = {n(t.dh[j])}<br />× ReLU′ = {t.hPre[j] > 0 ? 1 : 0}<br /><b>δ = {n(t.dhPre[j])}</b></div>
          </div>
        </>
      );
      break;
    }

    case "bdense1": {
      let nz = 0;
      for (let i = 0; i < H; i++) if (t.dhPre[i] !== 0) nz++;
      body = (
        <p>
          The 16 hidden δ flow back through the 16,224 weights: <code>∂E/∂poolᵢ = Σⱼ δⱼ·wⱼᵢ</code>. Only {nz} of 16 hidden neurons were active, so only they pass error back.
          Weight gradients here are <code>∂E/∂wⱼᵢ = δⱼ·poolᵢ</code>. The pooled maps now show where the error landed (blue: increasing this pixel increases the loss).
        </p>
      );
      break;
    }

    case "bpool": {
      const b = Math.min(PP - 1, Math.floor(pr * PP));
      const r = Math.floor(b / P);
      const c = b % P;
      const win = t.arg[f * PP + b];
      body = (
        <p>
          Max pooling has no weights, so it just routes the gradient: each pooled pixel's gradient goes back to the one pixel that won its 2×2 block,
          and the other three get 0. Block ({r}, {c}) of K{f + 1}: gradient <b>{n(t.dPool[f * PP + b], 4)}</b> goes to pixel ({Math.floor(win / C)}, {win % C}). That is why the map is sparse.
        </p>
      );
      break;
    }

    case "brelu": {
      let blocked = 0;
      for (let i = 0; i < F * CC; i++) if (t.dRelu[i] !== 0 && t.conv[i] <= 0) blocked++;
      body = (
        <p>
          ReLU′ is 1 where the conv output was positive and 0 elsewhere, so gradient only passes where the neuron fired.
          {blocked > 0 ? ` ${blocked} routed values are blocked here.` : " No routed value is blocked this time (max pooling already picked active pixels)."}
        </p>
      );
      break;
    }

    case "bconv": {
      const q = Math.min(CC - 1, Math.floor(pr * CC));
      const r = Math.floor(q / C);
      const c = q % C;
      const g = t.dConv[f * CC + q];
      const patch = patchAt(t.x, r, c);
      const run = new Array(9).fill(0);
      for (let s = 0; s <= q; s++) {
        const gs = t.dConv[f * CC + s];
        if (gs === 0) continue;
        const pp = patchAt(t.x, Math.floor(s / C), s % C);
        for (let i = 0; i < 9; i++) run[i] += gs * pp[i];
      }
      body = (
        <>
          <p>A kernel weight is used at all 676 positions, so its gradient is the sum over them: <code>∂E/∂K += ∂E/∂z(r,c) × patch(r,c)</code>. The window slides again, adding up.</p>
          <div className="eqrow">
            <div className="res">∂E/∂z = <b>{n(g, 4)}</b></div>
            <span className="op">×</span>
            <Mat values={patch} cols={3} label={`patch at (${r}, ${c})`} />
            <span className="op">⇒</span>
            <Mat values={run} cols={3} digits={3} label={`∂E/∂K${f + 1} so far`} />
          </div>
        </>
      );
      break;
    }

    case "update": {
      const sl = (a: Float32Array) => a.subarray(f * 9, f * 9 + 9);
      body = (
        <>
          <p>Every weight takes one step downhill: <code>w ← w − η·∂E/∂w</code> with η = {e.stepLr}. Watch the kernels and line colours shift.</p>
          <div className="eqrow">
            <Mat values={sl(e.params.k)} cols={3} digits={3} label={`K${f + 1} before`} />
            <span className="op">− {e.stepLr} ×</span>
            <Mat values={sl(t.g.k)} cols={3} digits={3} label="∂E/∂K" />
            <span className="op">=</span>
            <Mat values={sl(e.next.k)} cols={3} digits={3} label="after" />
          </div>
        </>
      );
      break;
    }
  }

  return (
    <section className="card detail">
      <h3>
        <span className={`dir ${ph.dir}`}>{ph.dir === "fwd" ? "forward" : "backward"}</span> {ph.label}
      </h3>
      {body}
    </section>
  );
}
