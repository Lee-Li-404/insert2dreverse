import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";

export function loadSVGShape(url, targetRadius = 1) {
  return new Promise((resolve, reject) => {
    const loader = new SVGLoader();
    loader.load(
      url,
      (data) => {
        const shapes = [];
        data.paths.forEach((path) => {
          shapes.push(...path.toShapes(true)); // 强制闭合
        });

        if (shapes.length === 0) {
          reject("No shape found in SVG");
          return;
        }

        // 合并成一个 ShapeGeometry
        const geo = new THREE.ShapeGeometry(shapes);

        // 缩放 + 平移到中心
        geo.computeBoundingBox();
        const box = geo.boundingBox;
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y);
        const scale = targetRadius / (maxDim / 2);

        const offset = new THREE.Vector3();
        box.getCenter(offset).multiplyScalar(-1);
        geo.translate(offset.x, offset.y, 0);
        geo.scale(scale, scale, 1);

        resolve(geo);
      },
      undefined,
      reject
    );
  });
}

export const hexVerts = []; // 用于碰撞检测

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

export async function generateRandomShapeGeometry(radius) {
  const type = Math.floor(Math.random() * 8); // 8种类型（加了 SVG）
  let shape;

  switch (type) {
    case 0:
      shape = generateCircleShape(radius, 64);
      break;
    case 1:
      shape = generatePolygonShape(3, radius);
      break;
    case 2:
      shape = generatePolygonShape(5, radius);
      break;
    case 3:
      shape = generatePolygonShape(6, radius);
      break;
    case 4:
      shape = generateStarShape(5, radius * 0.5, radius);
      break;
    case 5:
      shape = generateOrganicShape(radius, 0.25, 32);
      break;
    case 6:
      shape = generateOrganicShape(radius, 0.1, 16);
      break;
    case 7: // SVG 模式
      const geo = await loadSVGShape("/square-full-solid.svg", radius);

      // 更新碰撞检测顶点
      hexVerts.length = 0;
      const pos = geo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        hexVerts.push(new THREE.Vector2(pos[i], pos[i + 1]));
      }

      return geo;
  }

  const geo = new THREE.ShapeGeometry(shape);

  // 更新碰撞检测顶点
  hexVerts.length = 0;
  const pts = shape.getPoints();
  for (let p of pts) hexVerts.push(new THREE.Vector2(p.x, p.y));

  return geo;
}
