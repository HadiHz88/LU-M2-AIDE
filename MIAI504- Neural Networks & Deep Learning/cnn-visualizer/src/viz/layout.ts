// Fixed positions on a 1280×720 logical canvas; the canvas is scaled to fit its container.
import { F, H, O } from "../nn/net.ts";

export const W = 1280;
export const HGT = 720;

export const IN = { x: 30, y: 262, cell: 7, size: 196 };
export const KER = { x: 258, cell: 11, size: 33 };
export const CONV = { x: 314, cell: 3.8, size: 98.8 };
export const POOL = { x: 474, cell: 6, size: 78 };
export const HID = { x: 770, r: 11 };
export const OUT = { x: 1010, r: 17 };
export const PROB = { x: 1040, w: 84 };
export const DELTA = { x: 1220, half: 50 };

export const rowY = (f: number) => 105 + 110 * f; // centre of filter f's row
export const hidY = (j: number) => 62 + (j * 636) / (H - 1);
export const outY = (k: number) => 92 + (k * 572) / (O - 1);

export const kernelY = (f: number) => rowY(f) - 36;
export const dKernelY = (f: number) => rowY(f) + 3;
export const convY = (f: number) => rowY(f) - CONV.size / 2;
export const poolY = (f: number) => rowY(f) - POOL.size / 2;

export type Hit = { kind: "filter"; f: number } | { kind: "hidden"; j: number } | null;

export function hitTest(x: number, y: number): Hit {
  for (let f = 0; f < F; f++) {
    const top = rowY(f) - 52;
    if (y >= top && y <= top + 104 && x >= KER.x - 6 && x <= POOL.x + POOL.size) return { kind: "filter", f };
  }
  for (let j = 0; j < H; j++) {
    if (Math.hypot(x - HID.x, y - hidY(j)) <= HID.r + 6) return { kind: "hidden", j };
  }
  return null;
}
