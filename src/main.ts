import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { getState, setState, subscribe } from './ui/state';
import { initOverlay } from './ui/overlay';
import { HitTester } from './xr/hitTest';
import { FistDetector } from './xr/handTracking';
import { createReticle } from './scene/reticle';
import { createLauncher } from './scene/launcher';
import { createTrajectory } from './scene/trajectory';
import { createBall } from './scene/ball';
import { createDataLabel } from './scene/dataLabel';
import { simulate, sampleAt, speedOf, velocityAngleDeg, maxHeight, type SimPoint } from './physics/projectile';

// ---------- Scene ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const cssRenderer = new CSS2DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
const dataLayer = document.getElementById('data-layer')!;
dataLayer.appendChild(cssRenderer.domElement);
cssRenderer.domElement.style.position = 'absolute';
cssRenderer.domElement.style.inset = '0';
cssRenderer.domElement.style.pointerEvents = 'none';

// Lights — soft ambient + a soft hemisphere for general modeling.
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.1));
const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(1, 2, 1);
scene.add(dir);

// ---------- AR objects ----------
const reticle = createReticle();
scene.add(reticle);

const launcher = createLauncher();
scene.add(launcher.root);

const trajectory = createTrajectory();
launcher.root.add(trajectory.object);

const ball = createBall();
launcher.root.add(ball.mesh);

const dataLabel = createDataLabel();
launcher.root.add(dataLabel.object);
dataLabel.object.position.set(0, 0.06, 0); // overridden each frame while throwing

// ---------- XR helpers ----------
const hitTester = new HitTester();
const fistDetector = new FistDetector();

let xrRefSpace: XRReferenceSpace | null = null;
let pendingAutoAim = false;

// ---------- Trajectory caching ----------
let currentSim: SimPoint[] = [];
let throwStartTimeMs = 0;
let throwDurationS = 0;

function recomputeTrajectory(): void {
  const s = getState();
  currentSim = simulate({ angle: s.angle, velocity: s.velocity });
  trajectory.update(currentSim);
  throwDurationS = currentSim.length ? currentSim[currentSim.length - 1].t : 0;
}

// ---------- Overlay ----------
const overlay = initOverlay({
  onPrimaryAction: () => {
    const s = getState();
    if (s.mode === 'aiming') startThrow();
    else if (s.mode === 'throwing' || s.mode === 'landed') retrieveBall();
  },
});

subscribe((s) => {
  // Mirror launcher arrow + trajectory to the current sliders, but only while aiming.
  launcher.setAngle(s.angle);
  if (s.mode === 'aiming') {
    recomputeTrajectory();
    trajectory.setVisible(true);
  }
});

// ---------- Session lifecycle ----------
renderer.xr.addEventListener('sessionstart', async () => {
  const session = renderer.xr.getSession();
  if (!session) return;
  overlay.show();
  overlay.setStatus('Looking for a surface…');

  // Use 'local' reference space — universally supported in immersive-ar.
  try {
    xrRefSpace = await session.requestReferenceSpace('local');
  } catch (err) {
    console.error('[xr] failed to acquire local reference space', err);
    return;
  }

  await hitTester.start(session);

  // Detect hand tracking presence and keep it in sync as input sources come and go.
  const syncHands = () => {
    fistDetector.syncFromSession(session);
    const active = fistDetector.isActive;
    setState({ handTrackingActive: active });
    overlay.setHandPillVisible(active);
  };
  syncHands();
  session.addEventListener('inputsourceschange', syncHands);

  setState({ mode: 'idle', placed: false });
});

renderer.xr.addEventListener('sessionend', () => {
  overlay.hide();
  hitTester.stop();
  xrRefSpace = null;
  // Reset scene state for the next session.
  reticle.visible = false;
  launcher.root.visible = false;
  ball.setVisible(false);
  dataLabel.setVisible(false);
  trajectory.setVisible(false);
  setState({ mode: 'idle', placed: false, handTrackingActive: false });
});

// ---------- Tap-to-place ----------
const controller = renderer.xr.getController(0);
scene.add(controller);
controller.addEventListener('select', () => {
  const s = getState();
  if (!s.placed && reticle.visible) {
    placeLauncherAtReticle();
  }
});

function placeLauncherAtReticle(): void {
  // Copy the reticle's world matrix to extract position only; we'll apply our own yaw next frame
  // so the launcher always faces away from the viewer.
  const m = new THREE.Matrix4().copy(reticle.matrix);
  const pos = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  m.decompose(pos, _q, _s);

  launcher.root.position.copy(pos);
  launcher.root.rotation.set(0, 0, 0);
  launcher.root.visible = true;

  reticle.visible = false;
  pendingAutoAim = true;

  overlay.setStatus('Adjust angle and velocity, then tap Throw');
  setState({ placed: true, mode: 'aiming' });
  recomputeTrajectory();
  trajectory.setVisible(true);
}

function applyAutoAim(viewerPose: XRViewerPose): void {
  const cam = viewerPose.transform.position;
  const dx = launcher.root.position.x - cam.x;
  const dz = launcher.root.position.z - cam.z;
  if (dx * dx + dz * dz < 1e-6) return; // viewer is directly above launcher; skip
  // Make local +X point along (dx, dz) in the XZ plane.
  const yaw = Math.atan2(-dz, dx);
  launcher.root.rotation.y = yaw;
}

