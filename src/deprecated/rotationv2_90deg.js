import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { groupings } from "./groupings.js";
import { gradientPresets } from "./gradients.js";
import { rotateAnimated } from "./rotationUtils.js";

// === Setup scene ===
const scene = new THREE.Scene();
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

const lightIntensity = 6;
const fixedAmplitude = 3;

const light = new THREE.DirectionalLight(0xffffff, lightIntensity);
light.position.set(3, 5, 4);
scene.add(light);

const light2 = new THREE.DirectionalLight(0xffffff, lightIntensity);
light2.position.set(-3, -5, -3);
scene.add(light2);

// === Create cubes ===
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

const boxGeometry = new THREE.BoxGeometry(size, size, size);
const boxMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
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

// Compute group direction vectors
const sceneCenter = new THREE.Vector3(0, 0, 0);
for (let j = 1; j <= groupNum; j++) {
  scene.add(groupArray[j]);
  const groupCenter = getGroupCenter(groupArray[j]);
  const direction = groupCenter.clone().sub(sceneCenter).normalize();
  groupDirectionArray.push(direction);
}

function getGroupCenter(group) {
  const center = new THREE.Vector3();
  group.children.forEach((child) => {
    center.add(child.getWorldPosition(new THREE.Vector3()));
  });
  center.divideScalar(group.children.length);
  return center;
}

// === Microphone audio analysis ===
let analyser, dataArray;
navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const mic = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  mic.connect(analyser);
  dataArray = new Uint8Array(analyser.fftSize);
});

function getMicAmplitude() {
  if (!analyser || !dataArray) return 0;
  analyser.getByteTimeDomainData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    let value = dataArray[i] - 128;
    sum += value * value;
  }
  return Math.sqrt(sum / dataArray.length); // RMS amplitude
}

// === Animation control ===
const AMP_THRESHOLD = 4;
const DEBOUNCE_FRAMES = 120;
let lowAmpFrameCount = 0;
let isActive = false;

// === Rotation state ===
let skipExpandOnce = false;

let isRotating = false;
let rotationSequence = ["top", "right", "bottom", "left"];
let currentRotationIndex = 0;

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && !isRotating) {
    const face = rotationSequence[currentRotationIndex];
    currentRotationIndex = (currentRotationIndex + 1) % rotationSequence.length;

    isRotating = true;
    skipExpandOnce = true;

    rotateAnimated(face, "clockwise", Math.PI / 2, groupArray, () => {
      isRotating = false;
    });
  }
});

// === Animation loop ===
let frame = 0;
function animate() {
  frame += 1;
  requestAnimationFrame(animate);

  let rawAmp = getMicAmplitude();
  if (rawAmp < 1) rawAmp = 0;
  console.log(rawAmp);
  if (rawAmp > AMP_THRESHOLD) {
    lowAmpFrameCount = 0;
    isActive = true;
  } else {
    lowAmpFrameCount++;
    if (lowAmpFrameCount >= DEBOUNCE_FRAMES) {
      isActive = false;
    }
  }

  for (let i = 1; i <= groupNum; i++) {
    const group = groupArray[i];
    const dir = groupDirectionArray[i];

    let motionScale = 0;
    if (!skipExpandOnce) {
      const speed = isActive ? 0.05 : 0.01;
      const wave = Math.sin(frame * speed);
      motionScale = fixedAmplitude * (wave * 0.3 + Math.abs(wave) * 0.7);
    } else {
      skipExpandOnce = false; // only skip once
    }

    const offset = dir.clone().multiplyScalar(motionScale);
    group.position.copy(offset);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

function createGradientCube(position) {
  const geometry = new THREE.BoxGeometry(size, size, size);

  const gradientIndex = 5; // Or pick randomly
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
