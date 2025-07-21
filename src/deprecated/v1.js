import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// Scene setup
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  1000
);
camera.position.z = 20; // Fix: move the camera back so we can see the cube

const renderer = new THREE.WebGLRenderer();
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(1, 1, 1);
scene.add(light);

// Geometry and material
const size = 10;

const boxGeometry = new THREE.BoxGeometry(size, size, size);
const boxMaterial = new THREE.MeshNormalMaterial();

const lGroup = new THREE.Group();
const cube1 = new THREE.Mesh(boxGeometry, boxMaterial);
const cube2 = new THREE.Mesh(boxGeometry, boxMaterial);
const cube3 = new THREE.Mesh(boxGeometry, boxMaterial);

cube1.position.set(size, 0, 0); // 往左一格
cube3.position.set(0, size, 0); // 往左一格
lGroup.add(cube1);
lGroup.add(cube2);
lGroup.add(cube3);

//second

//add meshes to scene
// scene.add(cube1);
// scene.add(cube2);
// scene.add(cube3);
scene.add(lGroup);

console.log(lGroup);
const originalPos = lGroup.position.clone(); // 创建副本而不是引用

//
const lGroup2 = new THREE.Group();
const cube4 = new THREE.Mesh(boxGeometry, boxMaterial);
const cube5 = new THREE.Mesh(boxGeometry, boxMaterial);
const cube6 = new THREE.Mesh(boxGeometry, boxMaterial);

cube4.position.set(-size, 0, 0); // 往左一格
cube6.position.set(0, -size, 0); // 往左一格
lGroup2.add(cube4);
lGroup2.add(cube5);
lGroup2.add(cube6);

lGroup2.position.x += size * 3;
lGroup2.position.y += size * 3;

scene.add(lGroup2);

const originalPos2 = lGroup2.position.clone(); // 创建副本而不是引用

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Animation loop
let frame = 0;
function animate() {
  frame += 0.01;
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  lGroup.position.x = originalPos.x + 2 * Math.sin(frame);
  lGroup.position.y = originalPos.y + 2 * Math.sin(frame);

  lGroup2.position.x = originalPos2.x + 2 * Math.cos(frame);
  lGroup2.position.y = originalPos2.y + 2 * Math.cos(frame);
}
animate();
