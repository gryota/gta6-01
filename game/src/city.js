// Neon Harbor — city.js
// The city itself: a fictional neon coastal town built from merged geometry
// (a handful of draw calls, not hundreds), with a canvas window texture for
// the towers, neon signs, a dusk sky, the sea, and the Gry Market stall.
// Districts: Portside docks (west), Downtown towers (centre), Old Town
// (north-east, narrow streets), Beachfront (south), Industrial (east).
// Dashes run mid-block only — never across an intersection, where a vertical
// and a horizontal dash would meet and draw a bright cross.

import * as THREE from 'three';
import { STREET_LINES, MAP_HALF, GARAGE, HIDEOUT, SHOP_POS, DOCKS_PICKUP, BEACH_PICKUP } from './config.js';
import { createRandom, range, rangeInt, pick } from './random.js';

function makeCanvas(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture(rng) {
  return makeCanvas(128, 256, (g, w, h) => {
    g.fillStyle = '#1b2334';
    g.fillRect(0, 0, w, h);
    const cols = 8;
    const rows = 16;
    const cw = w / cols;
    const ch = h / rows;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const lit = rng() < 0.45;
        g.fillStyle = lit ? pick(rng, ['#ffd27a', '#ff9d5c', '#9fd8ff', '#ffe9b0']) : '#0d1322';
        g.fillRect(x * cw + 2, y * ch + 3, cw - 4, ch - 6);
      }
    }
  });
}

function signTexture(text, color, bg) {
  return makeCanvas(256, 80, (g, w, h) => {
    g.fillStyle = bg || '#12081f';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = color;
    g.font = 'bold 34px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 16;
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

// Merge a list of parts into one geometry. Each part: { geo, matrix, color }.
// Positions and normals are transformed; every vertex gets the part colour.
function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  let hasUv = false;
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
    if (geo.attributes.uv) {
      hasUv = true;
      const uv = geo.attributes.uv.array;
      for (let i = 0; i < count * 2; i += 1) uvs.push(uv[i]);
    }
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (hasUv && uvs.length === positions.length / 3 * 2) {
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  return out;
}

function matrix(x, y, z, ry, sx, sy, sz) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry || 0, 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

function flatMatrix(x, y, z, ry, sx, sz) {
  // A plane rotated flat (XZ), scaled in X/Z.
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, ry || 0));
  m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sz, 1));
  return m;
}

const C = (hex) => new THREE.Color(hex);

