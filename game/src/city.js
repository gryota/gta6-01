// Neon Harbor's city: five districts on a road grid, all procedural and original.
// generateLayout(seed) is pure data (roads, buildings, colliders, parked spots);
// buildCity(scene, layout) turns it into three.js meshes. The world logic uses the
// same layout for collisions, so the picture and the rules always agree.
import * as THREE from 'three';
import { BLOCK_CENTERS, DISTRICT_STYLE, ROADS, ROAD_W, districtAt } from './config.js';

const WORLD = 480; // ground texture covers -240..240
const PX_PER_M = 2048 / WORLD;
function toPx(v) { return (v + WORLD / 2) * PX_PER_M; }

const SIGN_TEXTS = [
  { text: 'NEON HARBOR', color: '#29e6ff' },
  { text: 'PIER 9', color: '#ff2e88' },
  { text: "ROOK'S GARAGE", color: '#ffd23e' },
  { text: 'VANE', color: '#ff2e88' },
  { text: 'VOLT TOWER', color: '#29e6ff' },
  { text: 'TIDE BAR', color: '#7dff5e' },
  { text: 'PALM COURT', color: '#ffd23e' },
  { text: 'DOCK 7', color: '#29e6ff' },
  { text: 'SUNSET MOTEL', color: '#ff9a3d' },
  { text: 'MARINA', color: '#7dff5e' },
  { text: 'NIGHT MARKET', color: '#ff2e88' },
  { text: 'HARBOR FM', color: '#29e6ff' },
];

