[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gryota/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gryota/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Harbor

An original open-world crime game for the make.fun **gta6-01** bounty: a neon port city of five districts, explored on foot and by car, with traffic, pedestrians, stealable cars, a five-star wanted system with pursuing police, four story missions, melee combat, a HUD with minimap, a start screen, saves, and a night-market shop — all running offline in the browser from static files.

## Story

Rook, a getaway driver, is back in Neon Harbor and owes the fixer **Ms. Vane**. Four jobs pay the debt:

1. **First Gear** — steal a car and bring it to the garage ($250)
2. **Harbor Run** — run a package from Portside to Downtown; blown if wanted hits 5 stars ($400)
3. **Night Shift** — ferry a passenger to the pier in 90 seconds ($500)
4. **The Vane Job** — meet the crew, lose the cops, and slip into the hideout with a clean slate ($800)

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

Or open `game/index.html` from any static server. No network requests: three.js is vendored under `game/vendor/`, all sound is synthesized with WebAudio.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Walk & drive |
| Mouse drag | Orbit camera |
| Shift | Run |
| E | Enter / steal car, open Gry Market |
| F / click | Punch |
| Space | Handbrake |
| H | Use bandage |
| M | Mute |
| Esc | Pause |

Touch devices get a virtual joystick plus CAR / HIT / RUN / BRAKE buttons.

## Gry Market

A night-market stall in Old Town sells bandages ($40, carry up to 3, press H to heal +50), energy drinks ($25, +25 health now) and police bribes ($200, −1 star at 1–2 stars when no police are within 30 m). It is not a safe zone — the cops follow you right up to the stall.

## Originality

Every name, character, district, story beat, texture and sound in Neon Harbor is original, made for this entry. Nothing is taken from any commercial game.

## Layout

- `game/index.html` — page, HUD, menus
- `game/src/config.js` — all tuning numbers and mission definitions
- `game/src/city.js` — procedural city (roads, buildings, docks, neon)
- `game/src/world.js` — player, driving, stealing, collisions, camera
- `game/src/traffic.js` — AI cars and pedestrians
- `game/src/police.js` — chase AI, foot police, busted rule
- `game/src/wanted.js` — wanted points/stars state machine
- `game/src/missions.js` — four-mission state machine
- `game/src/shop.js` — Gry Market purchase rules
- `game/src/hud.js` — HUD, minimap, menus, touch controls
- `game/src/audio.js` — synthesized WebAudio sound
- `game/src/shots.js` — deterministic screenshot poses (`?shot=`)
- `main.ts` — entry program, writes `/output/dossier.json`
- `tests/` — Node regression tests (`node --test tests/`)

## License

MIT — see `LICENSE`.
