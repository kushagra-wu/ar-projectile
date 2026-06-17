import * as THREE from 'three';
import { sampleAt, type SimPoint } from '../physics/projectile';

const MAX_DOTS = 128;
const DOT_RADIUS = 0.012;        // 1.2 cm spheres
const DOT_SPACING_S = 1 / 24;    // 24 dots per second of flight

export interface TrajectoryLine {
  object: THREE.Object3D;
  /** Rebuild the dot row from a fresh array of sim points. */
  update(points: SimPoint[]): void;
  setVisible(v: boolean): void;
}

/**
 * Predicted projectile path rendered as a row of small spheres along the trajectory.
 * Uses InstancedMesh for one draw call regardless of dot count. Plays nicely with WebXR
 * (no custom shaders, no resolution uniforms).
 *
 * Points are interpreted in the launcher's local frame: x → +X, y → +Y, z = 0.
 */
export function createTrajectory(): TrajectoryLine {
  const group = new THREE.Group();

  const geo = new THREE.SphereGeometry(DOT_RADIUS, 12, 8);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x9bb6ff,
    transparent: true,
    opacity: 0.95,
  });
  const dots = new THREE.InstancedMesh(geo, mat, MAX_DOTS);
  dots.frustumCulled = false;
  dots.count = 0;
  group.add(dots);

  // Landing marker (flat ring on the ground at the predicted landing X).
  const landing = new THREE.Mesh(
    new THREE.RingGeometry(0.04, 0.05, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x9bb6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  landing.position.set(0, 0.002, 0);
  group.add(landing);

  const dummy = new THREE.Object3D();

  return {
    object: group,
    update(points: SimPoint[]) {
      if (points.length < 2) {
        dots.count = 0;
        landing.visible = false;
        return;
      }
      const totalT = points[points.length - 1].t;
      const dotCount = Math.min(MAX_DOTS, Math.max(2, Math.floor(totalT / DOT_SPACING_S) + 1));
      for (let i = 0; i < dotCount; i++) {
        const t = (i / (dotCount - 1)) * totalT;
        const p = sampleAt(points, t);
        dummy.position.set(p.x, p.y, 0);
        dummy.updateMatrix();
        dots.setMatrixAt(i, dummy.matrix);
      }
      dots.count = dotCount;
      dots.instanceMatrix.needsUpdate = true;

      const last = points[points.length - 1];
      landing.visible = last.y <= 1e-3;
      landing.position.x = last.x;
    },
    setVisible(v: boolean) {
      group.visible = v;
    },
  };
}
