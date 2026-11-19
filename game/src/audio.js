// Neon Harbor — audio.js
// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum follows speed, the police siren wails in two tones, pickups
// blip, crashes burst noise, and a soft pad hums underneath at dusk.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let padGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);

      // Engine: two detuned saws through a lowpass, gain follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 82;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      engineOsc2.start();

      // Siren: a triangle wailing between two tones on a square LFO.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.6;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 130;
      sirenLfo.connect(lfoGain);
      lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();

      // Ambient pad: two slow detuned sines, very quiet.
      padGain = ctx.createGain();
      padGain.gain.value = 0.035;
      padGain.connect(master);
      for (const freq of [110, 164.8, 220.5]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        o.detune.value = (Math.random() - 0.5) * 8;
        o.connect(padGain);
        o.start();
      }
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  function blip(freq, dur, type = 'sine', vol = 0.25) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur);
  }

  function noiseBurst(dur = 0.25, vol = 0.4) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t);
  }

  return {
    get started() {
      return started;
    },
    resume,
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    /** Engine hum: speed01 0..1, on foot the engine idles quietly. */
    setEngine(speed01, driving) {
      if (!ctx) return;
      const target = driving ? 0.05 + speed01 * 0.12 : 0.015;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const freq = 55 + speed01 * 110;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(freq * 1.5, ctx.currentTime, 0.1);
    },
    setSiren(on) {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.2);
    },
    pickup() {
      blip(660, 0.12);
      setTimeout(() => blip(990, 0.18), 90);
    },
    coin() {
      blip(880, 0.1, 'square', 0.15);
      setTimeout(() => blip(1318, 0.16, 'square', 0.15), 80);
    },
    crash() {
      noiseBurst(0.3, 0.45);
    },
    punch() {
      noiseBurst(0.08, 0.25);
    },
    busted() {
      blip(220, 0.4, 'sawtooth', 0.2);
      setTimeout(() => blip(174, 0.6, 'sawtooth', 0.2), 200);
    },
    missionPass() {
      [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.22), i * 110));
    },
  };
}
