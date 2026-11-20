// Neon Harbor — audio.js
// Every sound is synthesized with WebAudio — no audio files, no downloads.
// Engine hum follows the car's speed, the siren wails while the heat is on,
// and a soft pad hums underneath it all.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let padGain = null;
  let started = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function noiseBuffer() {
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Call from the first user gesture (key, click, tap).
  function resume() {
    const c = ensure();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    if (started) return;
    started = true;

    // Engine: a sawtooth plus a sub sine through a lowpass.
    engineOsc = c.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = c.createOscillator();
    engineOsc2.type = 'sine';
    engineOsc2.frequency.value = 28;
    engineFilter = c.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = c.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(c.destination);
    engineOsc.start();
    engineOsc2.start();

    // Siren: a triangle that swings 700-950 Hz, quiet until wanted.
    sirenOsc = c.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 820;
    const sirenLfo = c.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 0.8;
    const sirenLfoGain = c.createGain();
    sirenLfoGain.gain.value = 130;
    sirenLfo.connect(sirenLfoGain);
    sirenLfoGain.connect(sirenOsc.frequency);
    sirenGain = c.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(c.destination);
    sirenOsc.start();
    sirenLfo.start();

    // Ambient pad: two detuned triangles, very quiet, always on.
    padGain = c.createGain();
    padGain.gain.value = 0.018;
    const padFilter = c.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 700;
    for (const freq of [110, 164.8, 220.5]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq;
      o.connect(padFilter);
      o.start();
    }
    padFilter.connect(padGain);
    padGain.connect(c.destination);
  }

  function blip(freq, dur, type, vol) {
    const c = ensure();
    if (!c || c.state !== 'running') return;
    const o = c.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  return {
    resume,
    // speed 0..1, driving true/false.
    setEngine(speed, driving) {
      if (!ctx || !engineGain) return;
      const t = ctx.currentTime;
      engineGain.gain.setTargetAtTime(driving ? 0.05 + speed * 0.09 : 0.02, t, 0.1);
      const f = 50 + speed * 130;
      engineOsc.frequency.setTargetAtTime(f, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(f / 2, t, 0.08);
      engineFilter.frequency.setTargetAtTime(380 + speed * 900, t, 0.1);
    },
    setSiren(on) {
      if (!ctx || !sirenGain) return;
      sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, ctx.currentTime, 0.2);
    },
    pickup() { blip(880, 0.12, 'sine', 0.14); setTimeout(() => blip(1320, 0.18, 'sine', 0.12), 90); },
    coin() { blip(1046, 0.1, 'square', 0.07); setTimeout(() => blip(1568, 0.16, 'square', 0.06), 80); },
    crash() {
      const c = ensure();
      if (!c || c.state !== 'running') return;
      const src = c.createBufferSource();
      src.buffer = noiseBuffer();
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = c.createGain();
      g.gain.setValueAtTime(0.25, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
      src.connect(f);
      f.connect(g);
      g.connect(c.destination);
      src.start();
      src.stop(c.currentTime + 0.35);
    },
    punch() { blip(180, 0.08, 'square', 0.1); },
  };
}
