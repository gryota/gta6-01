// Every sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, police siren, pickup chime, crash thud, punch thump, UI blips and a
// soft ambient pad. Created lazily on the first user gesture (browsers require it).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let padNodes = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);

      // Engine: two detuned saws through a lowpass, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 82;
      const engineFilter = ctx.createBiquadFilter();
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

      // Siren: a square wave whose frequency alternates hi/lo.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();

      // Ambient pad: two slow detuned triangles, very quiet.
      const padGain = ctx.createGain();
      padGain.gain.value = 0.05;
      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 600;
      const p1 = ctx.createOscillator();
      p1.type = 'triangle';
      p1.frequency.value = 110;
      const p2 = ctx.createOscillator();
      p2.type = 'triangle';
      p2.frequency.value = 164.8;
      const p3 = ctx.createOscillator();
      p3.type = 'sine';
      p3.frequency.value = 55;
      p1.connect(padFilter);
      p2.connect(padFilter);
      p3.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(master);
      p1.start();
      p2.start();
      p3.start();
      padNodes = { gain: padGain };
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  function tone(freqA, freqB, duration, type, volume) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    /** Call from any user gesture; also resumes a suspended context. */
    unlock() {
      if (ensure()) resume();
    },
    get ready() { return started; },
    /** speed01: 0..1 of top speed. on: whether the engine should be heard. */
    engine(speed01, on) {
      if (!ctx) return;
      const target = on ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const freq = 55 + speed01 * 110;
      engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(freq * 1.5 + 3, ctx.currentTime, 0.08);
    },
    /** Siren wail; call every frame with whether any police is near. */
    siren(on, dt) {
      if (!ctx) return;
      if (on) {
        sirenTimer += dt;
        const hi = Math.floor(sirenTimer * 1.6) % 2 === 0;
        sirenOsc.frequency.setTargetAtTime(hi ? 920 : 660, ctx.currentTime, 0.05);
        sirenGain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.2);
      } else {
        sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      }
    },
    pickup() { tone(880, 1320, 0.18, 'sine', 0.25); },
    coin() { tone(1046, 1568, 0.12, 'sine', 0.2); },
    crash() { noiseBurst(0.25, 0.5, 900); tone(90, 45, 0.2, 'sine', 0.4); },
    punch() { noiseBurst(0.12, 0.4, 500); },
    click() { tone(660, 660, 0.06, 'square', 0.12); },
    busted() { tone(392, 196, 0.7, 'triangle', 0.3); },
    mission() { tone(523, 523, 0.12, 'sine', 0.25); setTimeout(() => tone(784, 784, 0.2, 'sine', 0.25), 130); },
    setAmbient(on) {
      if (padNodes) padNodes.gain.gain.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.5);
    },
  };
}
