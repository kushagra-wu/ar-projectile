import * as THREE from 'three';

/**
 * Flat ring reticle that visualizes the current hit-test pose. Updated each frame with the latest
 * world matrix from a hit-test result. Hidden when no surface is detected or the launcher is placed.
 */
export function createReticle(): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0.07, 0.085, 32).rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color: 0x4f8cff,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  mesh.renderOrder = 999;
  return mesh;
}
