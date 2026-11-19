// Neon Harbor — city.js
// Builds the whole city from the config: roads, sidewalks, sea and sand,
// procedural buildings with world-space window UVs (so windows stay the
// same size on a shack and on a tower), docks, lamps, palms, neon signs,
// the Gry Market stall and the garage. Returns colliders for the world
// simulation and an update() for the little animated touches.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeRng, range, rangeInt, pick } from './random.js';
import { mergeParts, makeCanvasTexture, makeWindowsTexture, makeNeonTexture } from './render.js';

const BLOCKS = [-150, -90, -30, 30, 90, 150];

function districtAt(x, z) {
  for (const d of CONFIG.districts) {
    const [x0, z0, x1, z1] = d.rect;
    if (x >= x0 && x < x1 && z >= z0 && z < z1) return d;
  }
  return CONFIG.districts[1];
}

/** Merge box buildings into one geometry; UVs come from world coords. */
function mergeBuildings(list, windowsTex) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  let base = 0;
  const col = new THREE.Color();
  for (const b of list) {
    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    geo.translate(b.x, b.h / 2, b.z);
    col.set(b.color);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      positions.push(x, y, z);
      normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
      // Roof faces (+Y) sample a dark corner of the texture, not windows.
      if (nor.getY(i) > 0.5) uvs.push(0.01, 0.01);
      else uvs.push(x / 5, y / 5);
      colors.push(col.r, col.g, col.b);
    }
    for (let i = 0; i < geo.index.count; i++) indices.push(geo.index.getX(i) + base);
    base += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  out.setIndex(indices);
  const mat = new THREE.MeshStandardMaterial({ map: windowsTex, vertexColors: true, roughness: 0.85, metalness: 0.1 });
  windowsTex.wrapS = THREE.RepeatWrapping;
  windowsTex.wrapT = THREE.RepeatWrapping;
  return new THREE.Mesh(out, mat);
}

