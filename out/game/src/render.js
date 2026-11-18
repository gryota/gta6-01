// Drawing only: the three.js scene, the HUD and the minimap. The world's state in,
// pixels out. Meshes are pooled and reused — cars, pedestrians and cops each get a
// fixed set of groups, so a frame allocates nothing.
import * as THREE from 'three';
import { CITY_HALF, PALETTE, ROADS, SEA_X } from './config.js';
import { buildCity } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const MAX_CARS = 40;
const MAX_PEDS = 40;

function makeCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0e1622, roughness: 0.15, metalness: 0.7 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.65, 4.4), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, 0.36, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 2.5 });
  for (const x of [-0.65, 0.65]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(x, 0.6, 2.22);
    group.add(head);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa1111, emissive: 0xff2222, emissiveIntensity: 1.6 });
  for (const x of [-0.65, 0.65]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(x, 0.6, -2.22);
    group.add(tail);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 3 }),
    );
    red.position.x = -0.4;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x0000aa, emissive: 0x2222ff, emissiveIntensity: 3 }),
    );
    blue.position.x = 0.4;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.5, -0.2);
    lightBar.userData = { red, blue };
    group.add(lightBar);
  }
  group.userData = { wheels, lightBar, bodyMat };
  return group;
}

function makePedMesh(shirtColor) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.85 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x23232e, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirtMat);
  torso.position.y = 1.15;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skinMat);
  head.position.y = 1.68;
  group.add(head);
  const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.22);
  const legL = new THREE.Mesh(legGeo, pantsMat);
  legL.position.set(-0.15, 0.38, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pantsMat);
  legR.position.set(0.15, 0.38, 0);
  group.add(legR);
  const armGeo = new THREE.BoxGeometry(0.16, 0.62, 0.18);
  const armL = new THREE.Mesh(armGeo, shirtMat);
  armL.position.set(-0.38, 1.15, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirtMat);
  armR.position.set(0.38, 1.15, 0);
  group.add(armR);
  group.userData = { legL, legR, armL, armR };
  return group;
}

function makePlayerMesh() {
  const group = makePedMesh(0x2e8b8b);
  // Rook: teal jacket, dark cap.
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.12, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.7 }),
  );
  cap.position.y = 1.9;
  group.add(cap);
  return group;
}

