// Neon Harbor — all sound is synthesized with WebAudio. No audio files.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    padOsc: null,
    padGain: null,
    muted: false,
  };
}

export function ensureAudio(a) {
  if (a.ctx) {
    if (a.ctx.state === 'suspended') a.ctx.resume();
    return true;
  }
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    a.ctx = new Ctx();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.35;
    a.master.connect(a.ctx.destination);
    // Engine hum (sawtooth through lowpass).
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    a.engineOsc.connect(a.engineGain).connect(a.master);
    a.engineOsc.start();
    // Police siren (two-tone triangle, LFO on frequency).
    a.sirenOsc = a.ctx.createOscillator();
    a.sirenOsc.type = 'triangle';
    a.sirenOsc.frequency.value = 700;
    a.sirenGain = a.ctx.createGain();
    a.sirenGain.gain.value = 0;
    const lfo = a.ctx.createOscillator();
    lfo.frequency.value = 0.8;
    const lfoGain = a.ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain).connect(a.sirenOsc.frequency);
    lfo.start();
    a.sirenOsc.connect(a.sirenGain).connect(a.master);
    a.sirenOsc.start();
    // Ambient pad (soft detuned sines).
    a.padOsc = a.ctx.createOscillator();
    a.padOsc.type = 'sine';
    a.padOsc.frequency.value = 110;
    a.padGain = a.ctx.createGain();
    a.padGain.gain.value = 0.04;
    a.padOsc.connect(a.padGain).connect(a.master);
    a.padOsc.start();
    return true;
  } catch {
    return false;
  }
}

export function setEngine(a, speed01) {
  if (!a.ctx || !a.engineOsc) return;
  a.engineOsc.frequency.value = 55 + speed01 * 130;
  a.engineGain.gain.value = 0.02 + speed01 * 0.05;
}

export function setSiren(a, on) {
  if (!a.ctx || !a.sirenGain) return;
  a.sirenGain.gain.value = on ? 0.035 : 0;
}

function blip(a, freq, dur, type = 'sine', vol = 0.12) {
  if (!a.ctx) return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  const g = a.ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.master);
  o.start(t);
  o.stop(t + dur);
}

export function playPickup(a) { blip(a, 880, 0.12, 'sine', 0.12); setTimeout(() => blip(a, 1320, 0.15, 'sine', 0.1), 90); }
export function playCoin(a) { blip(a, 1046, 0.1, 'square', 0.06); setTimeout(() => blip(a, 1568, 0.18, 'square', 0.05), 80); }
export function playCrash(a) { blip(a, 90, 0.25, 'sawtooth', 0.18); }
export function playPunch(a) { blip(a, 160, 0.1, 'square', 0.12); }
