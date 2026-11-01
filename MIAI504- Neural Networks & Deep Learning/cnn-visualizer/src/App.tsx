import type { Engine } from "./engine.ts";
import { Chart } from "./ui/Chart.tsx";
import { Controls } from "./ui/Controls.tsx";
import { Detail } from "./ui/Detail.tsx";
import { DrawPad } from "./ui/DrawPad.tsx";
import { NetworkCanvas } from "./ui/NetworkCanvas.tsx";
import { useEngine } from "./ui/useEngine.ts";

export function App({ engine }: { engine: Engine }) {
  useEngine(engine);
  return (
    <div className="app">
      <header>
        <h1>CNN, <em>live</em></h1>
        <p className="muted">
          28×28 → conv 3×3 ×6 → ReLU → max pool → dense 16 → dense 10 → softmax · 16,476 weights, trained in your browser
        </p>
      </header>
      {engine.status === "error" ? (
        <div className="card error">
          <h3>No data yet</h3>
          <p>{engine.error}</p>
        </div>
      ) : engine.status === "loading" ? (
        <p className="muted">Loading MNIST…</p>
      ) : (
        <>
          <Controls engine={engine} />
          <NetworkCanvas engine={engine} />
          <div className="cards">
            <Detail engine={engine} />
            <DrawPad engine={engine} />
            <Chart engine={engine} />
          </div>
        </>
      )}
    </div>
  );
}
