// Owns the network, the current sample and the animation clock.
// React reads it through subscribe/getVersion; the canvas reads it every frame.

import {
  addGrads, backward, copyParams, forward, initParams, newTrace, predict, sgdStep, zeroGrads, zeroParams,
  type Params,
} from "./nn/net.ts";
import { fillInput, loadSplit, type Dataset } from "./nn/data.ts";

export type Phase = { id: string; label: string; dur: number; dir: "fwd" | "bwd" };

// One training step, slowed down. `dur` is milliseconds at 1× speed.
export const PHASES: Phase[] = [
  { id: "input", label: "Input", dur: 600, dir: "fwd" },
  { id: "conv", label: "Convolution", dur: 6000, dir: "fwd" },
  { id: "relu", label: "ReLU", dur: 1400, dir: "fwd" },
  { id: "pool", label: "Max pool", dur: 3000, dir: "fwd" },
  { id: "dense1", label: "Dense 16", dur: 2000, dir: "fwd" },
  { id: "dense2", label: "Dense 10", dur: 1700, dir: "fwd" },
  { id: "softmax", label: "Softmax", dur: 1400, dir: "fwd" },
  { id: "loss", label: "Loss, δ = p − t", dur: 2000, dir: "bwd" },
  { id: "bdense2", label: "δ → hidden", dur: 2200, dir: "bwd" },
  { id: "bdense1", label: "δ → pool", dur: 2200, dir: "bwd" },
  { id: "bpool", label: "Un-pool", dur: 3000, dir: "bwd" },
  { id: "brelu", label: "ReLU′", dur: 1400, dir: "bwd" },
  { id: "bconv", label: "∂E/∂kernel", dur: 6000, dir: "bwd" },
  { id: "update", label: "Update weights", dur: 2400, dir: "bwd" },
];

export const PH = Object.fromEntries(PHASES.map((p, i) => [p.id, i])) as Record<string, number>;
export const END = PHASES.length;

const EVAL_N = 1000; // test digits used for the accuracy curve
const EVAL_PER_FRAME = 100;
const LOSS_WINDOW = 200; // samples averaged into one point of the loss curve

export class Engine {
  params: Params = initParams(42);
  next: Params = zeroParams(); // params after this sample's update (step mode)
  shown: Params = zeroParams(); // what the canvas draws; slides from params to next during "update"
  trace = newTrace();
  private acc = zeroParams();
  private evalTrace = newTrace();

  train: Dataset | null = null;
  test: Dataset | null = null;
  status: "loading" | "ready" | "error" = "loading";
  error = "";

  mode: "step" | "train" = "step";

  // step mode
  stage = 0; // phase index + progress through it, 0 … END
  playing = false;
  speed = 1;
  autoNext = true;
  source: "test" | "drawn" = "test";
  stepLr = 0.1;

  // train mode
  training = false;
  perFrame = 8;
  lr = 0.05; // 0.1 sometimes kills most hidden ReLUs early on, depending on the random start
  batch = 16;
  view: "act" | "grad" = "act";
  seen = 0;
  epoch = 0;
  lossHistory: number[] = [];
  accHistory: { seen: number; acc: number }[] = [];
  lastAcc: number | null = null;
  lastLoss: number | null = null;
  private order = new Uint32Array(0);
  private cursor = 0;
  private inBatch = 0;
  private lossSum = 0;
  private lossCount = 0;
  private evalAt = 0;
  private evalCorrect = 0;

  selectedFilter = 0;
  selectedHidden = 0;

  private listeners = new Set<() => void>();
  private version = 0;
  private lastEmit = 0;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  emit() {
    this.version++;
    this.lastEmit = performance.now();
    this.listeners.forEach((fn) => fn());
  }

