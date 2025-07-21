import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { groupings } from "./groupings.js";
import { gradientPresets } from "./gradients.js";
import { rotate180 } from "./rotationUtils.js";

// === Setup scene ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfff2e5); // 你可以用任何淡橙色调，比如这个

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

scene.add(new THREE.AmbientLight(0xffffff, 0.4));

const light1 = new THREE.DirectionalLight(0xffffff, lightIntensity);
light1.position.set(3, 5, 4);
scene.add(light1);

const light2 = new THREE.DirectionalLight(0xffffff, lightIntensity * 0.5);
light2.position.set(0, 5, -5);
scene.add(light2);

const light3 = new THREE.DirectionalLight(0xffffff, lightIntensity * 0.5);
light3.position.set(0, -5, -5);
scene.add(light3);

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

const boxMaterial = new THREE.MeshLambertMaterial({
  vertexColors: true,
  flatShading: true,
  transparent: true, // 必须加这一行
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
  return Math.sqrt(sum / dataArray.length);
}

// === Animation control ===
const AMP_THRESHOLD = 4;
const DEBOUNCE_FRAMES = 120;
let lowAmpFrameCount = 0;
let isActive = false;

// === Rotation/Motion state ===
let skipExpandOnce = false;
let isFrozen = false;
let isFreezingToOrigin = false;
const freezeLerpSpeed = 0.009;

let isExploding = false;
let particleArray = [];
let hasExploded = false;
const particleLifespan = 100; // frames

let isRotating = false;
let faceSequence = ["top", "right", "bottom", "left", "front", "back"];
let faceIndex = 0;

window.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !isRotating) {
    const face = faceSequence[faceIndex];
    faceIndex = (faceIndex + 1) % faceSequence.length;

    isRotating = true;
    rotate180(face, groupArray, () => {
      isRotating = false;
    });
  } else if (e.code === "KeyD") {
    isFrozen = true;
    isFreezingToOrigin = true;
  }
});

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

  // === 更新粒子状态 ===
  if (isExploding) {
    for (let i = particleArray.length - 1; i >= 0; i--) {
      const p = particleArray[i];
      p.userData.age++;

      if (p.userData.age > p.userData.delay) {
        const t = p.userData.age - p.userData.delay;
        const total = p.userData.maxAge;
        const fadeIn = p.userData.fadeInFrames;

        // 粒子漂浮
        p.position.add(p.userData.drift);

        // 粒子 fade-in
        if (t <= fadeIn) {
          const fadeRatio = t / fadeIn;
          p.material.opacity = fadeRatio;
          p.scale.setScalar(fadeRatio);
        } else {
          const fadeOutRatio = (t - fadeIn) / (total - fadeIn);
          const eased = 1 - Math.pow(fadeOutRatio, 1.5);
          p.material.opacity = Math.max(eased, 0);
          p.scale.set(eased, eased, eased);
        }

        if (t >= total) {
          scene.remove(p);
          particleArray.splice(i, 1);
        }
      }
    }

    // ✅ ✨ 从这里开始插入 cube 渐隐部分：
    for (let i = 1; i <= groupNum; i++) {
      const group = groupArray[i];
      group.children.forEach((cube) => {
        if (cube.userData.fadeOut) {
          cube.userData.opacity -= 0.01;
          cube.material.opacity = Math.max(cube.userData.opacity, 0);

          // scale 也缩小
          const s = cube.userData.opacity;
          cube.scale.set(s, s, s);
        }
      });
    }

    // 粒子全部淡出后关闭 exploding 状态
    if (particleArray.length === 0) {
      isExploding = false;
      console.log("All particles faded.");
    }
  }

  // === group 移动阶段（向 origin 附近聚拢） ===
  else if (isFreezingToOrigin) {
    let minDistance = Infinity;

    for (let i = 1; i <= groupNum; i++) {
      const group = groupArray[i];
      const currentCenter = getGroupCenter(group);

      // ✅ 设置微偏移目标点，避免 group 重叠堆叠
      const baseTarget = new THREE.Vector3(0, 0, 0);
      const offsetDir = groupDirectionArray[i].clone().negate(); // 朝中心方向
      const target = baseTarget.clone().add(offsetDir.multiplyScalar(1.5)); // 每组微偏移

      const offset = currentCenter
        .clone()
        .lerp(target, freezeLerpSpeed)
        .sub(currentCenter);

      group.position.add(offset);

      // === 设置透明度随距离渐变 ===
      const distance = currentCenter.distanceTo(target);
      minDistance = Math.min(minDistance, distance);

      const fadeRatio = THREE.MathUtils.clamp(distance / 30, 0, 1);
      const opacity = 0.2 + 0.8 * fadeRatio;

      group.children.forEach((cube) => {
        // cube.material.opacity = opacity;
      });
    }

    // ✅ 提前触发颗粒化
    if (minDistance < 11.5 && !isExploding && !hasExploded) {
      triggerExplosion();
      hasExploded = true; // 防止重复触发
    }
  }

  // === 音频驱动阶段 ===
  else if (!isFrozen) {
    for (let i = 1; i <= groupNum; i++) {
      const group = groupArray[i];
      const dir = groupDirectionArray[i];

      let motionScale = 0;
      if (!skipExpandOnce) {
        const speed = isActive ? 0.05 : 0.01;
        const wave = (Math.sin(frame * speed - Math.PI / 2) + 1) / 2;
        motionScale = fixedAmplitude * wave;
      } else {
        skipExpandOnce = false;
      }

      const offset = dir.clone().multiplyScalar(motionScale);
      group.position.copy(offset);

      // 保证重置为不透明
      group.children.forEach((cube) => {
        cube.material.opacity = 1;
      });
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();

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

function triggerExplosion() {
  isExploding = true;

  const allCubePositions = [];
  const allColors = [];

  // === 准备共享几何体和材质缓存 ===
  const sharedGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const sharedMats = {};

  // === 用预设 approximate 位置替代 getWorldPosition ===
  const approxExplosionPosArray = [null];
  for (let i = 1; i <= groupNum; i++) {
    const dir = groupDirectionArray[i].clone().negate(); // 朝 origin
    const basePos = new THREE.Vector3(0, 0, 0).add(dir.multiplyScalar(1.5));
    approxExplosionPosArray.push(basePos);
  }

  for (let i = 1; i <= groupNum; i++) {
    const group = groupArray[i];
    const basePos = approxExplosionPosArray[i];

    group.children.forEach((cube) => {
      // 用 jittered basePos 模拟 cube 坐标
      const jitteredPos = basePos
        .clone()
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 16 + 7,
            (Math.random() - 0.5) * 16 + 7,
            (Math.random() - 0.5) * 16 + 7
          )
        );
      allCubePositions.push(jitteredPos);

      // 标记开始 fade out
      cube.userData.fadeOut = true;
      cube.userData.opacity = cube.material.opacity ?? 1;

      // 平均颜色计算（可保留，非瓶颈）
      const colorAttr = cube.geometry.attributes.color;
      const color = new THREE.Color(0, 0, 0);
      for (let j = 0; j < colorAttr.count; j++) {
        color.r += colorAttr.getX(j);
        color.g += colorAttr.getY(j);
        color.b += colorAttr.getZ(j);
      }
      color.multiplyScalar(1 / colorAttr.count);
      allColors.push(color);
    });
  }

  // === 粒子生成，使用共享几何体 + 材质缓存 ===
  const particleCount = 4000;
  for (let i = 0; i < particleCount; i++) {
    const baseIndex = Math.floor(Math.random() * allCubePositions.length);
    const basePos = allCubePositions[baseIndex];
    const baseColor = allColors[baseIndex];
    const colorKey = baseColor.getHexString();

    if (!sharedMats[colorKey]) {
      sharedMats[colorKey] = new THREE.MeshLambertMaterial({
        color: baseColor.clone(),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
    }

    const particle = new THREE.Mesh(sharedGeo, sharedMats[colorKey]);
    particle.position
      .copy(basePos)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 3.8,
          (Math.random() - 0.5) * 3.8,
          (Math.random() - 0.5) * 3.8
        )
      );
    particle.scale.setScalar(0.5 + Math.random() * 0.8);

    particle.userData = {
      age: 0,
      maxAge: particleLifespan + 60 + Math.floor(Math.random() * 80),
      fadeInFrames: 30,
      delay: Math.floor(Math.random() * 20),
      drift: new THREE.Vector3(
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.03
      ),
    };

    scene.add(particle);
    particleArray.push(particle);
  }
}
