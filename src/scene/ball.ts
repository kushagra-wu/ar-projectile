import * as THREE from 'three';

export interface BallObject {
  mesh: THREE.Mesh;
  setPosition(x: number, y: number, z?: number): void;
  setVisible(v: boolean): void;
}

/** Small sphere representing the projectile. Position is set in the launcher's local frame. */
export function createBall(): BallObject {
  const geometry = new THREE.SphereGeometry(0.04, 24, 16);
  const material = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.35,
    metalness: 0.05,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.25,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.visible = false;
  return {
    mesh,
    setPosition(x, y, z = 0) {
      mesh.position.set(x, y, z);
    },
    setVisible(v) {
      mesh.visible = v;
    },
  };
}
