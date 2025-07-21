import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { groupings } from "./groupings.js";

// Scene setup
const scene = new THREE.Scene();
const sceneCenter = new THREE.Vector3(0, 0, 0);
let mic, analyser, dataArray;
let smoothedAmp = 0;
const smoothingFactor = 0.1;

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
const width = 5;
let groupNum = 20;
let cubeArray = [null];
let groupArray = [null];
let groupCenterArray = [null];
let groupDirectionArray = [null];

const groupMomentum = [];

const groupTargetHistory = [];
const historyLength = 5;

for (let i = 1; i <= 8; i++) {
  groupMomentum[i] = { velocity: 0, position: 0 };
  groupTargetHistory[i] = [];
}

for (let i = 1; i < groupNum; i++) {
  const group = new THREE.Group();
  groupArray.push(group);
}

const boxGeometry = new THREE.BoxGeometry(size, size, size);
const boxMaterial = new THREE.MeshNormalMaterial();

// const cube1 = new THREE.Mesh(boxGeometry, boxMaterial);

for (let a = -((width - 1) / 2); a <= (width - 1) / 2; a++) {
  for (let b = -((width - 1) / 2); b <= (width - 1) / 2; b++) {
    for (let c = -((width - 1) / 2); c <= (width - 1) / 2; c++) {
      const cube = new THREE.Mesh(boxGeometry, boxMaterial);
      cube.position.set(a * size * 1, b * size * 1, c * size * 1);
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

for (let j = 1; j <= 8; j++) {
  scene.add(groupArray[j]);
  const groupCenter = getGroupCenter(groupArray[j]);
  groupCenterArray.push(groupCenter);
  const direction = groupCenter.clone().sub(sceneCenter).normalize();
  groupDirectionArray.push(direction);
}

console.log(groupArray[2]);

// const originalPos = lGroup.position.clone(); // 创建副本而不是引用

// Controls
const controls = new OrbitControls(camera, renderer.domElement);

// Animation loop
let frame = 0;

function animate() {
  frame += 1;
  requestAnimationFrame(animate);

  // === Smooth mic amplitude ===
  let rawAmp = getMicAmplitude();
  if (rawAmp < 10) rawAmp = 0;
  smoothedAmp = smoothedAmp * (1 - smoothingFactor) + rawAmp * smoothingFactor;

  for (let i = 1; i <= 8; i++) {
    const group = groupArray[i];
    const dir = groupDirectionArray[i];

    // Outward-biased sine wave
    const biasSin =
      Math.sin(frame * 0.02) * 0.3 + Math.abs(Math.sin(frame * 0.02)) * 0.7;

    // Target based on mic or idle wave
    const activeTarget = smoothedAmp * 0.5;
    const idleWave = 0.8 + 0.5 * Math.sin(frame * 0.01);
    const targetRaw = activeTarget > 0.3 ? activeTarget : idleWave;

    // === Weighted rolling average ===
    const history = groupTargetHistory[i];
    history.push(targetRaw);
    if (history.length > historyLength) history.shift();

    let weightSum = 0;
    let weightedSum = 0;
    for (let j = 0; j < history.length; j++) {
      const weight = j === history.length - 1 ? 3 : 1; // weight the most recent
      weightedSum += history[j] * weight;
      weightSum += weight;
    }
    const target = weightedSum / weightSum;

    // Final position = direction × smoothed target × bias wave
    const offset = dir.clone().multiplyScalar(biasSin * target);
    group.position.copy(offset);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

function getGroupCenter(group) {
  const center = new THREE.Vector3();
  group.children.forEach((child) => {
    center.add(child.getWorldPosition(new THREE.Vector3()));
  });
  center.divideScalar(group.children.length);
  return center;
}

navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  mic = audioCtx.createMediaStreamSource(stream);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;

  mic.connect(analyser);

  dataArray = new Uint8Array(analyser.fftSize);
});

function getMicAmplitude() {
  if (!analyser) return 0;

  analyser.getByteTimeDomainData(dataArray);

  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    let val = dataArray[i] - 128; // center at 0
    sum += val * val;
  }

  const rms = Math.sqrt(sum / dataArray.length);
  return rms; // this is the amplitude (0–~50)
}