function windowTexture(style, random) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = style === 'downtown' ? '#1c2438' : style === 'mid' ? '#26221f' : '#2e2620';
  g.fillRect(0, 0, 128, 256);
  const cols = style === 'downtown' ? 6 : 4;
  const rows = style === 'downtown' ? 14 : 8;
  const litColors = ['#ffd23e', '#29e6ff', '#ff9a5c', '#fff2b0'];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = random() < (style === 'downtown' ? 0.55 : 0.3);
      g.fillStyle = lit ? litColors[Math.floor(random() * litColors.length)] : '#0e1220';
      g.fillRect(8 + c * 20, 10 + r * 17, 13, 10);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function signTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, 512, 128);
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 28;
  g.fillStyle = color;
  g.fillText(text, 256, 64);
  g.shadowBlur = 8;
  g.fillStyle = '#ffffff';
  g.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function groundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const g = canvas.getContext('2d');
  g.fillStyle = '#23232c';
  g.fillRect(0, 0, 2048, 2048);
  // Docks concrete (west strip) and beach sand (east strip).
  g.fillStyle = '#3a3a40';
  g.fillRect(0, 0, toPx(-200), 2048);
  g.fillStyle = '#c2a878';
  g.fillRect(toPx(200), 0, 2048 - toPx(200), 2048);
  // Roads: clearly lighter than the blocks, with white edge lines.
  g.fillStyle = '#454552';
  for (const r of ROADS) {
    g.fillRect(toPx(r - ROAD_W / 2), 0, ROAD_W * PX_PER_M, 2048);
    g.fillRect(0, toPx(r - ROAD_W / 2), 2048, ROAD_W * PX_PER_M);
  }
  g.fillStyle = 'rgba(230,230,235,0.55)';
  for (const r of ROADS) {
    g.fillRect(toPx(r - ROAD_W / 2 + 0.4), 0, 2, 2048);
    g.fillRect(toPx(r + ROAD_W / 2 - 0.4), 0, 2, 2048);
    g.fillRect(0, toPx(r - ROAD_W / 2 + 0.4), 2048, 2);
    g.fillRect(0, toPx(r + ROAD_W / 2 - 0.4), 2048, 2);
  }
  // Sidewalk blocks: mid ring, dark inner yard where buildings stand.
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const half = 34;
      g.fillStyle = '#363642';
      g.fillRect(toPx(bx - half), toPx(bz - half), half * 2 * PX_PER_M, half * 2 * PX_PER_M);
      g.fillStyle = '#24242e';
      g.fillRect(toPx(bx - half + 5), toPx(bz - half + 5), (half - 5) * 2 * PX_PER_M, (half - 5) * 2 * PX_PER_M);
    }
  }
  // Lane dashes (yellow centre) and edge lines.
  g.fillStyle = '#c9a227';
  for (const r of ROADS) {
    for (let d = -220; d < 220; d += 16) {
      g.fillRect(toPx(r) - 1, toPx(d), 2, 8 * PX_PER_M);
      g.fillRect(toPx(d), toPx(r) - 1, 8 * PX_PER_M, 2);
    }
  }
  // Crosswalks at every intersection.
  g.fillStyle = 'rgba(230,230,230,0.75)';
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      for (let i = -2; i <= 2; i += 1) {
        g.fillRect(toPx(rx + i * 2.2) - 3, toPx(rz - ROAD_W / 2 - 2), 6, 4 * PX_PER_M);
        g.fillRect(toPx(rx + i * 2.2) - 3, toPx(rz + ROAD_W / 2 - 2), 6, 4 * PX_PER_M);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function skyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 512;
  const g = canvas.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#150a2c');
  grad.addColorStop(0.45, '#4b2560');
  grad.addColorStop(0.72, '#b34a5e');
  grad.addColorStop(0.85, '#ff7e3d');
  grad.addColorStop(1, '#2a1430');
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function generateLayout(random) {
  const buildings = [];
  const containers = [];
  const palms = [];
  const silos = [];
  const cranes = [];
  const colliders = [];
  let signIndex = 0;

  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      const district = districtAt(bx, bz);
      const style = DISTRICT_STYLE[district];
      const count = district === 'downtown' && Math.abs(bx) <= 40 && Math.abs(bz) <= 40
        ? 1
        : district === 'downtown' ? 2 : district === 'portside' ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        const w = 18 + random() * 22;
        const d = 18 + random() * 22;
        const h = style.minH + random() * (style.maxH - style.minH);
        const x = bx + (random() - 0.5) * (56 - w);
        const z = bz + (random() - 0.5) * (56 - d);
        const sign = signIndex < SIGN_TEXTS.length && h > 12 && random() < 0.6
          ? SIGN_TEXTS[signIndex++] : null;
        buildings.push({ x, z, w, d, h, style: style.windows, district, sign });
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
      if (district === 'portside') {
        for (let i = 0; i < 4; i += 1) {
          const x = bx + (random() - 0.5) * 40;
          const z = bz + (random() - 0.5) * 40;
          containers.push({ x, z, color: ['#2e8b8b', '#b3541e', '#c9a227', '#7a4a8b'][i % 4] });
          colliders.push({ minX: x - 3, maxX: x + 3, minZ: z - 1.3, maxZ: z + 1.3 });
        }
        if (bz === -120 || bz === 120) cranes.push({ x: bx - 10, z: bz });
      }
      if (district === 'industrial') {
        for (let i = 0; i < 2; i += 1) {
          const x = bx + (random() - 0.5) * 36;
          const z = bz + (random() - 0.5) * 36;
          silos.push({ x, z, r: 3 + random() * 2, h: 12 + random() * 8 });
          colliders.push({ minX: x - 4, maxX: x + 4, minZ: z - 4, maxZ: z + 4 });
        }
      }
      if (district === 'beachfront') {
        for (let i = 0; i < 3; i += 1) {
          palms.push({ x: bx + (random() - 0.5) * 44, z: bz + (random() - 0.5) * 44 });
        }
      }
    }
  }
  // A few palms downtown for the boulevard feel.
  for (let i = 0; i < 6; i += 1) {
    palms.push({ x: -80 + (random() - 0.5) * 8, z: -160 + i * 64 });
  }

  // Parked cars along road edges (x = road ± 7.5, or z = road ± 7.5).
  const parkedSpots = [];
  const spotRoads = [-160, -80, 0, 80, 160, -80, 0, 80];
  const spotAlong = [-120, 40, 120, -40, 80, 160, -160, -120];
  for (let i = 0; i < 8; i += 1) {
    const vertical = i % 2 === 0;
    const road = spotRoads[i];
    const along = spotAlong[i];
    const side = i % 4 < 2 ? 1 : -1;
    parkedSpots.push({
      x: vertical ? road + side * 7.6 : along,
      z: vertical ? along : road + side * 7.6,
      heading: vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI),
    });
  }
  return { buildings, containers, palms, silos, cranes, colliders, parkedSpots };
}

