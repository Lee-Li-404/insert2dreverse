import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// === Setup ===
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(20, 20, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(3, 5, 4);
scene.add(light);

// === Create 27 Cubes in a 3x3x3 Grid ===
const size = 4;
const boxGeometry = new THREE.BoxGeometry(size, size, size);
const boxMaterial = new THREE.MeshNormalMaterial();

const cubes = [];
for (let x = -1; x <= 1; x++) {
  for (let y = -1; y <= 1; y++) {
    for (let z = -1; z <= 1; z++) {
      const cube = new THREE.Mesh(boxGeometry, boxMaterial);
      cube.userData.grid = { x, y, z };
      cube.position.set(x * size, y * size, z * size);
      scene.add(cube);
      cubes.push(cube);
    }
  }
}

// === Grouping Cubes into 6 Arbitrary Groups ===
const groups = Array.from({ length: 6 }, () => new THREE.Group());
const groupDefs = [
  (c) => c.userData.grid.y === 1,
  (c) => c.userData.grid.y === -1,
  (c) => c.userData.grid.x === -1,
  (c) => c.userData.grid.x === 1,
  (c) => c.userData.grid.z === 0,
  (c) => c.userData.grid.x === 0 && c.userData.grid.y === 0,
];

// Assign cubes to groups
cubes.forEach((cube) => {
  groupDefs.forEach((fn, i) => {
    if (fn(cube)) groups[i].add(cube);
  });
});

// Rebuild scene with grouped cubes
cubes.forEach((c) => scene.remove(c));
groups.forEach((g) => scene.add(g));

// === Store outward directions & motion config ===
const motionConfigs = groups.map((group, i) => {
  // Outward direction from center
  const center = new THREE.Vector3();
  group.children.forEach((c) => center.add(c.position));
  center.divideScalar(group.children.length).normalize(); // outward vector

  return {
    group,
    base: group.position.clone(),
    direction: center.clone(), // unit vector from center
    amplitude: 3 + Math.random() * 1.5,
    speed: 0.005 + Math.random() * 0.01,
  };
});

// === Animate ===
let frame = 0;
function animate() {
  requestAnimationFrame(animate);
  frame++;

  motionConfigs.forEach(({ group, base, direction, amplitude, speed }) => {
    group.position.copy(base);

    const s = Math.sin(frame * speed);
    const biased = s * 0.3 + Math.abs(s) * 0.7; // mostly outward
    group.position.addScaledVector(direction, biased * amplitude);
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();
