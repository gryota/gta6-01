// Neon Harbor — three.js scene: dusk lighting, chase camera, entity meshes.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1a3a);
  scene.fog = new THREE.Fog(0x2a1a3a, 90, 320);
  const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x1a1420, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5c, 1.1);
  sun.position.set(-80, 120, -40);
  scene.add(sun);
  const moon = new THREE.DirectionalLight(0x5c7aff, 0.35);
  moon.position.set(60, 80, 100);
  scene.add(moon);
  return scene;
}

// Shared geometries/materials for cars and people.
export function makeCarMesh(color, police = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color, emissive: police ? 0x111111 : 0x000000 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2436, emissive: 0x0a1420 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.36, wz);
    g.add(w);
  }
  // Headlights.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b8 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    h.position.set(hx, 0.6, 2.22);
    g.add(h);
  }
  if (police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2244 }),
    );
    bar.position.set(0, 1.55, -0.2);
    bar.name = 'lightbar';
    g.add(bar);
    const bar2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar2.position.set(0.7, 1.55, -0.2);
    g.add(bar2);
  }
  return g;
}

export function makePersonMesh(shirt = 0xc2a23a) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 1.1, 8),
    new THREE.MeshLambertMaterial({ color: shirt }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd8a077 }),
  );
  head.position.y = 1.75;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2a2a3a }),
  );
  legs.position.y = 0.35;
  g.add(legs);
  return g;
}

export function makePlayerMesh() {
  const g = makePersonMesh(0x39c2d8);
  // Rook wears a dark jacket + red scarf stripe.
  const scarf = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.15),
    new THREE.MeshBasicMaterial({ color: 0xd81f3a }),
  );
  scarf.position.set(0, 1.35, 0.3);
  g.add(scarf);
  return g;
}

// Chase camera: behind + above, smoothed. yaw = camera heading.
export function updateCamera(camera, px, pz, heading, inCar, speed01, dt, camState) {
  const dist = inCar ? 13 : 10;
  const height = inCar ? 5.5 : 6.5;
  const tx = px - Math.sin(heading) * dist;
  const tz = pz - Math.cos(heading) * dist;
  const k = 1 - Math.exp(-6 * dt);
  camState.x += (tx - camState.x) * k;
  camState.z += (tz - camState.z) * k;
  camState.y += (height - camState.y) * k;
  camera.position.set(camState.x, camState.y, camState.z);
  camera.lookAt(px, 1.5, pz);
  void speed01;
}
