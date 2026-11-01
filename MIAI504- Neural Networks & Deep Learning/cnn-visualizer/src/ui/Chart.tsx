import { useEffect, useRef } from "react";
import type { Engine } from "../engine.ts";
import { COLORS } from "../viz/colors.ts";
import { useEngine } from "./useEngine.ts";

// Training loss (one point per 200 samples) and test accuracy, sharing the "samples seen" axis.
export function Chart({ engine: e }: { engine: Engine }) {
  useEngine(e);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 36, r: 40, t: 10, b: 22 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;
    const maxX = Math.max(2000, e.seen);
    const maxLoss = Math.max(0.5, ...e.lossHistory);
    const X = (s: number) => pad.l + (s / maxX) * pw;

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (i / 4) * ph;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(pad.l + pw, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.accent;
      ctx.textAlign = "right";
      ctx.fillText((maxLoss * (1 - i / 4)).toFixed(2), pad.l - 4, y + 3);
      ctx.fillStyle = COLORS.pos;
      ctx.textAlign = "left";
      ctx.fillText(`${100 - i * 25}%`, pad.l + pw + 4, y + 3);
    }
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = "center";
    ctx.fillText(`samples seen (${maxX.toLocaleString()})`, pad.l + pw / 2, h - 6);

    const plot = (pts: [number, number][], color: string) => {
      if (pts.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    };
    plot(e.lossHistory.map((l, i) => [X((i + 1) * 200), pad.t + (1 - l / maxLoss) * ph]), COLORS.accent);
    plot(e.accHistory.map((a) => [X(a.seen), pad.t + (1 - a.acc) * ph]), COLORS.pos);
  });

  return (
    <section className="card chart">
      <h3>Training curves <span className="key"><i className="loss" /> loss <i className="acc" /> test accuracy</span></h3>
      <canvas ref={ref} />
      {e.seen === 0 && <p className="muted small">Switch to <b>Train live</b> and press Start to fill this in.</p>}
    </section>
  );
}
