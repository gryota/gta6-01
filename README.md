[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gryota/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gryota/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Harbor

An open-world crime game for the make.fun **gta6-01** bounty — a fictional neon
coastal city, built from scratch in three.js. Everything is original: the city,
the characters, the story, the art, and the synthesized sound. Nothing is taken
from any commercial game.

You are **Rook**, a getaway driver back in town and in debt to the fixer
**Ms. Vane**. Work it off: steal cars, run packages, outdrive the police.

## Play

```sh
node serve.ts        # then open http://localhost:8080
```

Desktop (keyboard + mouse) and touch phones both work. No network requests
while the game runs; all sound is synthesized with WebAudio.

## Controls

- **WASD** walk / drive, **Shift** run, **Space** handbrake
- **E** enter a car / steal it / interact (shop, missions)
- **F** punch, **H** use a bandage, **Mouse drag** orbit the camera
- Touch: virtual joystick + CAR / HIT / RUN / BRAKE buttons

## Features

- A 3D city in 5 districts (Portside docks, Downtown towers, Old Town, Beachfront, Industrial), with traffic, pedestrians, neon signs, and the sea
- Wanted stars 1–5 with chasing police cars and foot police; BUSTED fines and respawns
- 4 story missions with briefing, objective beacon, minimap marker, and rewards ($250 / $400 / $500 / $800)
- **Gry Market** — a night-market stall in Old Town: bandages, energy drinks, and police bribes
- HUD with health, money, stars, clock, speed, and a live minimap; save in localStorage
- Synthesized sound only: engine hum, sirens, pickups, crashes, ambient pad

## Originality

All names, places, characters, story, art, and sound are invented for this
entry. Built for the make.fun gta6-01 bounty.
