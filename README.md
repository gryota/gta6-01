[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/gryota/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/gryota/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Neon Harbor

Open-world crime game untuk bounty make.fun **gta6-01** — kota pesisir fiktif bergaya neon yang bisa dijelajahi dengan jalan kaki dan mengemudi, lengkap dengan lalu lintas, pejalan kaki, wanted level dan polisi, 4 misi berurutan, combat, toko, HUD + minimap, save, dan suara tersintesis. Semua nama, kota, karakter, cerita, art, dan suara adalah karya original — tanpa aset dari game komersial mana pun.

## Cara main

```sh
node serve.ts
# buka http://localhost:8080
```

Node 22. Tidak ada build step, tidak ada network request saat game jalan — semua file statis di bawah `game/`.

## Kontrol

- **WASD** jalan / mengemudi · **Mouse drag** putar kamera · **Shift** lari
- **E** masuk/keluar mobil (dan membuka Gry Market di dekat stall)
- **F** pukul · **H** pakai perban · **Space** handbrake · **Esc** jeda
- Sentuh HP: joystick virtual + tombol CAR / HIT / RUN / BRAKE

## Cerita

Rook, sopir pelarian, kembali ke Neon Harbor dengan utang pada fixer Ms. Vane. Lunasi lewat empat pekerjaan: curi mobil untuk garasi, antar paket dari dermaga, antar penumpang tepat waktu, dan pekerjaan terakhir — lolos dari polisi menuju hideout.

## Sistem

- **Wanted 1–5 bintang**: naik saat mencuri mobil, menabrak pejalan kaki/mobil/polisi, atau memukul polisi; turun perlahan saat tidak terlihat polisi. Mobil polisi mengejar dan menabrak; polisi jalan kaki muncul dari 2 bintang. Dikepung = BUSTED (denda flat $150).
- **Gry Market** (Old Town): perban $40, minuman energi $25, suap polisi $200.
- **Misi**: First Gear $250, Harbor Run $400, Night Shift $500 (timer 90 detik), The Vane Job $800.
- **Save**: uang, misi terbuka, perban, dan best wanted tersimpan di localStorage.

## Struktur kode

- `game/src/config.js` — konstanta dan angka loop inti
- `game/src/city.js` — pembangunan kota (tekstur canvas, instancing)
- `game/src/traffic.js` — mobil AI, pejalan kaki, lampu lalu lintas
- `game/src/police.js` — AI kejar polisi mobil dan jalan kaki
- `game/src/world.js` — simulasi dunia (pemain, misi, wanted, toko, save)
- `game/src/missions.js`, `wanted.js`, `save.js`, `shop.js` — logika murni (diuji unit)
- `game/src/render.js` — renderer three.js + pabrik mesh
- `game/src/hud.js` — HUD, minimap, overlay
- `game/src/input.js`, `audio.js`, `shots.js`, `main.js`
- `main.ts` — program entry yang menyalin game + screenshot ke /output
- `tests/` — tes unit (Node), `scripts/check.mjs` — pemeriksaan pra-submit

## Lisensi

MIT — lihat `LICENSE`.
