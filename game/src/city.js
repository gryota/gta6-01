// Neon Harbor — procedural city. All geometry built from the spec, no assets.
// Streets on a grid, 5 districts, sea west + south, neon signs, dusk sky.
import * as THREE from 'three';
import { MAP_HALF, STREET_LINES, STREET_HALF, SEA_WEST, SEA_SOUTH, LANDMARKS } from './config.js';
import { mulberry32, range } from './random.js';

const CLEAR_SPOTS = Object.values(LANDMARKS).map((l) => ({ x: l.x, z: l.z, r: 20 }));

function nearClear(x, z, r = 20) {
  for (const c of CLEAR_SPOTS) {
    if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
  }
  return false;
}

function textTexture(text, fg, bg, font = 'bold 64px sans-serif') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 128);
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = fg;
  g.shadowColor = fg;
  g.shadowBlur = 24;
  g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1d29';
  g.fillRect(0, 0, 128, 256);
  const rand = mulberry32(7);
  for (let y = 12; y < 244; y += 28) {
    for (let x = 10; x < 118; x += 28) {
      g.fillStyle = rand() < 0.55 ? '#ffd27a' : '#2c3550';
      g.fillRect(x, y, 18, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity() {
  const rand = mulberry32(20261120);
  const group = new THREE.Group();

  // Ground: dark asphalt base.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_HALF * 2 + 80, MAP_HALF * 2 + 80),
    new THREE.MeshLambertMaterial({ color: 0x23242c }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Sea west + south.
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x0a3a5c, emissive: 0x06283f });
  const seaW = new THREE.Mesh(new THREE.PlaneGeometry(80, MAP_HALF * 2 + 80), seaMat);
  seaW.rotation.x = -Math.PI / 2;
  seaW.position.set(SEA_WEST - 40, 0.05, 0);
  group.add(seaW);
  const seaS = new THREE.Mesh(new THREE.PlaneGeometry(MAP_HALF * 2 + 80, 80), seaMat);
  seaS.rotation.x = -Math.PI / 2;
  seaS.position.set(0, 0.05, SEA_SOUTH + 40);
  group.add(seaS);

  // Roads: slightly lighter strips along each street line.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e2f38 });
  const roadLen = MAP_HALF * 2;
  for (const x of STREET_LINES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(STREET_HALF * 2, roadLen), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(x, 0.06, 0);
    group.add(r);
  }
  for (const z of STREET_LINES) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, STREET_HALF * 2), roadMat);
    r.rotation.x = -Math.PI / 2;
    r.position.set(0, 0.06, z);
    group.add(r);
  }

  // Sidewalks: pale strips beside roads.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x3a3b44 });
  for (const x of STREET_LINES) {
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3, roadLen), walkMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(x + side * (STREET_HALF + 1.5), 0.07, 0);
      group.add(s);
    }
  }
  for (const z of STREET_LINES) {
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 3), walkMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(0, 0.07, z + side * (STREET_HALF + 1.5));
      group.add(s);
    }
  }

  // Lane dashes, mid-block only (never across intersections).
  const dashGeo = new THREE.BoxGeometry(0.5, 0.1, 3);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  const dashPositions = [];
  for (const x of STREET_LINES) {
    for (let z = -MAP_HALF + 12; z < MAP_HALF - 12; z += 12) {
      if (STREET_LINES.some((s) => Math.abs(z - s) < 14)) continue;
      dashPositions.push([x, z, 0]);
    }
  }
  for (const z of STREET_LINES) {
    for (let x = -MAP_HALF + 12; x < MAP_HALF - 12; x += 12) {
      if (STREET_LINES.some((s) => Math.abs(x - s) < 14)) continue;
      dashPositions.push([x, z, 1]);
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  const m4 = new THREE.Matrix4();
  dashPositions.forEach(([x, z, rot], i) => {
    m4.makeRotationY(rot ? Math.PI / 2 : 0);
    m4.setPosition(x, 0.08, z);
    dashes.setMatrixAt(i, m4);
  });
  group.add(dashes);

  // Buildings: instanced boxes with a window texture; per-instance tint.
  const winTex = windowTexture();
  const bGeo = new THREE.BoxGeometry(1, 1, 1);
  bGeo.translate(0, 0.5, 0);
  const bMat = new THREE.MeshLambertMaterial({ map: winTex, emissive: 0x222222, emissiveMap: winTex });
  const spots = [];
  const blockCenters = [];
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      const cx = (STREET_LINES[i] + STREET_LINES[i + 1]) / 2;
      const cz = (STREET_LINES[j] + STREET_LINES[j + 1]) / 2;
      blockCenters.push([cx, cz]);
    }
  }
  // Extra blocks beyond the grid edges (outer ring).
  for (const cx of [-187, 187]) for (const cz of [-112, -37, 37, 112]) blockCenters.push([cx, cz]);
  for (const cz of [-187, 187]) for (const cx of [-112, -37, 37, 112]) blockCenters.push([cx, cz]);

  const palette = [0x8a7f8d, 0x6f7d8a, 0x9a8a6f, 0x7d8a6f, 0x8a6f7d, 0x5f6d7d, 0xa8906f, 0x6f5f7d];
  for (const [cx, cz] of blockCenters) {
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const x = cx + range(rand, -22, 22);
      const z = cz + range(rand, -22, 22);
      if (nearClear(x, z, 14)) continue;
      if (x < SEA_WEST + 12 || z > SEA_SOUTH - 12) continue;
      const w = range(rand, 14, 26);
      const d = range(rand, 14, 26);
      const h = range(rand, 10, 46);
      spots.push({ x, z, w, d, h, color: palette[Math.floor(rand() * palette.length)] });
    }
  }
  const buildings = new THREE.InstancedMesh(bGeo, bMat, spots.length);
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    m4.makeScale(s.w, s.h, s.d);
    m4.setPosition(s.x, 0, s.z);
    buildings.setMatrixAt(i, m4);
    buildings.setColorAt(i, col.setHex(s.color));
  });
  group.add(buildings);

  // Neon signs (emissive planes with canvas text).
  const signs = [
    { text: 'NEON HARBOR', fg: '#ff4fd8', bg: '#12041a', x: 0, z: -78, y: 26, ry: 0, w: 34 },
    { text: 'GRY MARKET', fg: '#39ff88', bg: '#04160a', x: LANDMARKS.SHOP_POS.x, z: LANDMARKS.SHOP_POS.z - 6, y: 7, ry: 0, w: 16 },
    { text: 'HOTEL', fg: '#ffd27a', bg: '#1a1204', x: 75, z: 78, y: 20, ry: Math.PI, w: 14 },
    { text: 'PIER 9', fg: '#4fd8ff', bg: '#04121a', x: -168, z: -30, y: 9, ry: Math.PI / 2, w: 12 },
    { text: 'TACOS', fg: '#ff9a3d', bg: '#1a0d04', x: -75, z: -78, y: 12, ry: 0, w: 12 },
    { text: 'DANCE', fg: '#ff4f6d', bg: '#1a0410', x: 150, z: 30, y: 16, ry: -Math.PI / 2, w: 12 },
    { text: '24H', fg: '#c8ff4f', bg: '#101a04', x: 30, z: 150, y: 10, ry: Math.PI, w: 10 },
    { text: 'BAR', fg: '#ff4fd8', bg: '#16041a', x: -150, z: 105, y: 11, ry: Math.PI / 2, w: 10 },
  ];
  for (const s of signs) {
    const tex = textTexture(s.text, s.fg, s.bg);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(s.w, s.w / 4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: false }),
    );
    mesh.position.set(s.x, s.y, s.z);
    mesh.rotation.y = s.ry;
    group.add(mesh);
  }

  // Gry Market stall: counter + canopy at SHOP_POS.
  const stall = new THREE.Group();
  const counter = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2.4), new THREE.MeshLambertMaterial({ color: 0x7a4a21 }));
  counter.position.y = 0.6;
  stall.add(counter);
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 3.4), new THREE.MeshLambertMaterial({ color: 0x1fae5f, emissive: 0x0a5a2a }));
  canopy.position.y = 3.2;
  stall.add(canopy);
  for (const px of [-3, 3]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.2, 6), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    pole.position.set(px, 1.6, 0);
    stall.add(pole);
  }
  stall.position.set(LANDMARKS.SHOP_POS.x, 0, LANDMARKS.SHOP_POS.z);
  group.add(stall);

  // Street lamps along streets (instanced).
  const lampGeo = new THREE.CylinderGeometry(0.15, 0.2, 7, 6);
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x555566 });
  const lampSpots = [];
  for (const x of STREET_LINES) {
    for (let z = -150; z <= 150; z += 50) lampSpots.push([x + 8, z]);
  }
  for (const z of STREET_LINES) {
    for (let x = -150; x <= 150; x += 50) lampSpots.push([x, z + 8]);
  }
  const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.identity();
    m4.setPosition(x, 3.5, z);
    lamps.setMatrixAt(i, m4);
  });
  group.add(lamps);
  const bulbGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    m4.identity();
    m4.setPosition(x, 7, z);
    bulbs.setMatrixAt(i, m4);
  });
  group.add(bulbs);

  // Palms along the beachfront (south) and docks.
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 6, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const palmSpots = [];
  for (let x = -150; x <= 150; x += 30) palmSpots.push([x, 172]);
  for (let z = -120; z <= 120; z += 40) palmSpots.push([-176, z]);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const leafGeo = new THREE.ConeGeometry(2.6, 3, 7);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1d7a3a });
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, palmSpots.length);
  palmSpots.forEach(([x, z], i) => {
    m4.identity();
    m4.setPosition(x, 3, z);
    trunks.setMatrixAt(i, m4);
    m4.identity();
    m4.setPosition(x, 7.2, z);
    leaves.setMatrixAt(i, m4);
  });
  group.add(trunks);
  group.add(leaves);

  // Shipping containers at the docks.
  const contGeo = new THREE.BoxGeometry(8, 2.6, 2.6);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xb0502a });
  const contMat2 = new THREE.MeshLambertMaterial({ color: 0x2a6ab0 });
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(contGeo, i % 2 ? contMat : contMat2);
    c.position.set(-172 + (i % 3) * 10, 1.3, -60 + Math.floor(i / 3) * 14);
    c.rotation.y = (i % 2) * 0.2;
    group.add(c);
  }

  // Mission beacon: tall translucent cyan column + pulsing base ring.
  const beaconMat = new THREE.MeshBasicMaterial({
    color: 0x22e6ff, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 60, 16, 1, true), beaconMat);
  beacon.position.set(0, 30, 0);
  beacon.visible = false;
  group.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 4, 24),
    new THREE.MeshBasicMaterial({ color: 0x22e6ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  ring.visible = false;
  group.add(ring);

  // Landmark pads (flat glowing discs so objectives are visible).
  const padMat = new THREE.MeshBasicMaterial({ color: 0x39ff88, transparent: true, opacity: 0.35 });
  for (const l of Object.values(LANDMARKS)) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(5, 24), padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(l.x, 0.12, l.z);
    group.add(pad);
  }

  return { group, beacon, ring, solids: spots };
}

// Is a point on a road (within street half-width of a street line)?
export function isOnRoad(x, z) {
  const onX = STREET_LINES.some((sx) => Math.abs(x - sx) <= STREET_HALF);
  const onZ = STREET_LINES.some((sz) => Math.abs(z - sz) <= STREET_HALF);
  return onX || onZ;
}

export function clampToMap(x, z) {
  return {
    x: Math.max(-MAP_HALF + 4, Math.min(MAP_HALF - 4, x)),
    z: Math.max(-MAP_HALF + 4, Math.min(MAP_HALF - 4, z)),
  };
}
