// All sound is synthesized with WebAudio — no audio files.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.padOsc = null;
    this.padGain = null;
    this.sirenOn = false;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      // Engine hum: low sawtooth through a lowpass.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 320;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(filt).connect(this.engineGain).connect(this.ctx.destination);
      this.engineOsc.start();
      // Police siren: two alternating tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
      this.sirenOsc.start();
      this._sirenPhase = 0;
      // Soft ambient pad: two detuned sines, very quiet.
      this.padOsc = this.ctx.createOscillator();
      this.padOsc.type = 'sine';
      this.padOsc.frequency.value = 110;
      this.padGain = this.ctx.createGain();
      this.padGain.gain.value = 0.015;
      this.padOsc.connect(this.padGain).connect(this.ctx.destination);
      this.padOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.03 : 0, this.ctx.currentTime, 0.2);
  }

  update(dt) {
    if (!this.ctx || !this.sirenOn || !this.sirenOsc) return;
    this._sirenPhase += dt;
    const f = this._sirenPhase % 1 < 0.5 ? 700 : 950;
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
  }

  _tone(freq, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  coin() {
    this._tone(880, 0.12, 'sine', 0.12);
    this._tone(1320, 0.18, 'sine', 0.1, 0.09);
  }

  pickup() {
    this._tone(520, 0.1, 'triangle', 0.12);
    this._tone(780, 0.14, 'triangle', 0.1, 0.08);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.2, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.25;
    src.connect(g).connect(this.ctx.destination);
    src.start(t);
    this._tone(90, 0.25, 'sine', 0.2);
  }

  punch() {
    this._tone(160, 0.08, 'square', 0.1);
  }
}
