import { END, PHASES, type Engine } from "../engine.ts";
import { useEngine } from "./useEngine.ts";

const SPEEDS = [0.25, 0.5, 1, 2, 4];
const PER_FRAME = [1, 4, 16, 64, 128];

export function Controls({ engine: e }: { engine: Engine }) {
  useEngine(e);
  return (
    <div className="controls">
      <div className="seg" role="tablist" aria-label="Mode">
        <button role="tab" aria-selected={e.mode === "step"} onClick={() => e.setMode("step")}>One sample, step by step</button>
        <button role="tab" aria-selected={e.mode === "train"} onClick={() => e.setMode("train")}>Train live</button>
      </div>
      {e.mode === "step" ? <StepControls e={e} /> : <TrainControls e={e} />}
    </div>
  );
}

function StepControls({ e }: { e: Engine }) {
  return (
    <>
      <div className="row">
        <button className="primary" onClick={() => e.togglePlay()}>{e.playing ? "Pause" : e.stage >= END ? "Replay" : "Play"}</button>
        <button onClick={() => e.nextPhase()} title="Jump to the next phase">Next phase ⏭</button>
        <button onClick={() => e.restart()}>Restart sample</button>
        <button onClick={() => e.randomTestDigit()}>New test digit</button>
        <label>
          Speed
          <select value={e.speed} onChange={(ev) => { e.speed = Number(ev.target.value); e.emit(); }}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
          </select>
        </label>
        <label>
          η
          <select value={e.stepLr} onChange={(ev) => e.setStepLr(Number(ev.target.value))}>
            {[0.01, 0.05, 0.1, 0.3, 1].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={e.autoNext} onChange={(ev) => { e.autoNext = ev.target.checked; e.emit(); }} />
          Keep going with new digits
        </label>
      </div>
      <PhaseBar e={e} />
    </>
  );
}

function PhaseBar({ e }: { e: Engine }) {
  const cur = e.stage >= END ? END : e.phaseIndex;
  return (
    <ol className="phases">
      {PHASES.map((ph, i) => {
        const fill = i < cur ? 1 : i === cur ? e.phaseProgress : 0;
        return (
          <li key={ph.id} className={`${ph.dir} ${i === cur ? "cur" : ""}`}>
            <button onClick={() => e.jumpTo(i)} title={`Jump to ${ph.label}`}>
              <span className="fill" style={{ width: `${fill * 100}%` }} />
              <span className="lbl">{ph.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function TrainControls({ e }: { e: Engine }) {
  return (
    <div className="row">
      <button className="primary" onClick={() => e.toggleTraining()}>{e.training ? "Pause training" : "Start training"}</button>
      <button onClick={() => e.resetWeights()}>Reset weights</button>
      <label>
        Samples / frame
        <select value={e.perFrame} onChange={(ev) => { e.perFrame = Number(ev.target.value); e.emit(); }}>
          {PER_FRAME.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label>
        η
        <select value={e.lr} onChange={(ev) => { e.lr = Number(ev.target.value); e.emit(); }}>
          {[0.01, 0.03, 0.05, 0.1, 0.3, 1].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>
        Batch
        <select value={e.batch} onChange={(ev) => { e.batch = Number(ev.target.value); e.emit(); }}>
          {[1, 4, 16, 64].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <div className="seg small" role="tablist" aria-label="Show">
        <button role="tab" aria-selected={e.view === "act"} onClick={() => { e.view = "act"; e.emit(); }}>Activations</button>
        <button role="tab" aria-selected={e.view === "grad"} onClick={() => { e.view = "grad"; e.emit(); }}>Gradients</button>
      </div>
      <dl className="stats">
        <div><dt>samples</dt><dd>{e.seen.toLocaleString()}</dd></div>
        <div><dt>epoch</dt><dd>{e.epoch + 1}</dd></div>
        <div><dt>loss</dt><dd>{e.lastLoss === null ? "—" : e.lastLoss.toFixed(3)}</dd></div>
        <div><dt>test acc</dt><dd>{e.lastAcc === null ? "—" : `${(e.lastAcc * 100).toFixed(1)}%`}</dd></div>
      </dl>
    </div>
  );
}
