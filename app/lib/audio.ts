export class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private play(freq: number, duration: number, type: OscillatorType = 'sine', vol = 0.15) {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  private noise(duration: number, vol: number) {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.5;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 800;
      filter.Q.value = 1;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + duration);
    } catch {}
  }

  /** Whistle sound — kick off */
  sndWhistle() {
    this.play(900, 0.08, 'sine', 0.12);
    setTimeout(() => this.play(1200, 0.12, 'sine', 0.14), 60);
    setTimeout(() => this.play(1100, 0.3, 'sine', 0.10), 140);
  }

  /** Ball kick */
  sndKick() {
    this.noise(0.06, 0.12);
    this.play(180, 0.08, 'triangle', 0.10);
  }

  /** Tackle impact */
  sndTackle() {
    this.noise(0.1, 0.15);
    this.play(100, 0.12, 'sawtooth', 0.06);
    setTimeout(() => this.play(80, 0.15, 'sine', 0.05), 50);
  }

  /** Pass sound */
  sndPass() {
    this.play(400, 0.06, 'sine', 0.06);
    setTimeout(() => this.play(500, 0.05, 'sine', 0.05), 40);
  }

  /** Goal — crowd roar + rising melody */
  sndGoal() {
    // Rising crowd noise
    this.noise(0.8, 0.10);
    // Victory melody
    this.play(523, 0.12, 'sine', 0.14);
    setTimeout(() => this.play(659, 0.12, 'sine', 0.14), 100);
    setTimeout(() => this.play(784, 0.15, 'sine', 0.16), 200);
    setTimeout(() => this.play(1047, 0.3, 'sine', 0.18), 320);
    setTimeout(() => this.play(1175, 0.4, 'sine', 0.12), 450);
  }

  /** Big goal — higher multiplier */
  sndBigGoal() {
    this.noise(1.0, 0.12);
    this.play(523, 0.12, 'sine', 0.16);
    setTimeout(() => this.play(659, 0.12, 'sine', 0.16), 80);
    setTimeout(() => this.play(784, 0.12, 'sine', 0.16), 160);
    setTimeout(() => this.play(1047, 0.15, 'sine', 0.18), 240);
    setTimeout(() => this.play(1175, 0.15, 'sine', 0.18), 320);
    setTimeout(() => this.play(1318, 0.2, 'sine', 0.18), 400);
    setTimeout(() => this.play(1568, 0.5, 'sine', 0.14), 500);
  }

  /** Lose — defense scored / sad trombone */
  sndLose() {
    this.play(300, 0.2, 'sine', 0.10);
    setTimeout(() => this.play(250, 0.25, 'sine', 0.08), 150);
    setTimeout(() => this.play(200, 0.35, 'sine', 0.06), 300);
  }

  /** Bet placed */
  sndBet() {
    this.play(250, 0.1, 'sine', 0.08);
  }

  /** Button click */
  sndClick() {
    this.play(500, 0.05, 'square', 0.04);
  }

  /** Running/dribble tick */
  sndDribble() {
    this.play(200 + Math.random() * 100, 0.03, 'triangle', 0.03);
  }
}
