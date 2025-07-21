import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { groupings } from "./groupings.js";
import { gradientPresets } from "./gradients.js";
import { rotate180 } from "./rotationUtils.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff2e5);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(30, 30, 30);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const light1 = new THREE.DirectionalLight(0xffffff, 6);
light1.position.set(3, 5, 4);
scene.add(light1);
const light2 = new THREE.DirectionalLight(0xffffff, 3);
light2.position.set(0, 5, -5);
scene.add(light2);
const light3 = new THREE.DirectionalLight(0xffffff, 3);
light3.position.set(0, -5, -5);
scene.add(light3);

const size = 5;
const width = 5;
let groupNum = 8;
let cubeArray = [null];
let groupArray = [null];
let groupDirectionArray = [null];

for (let i = 1; i <= groupNum; i++) {
  const group = new THREE.Group();
  groupArray.push(group);
}

const boxMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  transparent: true,
  opacity: 1,
});

for (let a = -((width - 1) / 2); a <= (width - 1) / 2; a++) {
  for (let b = -((width - 1) / 2); b <= (width - 1) / 2; b++) {
    for (let c = -((width - 1) / 2); c <= (width - 1) / 2; c++) {
      const position = new THREE.Vector3(a * size, b * size, c * size);
      const cube = createGradientCube(position);
      cube.position.copy(position);
      cubeArray.push(cube);
    }
  }
}

for (let i = 1; i <= cubeArray.length; i++) {
  const curGroup = groupings[i];
  if (curGroup != null) {
    groupArray[curGroup].add(cubeArray[i]);
  }
}

const sceneCenter = new THREE.Vector3(0, 0, 0);
for (let j = 1; j <= groupNum; j++) {
  scene.add(groupArray[j]);
  const box = new THREE.Box3().setFromObject(groupArray[j]);
  const groupCenter = new THREE.Vector3();
  box.getCenter(groupCenter);
  const direction = groupCenter.clone().sub(sceneCenter).normalize();
  groupDirectionArray.push(direction);
}

function createGradientCube(position) {
  const geometry = new THREE.BoxGeometry(size, size, size);
  const gradientIndex = 1;
  const colors = gradientPresets[gradientIndex];
  const bottomColor = new THREE.Color(colors.bottom);
  const topColor = new THREE.Color(colors.top);

  const colorAttribute = [];
  const pos = new THREE.Vector3();
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    pos.fromBufferAttribute(geometry.attributes.position, i);
    pos.add(position);
    let t = (pos.x + pos.y + pos.z) / (size * width * 1.5);
    t = THREE.MathUtils.clamp(t, 0, 1);
    const color = bottomColor.clone().lerp(topColor, t);
    colorAttribute.push(color.r, color.g, color.b);
  }
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colorAttribute, 3)
  );
  return new THREE.Mesh(geometry, boxMaterial);
}

let spinningGroupIndex = 1;
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyU") {
    const group = groupArray[spinningGroupIndex];
    spinGroupAroundOwnCenter(group);
    spinningGroupIndex++;
    if (spinningGroupIndex > groupNum) spinningGroupIndex = 1;
  }
});

function spinGroupAroundOwnCenter(group) {
  const worldCenter = new THREE.Vector3();
  const box = new THREE.Box3().setFromObject(group);
  box.getCenter(worldCenter);

  const pivot = new THREE.Object3D();
  pivot.position.copy(worldCenter);
  scene.add(pivot);

  scene.attach(group);
  pivot.attach(group);

  // XY diagonal axis based on quadrant, z=0
  const axisXY = new THREE.Vector3();
  if (worldCenter.x >= 0 && worldCenter.y >= 0) {
    axisXY.set(1, -1, 0);
  } else if (worldCenter.x < 0 && worldCenter.y >= 0) {
    axisXY.set(1, 1, 0);
  } else if (worldCenter.x < 0 && worldCenter.y < 0) {
    axisXY.set(1, -1, 0);
  } else {
    axisXY.set(-1, -1, 0);
  }
  const axis = axisXY.normalize();

  const totalRotation = Math.PI * 2;
  let rotated = 0;
  const delta = 0.05;

  function rotateStep() {
    if (rotated < totalRotation) {
      const quaternion = new THREE.Quaternion();
      quaternion.setFromAxisAngle(axis, delta);
      pivot.quaternion.multiply(quaternion);
      rotated += delta;
      requestAnimationFrame(rotateStep);
    } else {
      scene.attach(group);
      scene.remove(pivot);
    }
  }

  rotateStep();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
