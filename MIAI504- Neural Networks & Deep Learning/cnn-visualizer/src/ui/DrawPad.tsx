import { useEffect, useRef, useState } from "react";
import type { Engine } from "../engine.ts";
import { predict } from "../nn/net.ts";
import { useEngine } from "./useEngine.ts";

const SIZE = 224;

// Turns a drawing into an MNIST-style input: fit the strokes into 20×20, then centre them by mass in 28×28.
function toMnist(src: HTMLCanvasElement): Float32Array | null {
  const d = src.getContext("2d")!.getImageData(0, 0, src.width, src.height).data;
  let minX = src.width, minY = src.height, maxX = -1, maxY = -1;
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      if (d[(y * src.width + x) * 4] > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const s = 20 / Math.max(bw, bh);
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = 28;
  const tc = tmp.getContext("2d")!;
  tc.imageSmoothingQuality = "high";
  tc.drawImage(src, minX, minY, bw, bh, (28 - bw * s) / 2, (28 - bh * s) / 2, bw * s, bh * s);
  const px = tc.getImageData(0, 0, 28, 28).data;
  const v = new Float32Array(784);
  let mass = 0, cx = 0, cy = 0;
  for (let q = 0; q < 784; q++) {
    v[q] = px[q * 4] / 255;
    mass += v[q];
    cx += v[q] * (q % 28);
    cy += v[q] * Math.floor(q / 28);
  }
  const dx = Math.round(13.5 - cx / mass);
  const dy = Math.round(13.5 - cy / mass);
  const out = new Float32Array(784);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const sx = x - dx, sy = y - dy;
      if (sx >= 0 && sx < 28 && sy >= 0 && sy < 28) out[y * 28 + x] = v[sy * 28 + sx];
    }
  }
  return out;
}

export function DrawPad({ engine: e }: { engine: Engine }) {
  useEngine(e);
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPt = useRef<[number, number] | null>(null);
  const [empty, setEmpty] = useState(true);

  const clear = () => {
    const ctx = ref.current!.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, SIZE, SIZE);
    setEmpty(true);
  };
  useEffect(clear, []);

  const pos = (ev: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = ev.currentTarget.getBoundingClientRect();
    return [((ev.clientX - r.left) / r.width) * SIZE, ((ev.clientY - r.top) / r.height) * SIZE];
  };
  const stroke = (to: [number, number]) => {
    const ctx = ref.current!.getContext("2d")!;
    const from = lastPt.current ?? to;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
    lastPt.current = to;
    setEmpty(false);
  };

  const run = () => {
    const x = toMnist(ref.current!);
    if (x) e.useDrawing(x);
  };

  const drawn = e.source === "drawn" && e.mode === "step";
  return (
    <section className="card pad">
      <h3>Draw a digit</h3>
      <canvas
        ref={ref}
        width={SIZE}
        height={SIZE}
        onPointerDown={(ev) => { ev.currentTarget.setPointerCapture(ev.pointerId); drawing.current = true; lastPt.current = null; stroke(pos(ev)); }}
        onPointerMove={(ev) => drawing.current && stroke(pos(ev))}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
        aria-label="Drawing area"
      />
      <div className="row">
        <button className="primary" disabled={empty} onClick={run}>Run my drawing</button>
        <button onClick={clear}>Clear</button>
      </div>
      {drawn && (
        <>
          <p className="muted small">The network guesses <b>{predict(e.trace)}</b>. Pick the target backprop should push towards:</p>
          <div className="digits">
            {Array.from({ length: 10 }, (_, k) => (
              <button key={k} aria-pressed={e.trace.label === k} onClick={() => e.setTarget(k)}>{k}</button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
