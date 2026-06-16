import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export interface DataLabelMetrics {
  velocity: number;
  height: number;
  distance: number;
  time: number;
  maxHeight: number;
  velocityAngleDeg: number;
}

export interface DataLabel {
  object: CSS2DObject;
  update(m: DataLabelMetrics): void;
  setVisible(v: boolean): void;
}

/**
 * Floating HTML card anchored (via CSS2DRenderer) to the ball in world space. Re-uses six DOM
 * cells across updates so the per-frame work is just textContent writes.
 */
export function createDataLabel(): DataLabel {
  const el = document.createElement('div');
  el.className = 'ball-label';
  el.innerHTML = `
    <div class="row"><span class="k">Velocity</span><span class="v" data-k="velocity">0.0 m/s</span></div>
    <div class="row"><span class="k">Height</span><span class="v" data-k="height">0.00 m</span></div>
    <div class="row"><span class="k">Distance</span><span class="v" data-k="distance">0.00 m</span></div>
    <div class="row"><span class="k">Time</span><span class="v" data-k="time">0.00 s</span></div>
    <div class="row"><span class="k">Max h</span><span class="v" data-k="maxHeight">0.00 m</span></div>
    <div class="row"><span class="k">Angle</span><span class="v" data-k="angle">0°</span></div>
  `;

  const cells = {
    velocity: el.querySelector('[data-k="velocity"]') as HTMLSpanElement,
    height: el.querySelector('[data-k="height"]') as HTMLSpanElement,
    distance: el.querySelector('[data-k="distance"]') as HTMLSpanElement,
    time: el.querySelector('[data-k="time"]') as HTMLSpanElement,
    maxHeight: el.querySelector('[data-k="maxHeight"]') as HTMLSpanElement,
    angle: el.querySelector('[data-k="angle"]') as HTMLSpanElement,
  };

  const obj = new CSS2DObject(el);
  obj.visible = false;
  // Offset slightly above-right of the ball position; CSS handles the rest via transform.
  obj.position.set(0, 0.06, 0);

  // Stop pointer events on the label so taps still pass through to the camera area.
  el.addEventListener('pointerdown', (e) => e.stopPropagation());

  return {
    object: obj,
    update(m: DataLabelMetrics) {
      cells.velocity.textContent = `${m.velocity.toFixed(1)} m/s`;
      cells.height.textContent = `${m.height.toFixed(2)} m`;
      cells.distance.textContent = `${m.distance.toFixed(2)} m`;
      cells.time.textContent = `${m.time.toFixed(2)} s`;
      cells.maxHeight.textContent = `${m.maxHeight.toFixed(2)} m`;
      cells.angle.textContent = `${Math.round(m.velocityAngleDeg)}°`;
    },
    setVisible(v: boolean) {
      obj.visible = v;
    },
  };
}

/** Helper to silence unused import in environments where THREE is auto-tree-shaken. */
export const _three = THREE;
