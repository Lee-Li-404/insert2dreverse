import * as THREE from "three";

// Face to axis mapping (used for visual rotation)
const faceAxes = {
  top: new THREE.Vector3(0, 1, 0),
  bottom: new THREE.Vector3(0, -1, 0),
  left: new THREE.Vector3(-1, 0, 0),
  right: new THREE.Vector3(1, 0, 0),
  front: new THREE.Vector3(0, 0, 1),
  back: new THREE.Vector3(0, 0, -1),
};

// Manually define which groups each face affects
// These don’t need to update — we just animate them visually
const faceGroups = {
  top: [5, 6, 7, 8],
  bottom: [1, 2, 3, 4],
  left: [1, 3, 5, 7],
  right: [2, 4, 6, 8],
  front: [3, 4, 7, 8],
  back: [1, 2, 5, 6],
};

/**
 * Rotate a cube face visually by 360°, split into 4 x 90° turns.
 * No logical updates needed.
 */
export function rotate360(
  face,
  groupArray,
  direction = "clockwise",
  onComplete
) {
  const groups = faceGroups[face];
  const axis = faceAxes[face];
  const stepsPerTurn = 15;
  const quarterTurns = 4;
  const totalSteps = stepsPerTurn * quarterTurns;
  const fullAngle = Math.PI * 2;
  const delta = ((direction === "clockwise" ? 1 : -1) * fullAngle) / totalSteps;
  let step = 0;

  function animate() {
    if (step < totalSteps) {
      for (const i of groups) {
        groupArray[i].rotateOnWorldAxis(axis, delta);
      }
      step++;
      requestAnimationFrame(animate);
    } else {
      if (onComplete) onComplete();
    }
  }

  animate();
}