export function buildCity(scene, seed = 1) {
  const rng = makeRng(seed);
  const colliders = [];
  const animated = [];

  // --- Sky dome: dusk gradient, horizon orange fading to deep purple.
  const skyTex = makeCanvasTexture(64, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#160b2e');
    grad.addColorStop(0.45, '#4a2a5e');
    grad.addColorStop(0.72, '#c65a3c');
    grad.addColorStop(0.8, '#ff8a4a');
    grad.addColorStop(1, '#2a1a2e');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  // --- Ground base, sea and sand.
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x14405e, roughness: 0.35, metalness: 0.4 });
  const seaWest = new THREE.Mesh(new THREE.PlaneGeometry(60, 560), seaMat);
  seaWest.rotation.x = -Math.PI / 2;
  seaWest.position.set(-270, -0.15, 0);
  scene.add(seaWest);
  const seaSouth = new THREE.Mesh(new THREE.PlaneGeometry(560, 60), seaMat);
  seaSouth.rotation.x = -Math.PI / 2;
  seaSouth.position.set(0, -0.15, 270);
  scene.add(seaSouth);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 14),
    new THREE.MeshStandardMaterial({ color: 0xb99b6b, roughness: 1 })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 234);
  scene.add(sand);

  // --- Roads, sidewalks and dashes, all merged into three meshes.
  const roadParts = [];
  const walkParts = [];
  const dashParts = [];
  const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  for (const line of CONFIG.roadLines) {
    roadParts.push({ geo: new THREE.PlaneGeometry(480, CONFIG.roadWidth), matrix: new THREE.Matrix4().makeTranslation(0, 0.05, line).multiply(flat), color: 0x14161a });
    roadParts.push({ geo: new THREE.PlaneGeometry(CONFIG.roadWidth, 480), matrix: new THREE.Matrix4().makeTranslation(line, 0.05, 0).multiply(flat), color: 0x14161a });
    for (const side of [-1, 1]) {
      const off = side * (CONFIG.roadWidth / 2 + CONFIG.sidewalkWidth / 2);
      walkParts.push({ geo: new THREE.PlaneGeometry(480, CONFIG.sidewalkWidth), matrix: new THREE.Matrix4().makeTranslation(0, 0.03, line + off).multiply(flat), color: 0x3a3d42 });
      walkParts.push({ geo: new THREE.PlaneGeometry(CONFIG.sidewalkWidth, 480), matrix: new THREE.Matrix4().makeTranslation(line + off, 0.03, 0).multiply(flat), color: 0x3a3d42 });
    }
    // Centre-line dashes, mid-block only: no dash inside an intersection,
    // otherwise a vertical and a horizontal dash meet at the crossing
    // and read as a big amber "+" under the chase camera.
    const inCrossing = (p) => CONFIG.roadLines.some((other) => Math.abs(p - other) < 9);
    for (let p = -225; p <= 225; p += 15) {
      if (inCrossing(p)) continue;
      dashParts.push({ geo: new THREE.PlaneGeometry(3, 0.35), matrix: new THREE.Matrix4().makeTranslation(p, 0.07, line).multiply(flat), color: 0xd8b93a });
      dashParts.push({ geo: new THREE.PlaneGeometry(0.35, 3), matrix: new THREE.Matrix4().makeTranslation(line, 0.07, p).multiply(flat), color: 0xd8b93a });
    }
  }
  const roadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  scene.add(new THREE.Mesh(mergeParts(roadParts), roadMat));
  scene.add(new THREE.Mesh(mergeParts(walkParts), roadMat));
  scene.add(new THREE.Mesh(mergeParts(dashParts), roadMat));

  // --- Buildings, one merged mesh per city.
  const buildings = [];
  const tintVar = (base, amt) => {
    const c = new THREE.Color(base);
    const f = 1 + (rng() - 0.5) * amt;
    return new THREE.Color(c.r * f, c.g * f, c.b * f).getHex();
  };
  for (const bx of BLOCKS) {
    for (const bz of BLOCKS) {
      const d = districtAt(bx, bz);
      const spots = [];
      if (d.name === 'Downtown') {
        spots.push({ w: range(rng, 22, 30), d: range(rng, 22, 30), x: bx, z: bz });
      } else if (d.name === 'Old Town') {
        for (const [ox, oz] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) {
          if (rng() < 0.2) continue;
          spots.push({ w: range(rng, 11, 15), d: range(rng, 11, 15), x: bx + ox, z: bz + oz });
        }
      } else if (d.name === 'Portside') {
        spots.push({ w: range(rng, 22, 30), d: range(rng, 14, 20), x: bx, z: bz });
      } else {
        spots.push({ w: range(rng, 14, 20), d: range(rng, 14, 20), x: bx - 10, z: bz - 8 });
        spots.push({ w: range(rng, 14, 20), d: range(rng, 14, 20), x: bx + 10, z: bz + 8 });
      }
      for (const s of spots) {
        const h = range(rng, d.minH, d.maxH);
        buildings.push({ x: s.x, z: s.z, w: s.w, d: s.d, h, color: tintVar(d.tint, 0.5), district: d.name });
        colliders.push({ minX: s.x - s.w / 2, maxX: s.x + s.w / 2, minZ: s.z - s.d / 2, maxZ: s.z + s.d / 2 });
      }
    }
  }
  scene.add(mergeBuildings(buildings, makeWindowsTexture()));

  // --- Portside containers and crates.
  const boxParts = [];
  const containerColors = [0xb03a2e, 0x2e6ab0, 0x3a8a4a, 0xc07a2a, 0x7a4a9a];
  for (let i = 0; i < 22; i++) {
    const x = range(rng, -222, -192);
    const z = range(rng, -50, 100);
    const w = pick(rng, [12, 12, 6]);
    const h = pick(rng, [2.6, 2.6, 5.2]);
    boxParts.push({
      geo: new THREE.BoxGeometry(w, h, 2.6),
      matrix: new THREE.Matrix4().makeTranslation(x, h / 2, z),
      color: pick(rng, containerColors),
    });
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - 1.3, maxZ: z + 1.3 });
  }
  scene.add(new THREE.Mesh(mergeParts(boxParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })));

  // --- Street lamps (instanced pole + head).
  const lampSpots = [];
  for (const line of CONFIG.roadLines) {
    for (let p = -210; p <= 210; p += 40) {
      lampSpots.push({ x: p, z: line + 6.5 });
      lampSpots.push({ x: line + 6.5, z: p });
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.7 }), lampSpots.length);
  const headGeo = new THREE.BoxGeometry(0.5, 0.22, 0.9);
  const heads = new THREE.InstancedMesh(headGeo, new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), lampSpots.length);
  const m4 = new THREE.Matrix4();
  lampSpots.forEach((s, i) => {
    m4.makeTranslation(s.x, 3, s.z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(s.x, 6.1, s.z);
    heads.setMatrixAt(i, m4);
  });
  scene.add(poles);
  scene.add(heads);

  // --- Palms along the beachfront and the plaza.
  const palmSpots = [];
  for (let x = -180; x <= 180; x += 30) palmSpots.push({ x, z: 216 });
  for (const [x, z] of [[-24, -84], [24, -84], [-24, -36], [24, -36]]) palmSpots.push({ x, z });
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.3, 7, 6),
    new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 }),
    palmSpots.length
  );
  const fronds = new THREE.InstancedMesh(
    new THREE.ConeGeometry(2.4, 2.2, 7),
    new THREE.MeshStandardMaterial({ color: 0x2e7a3a, roughness: 1 }),
    palmSpots.length
  );
  palmSpots.forEach((s, i) => {
    m4.makeTranslation(s.x, 3.5, s.z);
    trunks.setMatrixAt(i, m4);
    m4.makeTranslation(s.x, 7.6, s.z);
    fronds.setMatrixAt(i, m4);
  });
  scene.add(trunks);
  scene.add(fronds);

  // --- Neon signs.
  function addSign(text, color, x, y, z, w, h, ry = 0, sub = '') {
    const tex = makeNeonTexture(text, color, sub);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    animated.push(mesh.material);
    return mesh;
  }
  const tallest = buildings.filter((b) => b.district === 'Downtown').sort((a, b) => b.h - a.h)[0];
  addSign('NEON HARBOR', '#ff5ad0', tallest.x, tallest.h * 0.78, tallest.z + tallest.d / 2 + 0.3, 34, 10, 0, 'CITY OF LIGHTS');
  const ramen = buildings.find((b) => b.district === 'Old Town');
  addSign('RAMEN', '#7ad4ff', ramen.x, ramen.h * 0.7, ramen.z + ramen.d / 2 + 0.3, 12, 4);
  const hotel = buildings.find((b) => b.district === 'Beachfront');
  addSign('HOTEL', '#ffd27a', hotel.x, hotel.h * 0.72, hotel.z + hotel.d / 2 + 0.3, 12, 4);
  const docks = buildings.find((b) => b.district === 'Portside');
  addSign('DOCKS', '#7affa8', docks.x, docks.h * 0.72, docks.z + docks.d / 2 + 0.3, 12, 4);
  addSign('PIER', '#ff9a5a', 0, 8, 226, 14, 4.5);
  addSign('24H', '#c07aff', 150, 12, -30, 8, 3);

  // --- Gry Market stall in Old Town.
  const shop = CONFIG.shop;
  const stallParts = [
    { geo: new THREE.BoxGeometry(7, 3, 4), matrix: new THREE.Matrix4().makeTranslation(shop.x, 1.5, shop.z), color: 0x4a2a3a },
    { geo: new THREE.BoxGeometry(7.6, 0.25, 5), matrix: new THREE.Matrix4().makeTranslation(shop.x, 3.4, shop.z), color: 0xff5ad0 },
    { geo: new THREE.BoxGeometry(6.4, 1, 0.6), matrix: new THREE.Matrix4().makeTranslation(shop.x, 1.1, shop.z + 2.1), color: 0x8a5a2a },
  ];
  scene.add(new THREE.Mesh(mergeParts(stallParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  colliders.push({ minX: shop.x - 3.5, maxX: shop.x + 3.5, minZ: shop.z - 2, maxZ: shop.z + 2 });
  addSign('GRY MARKET', '#ff5ad0', shop.x, 5.6, shop.z + 2.4, 12, 3.8);

  // --- Garage (mission hub) at the east end.
  const g = CONFIG.garage;
  const garageParts = [
    { geo: new THREE.BoxGeometry(16, 6, 12), matrix: new THREE.Matrix4().makeTranslation(g.x + 12, 3, g.z + 8), color: 0x3a4048 },
    { geo: new THREE.BoxGeometry(10, 4.5, 0.4), matrix: new THREE.Matrix4().makeTranslation(g.x + 12, 2.25, g.z + 2.1), color: 0x8a6a3a },
  ];
  scene.add(new THREE.Mesh(mergeParts(garageParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  colliders.push({ minX: g.x + 4, maxX: g.x + 20, minZ: g.z + 2, maxZ: g.z + 14 });
  addSign('GARAGE', '#7affa8', g.x + 12, 8, g.z + 2.2, 12, 3.5);

  // --- Mission beacon: a glowing pillar + arrow, repositioned by the world.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 30;
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(1.1, 2.4, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23a })
  );
  arrow.position.y = 9;
  arrow.rotation.x = Math.PI;
  beacon.add(pillar);
  beacon.add(arrow);
  beacon.visible = false;
  scene.add(beacon);

  function update(t) {
    // Gentle neon flicker so the signs feel alive.
    const f = 0.86 + 0.14 * Math.sin(t * 7.3);
    for (const mat of animated) mat.opacity = f;
  }

  return { colliders, beacon, update, tallest };
}
