import { useEffect, useRef } from "react";
import type { Engine } from "../engine.ts";
import { render } from "../viz/render.ts";
import { HGT, W, hitTest } from "../viz/layout.ts";

// Hosts the animation loop: advance the engine, then redraw, every frame.
export function NetworkCanvas({ engine }: { engine: Engine }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let scale = 1;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      scale = cssW / W;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssW * (HGT / W) * dpr);
      ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      engine.tick(dt);
      if (engine.status === "ready") {
        render(ctx, {
          p: engine.shown,
          t: engine.trace,
          stage: engine.displayStage,
          filter: engine.selectedFilter,
          hidden: engine.selectedHidden,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [engine]);

  const onClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * W;
    const y = ((ev.clientY - rect.top) / rect.height) * HGT;
    const hit = hitTest(x, y);
    if (hit?.kind === "filter") engine.selectedFilter = hit.f;
    if (hit?.kind === "hidden") engine.selectedHidden = hit.j;
    if (hit) engine.emit();
  };

  return <canvas ref={ref} className="net" onClick={onClick} aria-label="Animated view of the network" />;
}
