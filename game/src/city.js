// Neon Harbor city — static geometry, canvas textures, instancing.
// Built from a seeded RNG so every run with the same seed looks identical.
import * as THREE from 'three';
import { MAP_HALF, STREET_LINES, LANDMARKS } from './config.js';
import { range, pick } from './random.js';

const WORLD = MAP_HALF + 30; // ground plane half-size (480 wide)

function canvasTexture(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function windowTexture(rng, litRatio) {
  return canvasTexture(128, (g, s) => {
    g.fillStyle = '#11141c';
    g.fillRect(0, 0, s, s);
    for (let y = 8; y < s - 8; y += 16) {
      for (let x = 8; x < s - 8; x += 16) {
        if (rng() < litRatio) {
          g.fillStyle = pick(rng, ['#ffd27a', '#9fd8ff', '#ff9d5c', '#fff2b0']);
          g.globalAlpha = 0.55 + rng() * 0.45;
          g.fillRect(x, y, 9, 11);
        }
      }
    }
    g.globalAlpha = 1;
  });
}

function signTexture(text, color) {
  return canvasTexture(256, (g, s) => {
    g.clearRect(0, 0, s, s);
    g.font = 'bold 44px Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 22;
    g.fillStyle = color;
    g.fillText(text, s / 2, s / 2 - 8);
    g.shadowBlur = 6;
    g.fillStyle = '#ffffff';
    g.fillText(text, s / 2, s / 2 - 8);
  });
}

function groundTexture() {
  const S = 1024;
  const scale = S / (WORLD * 2);
  const toPx = (v) => (v + WORLD) * scale;
  return canvasTexture(S, (g) => {
    g.fillStyle = '#23262e';
    g.fillRect(0, 0, S, S);
    // Beach (south) and docks (west) strips.
    g.fillStyle = '#8a7a52';
    g.fillRect(0, toPx(180), S, toPx(240) - toPx(180));
    g.fillStyle = '#3a3f47';
    g.fillRect(0, 0, toPx(-180), S);
    // City blocks.
    for (let i = 0; i < STREET_LINES.length - 1; i++) {
      for (let j = 0; j < STREET_LINES.length - 1; j++) {
        const x0 = STREET_LINES[i] + 6;
        const z0 = STREET_LINES[j] + 6;
        const w = STREET_LINES[i + 1] - STREET_LINES[i] - 12;
        const cx = (x0 + w / 2) / 1;
        const cz = (z0 + w / 2) / 1;
        let col = '#2e323b';
        if (cx < -90) col = '#33383f';
        else if (Math.abs(cx) < 90 && Math.abs(cz) < 90) col = '#2b2f3a';
        else if (cx >= 90 && cz < -90) col = '#38302a';
        else if (cz >= 120) col = '#3a332a';
        else if (cx >= 90) col = '#2c3134';
        g.fillStyle = col;
        g.fillRect(toPx(x0), toPx(z0), w * scale, w * scale);
        g.strokeStyle = '#4a4f59';
        g.lineWidth = 3;
        g.strokeRect(toPx(x0), toPx(z0), w * scale, w * scale);
      }
    }
    // Roads.
    g.fillStyle = '#16181d';
    for (const l of STREET_LINES) {
      g.fillRect(toPx(l - 6), 0, 12 * scale, S);
      g.fillRect(0, toPx(l - 6), S, 12 * scale);
    }
    // Centre dashes.
    g.strokeStyle = '#c9a227';
    g.lineWidth = 2;
    g.setLineDash([10, 14]);
    for (const l of STREET_LINES) {
      g.beginPath();
      g.moveTo(0, toPx(l));
      g.lineTo(S, toPx(l));
      g.moveTo(toPx(l), 0);
      g.lineTo(toPx(l), S);
      g.stroke();
    }
    g.setLineDash([]);
  });
}

export function buildCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD * 2, WORLD * 2),
    new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = false;
  group.add(ground);

  // Sea, west and south.
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x0d3a5c, roughness: 0.35, metalness: 0.4 });
  const seaW = new THREE.Mesh(new THREE.PlaneGeometry(300, WORLD * 2 + 300), seaMat);
  seaW.rotation.x = -Math.PI / 2;
  seaW.position.set(-WORLD - 150, -0.3, 0);
  group.add(seaW);
  const seaS = new THREE.Mesh(new THREE.PlaneGeometry(WORLD * 2 + 300, 300), seaMat);
  seaS.rotation.x = -Math.PI / 2;
  seaS.position.set(0, -0.3, WORLD + 150);
  group.add(seaS);

  // Building window textures (shared).
  const winTall = windowTexture(rng, 0.42);
  const winLow = windowTexture(rng, 0.28);
  const wallMats = [
    new THREE.MeshStandardMaterial({ color: 0x3c4250, emissive: 0xffffff, emissiveMap: winTall, emissiveIntensity: 0.9, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x4a3f35, emissive: 0xffffff, emissiveMap: winLow, emissiveIntensity: 0.8, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0x2e3a4a, emissive: 0xffffff, emissiveMap: winTall, emissiveIntensity: 0.9, roughness: 0.85 }),
  ];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const addBuilding = (x, z, w, d, h, matIdx) => {
    const m = new THREE.Mesh(boxGeo, wallMats[matIdx % wallMats.length]);
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    group.add(m);
    colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
    return m;
  };

  // Buildings, one or more per block. Blocks holding a landmark stay open.
  const RESERVED = new Set(['1,4', '4,4', '4,0']); // garage, hideout, Gry Market
  for (let i = 0; i < STREET_LINES.length - 1; i++) {
    for (let j = 0; j < STREET_LINES.length - 1; j++) {
      if (RESERVED.has(`${i},${j}`)) continue;
      const x0 = STREET_LINES[i] + 6;
      const z0 = STREET_LINES[j] + 6;
      const w = STREET_LINES[i + 1] - STREET_LINES[i] - 12;
      const cx = x0 + w / 2;
      const cz = z0 + w / 2;
      const district =
        cx < -90 ? 'portside'
        : Math.abs(cx) < 90 && Math.abs(cz) < 90 ? 'downtown'
        : cx >= 90 && cz < -90 ? 'oldtown'
        : cz >= 120 ? 'beach'
        : cx >= 90 ? 'industrial'
        : 'mid';
      if (district === 'downtown') {
        addBuilding(cx + range(rng, -6, 6), cz + range(rng, -6, 6), range(rng, 22, 30), range(rng, 22, 30), range(rng, 34, 68), 0);
      } else if (district === 'portside') {
        addBuilding(cx, cz, range(rng, 30, 40), range(rng, 16, 22), range(rng, 9, 14), 1);
      } else if (district === 'industrial') {
        addBuilding(cx, cz, range(rng, 26, 36), range(rng, 20, 28), range(rng, 12, 20), 2);
      } else if (district === 'beach') {
        addBuilding(cx, cz, range(rng, 24, 32), range(rng, 16, 22), range(rng, 8, 14), 1);
      } else {
        addBuilding(cx - 10, cz - 8, range(rng, 14, 20), range(rng, 14, 20), range(rng, 10, 22), (i + j) % 3);
        addBuilding(cx + 12, cz + 10, range(rng, 12, 18), range(rng, 12, 18), range(rng, 8, 16), (i + j + 1) % 3);
      }
    }
  }

  // Containers in Portside / Industrial.
  const contCols = [0xb03a2e, 0x1e6f5c, 0x2e5a8a, 0x8a6d1e];
  for (let n = 0; n < 14; n++) {
    const x = n < 7 ? range(rng, -200, -130) : range(rng, 130, 200);
    const z = range(rng, -170, 170);
    const c = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: pick(rng, contCols), roughness: 0.8 }));
    c.scale.set(12, 3, 3);
    c.position.set(x, 1.5, z);
    c.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
    group.add(c);
    colliders.push({ x0: x - 6, x1: x + 6, z0: z - 2, z1: z + 2 });
  }

  // Dock cranes (Portside).
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.6 });
  for (const cz of [-150, -60]) {
    const tower = new THREE.Mesh(boxGeo, craneMat);
    tower.scale.set(4, 42, 4);
    tower.position.set(-196, 21, cz);
    group.add(tower);
    const arm = new THREE.Mesh(boxGeo, craneMat);
    arm.scale.set(30, 2, 2);
    arm.position.set(-182, 40, cz);
    group.add(arm);
    colliders.push({ x0: -198, x1: -194, z0: cz - 2, z1: cz + 2 });
  }

  // Garage (player home) with a door.
  const garage = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 }));
  garage.scale.set(20, 8, 14);
  garage.position.set(LANDMARKS.GARAGE.x, 4, LANDMARKS.GARAGE.z);
  group.add(garage);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 }));
  door.position.set(LANDMARKS.GARAGE.x, 3, LANDMARKS.GARAGE.z + 7.1);
  group.add(door);
  colliders.push({ x0: LANDMARKS.GARAGE.x - 10, x1: LANDMARKS.GARAGE.x + 10, z0: LANDMARKS.GARAGE.z - 7, z1: LANDMARKS.GARAGE.z + 7 });

  // Gry Market stall (Old Town) with awning.
  const stall = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x6e2a4a, roughness: 0.85 }));
  stall.scale.set(10, 5, 8);
  stall.position.set(LANDMARKS.SHOP_POS.x, 2.5, LANDMARKS.SHOP_POS.z);
  group.add(stall);
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ color: 0xd43d7a, side: THREE.DoubleSide, roughness: 0.8 }));
  awning.rotation.x = -Math.PI / 2.6;
  awning.position.set(LANDMARKS.SHOP_POS.x, 5.4, LANDMARKS.SHOP_POS.z + 3);
  group.add(awning);
  colliders.push({ x0: LANDMARKS.SHOP_POS.x - 5, x1: LANDMARKS.SHOP_POS.x + 5, z0: LANDMARKS.SHOP_POS.z - 4, z1: LANDMARKS.SHOP_POS.z + 4 });

  // Street lamps (instanced).
  const lampSpots = [];
  for (const l of STREET_LINES) {
    for (let v = -180; v <= 180; v += 60) {
      lampSpots.push([l + 8, v + 8]);
      lampSpots.push([l - 8, v - 8]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
  const m4 = new THREE.Matrix4();
  lampSpots.forEach(([x, z], i) => {
    m4.makeTranslation(x, 3, z);
    poles.setMatrixAt(i, m4);
    m4.makeTranslation(x, 6.1, z);
    heads.setMatrixAt(i, m4);
  });
  group.add(poles);
  group.add(heads);

  // Palms along Beachfront.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
  const leafGeo = new THREE.ConeGeometry(3, 4, 6);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1e6f3a, roughness: 0.9 });
  const palms = new THREE.InstancedMesh(trunkGeo, trunkMat, 18);
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, 18);
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let i = 0; i < 18; i++) {
    const x = -170 + i * 20 + range(rng, -4, 4);
    const z = 196 + range(rng, -4, 4);
    e.set(range(rng, -0.08, 0.08), 0, range(rng, -0.08, 0.08));
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3(x, 3.5, z), q, new THREE.Vector3(1, 1, 1));
    palms.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, 8.5, z), q, new THREE.Vector3(1, 1, 1));
    leaves.setMatrixAt(i, m4);
  }
  group.add(palms);
  group.add(leaves);

  // Neon signs.
  const signs = [
    ['NEON HARBOR', '#22d3ee', 0, 40, -58],
    ['GRY MARKET', '#ff4d9d', LANDMARKS.SHOP_POS.x, 8, LANDMARKS.SHOP_POS.z + 4.2],
    ['HOTEL', '#ffd27a', -30, 14, 172],
    ['PIER 9', '#22d3ee', -186, 16, -90],
    ['BAR', '#ff5a4d', 132, 10, -108],
    ['24H', '#4ade80', 150, 12, 30],
    ['TACOS', '#fb923c', 96, 9, -150],
    ['CINEMA', '#c084fc', 40, 30, -58],
  ];
  for (const [text, color, x, y, z] of signs) {
    const s = new THREE.Mesh(
      new THREE.PlaneGeometry(text.length * 1.1, 4),
      new THREE.MeshBasicMaterial({ map: signTexture(text, color), transparent: true, side: THREE.DoubleSide }),
    );
    s.position.set(x, y, z);
    group.add(s);
  }

  // Traffic lights at four intersections.
  const lights = [];
  for (const [lx, lz] of [[-60, -60], [60, -60], [-60, 60], [60, 60]]) {
    const g2 = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 6), poleMat);
    pole.position.y = 2.5;
    g2.add(pole);
    const head = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x111111 }));
    head.scale.set(0.8, 2.2, 0.8);
    head.position.y = 5.6;
    g2.add(head);
    const mk = (color, y) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color }));
      s.position.set(0, y, 0.45);
      g2.add(s);
      return s;
    };
    const red = mk(0x330000, 6.3);
    const yellow = mk(0x332200, 5.6);
    const green = mk(0x003300, 4.9);
    g2.position.set(lx + 7, 0, lz + 7);
    group.add(g2);
    lights.push({ red, yellow, green });
  }

  // Mission beacon (tall glowing column, moved by world.js).
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 80, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beacon.position.y = 40;
  beacon.visible = false;
  group.add(beacon);

  return { group, colliders, lights, beacon };
}

// Push a circle (x, z, radius) out of building AABBs. Mutates pos in place.
export function collideCircle(pos, radius, colliders) {
  for (const c of colliders) {
    const nx = Math.max(c.x0, Math.min(pos.x, c.x1));
    const nz = Math.max(c.z0, Math.min(pos.z, c.z1));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 1e-6) {
        pos.x = c.x1 + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = nx + (dx / d) * radius;
        pos.z = nz + (dz / d) * radius;
      }
    }
  }
}

export function clampToMap(pos, margin = 4) {
  pos.x = Math.max(-MAP_HALF + margin, Math.min(MAP_HALF - margin, pos.x));
  pos.z = Math.max(-MAP_HALF + margin, Math.min(MAP_HALF - margin, pos.z));
}
