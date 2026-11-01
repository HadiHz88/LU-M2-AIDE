import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { Engine } from "./engine.ts";
import "./styles.css";

const engine = new Engine();
engine.load();
// handy in the browser console while developing: engine.stage = 1.5, engine.trace.p, …
if (import.meta.env.DEV) Object.assign(window, { engine });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App engine={engine} />
  </StrictMode>,
);
