export class AudioEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private bgMusic: HTMLAudioElement | null = null;
  private bgStarted = false;

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.bgMusic) {
      if (this.enabled) {
        this.bgMusic.play().catch(() => {});
      } else {
        this.bgMusic.pause();
      }
    }
    return this.enabled;
  }

  startBgMusic() {
    if (this.bgStarted) return;
    this.bgStarted = true;
    try {
      this.bgMusic = new Audio('/bg-music.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.15;
      if (this.enabled) {
        this.bgMusic.play().catch(() => {});
      }
    } catch {}
  }

  setBgVolume(vol: number) {
    if (this.bgMusic) this.bgMusic.volume = vol;
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

  /** Referee whistle — real sound file */
  sndWhistle() {
    if (!this.enabled) return;
    try {
      const sfx = new Audio('/whistle.wav');
      sfx.volume = 0.4;
      sfx.play().catch(() => {});
    } catch {}
  }

  /** Ball kick — real sound file */
  sndKick() {
    if (!this.enabled) return;
    try {
      const sfx = new Audio('/sfx-kick.wav');
      sfx.volume = 0.35;
      sfx.play().catch(() => {});
    } catch {}
  }

  /** Tackle — same kick SFX at lower volume */
  sndTackle() {
    if (!this.enabled) return;
    try {
      const sfx = new Audio('/sfx-kick.wav');
      sfx.volume = 0.3;
      sfx.play().catch(() => {});
    } catch {}
  }

  /** Pass — real sound file */
  sndPass() {
    if (!this.enabled) return;
    try {
      const sfx = new Audio('/sfx-kick.wav');
      sfx.volume = 0.25;
      sfx.play().catch(() => {});
    } catch {}
  }

  /** Goal — whistle + crowd applause */
  sndGoal() {
    this.sndWhistle();
    if (!this.enabled) return;
    try {
      const crowd = new Audio('/crowd-win.mp3');
      crowd.volume = 0.4;
      crowd.play().catch(() => {});
    } catch {}
  }

  /** Big goal — whistle + crowd applause louder */
  sndBigGoal() {
    this.sndWhistle();
    if (!this.enabled) return;
    try {
      const crowd = new Audio('/crowd-win.mp3');
      crowd.volume = 0.55;
      crowd.play().catch(() => {});
    } catch {}
  }

  /** Lose — whistle */
  sndLose() {
    this.sndWhistle();
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

  /** GK save — kick SFX */
  sndSave() {
    if (!this.enabled) return;
    try {
      const sfx = new Audio('/sfx-kick.wav');
      sfx.volume = 0.3;
      sfx.play().catch(() => {});
    } catch {}
  }
}
