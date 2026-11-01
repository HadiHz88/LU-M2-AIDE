export const COLORS = {
  bg: "#0d1117",
  panel: "#151b23",
  line: "#2a323d",
  text: "#e6edf3",
  muted: "#8b949e",
  accent: "#f0a057",
  pos: "#6aa6f8",
  neg: "#f27ba3",
  ok: "#4cc38a",
};

type Stop = [number, string];

// 256-entry RGB lookup table interpolated between colour stops
function ramp(stops: Stop[]): Uint8ClampedArray {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    let s = 0;
    while (s < stops.length - 2 && v > stops[s + 1][0]) s++;
    const [p0, c0] = stops[s];
    const [p1, c1] = stops[s + 1];
    const t = Math.min(1, Math.max(0, (v - p0) / (p1 - p0)));
    const a = rgb(c0);
    const b = rgb(c1);
    for (let k = 0; k < 3; k++) lut[i * 3 + k] = a[k] + (b[k] - a[k]) * t;
  }
  return lut;
}

// activations (≥ 0): dark → amber → near white
export const SEQ = ramp([[0, "#11161d"], [0.35, "#6b3410"], [0.72, "#f0a057"], [1, "#fff4dc"]]);
// signed values: rose (−) → dark (0) → blue (+)
export const DIV = ramp([[0, "#ff8fb4"], [0.3, "#8a3355"], [0.5, "#161b22"], [0.7, "#2b5592"], [1, "#9cc8ff"]]);
export const GRAY = ramp([[0, "#0d1117"], [1, "#f5f7fa"]]);

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
export const seqI = (v: number, max: number) => (max > 0 ? clampByte((v / max) * 255) : 0);
export const divI = (v: number, maxAbs: number) => (maxAbs > 0 ? clampByte(127.5 + (v / maxAbs) * 127.5) : 128);
// gradients are mostly tiny with a few large values; a square root keeps the small ones visible
export const gradI = (v: number, maxAbs: number) =>
  maxAbs > 0 ? clampByte(127.5 + Math.sign(v) * Math.sqrt(Math.abs(v) / maxAbs) * 127.5) : 128;

export const lutColor = (lut: Uint8ClampedArray, i: number, alpha = 1) =>
  `rgba(${lut[i * 3]},${lut[i * 3 + 1]},${lut[i * 3 + 2]},${alpha})`;
export const signColor = (v: number) => (v >= 0 ? COLORS.pos : COLORS.neg);
