import * as THREE from "three";
import gsap from "gsap";
import { generateRandomShapeGeometry, hexVerts } from "./shapes.js";

// === Scene ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
camera.position.z = 1;

scene.add(new THREE.AmbientLight(0xffffff, 10));

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);
renderer.outputColorSpace = THREE.SRGBColorSpace;

function resize() {
  const aspect = window.innerWidth / window.innerHeight;
  const zoom = 1;
  camera.left = -zoom * aspect;
  camera.right = zoom * aspect;
  camera.top = zoom;
  camera.bottom = -zoom;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", resize);
resize();

// === Globals ===
let exploded = true; // 默认：方块形态
let squareBlocks = []; // 每个小球对应的方块
const SQUARE_SIZE = 0.15; // 方块边长
const BALL_RADIUS = 0.015;

const center = new THREE.Vector3(0, 0, 0);
const balls = []; // { mesh, color, vel, state, containerMesh?, bounds? }

const HEX_RADIUS = 0.28;
let hexMesh = null;
let backMesh = null;
let hexAcceptLights = false; // 关键：六边形是否开始接收光（控制“提前亮”）

const wpos2 = new THREE.Vector2();
function ballInsideHexWorld(b) {
  b.mesh.getWorldPosition(wp); // 取小球的世界坐标
  wpos2.set(wp.x, wp.y);
  return pointInPolygon(wpos2, hexVerts);
}

// === Hex geometry + collision ===
function buildHexShape(radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}
const hexGeo = new THREE.ShapeGeometry(buildHexShape(HEX_RADIUS));

for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  hexVerts.push(
    new THREE.Vector2(Math.cos(a) * HEX_RADIUS, Math.sin(a) * HEX_RADIUS)
  );
}
function pointInPolygon(point, vertices) {
  let inside = false;
  const x = point.x,
    y = point.y;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x,
      yi = vertices[i].y;
    const xj = vertices[j].x,
      yj = vertices[j].y;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInSquare(localPos, halfSize) {
  return (
    localPos.x >= -halfSize &&
    localPos.x <= halfSize &&
    localPos.y >= -halfSize &&
    localPos.y <= halfSize
  );
}

// === Glass shader (shared program) ===
const MAX_LIGHTS = 20;
const glassUniforms = {
  uLightCount: { value: 0 },
  uLightPos: {
    value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Vector2()),
  },
  uLightColor: {
    value: Array.from({ length: MAX_LIGHTS }, () => new THREE.Color()),
  },
  uRadiusWorld: { value: 0.5 },
  uIntensity: { value: 0.75 },
  uGrainScale: { value: 120.0 },
  uGrainAmount: { value: 0.015 },
  uAlpha: { value: 0.72 },
};
const glassMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  uniforms: glassUniforms,
  vertexShader: `
    varying vec2 vWorld;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xy;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    varying vec2 vWorld;
    uniform int   uLightCount;
    uniform vec2  uLightPos[${MAX_LIGHTS}];
    uniform vec3  uLightColor[${MAX_LIGHTS}];
    uniform float uRadiusWorld;
    uniform float uIntensity;
    uniform float uGrainScale;
    uniform float uGrainAmount;
    uniform float uAlpha;

    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
    float noise(vec2 p){
      vec2 i=floor(p), f=fract(p);
      float a=hash(i);
      float b=hash(i+vec2(1.,0.));
      float c=hash(i+vec2(0.,1.));
      float d=hash(i+vec2(1.,1.));
      vec2 u=f*f*(3.-2.*f);
      return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
    }

    void main() {
      vec3 accum = vec3(0.0);
      float sumFall = 0.0;

      for(int i=0;i<${MAX_LIGHTS};i++){
        if(i>=uLightCount) break;
        float dist = length(vWorld - uLightPos[i]);
        float g = (noise(vWorld * uGrainScale + float(i)*13.37) - 0.5) * uGrainAmount;
        dist += g;
        float fall = smoothstep(uRadiusWorld, 0.0, dist);
        fall = pow(fall, 1.35);
        accum += uLightColor[i] * fall;
        sumFall += fall;
      }

      vec3 color = accum * uIntensity;
      float alpha = clamp(sumFall, 0.0, 1.0) * uAlpha;
      gl_FragColor = vec4(color, alpha);
    }
  `,
});
const backMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });

