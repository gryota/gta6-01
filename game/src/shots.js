// Screenshot poses — deterministic setups for the four jury screenshots.
// Positions sit on roads (a coordinate is on a road when its x or z is within
// 6 of a street line). Camera poses look along the road toward the action.
export const SHOT_NAMES = ['start', 'drive', 'chase', 'mission'];

export function getShotPose(name) {
  const poses = {
    start: {
      pos: { x: 0, z: 30 },
      heading: Math.PI,
      inCar: false,
      wanted: 0,
      missionIndex: 0,
      cam: { x: 0, y: 4, z: 38, lx: 0, ly: 1.5, lz: 18 },
    },
    drive: {
      pos: { x: 0, z: 60 },
      heading: Math.PI,
      inCar: true,
      carColor: 0x8a2f2f,
      wanted: 0,
      missionIndex: 0,
      cam: { x: 0, y: 6, z: 74, lx: 0, ly: 1.5, lz: 48 },
    },
    chase: {
      pos: { x: -60, z: -60 },
      heading: Math.PI / 2,
      inCar: true,
      carColor: 0x8a2f2f,
      wanted: 300,
      missionIndex: 0,
      policeCars: [
        { x: -10, z: 0 },
        { x: -16, z: 2 },
        { x: 4, z: -8 },
      ],
      cam: { x: -72, y: 5, z: -60, lx: -46, ly: 1.5, lz: -60 },
    },
    mission: {
      pos: { x: 90, z: 0 },
      heading: -Math.PI / 2,
      inCar: true,
      carColor: 0x8a2f2f,
      wanted: 100,
      missionIndex: 1,
      hasPackage: true,
      cam: { x: 102, y: 5, z: 0, lx: 76, ly: 1.5, lz: 0 },
    },
  };
  return poses[name] || poses.start;
}

export function applyShot(world, name) {
  const pose = getShotPose(name);
  world.setupShot(pose);
  return pose;
}