export function buildCity(scene, layout, random) {
  const colliders = layout.colliders;

  // Ground: one big textured plane for the whole road grid.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Sea to the east, past the beach.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(280, WORLD),
    new THREE.MeshStandardMaterial({ color: 0x0b2f4a, roughness: 0.25, metalness: 0.35 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(240 + 140, 0.05, 0);
  scene.add(sea);

  // Dusk sky dome.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Shared geometry and materials.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
  const facadeMats = {};
  for (const style of ['downtown', 'mid', 'low']) {
    const tex = windowTexture(style, random);
    facadeMats[style] = new THREE.MeshStandardMaterial({
      map: tex, emissiveMap: tex,
      emissive: 0xffffff, emissiveIntensity: style === 'downtown' ? 0.7 : 0.5, roughness: style === 'downtown' ? 0.6 : 0.85,
    });
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.9 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x6b6258, roughness: 0.9 });
  const containerMats = {};
  const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 1 });
  const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x1e5c34, roughness: 0.9 });
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xc96a1e, roughness: 0.7 });
  const siloMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.5, metalness: 0.4 });

  for (const b of layout.buildings) {
    const mesh = new THREE.Mesh(boxGeo, facadeMats[b.style]);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(b.w * 0.9, 0.8, b.d * 0.9);
    roof.position.set(b.x, b.h + 0.4, b.z);
    scene.add(roof);
    if (b.sign) {
      const tex = signTexture(b.sign.text, b.sign.color);
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.min(26, b.w * 0.9), 6.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true }),
      );
      // Face the nearest road: buildings sit inside blocks, so face south (+z) by default.
      sign.position.set(b.x, Math.min(b.h - 4, 22), b.z + b.d / 2 + 0.35);
      scene.add(sign);
    }
  }
  for (const c of layout.containers) {
    if (!containerMats[c.color]) {
      containerMats[c.color] = new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.7, metalness: 0.3 });
    }
    const mesh = new THREE.Mesh(boxGeo, containerMats[c.color]);
    mesh.scale.set(6, 2.6, 2.6);
    mesh.position.set(c.x, 1.3, c.z);
    scene.add(mesh);
  }
  for (const s of layout.silos) {
    const mesh = new THREE.Mesh(cylGeo, siloMat);
    mesh.scale.set(s.r, s.h, s.r);
    mesh.position.set(s.x, s.h / 2, s.z);
    scene.add(mesh);
  }
  for (const cr of layout.cranes) {
    const column = new THREE.Mesh(boxGeo, craneMat);
    column.scale.set(3, 26, 3);
    column.position.set(cr.x, 13, cr.z);
    scene.add(column);
    const jib = new THREE.Mesh(boxGeo, craneMat);
    jib.scale.set(30, 2, 2);
    jib.position.set(cr.x + 8, 25, cr.z);
    scene.add(jib);
  }
  for (const p of layout.palms) {
    const trunk = new THREE.Mesh(cylGeo, palmTrunkMat);
    trunk.scale.set(0.35, 7, 0.35);
    trunk.position.set(p.x, 3.5, p.z);
    scene.add(trunk);
    const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), palmLeafMat);
    leaves.scale.set(1, 0.45, 1);
    leaves.position.set(p.x, 7.4, p.z);
    scene.add(leaves);
  }

  // Street lamps at intersections.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe6a0, emissive: 0xffc860, emissiveIntensity: 2 });
  for (const rx of ROADS) {
    for (const rz of ROADS) {
      const pole = new THREE.Mesh(cylGeo, poleMat);
      pole.scale.set(0.18, 6, 0.18);
      pole.position.set(rx + 8, 3, rz + 8);
      scene.add(pole);
      const head = new THREE.Mesh(boxGeo, lampMat);
      head.scale.set(0.5, 0.3, 1.4);
      head.position.set(rx + 8, 6.1, rz + 8);
      scene.add(head);
    }
  }

  // A few real lights for the neon mood.
  const cyan = new THREE.PointLight(0x29e6ff, 900, 180, 1.6);
  cyan.position.set(0, 26, 0);
  scene.add(cyan);
  const pink = new THREE.PointLight(0xff2e88, 700, 160, 1.6);
  pink.position.set(120, 22, -80);
  scene.add(pink);
  const orange = new THREE.PointLight(0xff9a3d, 700, 160, 1.6);
  orange.position.set(-160, 18, 40);
  scene.add(orange);

  return { colliders };
}