export function buildCity(scene, seed) {
  const rng = createRandom(seed);
  const group = new THREE.Group();
  const colliders = [];

  // --- ground, sea, sand -------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF * 2 + 40, MAP_HALF * 2 + 40),
    new THREE.MeshStandardMaterial({ color: 0x232833, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.1;
  group.add(ground);

  const seaMat = new THREE.MeshStandardMaterial({ color: 0x14506e, roughness: 0.35, metalness: 0.1, emissive: 0x06283d, emissiveIntensity: 0.6 });
  const seaWest = new THREE.Mesh(new THREE.PlaneGeometry(220, MAP_HALF * 2 + 440), seaMat);
  seaWest.rotation.x = -Math.PI / 2;
  seaWest.position.set(-MAP_HALF - 110, -0.4, 0);
  group.add(seaWest);
  const seaSouth = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 2 + 440, 220), seaMat);
  seaSouth.rotation.x = -Math.PI / 2;
  seaSouth.position.set(0, -0.4, MAP_HALF + 110);
  group.add(seaSouth);

  const sandMat = new THREE.MeshStandardMaterial({ color: 0xb59a67, roughness: 1 });
  const sandWest = new THREE.Mesh(new THREE.PlaneGeometry(16, MAP_HALF * 2), sandMat);
  sandWest.rotation.x = -Math.PI / 2;
  sandWest.position.set(-MAP_HALF - 8, 0, 0);
  group.add(sandWest);
  const sandSouth = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 2, 16), sandMat);
  sandSouth.rotation.x = -Math.PI / 2;
  sandSouth.position.set(0, 0, MAP_HALF + 8);
  group.add(sandSouth);

  // --- roads, sidewalks, dashes (merged) ---------------------------------
  const roadParts = [];
  const walkParts = [];
  const dashParts = [];
  const roadGeo = new THREE.PlaneGeometry(1, 1);
  for (const line of STREET_LINES) {
    // Vertical road (along z) and horizontal road (along x).
    roadParts.push({ geo: roadGeo.clone(), matrix: flatMatrix(line, 0.02, 0, 0, 12, MAP_HALF * 2), color: C(0x2b2f3a) });
    roadParts.push({ geo: roadGeo.clone(), matrix: flatMatrix(0, 0.02, line, 0, MAP_HALF * 2, 12), color: C(0x2b2f3a) });
    // Sidewalks flanking each road.
    for (const off of [-8, 8]) {
      walkParts.push({ geo: roadGeo.clone(), matrix: flatMatrix(line + off, 0.06, 0, 0, 4, MAP_HALF * 2), color: C(0x5d6470) });
      walkParts.push({ geo: roadGeo.clone(), matrix: flatMatrix(0, 0.06, line + off, 0, MAP_HALF * 2, 4), color: C(0x5d6470) });
    }
    // Centre dashes, mid-block only: skip any dash within 9 m of a crossing line.
    for (let d = -MAP_HALF + 6; d < MAP_HALF - 6; d += 6) {
      const nearCross = STREET_LINES.some((cl) => Math.abs(d - cl) < 9);
      if (nearCross) continue;
      dashParts.push({ geo: roadGeo.clone(), matrix: flatMatrix(line, 0.05, d, 0, 0.35, 3), color: C(0xd8c26a) });
      dashParts.push({ geo: roadGeo.clone(), matrix: flatMatrix(d, 0.05, line, 0, 3, 0.35), color: C(0xd8c26a) });
    }
  }
  const roadMesh = new THREE.Mesh(mergeParts(roadParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  group.add(roadMesh);
  const walkMesh = new THREE.Mesh(mergeParts(walkParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  group.add(walkMesh);
  const dashMesh = new THREE.Mesh(mergeParts(dashParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: 0x554411, emissiveIntensity: 0.5 }));
  group.add(dashMesh);

  // --- buildings ----------------------------------------------------------
  const winTex = windowTexture(rng);
  const buildingParts = [];
  const blockCenters = [-186, -130, -78, -26, 26, 78, 130, 186];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const landmarkClear = [
    { x: HIDEOUT.x, z: HIDEOUT.z, r: 14 },
    { x: SHOP_POS.x, z: SHOP_POS.z, r: 14 },
    { x: BEACH_PICKUP.x, z: BEACH_PICKUP.z, r: 12 },
    { x: DOCKS_PICKUP.x, z: DOCKS_PICKUP.z, r: 14 },
    { x: GARAGE.x + 14, z: GARAGE.z + 14, r: 14 },
  ];
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (landmarkClear.some((lm) => Math.hypot(bx - lm.x, bz - lm.z) < lm.r)) continue;
      const downtown = bx >= -104 && bx <= 104 && bz >= -104 && bz <= 104;
      const oldTown = bx > 104 && bz < -52;
      const industrial = bx > 104 && bz >= -52 && bz <= 104;
      const portside = bx < -104;
      const count = downtown ? rangeInt(rng, 1, 2) : rangeInt(rng, 2, 3);
      for (let i = 0; i < count; i += 1) {
        const w = downtown ? range(rng, 16, 26) : range(rng, 12, 20);
        const d = downtown ? range(rng, 16, 26) : range(rng, 12, 20);
        const h = downtown ? range(rng, 24, 62) : oldTown ? range(rng, 8, 14) : industrial ? range(rng, 8, 12) : portside ? range(rng, 10, 16) : range(rng, 10, 18);
        const ox = bx + (count > 1 ? (i === 0 ? -9 : 9) : 0) + range(rng, -2, 2);
        const oz = bz + (count > 1 ? (i === 0 ? 9 : -9) : 0) + range(rng, -2, 2);
        const shade = pick(rng, [0x8a7f8f, 0x6f7d94, 0x9c8a7a, 0x7a8699, 0x846b5e]);
        buildingParts.push({ geo: boxGeo.clone(), matrix: matrix(ox, h / 2, oz, 0, w, h, d), color: C(shade) });
        colliders.push({ x0: ox - w / 2, z0: oz - d / 2, x1: ox + w / 2, z1: oz + d / 2 });
      }
    }
  }
  const buildingMat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, map: winTex, emissiveMap: winTex,
    emissive: 0xffc98a, emissiveIntensity: 0.5,
  });
  const buildingMesh = new THREE.Mesh(mergeParts(buildingParts), buildingMat);
  group.add(buildingMesh);

  // --- street lamps + palms (merged) --------------------------------------
  const poleParts = [];
  const headParts = [];
  const trunkParts = [];
  const frondParts = [];
  const poleGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const line of STREET_LINES) {
    for (let d = -182; d <= 182; d += 26) {
      for (const [lx, lz] of [[line + 7, d], [line - 7, d + 13]]) {
        poleParts.push({ geo: poleGeo.clone(), matrix: matrix(lx, 2.5, lz, 0, 0.18, 5, 0.18), color: C(0x1c1f26) });
        headParts.push({ geo: poleGeo.clone(), matrix: matrix(lx, 5.1, lz, 0, 0.7, 0.25, 0.35), color: C(0xffe2a0) });
      }
    }
  }
  const palmSpots = [];
  for (let i = 0; i < 22; i += 1) {
    const beach = i < 12;
    palmSpots.push({
      x: beach ? range(rng, -150, 150) : range(rng, -190, 190),
      z: beach ? range(rng, 150, 195) : range(rng, -190, 190),
    });
  }
  for (const p of palmSpots) {
    trunkParts.push({ geo: new THREE.CylinderGeometry(0.22, 0.32, 4.5, 6), matrix: matrix(p.x, 2.25, p.z, 0, 1, 1, 1), color: C(0x7a5a3a) });
    for (let f = 0; f < 4; f += 1) {
      const a = (f / 4) * Math.PI * 2 + rng();
      const frond = new THREE.ConeGeometry(0.5, 2.6, 4);
      const m = new THREE.Matrix4().makeRotationZ(1.1);
      m.premultiply(new THREE.Matrix4().makeRotationY(a));
      m.setPosition(p.x + Math.cos(a) * 0.9, 4.9, p.z + Math.sin(a) * 0.9);
      frondParts.push({ geo: frond, matrix: m, color: C(0x2f7a4a) });
    }
  }
  group.add(new THREE.Mesh(mergeParts(poleParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));
  const headMesh = new THREE.Mesh(mergeParts(headParts), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffd27a, emissiveIntensity: 0.9 }));
  group.add(headMesh);
  group.add(new THREE.Mesh(mergeParts(trunkParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
  group.add(new THREE.Mesh(mergeParts(frondParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

  // --- containers (Industrial) --------------------------------------------
  const boxParts = [];
  const containerColors = [0xb8442c, 0x2c6fb8, 0x3d8a4a, 0xc9a13a, 0x7a4a9c];
  for (let i = 0; i < 12; i += 1) {
    const cx = 130 + (i % 4) * 16;
    const cz = -30 + Math.floor(i / 4) * 22;
    const stacked = i % 3 === 0;
    boxParts.push({ geo: boxGeo.clone(), matrix: matrix(cx, 1.3, cz, 0, 12, 2.6, 2.6), color: C(containerColors[i % containerColors.length]) });
    if (stacked) boxParts.push({ geo: boxGeo.clone(), matrix: matrix(cx, 3.9, cz, 0, 12, 2.6, 2.6), color: C(containerColors[(i + 2) % containerColors.length]) });
    colliders.push({ x0: cx - 6, z0: cz - 1.3, x1: cx + 6, z1: cz + 1.3 });
  }
  group.add(new THREE.Mesh(mergeParts(boxParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));

  // --- landmarks: garage, hideout, market stall, docks --------------------
  const landmarkParts = [];
  // Garage (teal, next to the mission point).
  landmarkParts.push({ geo: boxGeo.clone(), matrix: matrix(GARAGE.x + 14, 3, GARAGE.z + 14, 0, 14, 6, 10), color: C(0x2c7a72) });
  colliders.push({ x0: GARAGE.x + 7, z0: GARAGE.z + 9, x1: GARAGE.x + 21, z1: GARAGE.z + 19 });
  // Hideout shack.
  landmarkParts.push({ geo: boxGeo.clone(), matrix: matrix(HIDEOUT.x, 1.8, HIDEOUT.z, 0, 7, 3.6, 5), color: C(0x5e4a3a) });
  colliders.push({ x0: HIDEOUT.x - 3.5, z0: HIDEOUT.z - 2.5, x1: HIDEOUT.x + 3.5, z1: HIDEOUT.z + 2.5 });
  // Market stall: counter + striped awning.
  landmarkParts.push({ geo: boxGeo.clone(), matrix: matrix(SHOP_POS.x, 0.6, SHOP_POS.z, 0, 5, 1.2, 2.4), color: C(0x6b4a2c) });
  landmarkParts.push({ geo: boxGeo.clone(), matrix: matrix(SHOP_POS.x, 2.6, SHOP_POS.z, 0, 5.6, 0.25, 3), color: C(0xc23b3b) });
  colliders.push({ x0: SHOP_POS.x - 2.5, z0: SHOP_POS.z - 1.2, x1: SHOP_POS.x + 2.5, z1: SHOP_POS.z + 1.2 });
  // Dock platform + a warehouse by the pickup.
  landmarkParts.push({ geo: boxGeo.clone(), matrix: matrix(DOCKS_PICKUP.x, 0.4, DOCKS_PICKUP.z, 0, 20, 0.8, 12), color: C(0x4a4f58) });
  landmarkParts.push({ geo: boxGeo.clone(), matrix: matrix(DOCKS_PICKUP.x - 16, 5, DOCKS_PICKUP.z, 0, 10, 10, 14), color: C(0x54606e) });
  colliders.push({ x0: DOCKS_PICKUP.x - 21, z0: DOCKS_PICKUP.z - 7, x1: DOCKS_PICKUP.x - 11, z1: DOCKS_PICKUP.z + 7 });
  group.add(new THREE.Mesh(mergeParts(landmarkParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));

  // --- neon signs ----------------------------------------------------------
  const signs = [
    { text: 'NEON HARBOR', color: '#ff5ce1', x: 0, y: 34, z: -88, ry: 0, w: 26 },
    { text: 'GRY MARKET', color: '#ffd23e', x: SHOP_POS.x, y: 4.2, z: SHOP_POS.z - 1.8, ry: 0, w: 7 },
    { text: 'GARAGE', color: '#39d0c0', x: GARAGE.x + 14, y: 6.8, z: GARAGE.z + 8.8, ry: 0, w: 9 },
    { text: 'DOCK 7', color: '#5cc8ff', x: DOCKS_PICKUP.x - 16, y: 11, z: DOCKS_PICKUP.z - 7.2, ry: 0, w: 8 },
    { text: 'HOTEL', color: '#ff9d5c', x: 26, y: 20, z: 130, ry: Math.PI, w: 9 },
    { text: 'PIER 9', color: '#7dffb0', x: -180, y: 8, z: 60, ry: Math.PI / 2, w: 8 },
    { text: '24H TACOS', color: '#ff6b6b', x: 130, y: 9, z: -78, ry: -Math.PI / 2, w: 10 },
    { text: 'BAR', color: '#c98cff', x: -78, y: 12, z: -26, ry: Math.PI / 2, w: 6 },
  ];
  for (const s of signs) {
    const tex = signTexture(s.text, s.color);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w * 0.31), mat);
    plane.position.set(s.x, s.y, s.z);
    plane.rotation.y = s.ry;
    group.add(plane);
  }

  // --- mission beacon (moved by the world) ---------------------------------
  // A bright, solid column: the main way a player finds the next objective.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 34, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x39f5c8, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.set(GARAGE.x, 17, GARAGE.z);
  beacon.visible = false;
  group.add(beacon);

  scene.add(group);
  return { group, colliders, beacon };
}

// A random point on a street (for spawning traffic and pedestrians).
export function randomStreetPoint(rng) {
  const line = pick(rng, STREET_LINES);
  const along = range(rng, -190, 190);
  if (rng() < 0.5) return { x: line + pick(rng, [-3, 3]), z: along, axis: 'z', line };
  return { x: along, z: line + pick(rng, [-3, 3]), axis: 'x', line };
}

// Push a circle (x, z, radius) out of every building box it overlaps.
export function resolveCollisions(colliders, pos, radius) {
  for (const b of colliders) {
    const nx = Math.max(b.x0, Math.min(pos.x, b.x1));
    const nz = Math.max(b.z0, Math.min(pos.z, b.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 1e-6) {
        pos.x = b.x1 + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      }
    }
  }
  return pos;
}
