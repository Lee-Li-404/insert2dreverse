import * as THREE from "three";
import gsap from "gsap";

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
const BALL_RADIUS = 0.0000015;

const center = new THREE.Vector3(0, 0, 0);
const balls = []; // { mesh, color, vel, state, containerMesh?, bounds? }

const HEX_RADIUS = 0.28;
let hexMesh = null;
let backMesh = null;

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

const hexVerts = [];
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  hexVerts.push(
    new THREE.Vector2(Math.cos(a) * HEX_RADIUS, Math.sin(a) * HEX_RADIUS)
  );
}
function pointInConvexPolygon(p) {
  for (let i = 0; i < 6; i++) {
    const a = hexVerts[i],
      b = hexVerts[(i + 1) % 6];
    const ab = new THREE.Vector2(b.x - a.x, b.y - a.y);
    const ap = new THREE.Vector2(p.x - a.x, p.y - a.y);
    if (ab.x * ap.y - ab.y * ap.x < 0) return false;
  }
  return true;
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
function ensureHexMeshes() {
  if (!hexMesh) hexMesh = new THREE.Mesh(hexGeo, glassMat);
  if (!backMesh) {
    backMesh = new THREE.Mesh(hexGeo, backMat);
    backMesh.position.z = -0.01;
  }
}
function startSquareMotion(meshSquare) {
  // 递归随机漫步（可叠加），简单粗暴够用；如需更严谨可存 tween 引用并 kill
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

// === 方块形态：新增「方块 + 小球」一对（随机位置 + parenting） ===
function addSquareBallPair() {
  const x = rand(0.55);
  const y = rand(0.55);

  // 方块（单独克隆 shader + 半径更小）
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

  // 球（成为方块的子节点：方块动，球跟着动）
  const color = new THREE.Color().setHSL(Math.random(), 0.75, 0.55);
  const meshBall = new THREE.Mesh(
    new THREE.CircleGeometry(BALL_RADIUS, 32),
    new THREE.MeshBasicMaterial({ color })
  );
  meshBall.position.set(0, 0, -0.01); // 局部坐标
  meshSquare.add(meshBall);

  const ball = {
    mesh: meshBall, // 现在是“局部坐标”的球
    color,
    vel: new THREE.Vector2(), // 局部速度
    state: "INSIDE",
    containerMesh: meshSquare,
    bounds: SQUARE_SIZE * 0.5,
  };
  balls.push(ball);

  // 初始化 shader 的光源位置（需要世界坐标）
  const wp = new THREE.Vector3();
  meshBall.getWorldPosition(wp);
  mat.uniforms.uLightPos.value[0] = new THREE.Vector2(wp.x, wp.y);
  mat.uniforms.uLightColor.value[0] = color.clone();

  // 动效
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

  // 方块随机移动
  startSquareMotion(meshSquare);
}

// === 从“方块形态”聚拢到“六边形形态” ===
function gatherToHex() {
  if (!exploded) return;
  exploded = false;

  ensureHexMeshes();

  const tl = gsap.timeline({
    onComplete: () => {
      // 1) 先把六边形加进场景（现在才出现）
      if (!scene.children.includes(hexMesh)) scene.add(hexMesh);
      if (!scene.children.includes(backMesh)) scene.add(backMesh);

      // 2) 解除 parent：把球摘出来保持世界坐标不跳
      for (const b of balls) {
        if (b.containerMesh) {
          const wp = new THREE.Vector3();
          b.mesh.getWorldPosition(wp);
          scene.add(b.mesh);
          b.mesh.position.copy(wp).setZ(-0.01);
          b.containerMesh = null;
          b.bounds = null;
        }
        b.state = "OUTSIDE";
      }

      // 3) 移除所有方块
      squareBlocks.forEach((sq) => {
        gsap.killTweensOf(sq.position);
        sq.geometry.dispose();
        sq.material.dispose();
        scene.remove(sq);
      });
      squareBlocks = [];

      // 4) 恢复六边形 shader 参数
      glassUniforms.uRadiusWorld.value = 0.5;
      glassUniforms.uIntensity.value = 0.75;
    },
  });

  // 收拢动画（此时 hex 还没加进场景，不会显示）
  for (const b of balls) {
    if (b.containerMesh) {
      const sq = b.containerMesh;
      tl.to(
        sq.position,
        { x: 0, y: 0, duration: 0.8, ease: "power2.inOut" },
        0
      );
    }
  }
}

// === 从“六边形形态”炸回“方块形态” ===
function explodeFromHex() {
  if (exploded) return;
  exploded = true;

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

// === 键盘：A 新增；S 聚拢/炸回 ===
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
      gatherToHex(); // 方块形态：聚拢成六边形
    } else {
      explodeFromHex(); // 六边形形态：再炸回方块（可选）
    }
  }
});

// === 开局只有 1 对（1 方块 + 1 小球） ===
addSquareBallPair();

// === Animate ===
const clock = new THREE.Clock();
const tmpV2 = new THREE.Vector2();

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  for (const b of balls) {
    const m = b.mesh;
    let inside = false;

    if (!exploded) {
      // 六边形判定（世界坐标）
      inside = pointInConvexPolygon(
        new THREE.Vector2(m.position.x, m.position.y)
      );
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

    // 加速度/力
    const acc = new THREE.Vector2();
    if (!exploded) {
      // 六边形：以中心吸引（世界坐标）
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
      // 方块：局部力学（方块中心即 (0,0)）
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

    // 位移：六边形形态下，球在世界坐标移动；方块形态下，球在局部坐标移动
    m.position.x += b.vel.x * dt;
    m.position.y += b.vel.y * dt;
  }

  // 六边形形态：更新统一 shader 的光源
  if (!exploded && hexMesh) {
    const trapped = balls.filter((b) =>
      pointInConvexPolygon(
        new THREE.Vector2(b.mesh.position.x, b.mesh.position.y)
      )
    );
    const n = Math.min(trapped.length, MAX_LIGHTS);
    glassUniforms.uLightCount.value = n;
    glassUniforms.uIntensity.value = 0.75 / Math.pow(Math.max(1, n), 0.3);
    for (let i = 0; i < n; i++) {
      const b = trapped[i];
      glassUniforms.uLightPos.value[i].set(
        b.mesh.position.x,
        b.mesh.position.y
      );
      glassUniforms.uLightColor.value[i].copy(b.color);
    }
  }

  // 方块形态：每个方块自己的 shader 用球的世界坐标
  if (exploded) {
    const wp = new THREE.Vector3();
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
