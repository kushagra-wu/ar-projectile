import { getState, setState, subscribe } from './state';

export interface OverlayHandlers {
  /** Called when the user taps the primary action button. */
  onPrimaryAction: () => void;
}

export interface OverlayApi {
  /** Update the status pill copy shown at the top of the AR overlay. */
  setStatus(text: string): void;
  /** Toggle the hand-gesture pill visibility (only relevant when hand tracking is granted). */
  setHandPillVisible(visible: boolean): void;
  /** Show the overlay (called when an XR session starts). */
  show(): void;
  /** Hide the overlay (called when an XR session ends). */
  hide(): void;
}

/**
 * Wire up the DOM overlay: sliders push into the state store, primary button delegates to the
 * provided handler, and slider readouts + button label react to state changes.
 */
export function initOverlay(handlers: OverlayHandlers): OverlayApi {
  const overlay = requireEl<HTMLDivElement>('overlay');
  const controls = requireEl<HTMLDivElement>('controls');
  const angleInput = requireEl<HTMLInputElement>('angle');
  const angleValue = requireEl<HTMLSpanElement>('angle-value');
  const velInput = requireEl<HTMLInputElement>('velocity');
  const velValue = requireEl<HTMLSpanElement>('velocity-value');
  const throwBtn = requireEl<HTMLButtonElement>('throw-btn');
  const statusPill = requireEl<HTMLDivElement>('status-pill');
  const handPill = requireEl<HTMLDivElement>('hand-pill');

  // Initialize inputs from state.
  const s0 = getState();
  angleInput.value = String(s0.angle);
  velInput.value = String(s0.velocity);
  renderReadouts(s0.angle, s0.velocity);

  // Input → state (live, every input event).
  angleInput.addEventListener('input', () => {
    const v = Number(angleInput.value);
    setState({ angle: v });
  });
  velInput.addEventListener('input', () => {
    const v = Number(velInput.value);
    setState({ velocity: v });
  });

  throwBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handlers.onPrimaryAction();
  });

  // State → DOM.
  subscribe((s) => {
    renderReadouts(s.angle, s.velocity);
    renderControlsVisibility(controls, s.placed, s.mode);
    renderButton(throwBtn, s.mode);
  });

  function renderReadouts(angle: number, velocity: number): void {
    angleValue.textContent = `${Math.round(angle)}°`;
    velValue.textContent = `${velocity.toFixed(1)} m/s`;
  }

  return {
    setStatus(text: string) {
      statusPill.textContent = text;
    },
    setHandPillVisible(visible: boolean) {
      handPill.hidden = !visible;
    },
    show() {
      overlay.setAttribute('aria-hidden', 'false');
      const splash = document.getElementById('splash');
      if (splash) splash.style.display = 'none';
    },
    hide() {
      overlay.setAttribute('aria-hidden', 'true');
      const splash = document.getElementById('splash');
      if (splash) splash.style.display = '';
    },
  };
}

function renderControlsVisibility(controls: HTMLDivElement, placed: boolean, mode: string): void {
  if (!placed) {
    controls.setAttribute('data-state', 'hidden');
    return;
  }
  if (mode === 'throwing' || mode === 'landed') {
    controls.setAttribute('data-state', 'locked');
  } else {
    controls.setAttribute('data-state', 'visible');
  }
}

function renderButton(btn: HTMLButtonElement, mode: string): void {
  if (mode === 'throwing' || mode === 'landed') {
    btn.textContent = 'Retrieve Ball';
    btn.setAttribute('data-mode', 'retrieve');
  } else {
    btn.textContent = 'Throw';
    btn.setAttribute('data-mode', 'throw');
  }
}

function requireEl<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Required element #${id} not found in DOM`);
  return el as T;
}
