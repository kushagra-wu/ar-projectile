import * as THREE from 'three';

const PAD_RADIUS = 0.06;
const ARROW_LEN = 0.18;
const ARROW_HEAD_LEN = 0.04;
const ARROW_HEAD_WIDTH = 0.025;
const ARROW_SHAFT_RADIUS = 0.005;

export interface Launcher {
  /** The root group that should be placed at the hit-test pose. */
  root: THREE.Group;
  /** Local +X axis points along the throw direction. Trajectory + ball use the same frame. */
  setAngle(deg: number): void;
}

/**
 * A small launch pad (disc) plus an arrow indicating the current launch angle.
 *
 * Coordinate convention (local to `root`):
 *   +X = horizontal forward (throw direction)
 *   +Y = world up
 *   +Z = sideways (unused by physics)
 *
 * The arrow rotates around the local Z axis so that 0° = horizontal +X and 90° = straight up.
 */
export function createLauncher(): Launcher {
  const root = new THREE.Group();
  root.visible = false;

  // Pad disc
  const padGeo = new THREE.CylinderGeometry(PAD_RADIUS, PAD_RADIUS, 0.008, 24);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x111418, roughness: 0.6, metalness: 0.2 });
  const pad = new THREE.Mesh(padGeo, padMat);
  pad.position.y = 0.004;
  root.add(pad);

  const padRing = new THREE.Mesh(
    new THREE.TorusGeometry(PAD_RADIUS, 0.004, 8, 32).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x4f8cff }),
  );
  padRing.position.y = 0.009;
  root.add(padRing);

  // Arrow shaft (cylinder oriented along +X by default → cylinder runs along +Y, we rotate -Z 90°)
  const arrowGroup = new THREE.Group();
  arrowGroup.position.y = 0.01;
  root.add(arrowGroup);

  const shaftGeo = new THREE.CylinderGeometry(ARROW_SHAFT_RADIUS, ARROW_SHAFT_RADIUS, ARROW_LEN - ARROW_HEAD_LEN, 12);
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0x4f8cff, emissive: 0x1d4ed8, emissiveIntensity: 0.4 });
  const shaft = new THREE.Mesh(shaftGeo, arrowMat);
  // Place the shaft along +X
  shaft.rotation.z = -Math.PI / 2;
  shaft.position.x = (ARROW_LEN - ARROW_HEAD_LEN) / 2;
  arrowGroup.add(shaft);

  const headGeo = new THREE.ConeGeometry(ARROW_HEAD_WIDTH, ARROW_HEAD_LEN, 16);
  const head = new THREE.Mesh(headGeo, arrowMat);
  head.rotation.z = -Math.PI / 2;
  head.position.x = ARROW_LEN - ARROW_HEAD_LEN / 2;
  arrowGroup.add(head);

  return {
    root,
    setAngle(deg: number) {
      const rad = (deg * Math.PI) / 180;
      // Rotate arrow around local Z so that 0° = +X (horizontal) and 90° = +Y (up).
      arrowGroup.rotation.z = rad;
    },
  };
}
