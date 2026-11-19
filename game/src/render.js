// Neon Harbor — render.js
// Renderer, scene and camera setup plus the small geometry kit the rest of
// the game builds from: canvas textures (windows, neon signs), a merge
// helper that welds boxes/cylinders/spheres into one vertex-coloured mesh
// (one draw call per vehicle or pedestrian), and the vehicle/person builders.

import * as THREE from 'three';

export function createRenderer(canvas) {
  // No MSAA: in software rendering it costs far more than it shows.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2e2140, 120, 520);
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, 14);

  const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x1a1410, 1.05);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x403050, 0.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-120, 180, -80);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x5a6ab8, 0.5);
  fill.position.set(140, 90, 160);
  scene.add(fill);
  return { renderer, scene, camera };
}

export function makeCanvasTexture(width, height, draw) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  draw(c.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Windows texture for building facades: dark glass with lit windows. */
export function makeWindowsTexture() {
  return makeCanvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = '#20242e';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 12; y += 22) {
      for (let x = 8; x < w - 12; x += 18) {
        const lit = Math.random();
        if (lit < 0.55) g.fillStyle = Math.random() < 0.5 ? '#ffd27a' : '#7ad4ff';
        else g.fillStyle = '#10131c';
        g.fillRect(x, y, 11, 14);
      }
    }
  });
}

/** A glowing neon sign texture with the given text. */
export function makeNeonTexture(text, color = '#ff5ad0', sub = '') {
  return makeCanvasTexture(512, 160, (g, w, h) => {
    g.fillStyle = '#0a0614';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.strokeRect(6, 6, w - 12, h - 12);
    g.font = 'bold 64px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 26;
    g.fillStyle = color;
    g.fillText(text, w / 2, sub ? h / 2 - 22 : h / 2);
    if (sub) {
      g.font = 'bold 30px Arial, sans-serif';
      g.shadowBlur = 12;
      g.fillText(sub, w / 2, h / 2 + 42);
    }
  });
}

/**
 * Weld several transformed geometries into one BufferGeometry with a
 * per-vertex color attribute. parts: [{ geo, matrix, color }].
 */
export function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  let base = 0;
  const col = new THREE.Color();
  for (const part of parts) {
    const geo = part.geo.clone();
    if (part.matrix) geo.applyMatrix4(part.matrix);
    col.set(part.color);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      colors.push(col.r, col.g, col.b);
    }
    if (geo.index) {
      for (let i = 0; i < geo.index.count; i++) indices.push(geo.index.getX(i) + base);
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(base + i);
    }
    base += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.setIndex(indices);
  return out;
}

const vehicleMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 });
const personMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });

function box(w, h, d, x, y, z, color) {
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  return { geo: new THREE.BoxGeometry(w, h, d), matrix: m, color };
}

function cylY(rTop, rBottom, h, x, y, z, color) {
  const m = new THREE.Matrix4().makeTranslation(x, y, z);
  return { geo: new THREE.CylinderGeometry(rTop, rBottom, h, 10), matrix: m, color };
}

/** One-draw-call car: body, cabin, wheels, lights. Forward is -Z. */
export function makeVehicleMesh(color, isPolice = false) {
  const parts = [
    box(1.9, 0.62, 4.1, 0, 0.55, 0, color),
    box(1.7, 0.55, 2.1, 0, 1.1, 0.25, isPolice ? 0x14181f : 0x1a2028),
    box(1.92, 0.14, 0.5, 0, 0.62, -1.95, 0xfff2b0),
    box(1.92, 0.14, 0.3, 0, 0.62, 2.0, 0xff2a2a),
  ];
  for (const [x, z] of [[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]]) {
    const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(x, 0.34, z);
    parts.push({ geo: new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10), matrix: m, color: 0x0c0c0e });
  }
  if (isPolice) {
    parts.push(box(1.2, 0.16, 0.5, 0, 1.48, 0.25, 0x223344));
    parts.push(box(0.5, 0.18, 0.52, -0.3, 1.5, 0.25, 0xff2020));
    parts.push(box(0.5, 0.18, 0.52, 0.3, 1.5, 0.25, 0x2060ff));
    parts.push(box(1.94, 0.3, 4.14, 0, 0.55, 0, 0xf2f2f2));
  }
  const mesh = new THREE.Mesh(mergeParts(parts), vehicleMaterial);
  mesh.castShadow = false;
  return mesh;
}

/** One-draw-call pedestrian: legs, torso, head. Forward is -Z. */
export function makePersonMesh(shirt, skin = 0xc89878, pants = 0x2a2f3a) {
  const parts = [
    box(0.34, 0.7, 0.2, -0.12, 0.35, 0, pants),
    box(0.34, 0.7, 0.2, 0.12, 0.35, 0, pants),
    box(0.72, 0.75, 0.4, 0, 1.05, 0, shirt),
    { geo: new THREE.SphereGeometry(0.24, 10, 8), matrix: new THREE.Matrix4().makeTranslation(0, 1.66, 0), color: skin },
  ];
  const mesh = new THREE.Mesh(mergeParts(parts), personMaterial);
  return mesh;
}

/** The player character: dark jacket, red scarf stripe. */
export function makePlayerMesh() {
  const parts = [
    box(0.34, 0.7, 0.2, -0.12, 0.35, 0, 0x1c1c22),
    box(0.34, 0.7, 0.2, 0.12, 0.35, 0, 0x1c1c22),
    box(0.74, 0.78, 0.42, 0, 1.06, 0, 0x232830),
    box(0.76, 0.16, 0.44, 0, 1.32, 0, 0xc22a2a),
    { geo: new THREE.SphereGeometry(0.25, 10, 8), matrix: new THREE.Matrix4().makeTranslation(0, 1.68, 0), color: 0xd8a888 },
    box(0.3, 0.1, 0.3, 0, 1.86, 0, 0x2a2a2a),
  ];
  return new THREE.Mesh(mergeParts(parts), personMaterial);
}