export function createRenderer(canvas, layout, random) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 90, 620);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

  scene.add(new THREE.HemisphereLight(0x8a6bbf, 0x1a1210, 1.5));
  const sun = new THREE.DirectionalLight(0xff9a5c, 2.2);
  sun.position.set(-180, 90, 60);
  scene.add(sun);

  buildCity(scene, layout, random);

  const playerMesh = makePlayerMesh();
  scene.add(playerMesh);

  const carPool = [];
  for (let i = 0; i < MAX_CARS; i += 1) {
    const mesh = makeCarMesh(0x888888, false);
    mesh.visible = false;
    scene.add(mesh);
    carPool.push({ mesh, isPolice: false });
  }
  const pedPool = [];
  for (let i = 0; i < MAX_PEDS; i += 1) {
    const mesh = makePedMesh(0x888888);
    mesh.visible = false;
    scene.add(mesh);
    pedPool.push(mesh);
  }

  // Mission beacon: a glowing column + ring on the ground + a floating arrow.
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 34, 20, 1, true), beaconMat);
  scene.add(beacon);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.1, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);
  const arrow = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.2, 4),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  arrow.rotation.x = Math.PI;
  scene.add(arrow);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Third-person camera: behind the player on foot, chase behind the car.
  // A cinematic override (the title screen) frames the city instead.
  function updateCamera(state, dt) {
    if (state.cinematic) {
      camera.position.set(state.cinematic.x, state.cinematic.y, state.cinematic.z);
      camera.lookAt(state.cinematic.tx, state.cinematic.ty, state.cinematic.tz);
      return;
    }
    const player = state.player;
    const inCar = !player.onFoot && state.playerCar;
    const dist = inCar ? 11 : 7.5;
    const height = inCar ? 4.2 : 3.4;
    // Chase camera: behind the car, facing its heading. On foot the camera orbits
    // freely around the player at state.camYaw.
    const camYaw = inCar ? player.heading : state.camYaw;
    const pitch = state.camPitch;
    const tx = player.x;
    const tz = player.z;
    const cx = tx - Math.sin(camYaw) * Math.cos(pitch) * dist;
    const cz = tz - Math.cos(camYaw) * Math.cos(pitch) * dist;
    const cy = height + Math.sin(pitch) * dist * 0.7;
    camera.position.set(cx, cy, cz);
    camera.lookAt(tx, 1.6, tz);
  }

  function sync(state, time) {
    const player = state.player;
    playerMesh.visible = true;
    playerMesh.position.set(player.x, 0, player.z);
    playerMesh.rotation.y = player.heading;
    if (player.onFoot) {
      const swing = Math.sin(player.walkPhase) * 0.55;
      const u = playerMesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.8;
      u.armR.rotation.x = swing * 0.8;
      playerMesh.visible = !(player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0);
    } else {
      playerMesh.visible = false;
    }

    // Cars: reuse pool entries; rebuild a mesh's colour when the car changes.
    let ci = 0;
    for (const car of state.cars) {
      if (ci >= MAX_CARS) break;
      const slot = carPool[ci];
      const needPolice = car.kind === 'police';
      if (slot.isPolice !== needPolice) {
        scene.remove(slot.mesh);
        const mesh = makeCarMesh(car.color, needPolice);
        scene.add(mesh);
        slot.mesh = mesh;
        slot.isPolice = needPolice;
      }
      const mesh = slot.mesh;
      mesh.visible = true;
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.heading;
      mesh.userData.bodyMat.color.setHex(car.color);
      if (car.kind === 'police') {
        // Alternate the light bar: red then blue.
        const bar = mesh.userData.lightBar;
        if (bar) {
          const phase = Math.floor(time * 2.4) % 2 === 0;
          bar.userData.red.material.emissiveIntensity = phase ? 4 : 0.4;
          bar.userData.blue.material.emissiveIntensity = phase ? 0.4 : 4;
        }
      }
      const spin = car.speed * 0.5;
      for (const wheel of mesh.userData.wheels) wheel.rotation.x += spin * 0.016;
      ci += 1;
    }
    for (; ci < MAX_CARS; ci += 1) carPool[ci].mesh.visible = false;

    let pi = 0;
    for (const ped of state.peds) {
      if (pi >= MAX_PEDS) break;
      const mesh = pedPool[pi];
      mesh.visible = true;
      mesh.position.set(ped.x, ped.down > 0 ? -0.4 : 0, ped.z);
      mesh.rotation.y = ped.heading;
      if (ped.down > 0) mesh.rotation.x = Math.PI / 2;
      else mesh.rotation.x = 0;
      const swing = Math.sin(ped.walkPhase) * 0.5;
      const u = mesh.userData;
      u.legL.rotation.x = swing;
      u.legR.rotation.x = -swing;
      u.armL.rotation.x = -swing * 0.8;
      u.armR.rotation.x = swing * 0.8;
      // Shirt colour: cops wear navy.
      mesh.children[0].material.color.setHex(ped.color);
      pi += 1;
    }
    for (; pi < MAX_PEDS; pi += 1) pedPool[pi].visible = false;
  }

  function drawBeacon(target, time) {
    if (!target) {
      beacon.visible = false;
      ring.visible = false;
      arrow.visible = false;
      return;
    }
    beacon.visible = true;
    ring.visible = true;
    arrow.visible = true;
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    beacon.position.set(target.x, 17, target.z);
    beacon.scale.set(pulse, 1, pulse);
    ring.position.set(target.x, 0.15, target.z);
    ring.scale.set(pulse, pulse, 1);
    arrow.position.set(target.x, 26 + Math.sin(time * 2) * 1.2, target.z);
    arrow.rotation.y = time * 1.5;
  }

  function draw(state, screen, target, time) {
    updateCamera(state, 0.016);
    sync(state, time);
    drawBeacon(target, time);
    renderer.render(scene, camera);
  }

  return { draw, camera, scene, renderer };
}

// ---- Minimap: a 2D top-down canvas. ----
export function createMinimap(canvas) {
  const ctx = canvas.getContext('2d');
  const size = 150;
  canvas.width = size;
  canvas.height = size;
  function toMap(v) { return ((v + 240) / 480) * size; }

  function draw(state, target) {
    ctx.fillStyle = '#101018';
    ctx.fillRect(0, 0, size, size);
    // Sea.
    ctx.fillStyle = '#0b2f4a';
    ctx.fillRect(toMap(SEA_X), 0, size - toMap(SEA_X), size);
    // Roads.
    ctx.strokeStyle = '#4a4a58';
    ctx.lineWidth = 4;
    for (const r of ROADS) {
      ctx.beginPath();
      ctx.moveTo(toMap(r), 0);
      ctx.lineTo(toMap(r), size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, toMap(r));
      ctx.lineTo(size, toMap(r));
      ctx.stroke();
    }
    // Mission target.
    if (target) {
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(toMap(target.x), toMap(target.z), pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cars: white dots, police red/blue.
    for (const car of state.cars) {
      ctx.fillStyle = car.kind === 'police' ? '#ff4444' : '#ffffff';
      ctx.fillRect(toMap(car.x) - 2, toMap(car.z) - 2, 4, 4);
    }
    // Player: a cyan triangle pointing where they face.
    const p = state.player;
    ctx.save();
    ctx.translate(toMap(p.x), toMap(p.z));
    ctx.rotate(Math.PI - p.heading);
    ctx.fillStyle = '#29e6ff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North tick.
    ctx.fillStyle = '#9aa3b5';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', 4, 12);
  }
  return { draw };
}
