// Neon Harbor — shots.js
// Screenshot poses: ?shot=start|drive|chase|mission&seed=1
// Each pose puts the player, the camera, the wanted level and the mission
// in a fixed spot so the four jury screenshots are deterministic renders
// of the game itself. Forward is -Z; heading 0 faces north.

export function parseShot(search) {
  const params = new URLSearchParams(search);
  const shot = params.get('shot');
  if (!shot) return null;
  const seed = parseInt(params.get('seed') || '1', 10) || 1;
  const poses = {
    // Cover: Rook on foot in Downtown, neon towers ahead, dusk sky.
    start: {
      x: 0, z: 30, heading: 0,
      camYaw: 0, camPitch: 0.3, camDist: 9,
      wanted: 0, missionIndex: 0, inCar: false,
    },
    // Driving north through Downtown in a stolen car.
    drive: {
      x: 0, z: 120, heading: 0,
      camYaw: 0, camPitch: 0.26, camDist: 12,
      wanted: 0, inCar: true, carIndex: 10,
    },
    // Three stars, police cars closing in on the chase.
    chase: {
      x: -60, z: 0, heading: -Math.PI / 2,
      camYaw: -Math.PI / 2, camPitch: 0.26, camDist: 13,
      wanted: 300, inCar: true, carIndex: 10,
    },
    // Harbor Run in progress: driving west along the z=0 street toward the
    // Portside pickup, the beacon column straight ahead over the docks.
    // (The old pose faced the pickup from the south, where a Portside
    // warehouse hides the beacon behind its roofline.)
    mission: {
      x: -140, z: 0, heading: Math.PI / 2,
      camYaw: Math.PI / 2, camPitch: 0.28, camDist: 12,
      wanted: 100, missionIndex: 1, inCar: true, carIndex: 10,
    },
  };
  const pose = poses[shot];
  if (!pose) return null;
  return { ...pose, seed, name: shot };
}
