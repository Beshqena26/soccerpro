export class AudioEngine {
  private enabled = true;
  private unlocked = false;

  // Pre-loaded audio pools (multiple instances so sounds can overlap)
  private whistlePool: HTMLAudioElement[] = [];
  private kickPool: HTMLAudioElement[] = [];
  private crowdPool: HTMLAudioElement[] = [];
  private bgMusic: HTMLAudioElement | null = null;
  private bgStarted = false;

  // Create a pool of clones for a sound file
  private createPool(src: string, count: number, vol: number): HTMLAudioElement[] {
    const pool: HTMLAudioElement[] = [];
    for (let i = 0; i < count; i++) {
      const el = new Audio(src);
      el.preload = 'auto';
      el.volume = vol;
      pool.push(el);
    }
    return pool;
  }

  // Play next available from pool
  private playFromPool(pool: HTMLAudioElement[], vol?: number) {
    if (!this.enabled || !this.unlocked) return;
    const el = pool.find(a => a.paused || a.ended) || pool[0];
    if (!el) return;
    if (vol !== undefined) el.volume = vol;
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  // Call this on first user interaction (tap/click) to unlock audio on mobile
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    // Preload sound pools
    this.whistlePool = this.createPool('/whistle.wav', 3, 0.4);
    this.kickPool = this.createPool('/sfx-kick.wav', 4, 0.3);
    this.crowdPool = this.createPool('/crowd-win.mp3', 2, 0.4);

    // Touch-play all pools silently to unlock on iOS
    [...this.whistlePool, ...this.kickPool, ...this.crowdPool].forEach(el => {
      el.volume = 0;
      el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(() => {});
    });

    // Restore volumes after unlock
    setTimeout(() => {
      this.whistlePool.forEach(el => el.volume = 0.4);
      this.kickPool.forEach(el => el.volume = 0.3);
      this.crowdPool.forEach(el => el.volume = 0.4);
    }, 100);
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

  isEnabled(): boolean {
    return this.enabled;
  }

  startBgMusic() {
    if (this.bgStarted) return;
    this.bgStarted = true;
    try {
      this.bgMusic = new Audio('/bg-music.mp3');
      this.bgMusic.preload = 'auto';
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.15;
      if (this.enabled) {
        this.bgMusic.play().catch(() => {});
      }
    } catch {}
  }

  /** Referee whistle */
  sndWhistle() {
    this.playFromPool(this.whistlePool, 0.4);
  }

  /** Ball kick / shot */
  sndKick() {
    this.playFromPool(this.kickPool, 0.35);
  }

  /** Tackle */
  sndTackle() {
    this.playFromPool(this.kickPool, 0.3);
  }

  /** Pass */
  sndPass() {
    this.playFromPool(this.kickPool, 0.25);
  }

  /** Goal — whistle + crowd */
  sndGoal() {
    this.sndWhistle();
    this.playFromPool(this.crowdPool, 0.4);
  }

  /** Big goal — whistle + loud crowd */
  sndBigGoal() {
    this.sndWhistle();
    this.playFromPool(this.crowdPool, 0.55);
  }

  /** Lose — whistle */
  sndLose() {
    this.sndWhistle();
  }

  /** GK save */
  sndSave() {
    this.playFromPool(this.kickPool, 0.3);
  }

}