// === Helpers ===
function rand(range = 0.6) {
  return (Math.random() * 2 - 1) * range;
}
async function ensureRandomShapeMeshes() {
  if (!hexMesh) {
    const geo = await generateRandomShapeGeometry(HEX_RADIUS);
    hexMesh = new THREE.Mesh(geo, glassMat);
  }
  if (!backMesh) {
    backMesh = new THREE.Mesh(hexMesh.geometry.clone(), backMat);
    backMesh.position.z = -0.01;
  }
}

function startSquareMotion(meshSquare) {
  const hop = () => {
    gsap.to(meshSquare.position, {
      x: rand(0.65),
      y: rand(0.65),
      duration: 1.2 + Math.random() * 1.2,
      ease: "sine.inOut",
      onComplete: hop,
    });
  };
  hop();
}

// === 方块形态：新增一对（方块 + 小球, 球作为子节点） ===
function addSquareBallPair() {
  const x = rand(0.55);
  const y = rand(0.55);

  // 方块材质（独立 uniforms）
  const mat = glassMat.clone();
  mat.uniforms = THREE.UniformsUtils.clone(glassMat.uniforms);
  mat.uniforms.uLightCount.value = 1;
  mat.uniforms.uRadiusWorld.value = 0.2; // 方块形态：更紧的光斑
  mat.uniforms.uIntensity.value = 0.9;

  const meshSquare = new THREE.Mesh(
    new THREE.PlaneGeometry(SQUARE_SIZE, SQUARE_SIZE),
    mat
  );
  meshSquare.position.set(x, y, 0);
  scene.add(meshSquare);
  squareBlocks.push(meshSquare);

  // 球（方块子节点）
  const color = new THREE.Color().setHSL(Math.random(), 0.75, 0.55);
  const meshBall = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_RADIUS, 32),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true, // 必须要开启
      opacity: 0.3, // 0~1 之间
    })
  );
  meshBall.position.set(0, 0, -0.01);
  meshSquare.add(meshBall);

  const ball = {
    mesh: meshBall,
    color,
    vel: new THREE.Vector2(), // 局部速度
    state: "INSIDE",
    containerMesh: meshSquare,
    bounds: SQUARE_SIZE * 0.5,
  };
  balls.push(ball);

  // 初始化方块 shader 的光源（世界坐标）
  const wp = new THREE.Vector3();
  meshBall.getWorldPosition(wp);
  mat.uniforms.uLightPos.value[0] = new THREE.Vector2(wp.x, wp.y);
  mat.uniforms.uLightColor.value[0] = color.clone();

  // 弹入动画 + 随机移动
  gsap.from(meshSquare.scale, {
    x: 0.01,
    y: 0.01,
    duration: 0.4,
    ease: "back.out(1.7)",
  });
  gsap.from(meshBall.scale, {
    x: 0.01,
    y: 0.01,
    duration: 0.4,
    ease: "back.out(1.7)",
  });
  startSquareMotion(meshSquare);
}

// === push out：把所有方块推出 hex 外圈（六边形先不出现） ===
function pushOutThenGather() {
  // 这里只会在方块形态调用
  if (!exploded) return;

  const lightRadius = 0.2;
  const marginFactor = 3;
  const outerRadius = HEX_RADIUS + lightRadius * marginFactor;

  const tl = gsap.timeline();

  for (const b of balls) {
    if (!b.containerMesh) continue;

    const sq = b.containerMesh;
    // 停掉随机漫步，避免冲突
    gsap.killTweensOf(sq.position);

    // 以当前世界方向推出到 outerRadius
    const wp = new THREE.Vector3();
    sq.getWorldPosition(wp);
    let dir = new THREE.Vector2(wp.x, wp.y);
    if (dir.lengthSq() < 1e-6) {
      const ang = Math.random() * Math.PI * 2;
      dir.set(Math.cos(ang), Math.sin(ang));
    } else {
      dir.normalize();
    }
    const tx = dir.x * outerRadius;
    const ty = dir.y * outerRadius;

    tl.to(sq.position, { x: tx, y: ty, duration: 0.45, ease: "power2.out" }, 0);
  }

  // 等 1 秒让球（子节点）跟上，再开始 gather
  tl.add(() => setTimeout(gatherToHex, 1000));
}

