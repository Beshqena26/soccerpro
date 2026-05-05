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

  // Filtered noise — sounds like crowd/impact
  private noise(duration: number, vol: number, filterFreq = 800, filterQ = 1) {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq;
      filter.Q.value = filterQ;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol * 0.8, ctx.currentTime + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      source.stop(ctx.currentTime + duration);
    } catch {}
  }

  // Low thud — body collision / ball hit
  private thud(freq: number, duration: number, vol: number) {
    if (!this.enabled) return;
    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + duration);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {}
  }

  /** Referee whistle — two-tone like a real whistle */
  sndWhistle() {
    // Sharp high whistle
    this.play(2800, 0.06, 'sine', 0.08);
    setTimeout(() => this.play(3200, 0.08, 'sine', 0.10), 50);
    setTimeout(() => this.play(3000, 0.35, 'sine', 0.09), 120);
    // Slight warble
    setTimeout(() => this.play(3100, 0.08, 'sine', 0.06), 300);
    setTimeout(() => this.play(2900, 0.15, 'sine', 0.05), 350);
  }

  /** Ball kick — thump + air swoosh */
  sndKick() {
    this.thud(120, 0.10, 0.14);
    this.noise(0.08, 0.08, 2000, 0.5);
    setTimeout(() => this.noise(0.05, 0.04, 4000, 0.8), 30);
  }

  /** Tackle — body crunch + grunt thud */
  sndTackle() {
    this.thud(80, 0.15, 0.12);
    this.noise(0.12, 0.14, 600, 2);
    setTimeout(() => this.thud(60, 0.1, 0.08), 40);
    setTimeout(() => this.noise(0.08, 0.06, 1200, 1), 80);
  }

  /** Pass — quick boot tap */
  sndPass() {
    this.thud(200, 0.05, 0.08);
    this.noise(0.04, 0.05, 3000, 0.8);
  }

  /** Goal — crowd erupts + stadium horn */
  sndGoal() {
    // Crowd roar — builds up
    this.noise(0.3, 0.04, 400, 0.5);
    setTimeout(() => this.noise(0.5, 0.08, 500, 0.8), 100);
    setTimeout(() => this.noise(1.2, 0.14, 600, 1), 200);
    setTimeout(() => this.noise(1.5, 0.10, 700, 0.6), 400);

    // Stadium horn — deep note
    setTimeout(() => {
      this.play(220, 0.6, 'sawtooth', 0.06);
      this.play(330, 0.6, 'sawtooth', 0.04);
      this.play(440, 0.5, 'sine', 0.05);
    }, 250);

    // Celebration melody
    setTimeout(() => this.play(523, 0.12, 'sine', 0.08), 500);
    setTimeout(() => this.play(659, 0.12, 'sine', 0.08), 600);
    setTimeout(() => this.play(784, 0.15, 'sine', 0.10), 700);
    setTimeout(() => this.play(1047, 0.3, 'sine', 0.10), 820);
  }

  /** Big goal — massive crowd + extended horn + fireworks pops */
  sndBigGoal() {
    // Huge crowd buildup
    this.noise(0.4, 0.05, 350, 0.5);
    setTimeout(() => this.noise(0.6, 0.10, 500, 0.8), 80);
    setTimeout(() => this.noise(1.5, 0.16, 650, 1.0), 180);
    setTimeout(() => this.noise(2.0, 0.12, 800, 0.6), 500);

    // Double stadium horn
    setTimeout(() => {
      this.play(220, 0.8, 'sawtooth', 0.07);
      this.play(330, 0.8, 'sawtooth', 0.05);
      this.play(440, 0.7, 'sine', 0.06);
    }, 200);
    setTimeout(() => {
      this.play(220, 0.6, 'sawtooth', 0.05);
      this.play(440, 0.5, 'sine', 0.04);
    }, 700);

    // Celebration melody — extended
    setTimeout(() => this.play(523, 0.1, 'sine', 0.09), 500);
    setTimeout(() => this.play(659, 0.1, 'sine', 0.09), 580);
    setTimeout(() => this.play(784, 0.1, 'sine', 0.10), 660);
    setTimeout(() => this.play(1047, 0.12, 'sine', 0.12), 740);
    setTimeout(() => this.play(1175, 0.12, 'sine', 0.12), 820);
    setTimeout(() => this.play(1318, 0.15, 'sine', 0.10), 900);
    setTimeout(() => this.play(1568, 0.4, 'sine', 0.08), 1000);

    // Firework pops
    setTimeout(() => this.noise(0.04, 0.10, 5000, 2), 600);
    setTimeout(() => this.noise(0.04, 0.08, 6000, 2), 800);
    setTimeout(() => this.noise(0.04, 0.09, 4500, 2), 1050);
  }

  /** Lose — crowd groan + sad horn */
  sndLose() {
    // Crowd groan
    this.noise(0.8, 0.08, 300, 0.5);

    // Sad descending horn
    this.play(220, 0.3, 'sawtooth', 0.05);
    this.play(220, 0.3, 'sine', 0.06);
    setTimeout(() => {
      this.play(185, 0.35, 'sawtooth', 0.04);
      this.play(185, 0.35, 'sine', 0.05);
    }, 200);
    setTimeout(() => {
      this.play(147, 0.5, 'sawtooth', 0.03);
      this.play(147, 0.5, 'sine', 0.04);
    }, 420);
  }

  /** Bet placed — coin drop */
  sndBet() {
    this.play(800, 0.04, 'sine', 0.06);
    setTimeout(() => this.play(1200, 0.03, 'sine', 0.05), 30);
    setTimeout(() => this.play(1600, 0.06, 'sine', 0.04), 50);
  }

  /** Button click */
  sndClick() {
    this.play(600, 0.03, 'square', 0.03);
  }

  /** GK save — glove catch thud */
  sndSave() {
    this.thud(100, 0.12, 0.12);
    this.noise(0.06, 0.08, 1500, 1);
    // Small crowd reaction
    setTimeout(() => this.noise(0.4, 0.06, 500, 0.5), 50);
  }

  /** Near miss — crowd gasp */
  sndGasp() {
    this.noise(0.5, 0.06, 900, 0.8);
    this.play(600, 0.06, 'sine', 0.04);
    setTimeout(() => this.play(500, 0.08, 'sine', 0.03), 50);
  }

  /** Ambient crowd murmur — background loop feel */
  sndCrowdPulse() {
    this.noise(0.3, 0.02, 400, 0.3);
  }
}
