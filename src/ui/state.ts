export type Mode = 'idle' | 'aiming' | 'throwing' | 'landed';

export interface AppState {
  /** Launch angle in degrees, 0–90. */
  angle: number;
  /** Initial velocity in m/s, 1–30. */
  velocity: number;
  /** Horizontal launch direction in degrees, -180 to 180 (yaw around world Y). */
  direction: number;
  /** High-level interaction mode. */
  mode: Mode;
  /** Whether the launcher has been anchored in the world. */
  placed: boolean;
  /** Whether the active session reports an XRHand on any input source. */
  handTrackingActive: boolean;
}

type Listener = (s: Readonly<AppState>) => void;

const state: AppState = {
  angle: 45,
  velocity: 10,
  direction: 0,
  mode: 'idle',
  placed: false,
  handTrackingActive: false,
};

const listeners = new Set<Listener>();

export function getState(): Readonly<AppState> {
  return state;
}

export function setState(patch: Partial<AppState>): void {
  let changed = false;
  for (const k of Object.keys(patch) as (keyof AppState)[]) {
    const next = patch[k];
    if (next !== undefined && state[k] !== next) {
      (state as Record<keyof AppState, AppState[keyof AppState]>)[k] = next as AppState[keyof AppState];
      changed = true;
    }
  }
  if (changed) for (const l of listeners) l(state);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