// === 从“方块形态”聚拢到“六边形形态” ===
async function gatherToHex() {
  if (!exploded) return; // 只有在方块形态才能聚拢
  exploded = false;

  hexMesh = null;
  backMesh = null;
  await ensureRandomShapeMeshes();

  // 关键：六边形刚出现时“完全黑”
  hexAcceptLights = false;
  glassUniforms.uLightCount.value = 0;
  glassUniforms.uIntensity.value = 0;

  if (!scene.children.includes(backMesh)) scene.add(backMesh);
  if (!scene.children.includes(hexMesh)) scene.add(hexMesh);

  // 收拢动画：把方块（连带子球）移动到中心
  const tl = gsap.timeline({
    onComplete: () => {
      // 收拢完成：把“球”从方块里拿出来放到场景里（进入世界坐标系）
      const wp = new THREE.Vector3();

      balls.forEach((b) => {
        if (!b.containerMesh) return;
        b.mesh.getWorldPosition(wp);
        scene.add(b.mesh);
        b.mesh.position.copy(wp).setZ(-0.01);

        b.containerMesh = null;
        b.bounds = null;
        b.state = "OUTSIDE";
      });

      // 清理 & 移除所有方块
      squareBlocks.forEach((sq) => {
        gsap.killTweensOf(sq.position);
        sq.geometry.dispose();
        sq.material.dispose();
        scene.remove(sq);
      });
      squareBlocks = [];

      // 再开灯：允许 hex 接收光（动画淡入强度）
      hexAcceptLights = true;
      gsap.to(glassUniforms.uIntensity, {
        value: 0.75,
        duration: 0.3,
        ease: "power1.inOut",
      });
    },
  });

  for (const b of balls) {
    const sq = b.containerMesh;
    if (!sq) continue;
    tl.to(sq.position, { x: 0, y: 0, duration: 0.8, ease: "power2.inOut" }, 0);
    tl.to(
      sq.rotation,
      { z: `+=${Math.PI * 2}`, duration: 0.8, ease: "power2.inOut" },
      0
    );
  }
}

// === 从“六边形形态”炸回“方块形态” ===
function explodeFromHex() {
  if (exploded) return;
  exploded = true;
  hexAcceptLights = false;

  // 从场景移除六边形
  if (hexMesh) scene.remove(hexMesh);
  if (backMesh) scene.remove(backMesh);

  // 为每个球创建方块并随机散开；球变为该方块子节点（局部坐标）
  squareBlocks = [];
  balls.forEach((ball) => {
    const mat = glassMat.clone();
    mat.uniforms = THREE.UniformsUtils.clone(glassMat.uniforms);
    mat.uniforms.uLightCount.value = 1;
    mat.uniforms.uRadiusWorld.value = 0.2;
    mat.uniforms.uIntensity.value = 0.9;

    const sq = new THREE.Mesh(
      new THREE.PlaneGeometry(SQUARE_SIZE, SQUARE_SIZE),
      mat
    );
    sq.position.set(0, 0, 0);
    scene.add(sq);
    squareBlocks.push(sq);

    // 把球挂到方块下面，设局部坐标（0,0）
    const wp = new THREE.Vector3();
    ball.mesh.getWorldPosition(wp); // 先取世界坐标用于过渡
    sq.add(ball.mesh);
    ball.mesh.position.set(0, 0, -0.01);

    // 绑定
    ball.containerMesh = sq;
    ball.bounds = SQUARE_SIZE * 0.5;
    ball.state = "INSIDE";

    // 随机目标点
    const tx = rand(0.55);
    const ty = rand(0.55);

    // 炸开动画（方块动，球跟着动）
    gsap.to(sq.position, { x: tx, y: ty, duration: 1.0, ease: "power2.out" });
    gsap.to(sq.rotation, { z: Math.PI * 2, duration: 1.0, ease: "power2.out" });

    // shader 颜色/位置
    mat.uniforms.uLightColor.value[0] = ball.color.clone();
    mat.uniforms.uLightPos.value[0] = new THREE.Vector2(wp.x, wp.y);

    // 开始随机移动
    startSquareMotion(sq);
  });
}

// === 键盘：A 新增；S pushout→等待→gather；S（hex模式）炸回 ===
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "a") {
    if (exploded) {
      addSquareBallPair(); // 方块形态：A 新增一对
    } else {
      explodeFromHex(); // 六边形形态：切回方块形态
      addSquareBallPair();
    }
  }
  if (k === "s") {
    if (exploded) {
      // 方块形态：先推到外圈，等 1s，再 gather
      pushOutThenGather();
    } else {
      // 六边形形态：炸回方块
      explodeFromHex();
    }
  }
});

// === 开局只有 1 对（1 方块 + 1 小球） ===
addSquareBallPair();

