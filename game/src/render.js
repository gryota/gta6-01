// Renderer — THREE setup, chase camera, mesh factories for cars/peds/player.
import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(1280, 800, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a2340);
    this.scene.fog = new THREE.Fog(0x1a2340, 90, 320);
    this.camera = new THREE.PerspectiveCamera(62, 1280 / 800, 0.1, 900);
    const hemi = new THREE.HemisphereLight(0x8a7ab8, 0x1a1410, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb36b, 1.4);
    sun.position.set(-80, 120, -40);
    this.scene.add(sun);
    this.camYaw = 0;
    this.camPitch = 0.32;
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // Third-person chase camera behind a target, with mouse orbit offsets.
  chaseCamera(pos, heading, dist, height, yawOff, pitchOff) {
    const yaw = heading + Math.PI + yawOff;
    const pitch = pitchOff;
    const cx = pos.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cz = pos.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    const cy = height + Math.sin(pitch) * dist;
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(pos.x, 1.6, pos.z);
  }

  setCamera(x, y, z, lx, ly, lz) {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(lx, ly, lz);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// Car: body + cabin, faces +z so rotation.y = heading works.
export function makeCarMesh(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x11141c, roughness: 0.15, metalness: 0.6 }),
  );
  cabin.position.set(0, 1.15, -0.2);
  g.add(cabin);
  if (isPolice) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.25, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x4488ff, emissiveIntensity: 1.2 }),
    );
    bar.position.set(0, 1.55, -0.2);
    g.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.25, 4.42), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    stripe.position.y = 0.55;
    g.add(stripe);
  }
  return g;
}

// Pedestrian: capsule-ish body + head.
export function makePedMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.4, 1.3, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.26, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a075, roughness: 0.8 }),
  );
  head.position.y = 1.85;
  g.add(head);
  return g;
}

// The player on foot: dark jacket, red scarf accent.
export function makePlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 1.35, 8),
    new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85 }),
  );
  body.position.y = 0.95;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xd8a075, roughness: 0.8 }),
  );
  head.position.y = 1.9;
  g.add(head);
  const scarf = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.18, 0.1),
    new THREE.MeshStandardMaterial({ color: 0xc0272d, roughness: 0.8 }),
  );
  scarf.position.set(0, 1.62, 0.36);
  g.add(scarf);
  return g;
}
