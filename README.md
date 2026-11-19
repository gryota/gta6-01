# Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gryota/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gryota/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

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
| E | Enter / exit car (steal parked or traffic cars); open Gry Market near its stall |
| F | Punch |
| H | Use a bandage (+50 health) |
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
- **Gry Market**: a supply stall in the Old Town night market (walk up, press E).
  Bandages $40 (carry up to 3, press H to heal — the only heal while wanted),
  energy drinks $25 (+25 health), and police bribes $200 (-1 star, only at
  1–2 stars with no cop within 30 m). Not a safe zone: the police keep chasing
  while you shop. Bandage stock is saved with the game.
- **HUD**: health, cash, bandages, wanted stars, speed, city clock, mission objective, and a
  live 2D minimap (with a green $ marker for Gry Market).
- **Save**: money, mission progress and best wanted level persist in localStorage
  (Continue on the title screen).
- **Sound**: everything synthesized with WebAudio — engine hum, police siren,
  pickup chimes, crashes, punches and an ambient pad. No audio files.

## Originality

Every name, character, district, vehicle, story beat, texture, sound and line of code
is original work made for this bounty. Nothing is taken from Rockstar Games, Grand
Theft Auto, or any other commercial game. three.js r170 is vendored under
`game/vendor/three.module.min.js` (MIT).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