// ---------- Throw / Retrieve ----------
function startThrow(): void {
  if (currentSim.length < 2) return;
  throwStartTimeMs = performance.now();
  ball.setVisible(true);
  dataLabel.setVisible(true);
  // Keep the predicted-path dots visible during flight so the user can compare
  // the ball's actual motion to the prediction.
  trajectory.setVisible(true);
  overlay.setStatus('Ball in flight…');
  setState({ mode: 'throwing' });
}

function retrieveBall(): void {
  ball.setVisible(false);
  dataLabel.setVisible(false);
  trajectory.setVisible(true);
  overlay.setStatus('Adjust angle and velocity, then tap Throw');
  setState({ mode: 'aiming' });
  recomputeTrajectory();
}

// ---------- Animation loop ----------
function onXRFrame(_t: number, frame?: XRFrame): void {
  if (frame && xrRefSpace) {
    // Hit-test → reticle (only while not placed).
    const s = getState();
    if (!s.placed) {
      const pose = hitTester.getLatestPose(frame, xrRefSpace);
      if (pose) {
        reticle.matrix.fromArray(pose.transform.matrix);
        if (!reticle.visible) {
          reticle.visible = true;
          overlay.setStatus('Tap to place the launcher');
        }
      } else {
        reticle.visible = false;
        overlay.setStatus('Looking for a surface…');
      }
    }

    // Apply queued auto-aim on the first frame that gives us a viewer pose.
    if (pendingAutoAim) {
      const viewerPose = frame.getViewerPose(xrRefSpace);
      if (viewerPose) {
        applyAutoAim(viewerPose);
        pendingAutoAim = false;
      }
    }

    // Hand tracking → fist gesture detection.
    const session = renderer.xr.getSession();
    if (session && fistDetector.isActive) {
      fistDetector.update(performance.now(), frame, session, xrRefSpace, () => {
        const m = getState().mode;
        if (m === 'throwing' || m === 'landed') retrieveBall();
      });
    }

    // Throw animation.
    if (s.mode === 'throwing') {
      const elapsedS = (performance.now() - throwStartTimeMs) / 1000;
      if (elapsedS >= throwDurationS) {
        // Snap to landing point.
        const last = currentSim[currentSim.length - 1];
        ball.setPosition(last.x, last.y, 0);
        dataLabel.object.position.set(last.x, last.y + 0.06, 0);
        dataLabel.update({
          velocity: speedOf(last),
          height: Math.max(0, last.y),
          distance: last.x,
          time: last.t,
          maxHeight: maxHeight(currentSim),
          velocityAngleDeg: velocityAngleDeg(last),
        });
        overlay.setStatus('Tap Retrieve Ball to reset');
        setState({ mode: 'landed' });
      } else {
        const p = sampleAt(currentSim, elapsedS);
        ball.setPosition(p.x, p.y, 0);
        dataLabel.object.position.set(p.x, p.y + 0.06, 0);
        dataLabel.update({
          velocity: speedOf(p),
          height: Math.max(0, p.y),
          distance: p.x,
          time: p.t,
          maxHeight: maxHeight(currentSim),
          velocityAngleDeg: velocityAngleDeg(p),
        });
      }
    }
  }

  renderer.render(scene, camera);
  cssRenderer.render(scene, camera);
}

renderer.setAnimationLoop(onXRFrame);

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Pre-session AR-button setup + capability detection ----------
async function bootstrap(): Promise<void> {
  const splashStatus = document.getElementById('splash-status');
  const slot = document.getElementById('ar-button-slot');
  if (!splashStatus || !slot) return;

  if (!('xr' in navigator) || !navigator.xr) {
    showNoArMessage(splashStatus, 'This browser does not expose the WebXR Device API.');
    return;
  }

  let supported = false;
  try {
    supported = await navigator.xr.isSessionSupported('immersive-ar');
  } catch {
    supported = false;
  }

  if (!supported) {
    showNoArMessage(
      splashStatus,
      'WebXR AR is not available on this device or browser. Open in Chrome on an ARCore-supported Android device, or a WebXR-capable headset browser.',
    );
    return;
  }

  splashStatus.textContent = 'Ready — tap below to start.';

  const overlayRoot = document.getElementById('overlay')!;
  const button = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test', 'dom-overlay'],
    optionalFeatures: ['hand-tracking', 'local-floor', 'anchors', 'light-estimation'],
    domOverlay: { root: overlayRoot },
  });
  // Strip ARButton's hardcoded inline styles so our CSS slot can take over.
  button.removeAttribute('style');
  slot.appendChild(button);
}

function showNoArMessage(splashStatus: HTMLElement, msg: string): void {
  splashStatus.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'no-ar';
  wrap.innerHTML = `
    <strong>WebXR AR unavailable.</strong>
    <p>${msg}</p>
    <p>Need a compatible setup? Check device support at
      <a href="https://immersiveweb.dev/" target="_blank" rel="noopener">immersiveweb.dev</a>.
    </p>
  `;
  splashStatus.appendChild(wrap);
}

bootstrap();
