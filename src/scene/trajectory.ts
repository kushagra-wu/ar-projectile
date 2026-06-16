import * as THREE from 'three';
import type { SimPoint } from '../physics/projectile';

const MAX_POINTS = 256;

export interface TrajectoryLine {
  object: THREE.Object3D;
  /** Rebuild the line geometry from a fresh array of sim points. */
  update(points: SimPoint[]): void;
  setVisible(v: boolean): void;
}

/**
 * Dashed line that visualises the predicted projectile path. The geometry's Float32 buffer is
 * reused across updates to avoid GC churn; we just rewrite positions and adjust `drawRange`.
 *
 * Points are interpreted in the launcher's local frame: x → +X, y → +Y, z = 0.
 */
export function createTrajectory(): TrajectoryLine {
  const positions = new Float32Array(MAX_POINTS * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);

  const material = new THREE.LineDashedMaterial({
    color: 0x9bb6ff,
    linewidth: 1,
    dashSize: 0.04,
    gapSize: 0.03,
    transparent: true,
    opacity: 0.95,
  });

  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;

  // Landing marker (flat ring on the ground at the predicted landing X).
  const landing = new THREE.Mesh(
    new THREE.RingGeometry(0.04, 0.05, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x9bb6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  landing.position.set(0, 0.002, 0);

  const group = new THREE.Group();
  group.add(line);
  group.add(landing);

  return {
    object: group,
    update(points: SimPoint[]) {
      const n = Math.min(points.length, MAX_POINTS);
      for (let i = 0; i < n; i++) {
        const p = points[i];
        positions[i * 3 + 0] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = 0;
      }
      (geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      geometry.setDrawRange(0, n);
      geometry.computeBoundingSphere();
      line.computeLineDistances(); // required for dashed material

      if (n > 0) {
        const last = points[n - 1];
        landing.visible = last.y <= 1e-3;
        landing.position.x = last.x;
      } else {
        landing.visible = false;
      }
    },
    setVisible(v: boolean) {
      group.visible = v;
    },
  };
}
