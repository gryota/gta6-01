// Neon Harbor — render.js
// The three.js stage: dusk sky, warm sun, fog, the chase camera, and the
// merged-geometry meshes for cars, the player and pedestrians. One draw call
// per vehicle or person (body, cabin and wheels merged with vertex colours).

import * as THREE from 'three';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const C = (hex) => new THREE.Color(hex);

// Merge box/cylinder parts (same helper shape as city.js, local copy so the
// renderer does not depend on the city builder).
function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  for (const part of parts) {
    const geo = part.geo.index ? part.geo.toNonIndexed() : part.geo;
    geo.applyMatrix4(part.matrix);
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const count = geo.attributes.position.count;
    for (let i = 0; i < count; i += 1) {
      positions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      normals.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
      colors.push(part.color.r, part.color.g, part.color.b);
    }
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return out;
}

function matrix(x, y, z, ry, sx, sy, sz) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

const CAR_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 });

// A car: body, cabin, four wheels, headlights. Police adds a light bar.
export function buildCarMesh(color, isPolice) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const parts = [
    { geo: box.clone(), matrix: matrix(0, 0.55, 0, 0, 2, 0.7, 4.4), color: C(color) },
    { geo: box.clone(), matrix: matrix(0, 1.15, 0.3, 0, 1.7, 0.6, 2.2), color: C(color) },
    { geo: box.clone(), matrix: matrix(0, 0.9, -2.05, 0, 1.8, 0.25, 0.15), color: C(0xfff2c0) },
    { geo: box.clone(), matrix: matrix(0, 0.9, 2.2, 0, 1.8, 0.25, 0.15), color: C(0xff3b30) },
  ];
  for (const [wx, wz] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 1.5], [0.95, 1.5]]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10), matrix: new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(wx, 0.36, wz), color: C(0x14161a) });
  }
  if (isPolice) {
    parts.push({ geo: box.clone(), matrix: matrix(-0.4, 1.55, 0.3, 0, 0.7, 0.22, 0.5), color: C(0xff2d2d) });
    parts.push({ geo: box.clone(), matrix: matrix(0.4, 1.55, 0.3, 0, 0.7, 0.22, 0.5), color: C(0x2d7dff) });
    parts.push({ geo: box.clone(), matrix: matrix(0, 0.55, -2.2, 0, 1.9, 0.5, 0.1), color: C(0xffffff) });
  }
  const mesh = new THREE.Mesh(mergeParts(parts), CAR_MAT);
  mesh.castShadow = false;
  return mesh;
}

// A person on foot: torso, head, legs, arms — one merged mesh.
export function buildPersonMesh(color) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  const parts = [
    { geo: box.clone(), matrix: matrix(0, 1.05, 0, 0, 0.62, 0.75, 0.36), color: C(color) },
    { geo: box.clone(), matrix: matrix(0, 1.62, 0, 0, 0.4, 0.4, 0.4), color: C(0xe8b88a) },
    { geo: box.clone(), matrix: matrix(-0.16, 0.45, 0, 0, 0.22, 0.9, 0.26), color: C(0x2c2f36) },
    { geo: box.clone(), matrix: matrix(0.16, 0.45, 0, 0, 0.22, 0.9, 0.26), color: C(0x2c2f36) },
    { geo: box.clone(), matrix: matrix(-0.42, 1.05, 0, 0, 0.16, 0.7, 0.22), color: C(color) },
    { geo: box.clone(), matrix: matrix(0.42, 1.05, 0, 0, 0.16, 0.7, 0.22), color: C(color) },
  ];
  const mesh = new THREE.Mesh(mergeParts(parts), CAR_MAT);
  return mesh;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  // Dusk: a warm orange horizon fading to deep violet above.
  scene.background = new THREE.Color(0x2a1e3f);
  scene.fog = new THREE.Fog(0x3a2a4d, 90, 320);

  const hemi = new THREE.HemisphereLight(0xffd9a0, 0x2a2438, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-120, 90, -60);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x7a86ff, 0.35);
  fill.position.set(80, 60, 120);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    scene,
    camera,
    // Chase camera: behind the target, at yaw/pitch, smoothed.
    updateCamera(target, yaw, pitch, dist, dt) {
      const k = 1 - Math.exp(-8 * dt);
      const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
      const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
      const cy = 4 + Math.sin(pitch) * dist;
      camera.position.x += (cx - camera.position.x) * k;
      camera.position.y += (cy - camera.position.y) * k;
      camera.position.z += (cz - camera.position.z) * k;
      camera.lookAt(target.x, 2.2, target.z);
    },
    render() {
      renderer.render(scene, camera);
    },
  };
}
