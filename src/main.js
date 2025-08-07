import * as THREE from "three";
import gsap from "gsap";

// === Scene Setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.z = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });
document.body.style.margin = 0;
document.body.appendChild(renderer.domElement);

// === Resize ===
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

// === Material ===
const blackMat = new THREE.MeshBasicMaterial({ color: 0xffd580 });

// === Central Ball ===
const center = new THREE.Vector3(0, 0, 0);
let centralBall = new THREE.Mesh(new THREE.CircleGeometry(0.2, 64), blackMat);
centralBall.position.copy(center);
centralBall.scale.set(1, 1, 1);
scene.add(centralBall);

// === Incoming Balls ===
let incoming = [];
let absorbedCount = 0;
let exploded = false;

// === Spawn ball toward center ===
function spawnBall() {
  if (exploded) return;

  // 随机在屏幕边界附近生成
  const side = Math.random() < 0.5 ? -1.2 : 1.2;
  const y = (Math.random() - 0.5) * 1.8;
  const ball = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), blackMat);
  ball.position.set(side, y, 0);
  ball.userData.absorbing = false;
  scene.add(ball);
  incoming.push(ball);
}

// === Key press: press A to spawn a ball ===
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "a" && !exploded) {
    spawnBall();
  }
});

// === Animate ===
function animate() {
  requestAnimationFrame(animate);

  if (!exploded) {
    for (let i = incoming.length - 1; i >= 0; i--) {
      const ball = incoming[i];

      if (!ball.userData.absorbing) {
        // 小球朝中心飞
        const dir = center.clone().sub(ball.position).normalize();
        ball.position.addScaledVector(dir, 0.01);
      }

      // 碰撞检测
      if (!ball.userData.absorbing && ball.position.distanceTo(center) < 0.22) {
        ball.userData.absorbing = true;

        // 吸收动画
        gsap.to(ball.position, {
          x: center.x,
          y: center.y,
          duration: 0.5,
          ease: "power2.in",
        });

        gsap.to(ball.scale, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: "power2.in",
        });

        // 中心鼓动动画
        gsap.to(centralBall.scale, {
          x: 1.2,
          y: 1.2,
          duration: 0.2,
          yoyo: true,
          repeat: 1,
          ease: "power2.out",
        });

        // 删除小球
        setTimeout(() => {
          scene.remove(ball);
          incoming.splice(i, 1);
          absorbedCount++;
          if (absorbedCount >= 5) explode();
        }, 500);
      }
    }
  }

  renderer.render(scene, camera);
}
animate();

// === Explosion ===
function explode() {
  exploded = true;
  scene.remove(centralBall);

  const blocks = [];
  const size = 0.08;

  for (let i = 0; i < 9; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), blackMat);
    mesh.position.set(0, 0, 0);
    scene.add(mesh);
    blocks.push(mesh);
  }

  blocks.forEach((block, i) => {
    const angle = (i / blocks.length) * Math.PI * 2;
    const targetX = Math.cos(angle) * 0.4;
    const targetY = Math.sin(angle) * 0.4;

    gsap.to(block.position, {
      x: targetX,
      y: targetY,
      duration: 1.2,
      ease: "power2.out",
    });

    gsap.to(block.rotation, {
      z: Math.PI * 2,
      duration: 1.2,
    });
  });
}
