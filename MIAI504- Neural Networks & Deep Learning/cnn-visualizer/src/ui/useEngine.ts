import { useSyncExternalStore } from "react";
import type { Engine } from "../engine.ts";

// Re-renders the calling component whenever the engine emits.
export function useEngine(engine: Engine): Engine {
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  return engine;
}