  async load() {
    try {
      [this.train, this.test] = await Promise.all([loadSplit("train"), loadSplit("test")]);
      this.status = "ready";
      this.shuffle();
      this.randomTestDigit();
    } catch (e) {
      this.status = "error";
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.emit();
  }

  // ---------- step mode ----------

  get phaseIndex() {
    return Math.min(END - 1, Math.floor(this.stage));
  }
  get phaseProgress() {
    return this.stage >= END ? 1 : this.stage - Math.floor(this.stage);
  }

  // Runs the full forward and backward pass now; the animation just reveals it.
  private recompute() {
    forward(this.params, this.trace);
    backward(this.params, this.trace);
    copyParams(this.params, this.next);
    sgdStep(this.next, this.trace.g, this.stepLr);
    copyParams(this.params, this.shown);
  }

  randomTestDigit() {
    if (!this.test) return;
    this.trace.label = fillInput(this.test, Math.floor(Math.random() * this.test.n), this.trace.x);
    this.source = "test";
    this.recompute();
    this.stage = 0;
    this.emit();
  }

  // A drawn digit has no label, so the target starts as the network's own guess.
  useDrawing(x: Float32Array) {
    this.setMode("step");
    this.trace.x.set(x);
    this.trace.label = 0;
    forward(this.params, this.trace);
    this.trace.label = predict(this.trace);
    this.source = "drawn";
    this.recompute();
    this.stage = 0;
    this.playing = true;
    this.emit();
  }

  setTarget(label: number) {
    this.trace.label = label;
    this.recompute();
    if (this.stage >= END) this.stage = PH.loss;
    this.emit();
  }

  setStepLr(lr: number) {
    this.stepLr = lr;
    this.recompute();
    this.emit();
  }

  togglePlay() {
    if (!this.playing && this.stage >= END) this.stage = 0;
    this.playing = !this.playing;
    this.emit();
  }

  restart() {
    this.stage = 0;
    copyParams(this.params, this.shown);
    this.emit();
  }

  jumpTo(phase: number) {
    this.stage = phase;
    copyParams(this.params, this.shown);
    this.emit();
  }

  nextPhase() {
    if (this.stage >= END) {
      this.afterUpdate();
    } else {
      this.stage = Math.floor(this.stage) + 1;
      if (this.stage >= END) this.commit();
    }
    this.emit();
  }

  private commit() {
    copyParams(this.next, this.params);
    copyParams(this.params, this.shown);
    this.stage = END;
  }

  private afterUpdate() {
    if (this.source === "test") this.randomTestDigit();
    else {
      this.recompute();
      this.stage = 0;
    }
  }

  // ---------- train mode ----------

  private shuffle() {
    if (!this.train) return;
    const n = this.train.n;
    if (this.order.length !== n) this.order = new Uint32Array(n).map((_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    this.cursor = 0;
  }

  setMode(mode: "step" | "train") {
    if (mode === this.mode) return;
    this.mode = mode;
    this.training = false;
    this.playing = false;
    if (mode === "step") {
      // replay the last digit the network trained on, with the current weights
      this.source = "test";
      this.recompute();
      this.stage = 0;
    }
    this.emit();
  }

  toggleTraining() {
    this.training = !this.training;
    this.emit();
  }

  resetWeights() {
    this.params = initParams(Date.now());
    zeroGrads(this.acc);
    this.inBatch = this.lossSum = this.lossCount = 0;
    this.seen = this.epoch = 0;
    this.evalAt = this.evalCorrect = 0;
    this.lossHistory = [];
    this.accHistory = [];
    this.lastAcc = this.lastLoss = null;
    this.shuffle();
    this.recompute();
    this.stage = 0;
    this.emit();
  }

  private trainFrame() {
    const train = this.train!;
    const t = this.trace;
    for (let n = 0; n < this.perFrame; n++) {
      if (this.cursor >= train.n) {
        this.shuffle();
        this.epoch++;
      }
      t.label = fillInput(train, this.order[this.cursor++], t.x);
      forward(this.params, t);
      backward(this.params, t);
      addGrads(this.acc, t.g);
      if (++this.inBatch === this.batch) {
        sgdStep(this.params, this.acc, this.lr, this.batch);
        zeroGrads(this.acc);
        this.inBatch = 0;
      }
      this.seen++;
      this.lossSum += t.loss;
      if (++this.lossCount === LOSS_WINDOW) {
        this.lastLoss = this.lossSum / LOSS_WINDOW;
        this.lossHistory.push(this.lastLoss);
        this.lossSum = this.lossCount = 0;
      }
    }

    // test accuracy, spread over frames so training never stutters
    const test = this.test!;
    const e = this.evalTrace;
    for (let n = 0; n < EVAL_PER_FRAME; n++) {
      e.label = fillInput(test, this.evalAt, e.x);
      forward(this.params, e);
      if (predict(e) === e.label) this.evalCorrect++;
      if (++this.evalAt === EVAL_N) {
        this.lastAcc = this.evalCorrect / EVAL_N;
        this.accHistory.push({ seen: this.seen, acc: this.lastAcc });
        this.evalAt = this.evalCorrect = 0;
      }
    }
    copyParams(this.params, this.shown);
  }

  // ---------- clock ----------

  // The stage the canvas should draw.
  get displayStage() {
    if (this.mode === "train") return this.view === "act" ? PH.loss : PH.update;
    return this.stage;
  }

  tick(dt: number) {
    if (this.status !== "ready") return;
    let changedPhase = false;

    if (this.mode === "train" && this.training) {
      this.trainFrame();
    } else if (this.mode === "step" && this.playing) {
      let ms = dt * this.speed;
      while (ms > 0 && this.stage < END) {
        const i = Math.floor(this.stage);
        const left = (i + 1 - this.stage) * PHASES[i].dur;
        if (ms < left) {
          this.stage += ms / PHASES[i].dur;
          ms = 0;
        } else {
          this.stage = i + 1;
          ms -= left;
          changedPhase = true;
        }
      }
      if (this.stage >= END) {
        this.commit();
        if (this.autoNext) this.afterUpdate();
        else this.playing = false;
        changedPhase = true;
      }
      if (this.phaseIndex === PH.update) {
        lerpParams(this.params, this.next, this.phaseProgress, this.shown);
      }
    }

    const busy = this.training || this.playing;
    if (changedPhase || (busy && performance.now() - this.lastEmit > 100)) this.emit();
  }
}

function lerpParams(a: Params, b: Params, t: number, out: Params) {
  for (const key of ["k", "kb", "w1", "b1", "w2", "b2"] as const) {
    const x = a[key];
    const y = b[key];
    const o = out[key];
    for (let i = 0; i < o.length; i++) o[i] = x[i] + (y[i] - x[i]) * t;
  }
}
