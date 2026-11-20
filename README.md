[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gryota/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gryota/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Harbor

An open-world crime game in the browser: a fictional neon coastal city you
explore on foot and by car. Steal cars, outrun the harbor police, run four
story missions for Ms. Vane, and spend your earnings at Gry Market in Old
Town. Everything — the city, the characters, the story, the art and the
sounds — is original, made for the make.fun gta6-01 bounty.

## Play

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request while playing: the game is static files
under `game/`, built on three.js (vendored as `game/vendor/three.module.min.js`).

## Controls

- **WASD** — walk / drive · **Mouse drag** — camera
- **E** — enter a car / steal it / open the shop
- **F** — punch · **H** — use a bandage (+50 health)
- **Shift** — run · **Space** — handbrake · **Esc** — pause
- Touch: virtual joystick + CAR / HIT / RUN / BRAKE buttons

## The game

- **City**: five districts — Portside docks, Downtown towers, Old Town, Beachfront, Industrial — with traffic, pedestrians, street lamps, palm trees and neon signs.
- **Wanted**: 1–5 stars. Stealing, hitting pedestrians or cars, and punching police raise the heat; it cools 6 points a second when no police is near. Police cars chase and ram; foot police close in from 2 stars. Get surrounded and you're BUSTED (flat $150 fine).
- **Missions**: four in a row — *First Gear* (steal a car), *Harbor Run* (a package from the docks), *Night Shift* (a 90-second fare), *The Vane Job* (lose the heat, reach the hideout). Rewards $250 / $400 / $500 / $800.
- **Gry Market**: the Old Town night-market stall. Bandages $40 (the only heal while wanted), energy drinks $25, and a $200 bribe that drops one star — but only at 1–2 stars with no police nearby. The shop is not a safe zone.
- **HUD + minimap**, start screen, save in localStorage, synthesized WebAudio sound (engine, sirens, pickups, crashes, ambient pad).

## Screenshots

Four real renders of the game itself (`?shot=start|drive|chase|mission&seed=1`): on foot in Downtown, driving, a three-star chase, and the Harbor Run.
