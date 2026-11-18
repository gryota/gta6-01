# Neon Harbor

An original open-world crime game for the make.fun **gta6-01** bounty — "in the spirit
of GTA 6" with a world that is entirely its own: the dusk-lit coastal city of Neon
Harbor, five districts (Portside docks, Downtown towers, Old Town, Beachfront, and
Industrial), and the getaway driver Rook, who owes money to the fixer Ms. Vane.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

Desktop (keyboard + mouse) and touch phones are both supported — the touch controls
(virtual joystick, CAR / HIT / RUN / BRAKE buttons, drag to look) appear automatically
on touch devices.

| Input | Action |
| --- | --- |
| W A S D / arrows | Walk / drive |
| Mouse drag | Orbit camera |
| Shift | Run |
| E | Enter / exit car (steal parked or traffic cars) |
| F | Punch |
| Space | Handbrake |
| P / Esc | Pause |

## Features

- **Open city**: procedural buildings with lit windows, neon signs, palms, docks with
  cranes, beach and sea, dusk sky and fog.
- **On foot and driving**: third-person walking with run, arcade car handling with
  handbrake drifts, chase camera.
- **Traffic and pedestrians**: AI cars follow the road grid and slow for the car
  ahead; pedestrians stroll the sidewalks.
- **Steal cars**: walk up to a parked or traffic car and press E — the driver bails
  out and the law notices.
- **Wanted level 1–5 stars**: police cruisers chase and ram you; foot cops get out
  and chase you down on foot. Lay low and the heat fades.
- **Four story missions**: First Gear, Harbor Run, Night Shift (timed fare), and
  The Vane Job — with briefing, objective markers, a beacon and minimap target, and
  cash rewards. Mission Passed screen after each one.
- **Combat**: melee punches on foot, ramming in a car; police fight back.
- **HUD**: health, cash, wanted stars, speed, city clock, mission objective, and a
  live 2D minimap.
- **Save**: money, mission progress and best wanted level persist in localStorage
  (Continue on the title screen).
- **Sound**: everything synthesized with WebAudio — engine hum, police siren,
  pickup chimes, crashes, punches and an ambient pad. No audio files.

## Originality

Every name, character, district, vehicle, story beat, texture, sound and line of code
is original work made for this bounty. Nothing is taken from Rockstar Games, Grand
Theft Auto, or any other commercial game. three.js r170 is vendored under
`game/vendor/three.module.min.js` (MIT).