// === Animate ===
const clock = new THREE.Clock();
const tmpV2 = new THREE.Vector2();
const wp = new THREE.Vector3();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  for (const b of balls) {
    const m = b.mesh;
    let inside = false;

    if (!exploded) {
      // 六边形判定（世界坐标；球在 hex 模式下是场景子节点）
      inside = pointInPolygon(new THREE.Vector2(wp.x, wp.y), hexVerts);
    } else {
      // 方块局部判定（球是方块子节点）
      const local = m.position;
      tmpV2.set(local.x, local.y);
      inside = pointInSquare(tmpV2, b.bounds);
    }

    // 状态机
    if (b.state === "OUTSIDE" && inside) b.state = "INSIDE";
    else if (b.state === "INSIDE" && !inside) b.state = "ESCAPING";
    else if (b.state === "ESCAPING" && inside) b.state = "INSIDE";

    // 力 / 加速度
    const acc = new THREE.Vector2();
    if (!exploded) {
      if (b.state === "OUTSIDE") {
        acc
          .set(center.x - m.position.x, center.y - m.position.y)
          .normalize()
          .multiplyScalar(2.5);
      } else if (b.state === "INSIDE") {
        let baseAngle = Math.atan2(b.vel.y, b.vel.x);
        let randOffset = (Math.random() - 0.5) * Math.PI * 1.6;
        let targetAngle = baseAngle + randOffset;
        acc
          .set(Math.cos(targetAngle), Math.sin(targetAngle))
          .multiplyScalar(0.45);
      } else if (b.state === "ESCAPING") {
        acc
          .set(center.x - m.position.x, center.y - m.position.y)
          .normalize()
          .multiplyScalar(0.9);
      }
    } else {
      // 方块局部力学
      const local = m.position;
      if (b.state === "OUTSIDE") {
        acc.set(-local.x, -local.y).normalize().multiplyScalar(2.5);
      } else if (b.state === "INSIDE") {
        let baseAngle = Math.atan2(b.vel.y, b.vel.x);
        let randOffset = (Math.random() - 0.5) * Math.PI * 1.6;
        let targetAngle = baseAngle + randOffset;
        acc
          .set(Math.cos(targetAngle), Math.sin(targetAngle))
          .multiplyScalar(0.45);
      } else if (b.state === "ESCAPING") {
        acc.set(-local.x, -local.y).normalize().multiplyScalar(0.9);
      }
    }

    // 速度积分
    b.vel.add(acc.multiplyScalar(dt));
    b.vel.multiplyScalar(0.995);
    const speed = b.vel.length();
    if (speed > 0.5) b.vel.multiplyScalar(0.5 / speed);
    if (speed < 0.05) {
      const ang = Math.random() * Math.PI * 2;
      b.vel.set(Math.cos(ang), Math.sin(ang)).multiplyScalar(0.05);
    }

    // 位移
    m.position.x += b.vel.x * dt;
    m.position.y += b.vel.y * dt;
  }

  // 六边形形态：更新统一 shader 的光源（只有 hexAcceptLights==true 才接光）
  // 六边形形态：更新统一 shader 的光源
  if (!exploded && hexMesh) {
    // 如果还没开灯，就检测是否有小球接触到 hex
    if (!hexAcceptLights) {
      for (const b of balls) {
        b.mesh.getWorldPosition(wp);
        if (pointInPolygon(new THREE.Vector2(wp.x, wp.y), hexVerts)) {
          hexAcceptLights = true;
          break;
        }
      }
    }

    if (!hexAcceptLights) {
      glassUniforms.uLightCount.value = 0; // 继续全黑
    } else {
      // 统计所有在 hex 内的小球
      const trapped = [];
      for (const b of balls) {
        if (ballInsideHexWorld(b)) trapped.push(b);
      }

      const n = Math.min(trapped.length, MAX_LIGHTS);
      glassUniforms.uLightCount.value = n;
      glassUniforms.uIntensity.value = 0.75 / Math.pow(Math.max(1, n), 0.3);

      for (let i = 0; i < n; i++) {
        const bb = trapped[i];
        bb.mesh.getWorldPosition(wp); // 用世界坐标更新光源
        glassUniforms.uLightPos.value[i].set(wp.x, wp.y);
        glassUniforms.uLightColor.value[i].copy(bb.color);
      }
    }
  }

  // 方块形态：每个方块自己的 shader 用球的世界坐标
  if (exploded) {
    for (const b of balls) {
      if (!b.containerMesh) continue;
      b.mesh.getWorldPosition(wp);
      const mat = b.containerMesh.material;
      mat.uniforms.uLightPos.value[0].set(wp.x, wp.y);
      mat.uniforms.uLightColor.value[0].copy(b.color);
    }
  }

  renderer.render(scene, camera);
}

animate();
