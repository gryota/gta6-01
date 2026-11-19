// Neon Harbor — config.js
// Every tunable number of the game in one place. Pure module: no imports,
// so the Node regression tests can load it directly.

export const STEP = 1 / 60;

export const CONFIG = {
  // World layout (meters, x east, z south, origin at city centre).
  worldHalf: 240,
  roadSpacing: 60,
  roadWidth: 10,
  sidewalkWidth: 3,
  roadLines: [-180, -120, -60, 0, 60, 120, 180],

  // Districts: name, rectangle [minX, minZ, maxX, maxZ], building height range.
  districts: [
    { name: 'Portside', rect: [-240, -60, -120, 120], minH: 8, maxH: 22, tint: 0x8a7a5a },
    { name: 'Downtown', rect: [-120, -120, 120, 60], minH: 30, maxH: 95, tint: 0x5a6a8a },
    { name: 'Old Town', rect: [60, -180, 180, -60], minH: 8, maxH: 18, tint: 0x9a7a5a },
    { name: 'Beachfront', rect: [-120, 120, 120, 240], minH: 10, maxH: 30, tint: 0x7a8a9a },
    { name: 'Industrial', rect: [120, -60, 240, 120], minH: 10, maxH: 26, tint: 0x6a6a5a },
  ],

  // Landmarks (road intersections, so cars and the player can reach them).
  garage: { x: 180, z: 120, label: 'Garage' },
  shop: { x: 120, z: -120, label: 'Gry Market' },
  portsidePickup: { x: -180, z: 30, label: 'Portside Docks' },
  downtownDrop: { x: 0, z: -60, label: 'Downtown Plaza' },
  passengerPickup: { x: 60, z: 60, label: 'Beachfront Corner' },
  beachfrontDrop: { x: 0, z: 180, label: 'Beachfront Pier' },
  rallyPoint: { x: -120, z: 120, label: 'Rally Point' },
  hideout: { x: 180, z: 120, label: 'Hideout Garage' },

  // Player on foot.
  walkSpeed: 5,
  runSpeed: 9,
  playerRadius: 0.6,
  playerHealth: 100,

  // Driving.
  carAccel: 14,
  carBrake: 26,
  carReverseMax: 10,
  carMaxSpeed: 38,
  carSteer: 1.9,
  carRadius: 1.6,
  handbrakeFriction: 8,

  // Wanted system: points 0-500, 100 points = 1 star.
  wantedMaxPoints: 500,
  wantedPointsPerStar: 100,
  wantedDecayPerSec: 6,
  wantedDecayMinPoliceDist: 45,
  wantedStealCar: 100,
  wantedHitPedestrian: 80,
  wantedHitCar: 30,
  wantedHitPoliceCar: 60,
  wantedPunchPolice: 150,

  // Police cars.
  policeCarNearSpeed: 21,
  policeCarFarSpeed: 17,
  policeCarNearDist: 30,
  policeCarRamDamage: 6,
  policeCarRamCooldown: 1.2,

  // Police on foot.
  footPoliceMinStars: 2,
  footPoliceMax: 3,
  footPoliceSpawnEvery: 4,
  footPoliceSpeed: 4.5,
  footPolicePunchDamage: 8,
  footPolicePunchCooldown: 1.0,
  footPolicePunchRange: 1.8,

  // Busted: 2+ foot police within 3 m for 2.5 s.
  bustedMinCops: 2,
  bustedRadius: 3,
  bustedHoldSec: 2.5,
  bustedFine: 150,

  // Damage and healing.
  crashDamage: 4,
  healthRegenPerSec: 3,

  // Missions.
  missionRewards: [250, 400, 500, 800],
  mission3TimeLimit: 90,

  // Traffic.
  trafficCarCount: 10,
  trafficCarSpeed: 9,
  pedestrianCount: 24,
  pedestrianSpeed: 1.6,

  // Shop (Gry Market).
  shopBandagePrice: 40,
  shopBandageMax: 3,
  shopBandageHeal: 50,
  shopEnergyPrice: 25,
  shopEnergyHeal: 25,
  shopBribePrice: 200,
  shopBribeMinStars: 1,
  shopBribeMaxStars: 2,
  shopBribeMinPoliceDist: 30,

  // Save.
  saveKey: 'neon-harbor-save-v1',
  startingMoney: 0,

  // Clock: one in-game hour per 60 real seconds, starting at dusk.
  clockStartHour: 19,
  clockHoursPerRealSec: 1 / 60,
};

export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'First Gear',
    briefing:
      'Rook, you owe Ms. Vane. First job is simple: lift a car, any car, and bring it to the garage at the east end. Keep it clean if you can.',
    steps: [
      { type: 'steal', text: 'Steal a car (press E near one)' },
      { type: 'goto', pos: CONFIG.garage, text: 'Drive the car to the garage' },
    ],
  },
  {
    id: 'm2',
    title: 'Harbor Run',
    briefing:
      'A package is waiting at the Portside docks. Pick it up and drop it at Downtown Plaza. Word is the heat is watching the docks — if your wanted level hits five stars, the job is blown.',
    steps: [
      { type: 'goto', pos: CONFIG.portsidePickup, text: 'Pick up the package at Portside' },
      { type: 'goto', pos: CONFIG.downtownDrop, text: 'Deliver the package to Downtown Plaza' },
    ],
  },
  {
    id: 'm3',
    title: 'Night Shift',
    briefing:
      'A fare is waiting at Beachfront Corner. Pick them up and get them to the pier in 90 seconds. Late means no pay.',
    steps: [
      { type: 'goto', pos: CONFIG.passengerPickup, text: 'Pick up the passenger' },
      { type: 'goto', pos: CONFIG.beachfrontDrop, text: 'Drop the passenger at the pier', timed: true },
    ],
  },
  {
    id: 'm4',
    title: 'The Vane Job',
    briefing:
      'Last job. Ms. Vane wants the heat off her back. Meet the crew at the rally point, then lose the cops and slip into the hideout garage with a clean slate — wanted level zero, or the door stays shut.',
    steps: [
      { type: 'goto', pos: CONFIG.rallyPoint, text: 'Reach the rally point' },
      { type: 'escape', pos: CONFIG.hideout, text: 'Lose the cops, then reach the hideout with 0 stars' },
    ],
  },
];
