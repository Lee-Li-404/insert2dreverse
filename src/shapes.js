import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function loadSVGShape(url, targetRadius = 1) {
  return new Promise((resolve, reject) => {
    const loader = new SVGLoader();
    loader.load(
      url,
      (data) => {
        const paths = data.paths;
        const shapes = [];
        for (let path of paths) {
          const s = path.toShapes(true); // 强制闭合
          shapes.push(...s);
        }

        if (shapes.length === 0) {
          reject("No shape found in SVG");
          return;
        }

        const shape = shapes[0];
        if (!(shape instanceof THREE.Shape)) {
          reject("Invalid shape type");
          return;
        }

        // 居中 + 缩放
        let minX = Infinity,
          maxX = -Infinity,
          minY = Infinity,
          maxY = -Infinity;
        shape.getPoints().forEach((pt) => {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        });
        const width = maxX - minX;
        const height = maxY - minY;
        const maxDim = Math.max(width, height);
        const offsetX = -(minX + width / 2);
        const offsetY = -(minY + height / 2);
        const scale = targetRadius / (maxDim / 2);

        // 更新曲线控制点
        shape.curves.forEach((curve) => {
          ["v0", "v1", "v2"].forEach((k) => {
            if (curve[k]) {
              curve[k].x = (curve[k].x + offsetX) * scale;
              curve[k].y = (curve[k].y + offsetY) * scale;
            }
          });
        });

        resolve(shape);
      },
      undefined,
      reject
    );
  });
}

export const hexVerts = []; // 用于碰撞检测

function generateFlowerShape(radius) {
  const shape = new THREE.Shape();
  const petalRadius = radius * 0.6;
  const center = 0;
  const petals = 6;

  for (let i = 0; i < petals; i++) {
    const angle = (i / petals) * Math.PI * 2;
    const nextAngle = ((i + 1) / petals) * Math.PI * 2;

    const x1 = Math.cos(angle) * petalRadius;
    const y1 = Math.sin(angle) * petalRadius;
    const x2 = Math.cos(nextAngle) * petalRadius;
    const y2 = Math.sin(nextAngle) * petalRadius;

    if (i === 0) {
      shape.moveTo(0, 0);
      shape.lineTo(x1, y1);
    }

    // 用二次贝塞尔曲线画花瓣弧线，控制点在外面，形成圆润花瓣
    const cx = Math.cos((angle + nextAngle) / 2) * petalRadius * 1.3;
    const cy = Math.sin((angle + nextAngle) / 2) * petalRadius * 1.3;

    shape.quadraticCurveTo(cx, cy, x2, y2);
    shape.lineTo(0, 0);
  }

  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function generateButterflyShape(radius) {
  const shape = new THREE.Shape();

  // 从中心底部开始
  shape.moveTo(0, 0);

  // 左翅膀：三段贝塞尔曲线构成
  shape.bezierCurveTo(
    -radius * 0.5,
    radius * 0.5,
    -radius * 1.2,
    radius * 1.2,
    0,
    radius * 2
  );
  shape.bezierCurveTo(
    -radius * 0.3,
    radius * 1.5,
    -radius * 0.1,
    radius * 0.8,
    0,
    0
  );

  // 右翅膀：对称左翅膀
  shape.bezierCurveTo(
    radius * 0.5,
    radius * 0.5,
    radius * 1.2,
    radius * 1.2,
    0,
    radius * 2
  );
  shape.bezierCurveTo(
    radius * 0.3,
    radius * 1.5,
    radius * 0.1,
    radius * 0.8,
    0,
    0
  );

  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

function generateMusicNoteShape(radius) {
  const shape = new THREE.Shape();

  // 音符圆头（实心圆）
  const circleRadius = radius * 0.4;
  shape.absarc(0, 0, circleRadius, 0, Math.PI * 2, false);

  // 音符杆（矩形）
  const stemWidth = radius * 0.1;
  const stemHeight = radius * 1.2;
  shape.moveTo(circleRadius, 0);
  shape.lineTo(circleRadius + stemWidth, 0);
  shape.lineTo(circleRadius + stemWidth, stemHeight);
  shape.lineTo(circleRadius, stemHeight);
  shape.closePath();

  return new THREE.ShapeGeometry(shape);
}
function generateHeartGeometry(radius) {
  const x = 0,
    y = 0;
  const heartShape = new THREE.Shape();

  heartShape.moveTo(x, y + radius / 2);
  heartShape.bezierCurveTo(
    x + radius,
    y + radius,
    x + radius * 3,
    y,
    x,
    y - radius * 2
  );
  heartShape.bezierCurveTo(
    x - radius * 3,
    y,
    x - radius,
    y + radius,
    x,
    y + radius / 2
  );

  return new THREE.ShapeGeometry(heartShape);
}

function generateCloudGeometry(radius) {
  const group = new THREE.Group();
  const sphereGeom = new THREE.SphereGeometry(radius * 0.6, 16, 16);

  const positions = [
    [0, 0, 0],
    [radius * 0.7, 0, 0],
    [-radius * 0.7, 0, 0],
    [0, radius * 0.4, 0],
  ];

  positions.forEach((pos) => {
    const mesh = new THREE.Mesh(sphereGeom);
    mesh.position.set(...pos);
    group.add(mesh);
  });

  // 使用导入的 BufferGeometryUtils 合并
  const merged = BufferGeometryUtils.mergeGeometries(
    group.children.map((m) =>
      m.geometry.clone().translate(m.position.x, m.position.y, m.position.z)
    ),
    false
  );

  return merged;
}

function generateCircleShape(radius, segments = 64) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function generatePolygonShape(sides, radius) {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function generateOrganicShape(radius, irregularity = 0.2, points = 32) {
  const shape = new THREE.Shape();
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = radius * (1 - irregularity / 2 + Math.random() * irregularity);
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function generateStarShape(points, innerR, outerR) {
  const shape = new THREE.Shape();
  const step = Math.PI / points;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = i * step;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function generateRandomShapeGeometry(radius) {
  const type = Math.floor(Math.random() * 10); // 0 到 11 的整数随机数
  let geo;

  switch (type) {
    case 0:
      geo = new THREE.ShapeGeometry(generateCircleShape(radius, 64));
      break;
    case 1:
      geo = new THREE.ShapeGeometry(generatePolygonShape(3, radius));
      break;
    case 2:
      geo = new THREE.ShapeGeometry(generatePolygonShape(5, radius));
      break;
    case 3:
      geo = new THREE.ShapeGeometry(generatePolygonShape(6, radius));
      break;
    case 4:
      geo = new THREE.ShapeGeometry(generateStarShape(5, radius * 0.5, radius));
      break;
    case 5:
      geo = new THREE.ShapeGeometry(generateOrganicShape(radius, 0.25, 32));
      break;
    case 6:
      geo = new THREE.ShapeGeometry(generateOrganicShape(radius, 0.1, 16));
      break;
    case 7: // 纯 BufferGeometry 示例：立方体
      geo = new THREE.BoxGeometry(radius * 2, radius * 2, 0.1);
      break;
    case 8: // 爱心
      geo = generateHeartGeometry(radius);
      break;
    case 9: // 云朵
      geo = generateCloudGeometry(radius);
      break;

    case 10: // 云朵
      geo = generateMusicNoteShape(radius);
      break;
  }

  return geo;
}
