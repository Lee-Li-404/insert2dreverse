import * as THREE from "three";
import gsap from "gsap";

// === Scene ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10);
camera.position.z = 1;

// 环境光
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

// === Hexagon geometry ===
const HEX_RADIUS = 0.28;
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
const hexShape = buildHexShape(HEX_RADIUS);
const hexGeo = new THREE.ShapeGeometry(hexShape);

// === Glass shader ===
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

const hexMesh = new THREE.Mesh(hexGeo, glassMat);
scene.add(hexMesh);

// 背板
const backMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
const backMesh = new THREE.Mesh(hexGeo, backMat);
backMesh.position.z = -0.01;
scene.add(backMesh);

// === Hex collision data ===
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

// === Balls ===
const BALL_RADIUS = 0.03;
const center = new THREE.Vector3(0, 0, 0);
const balls = [];

function spawnBall() {
  const side = Math.random() < 0.5 ? -0.6 : 0.6;
  const y = (Math.random() - 0.5) * 1;
  const color = new THREE.Color().setHSL(Math.random(), 0.75, 0.55);
  const mat = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(BALL_RADIUS, 32), mat);
  mesh.position.set(side, y, -0.01);
  scene.add(mesh);
  balls.push({
    mesh,
    color,
    trapped: false,
    vel: new THREE.Vector2(),
    state: "OUTSIDE",
  });
}

// === Snapshot logic ===
function snapshotAndExplode() {
  // 1) 暂时隐藏小球，避免被拍进贴图
  balls.forEach((b) => (b.mesh.visible = false));

  // 2) 截屏到 RenderTarget（包含玻璃光效）
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  renderer.setRenderTarget(rt);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  // 3) 恢复小球显示
  balls.forEach((b) => (b.mesh.visible = true));

  // 4) 移除原六边形（用碎片替代）
  if (hexMesh) scene.remove(hexMesh);
  if (backMesh) scene.remove(backMesh);

  // 5) 六边形顶点（世界坐标）
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    verts.push(
      new THREE.Vector3(Math.cos(a) * HEX_RADIUS, Math.sin(a) * HEX_RADIUS, 0)
    );
  }
  const centerV = new THREE.Vector3(0, 0, 0);

  // —— 用屏幕坐标计算 UV —— //
  const worldToUv = (v3) => {
    const p = v3.clone();
    // 如果你的六边形有位移/旋转/缩放，改成：p.applyMatrix4(hexMesh.matrixWorld);
    p.project(camera); // NDC [-1,1]
    return new THREE.Vector2((p.x + 1) * 0.5, (p.y + 1) * 0.5); // UV [0,1]
  };

  // 6) 所有碎片共用一个材质（同一张 snapshot 纹理）
  const sharedMat = new THREE.MeshBasicMaterial({
    map: rt.texture,
    transparent: true,
    side: THREE.DoubleSide,
  });

  // 7) 生成 6 片三角碎片（中心 + 邻接两顶点），每片自有屏幕UV
  const fragments = [];
  for (let i = 0; i < 6; i++) {
    const v1 = centerV;
    const v2 = verts[i];
    const v3 = verts[(i + 1) % 6];

    // 顶点位置（真正的三角面）
    const positions = new Float32Array([
      v1.x,
      v1.y,
      0,
      v2.x,
      v2.y,
      0,
      v3.x,
      v3.y,
      0,
    ]);

    // 屏幕空间 UV（保证每片采样的是自己对应的截图区域）
    const uv1 = worldToUv(v1);
    const uv2 = worldToUv(v2);
    const uv3 = worldToUv(v3);
    const uvs = new Float32Array([uv1.x, uv1.y, uv2.x, uv2.y, uv3.x, uv3.y]);

    const triGeo = new THREE.BufferGeometry();
    triGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    triGeo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    // 索引明示为一个三角面，确保“填满”而不是线
    triGeo.setIndex([0, 1, 2]);

    const triMesh = new THREE.Mesh(triGeo, sharedMat);
    scene.add(triMesh);
    fragments.push(triMesh);
  }

  // 8) 爆裂动画（可选）
  fragments.forEach((frag, i) => {
    const angle = (i / fragments.length) * Math.PI * 2;
    const r = 0.65; // 爆裂半径，想更大就调大
    const target = { x: Math.cos(angle) * r, y: Math.sin(angle) * r };

    if (typeof gsap !== "undefined") {
      gsap.to(frag.position, {
        x: target.x,
        y: target.y,
        duration: 1.1,
        ease: "power2.out",
      });
      gsap.to(frag.rotation, { z: Math.PI * 2, duration: 1.1 });
    } else {
      // 没引入 gsap 就直接瞬移，防报错
      frag.position.set(target.x, target.y, 0);
      frag.rotation.z = Math.PI * 2;
    }
  });

  console.log(
    "💥 exploded into 6 screen-UV mapped triangles (filled, no black)."
  );
}

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "a") spawnBall();
  if (e.key.toLowerCase() === "s") snapshotAndExplode();
});

// === Animate ===
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  for (const b of balls) {
    const m = b.mesh;
    const pos2 = new THREE.Vector2(m.position.x, m.position.y);
    const inside = pointInConvexPolygon(pos2);
    const acc = new THREE.Vector2();

    if (b.state === "OUTSIDE" && inside) b.state = "INSIDE";
    else if (b.state === "INSIDE" && !inside) b.state = "ESCAPING";
    else if (b.state === "ESCAPING" && inside) b.state = "INSIDE";

    if (b.state === "OUTSIDE") {
      acc.copy(center).sub(m.position).normalize().multiplyScalar(2.5);
    } else if (b.state === "INSIDE") {
      let baseAngle = Math.atan2(b.vel.y, b.vel.x);
      let randOffset = (Math.random() - 0.5) * Math.PI * 1.6;
      let targetAngle = baseAngle + randOffset;
      acc
        .set(Math.cos(targetAngle), Math.sin(targetAngle))
        .multiplyScalar(0.45);
    } else if (b.state === "ESCAPING") {
      acc.copy(center).sub(m.position).normalize().multiplyScalar(0.9);
    }

    b.vel.add(acc.multiplyScalar(dt));
    b.vel.multiplyScalar(0.995);
    const speed = b.vel.length();
    if (speed > 0.5) b.vel.multiplyScalar(0.5 / speed);
    if (speed < 0.05) {
      const ang = Math.random() * Math.PI * 2;
      b.vel.set(Math.cos(ang), Math.sin(ang)).multiplyScalar(0.05);
    }
    m.position.x += b.vel.x * dt;
    m.position.y += b.vel.y * dt;
  }

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
    glassUniforms.uLightPos.value[i].set(b.mesh.position.x, b.mesh.position.y);
    glassUniforms.uLightColor.value[i].copy(b.color);
  }

  renderer.render(scene, camera);
}
animate();
