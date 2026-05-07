import { ImageCache } from "./ImageCache";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PlayerState {
  pos: { x: number; y: number };
  team: "offense" | "defense";
  isGK: boolean;
  hasBall: boolean;
  hasDefBall: boolean;
  tackled: boolean;
}

export interface TeamAppearance {
  flagImg: string;
  flagRect: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface TackleFlash {
  pos: { x: number; y: number };
  startTick: number;
}

export interface RenderState {
  players: PlayerState[];
  ball: { pos: { x: number; y: number }; free: boolean };
  offenseTeam: TeamAppearance | null;
  defenseTeam: TeamAppearance | null;
  playing: boolean;
  tick: number;
  cameraShake: boolean;
  tackleFlashes: TackleFlash[];
  multiplier: string;
  winChance: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const GOAL_X_MIN = 0.3;
const GOAL_X_MAX = 0.7;

const FIELD_CORNER_RADIUS = 10;
const CENTER_CIRCLE_R = 80;
const PLAYER_RADIUS_BASE = 14; // at 600px height reference
const BALL_RADIUS_BASE = 10;

const GRASS_COLORS = ["#267a3d", "#1e6832", "#24723a", "#1d6530", "#236f38"];
const STRIPE_COUNT = 14;

const TACKLE_FLASH_DURATION = 15;
const CAMERA_SHAKE_MAGNITUDE = 3;
const CAMERA_SHAKE_DURATION = 12;

// Inline ball SVG as data URL — no network request needed
const BALL_SVG_URL = "data:image/svg+xml," + encodeURIComponent(`<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="b" cx=".38" cy=".32" r=".65"><stop offset="0%" stop-color="#fafafa"/><stop offset="70%" stop-color="#e8e8e4"/><stop offset="100%" stop-color="#c8c8c0"/></radialGradient></defs>
<circle cx="32" cy="32" r="30" fill="url(#b)" stroke="#aaa" stroke-width=".8"/>
<path d="M32,10L37,15L35,21L29,21L27,15Z" fill="#222"/><path d="M48,20L52,27L49,33L41,31L39,25Z" fill="#222"/>
<path d="M16,20L25,25L23,31L15,33L12,27Z" fill="#222"/><path d="M45,41L50,38L53,43L49,49L43,47Z" fill="#222"/>
<path d="M19,41L21,47L15,49L11,43L14,38Z" fill="#222"/><path d="M29,45L35,45L39,51L32,56L25,51Z" fill="#222"/>
<circle cx="32" cy="32" r="30" fill="none" stroke="rgba(0,0,0,.08)" stroke-width="1.5"/>
</svg>`);

/* ------------------------------------------------------------------ */
/*  GameRenderer                                                       */
/* ------------------------------------------------------------------ */

export class GameRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private w: number;
  private h: number;

  private images: ImageCache;

  // Off-screen field cache
  private fieldCanvas: HTMLCanvasElement | null = null;
  private fieldDirty = true;

  // Camera shake state
  private shakeFrame = 0;

  private dpr = 1;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.canvas = ctx.canvas;
    this.w = this.canvas.width;
    this.h = this.canvas.height;
    this.images = new ImageCache();
  }

  /* ---- public helpers ---- */

  get imageCache(): ImageCache {
    return this.images;
  }

  resize(width: number, height: number, dpr: number) {
    this.w = width;
    this.h = height;
    this.dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Use CSS pixel dimensions for drawing
    this.w = width / dpr;
    this.h = height / dpr;
    this.fieldDirty = true;
  }

  invalidateField() {
    this.fieldDirty = true;
  }

  async preloadImages(flagUrls: string[], rectFlagUrls: string[] = []): Promise<void> {
    await this.images.preload([...flagUrls, ...rectFlagUrls, BALL_SVG_URL]);
  }

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  render(state: RenderState) {
    const { ctx, w, h } = this;

    ctx.clearRect(0, 0, w, h);

    // --- camera shake offset ---
    let shakeX = 0;
    let shakeY = 0;
    if (state.cameraShake) {
      this.shakeFrame = CAMERA_SHAKE_DURATION;
    }
    if (this.shakeFrame > 0) {
      shakeX = (Math.random() - 0.5) * 2 * CAMERA_SHAKE_MAGNITUDE;
      shakeY = (Math.random() - 0.5) * 2 * CAMERA_SHAKE_MAGNITUDE;
      this.shakeFrame--;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // 1. Static field
    this.drawFieldCached(state);

    // 2. Player shadows
    for (const p of state.players) {
      this.drawPlayerShadow(p, state);
    }

    // 3. Ball shadow
    this.drawBallShadow(state);

    // 4. Players
    for (const p of state.players) {
      this.drawPlayer(p, state);
    }

    // 5. Ball
    this.drawBall(state);

    // 6. Tackle flashes
    for (const flash of state.tackleFlashes) {
      this.drawTackleFlash(flash, state.tick);
    }

    ctx.restore();
  }

  /* ================================================================ */
  /*  FIELD (cached to off-screen canvas)                              */
  /* ================================================================ */

  private drawFieldCached(state: RenderState) {
    if (
      this.fieldDirty ||
      !this.fieldCanvas ||
      this.fieldCanvas.width !== this.w ||
      this.fieldCanvas.height !== this.h
    ) {
      this.fieldCanvas = document.createElement("canvas");
      this.fieldCanvas.width = this.w;
      this.fieldCanvas.height = this.h;
      const fCtx = this.fieldCanvas.getContext("2d")!;
      this.paintField(fCtx, state);
      this.fieldDirty = false;
    }
    this.ctx.drawImage(this.fieldCanvas, 0, 0);
  }

  private paintField(fc: CanvasRenderingContext2D, state: RenderState) {
    const { w, h } = this;

    // --- green gradient background ---
    const grad = fc.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, GRASS_COLORS[0]);
    grad.addColorStop(0.25, GRASS_COLORS[1]);
    grad.addColorStop(0.5, GRASS_COLORS[2]);
    grad.addColorStop(0.75, GRASS_COLORS[3]);
    grad.addColorStop(1, GRASS_COLORS[4]);

    this.roundRect(fc, 0, 0, w, h, FIELD_CORNER_RADIUS);
    fc.fillStyle = grad;
    fc.fill();

    // --- mow stripes ---
    fc.save();
    this.roundRect(fc, 0, 0, w, h, FIELD_CORNER_RADIUS);
    fc.clip();
    const stripeH = h / STRIPE_COUNT;
    for (let i = 0; i < STRIPE_COUNT; i++) {
      if (i % 2 === 0) {
        fc.fillStyle = "rgba(255,255,255,0.03)";
        fc.fillRect(0, i * stripeH, w, stripeH);
      }
    }
    fc.restore();

    // --- white markings ---
    fc.strokeStyle = "rgba(255,255,255,0.65)";
    fc.lineWidth = 2;

    // Outer boundary
    this.roundRect(fc, 4, 4, w - 8, h - 8, FIELD_CORNER_RADIUS - 2);
    fc.stroke();

    // Center line
    fc.beginPath();
    fc.moveTo(0, h / 2);
    fc.lineTo(w, h / 2);
    fc.stroke();

    // Center circle
    fc.beginPath();
    fc.arc(w / 2, h / 2, CENTER_CIRCLE_R, 0, Math.PI * 2);
    fc.stroke();

    // Center dot
    fc.fillStyle = "rgba(255,255,255,0.7)";
    fc.beginPath();
    fc.arc(w / 2, h / 2, 4, 0, Math.PI * 2);
    fc.fill();

    // --- Penalty areas ---
    const paW = w * 0.52; // penalty area width
    const paH = h * 0.16; // penalty area height
    const paX = (w - paW) / 2;

    // Top penalty area
    fc.strokeRect(paX, 4, paW, paH);
    // Bottom penalty area
    fc.strokeRect(paX, h - paH - 4, paW, paH);

    // --- Goal areas ---
    const gaW = w * 0.3;
    const gaH = h * 0.07;
    const gaX = (w - gaW) / 2;

    // Top goal area
    fc.strokeRect(gaX, 4, gaW, gaH);
    // Bottom goal area
    fc.strokeRect(gaX, h - gaH - 4, gaW, gaH);

    // --- Penalty dots ---
    const penDotTopY = 4 + paH * 0.75;
    const penDotBotY = h - 4 - paH * 0.75;
    fc.fillStyle = "rgba(255,255,255,0.7)";
    fc.beginPath();
    fc.arc(w / 2, penDotTopY, 3, 0, Math.PI * 2);
    fc.fill();
    fc.beginPath();
    fc.arc(w / 2, penDotBotY, 3, 0, Math.PI * 2);
    fc.fill();

    // --- Corner arcs ---
    const cornerR = 16;
    fc.strokeStyle = "rgba(255,255,255,0.55)";
    // Top-left
    fc.beginPath();
    fc.arc(4, 4, cornerR, 0, Math.PI / 2);
    fc.stroke();
    // Top-right
    fc.beginPath();
    fc.arc(w - 4, 4, cornerR, Math.PI / 2, Math.PI);
    fc.stroke();
    // Bottom-left
    fc.beginPath();
    fc.arc(4, h - 4, cornerR, (3 * Math.PI) / 2, Math.PI * 2);
    fc.stroke();
    // Bottom-right
    fc.beginPath();
    fc.arc(w - 4, h - 4, cornerR, Math.PI, (3 * Math.PI) / 2);
    fc.stroke();

    // --- Goals (frames + net mesh) ---
    this.drawGoalFrame(fc, "top");
    this.drawGoalFrame(fc, "bottom");

    // --- Flag images in penalty areas ---
    this.drawFlagInArea(fc, state.offenseTeam, paX, h - paH - 4, paW, paH);
    this.drawFlagInArea(fc, state.defenseTeam, paX, 4, paW, paH);
  }

  private drawGoalFrame(
    fc: CanvasRenderingContext2D,
    side: "top" | "bottom",
  ) {
    const { w, h } = this;
    const goalW = (GOAL_X_MAX - GOAL_X_MIN) * w;
    const goalH = 14;
    const goalX = GOAL_X_MIN * w;
    const goalY = side === "top" ? 0 : h - goalH;

    // Net mesh
    fc.save();
    fc.globalAlpha = 0.12;
    fc.strokeStyle = "#ffffff";
    fc.lineWidth = 0.5;
    const meshSpacing = 6;
    for (let mx = goalX; mx < goalX + goalW; mx += meshSpacing) {
      fc.beginPath();
      fc.moveTo(mx, goalY);
      fc.lineTo(mx, goalY + goalH);
      fc.stroke();
    }
    for (let my = goalY; my < goalY + goalH; my += meshSpacing) {
      fc.beginPath();
      fc.moveTo(goalX, my);
      fc.lineTo(goalX + goalW, my);
      fc.stroke();
    }
    fc.restore();

    // Posts
    const postGrad = fc.createLinearGradient(goalX, goalY, goalX + 4, goalY);
    postGrad.addColorStop(0, "#d0d0d0");
    postGrad.addColorStop(0.5, "#ffffff");
    postGrad.addColorStop(1, "#b0b0b0");

    fc.fillStyle = postGrad;
    // Left post
    fc.fillRect(goalX - 2, goalY, 4, goalH);
    // Right post
    fc.fillRect(goalX + goalW - 2, goalY, 4, goalH);

    // Crossbar
    const crossY = side === "top" ? goalY + goalH - 2 : goalY;
    const barGrad = fc.createLinearGradient(goalX, crossY, goalX, crossY + 3);
    barGrad.addColorStop(0, "#d0d0d0");
    barGrad.addColorStop(0.5, "#ffffff");
    barGrad.addColorStop(1, "#b0b0b0");
    fc.fillStyle = barGrad;
    fc.fillRect(goalX, crossY, goalW, 3);
  }

  private drawFlagInArea(
    fc: CanvasRenderingContext2D,
    team: TeamAppearance | null,
    x: number,
    y: number,
    areaW: number,
    areaH: number,
  ) {
    if (!team) return;
    const img = this.images.get(team.flagRect);
    if (!img) return;

    fc.save();
    fc.globalAlpha = 0.18;
    // Draw rectangular flag filling the penalty area
    fc.drawImage(img, x, y, areaW, areaH);
    fc.restore();
  }

  /* ================================================================ */
  /*  PLAYERS                                                          */
  /* ================================================================ */

  private playerRadius(): number {
    // Scale based on canvas height relative to a 600px reference
    return PLAYER_RADIUS_BASE * (this.h / 600);
  }

  private drawPlayerShadow(p: PlayerState, state: RenderState) {
    const { ctx, w, h } = this;
    const r = this.playerRadius();
    const px = p.pos.x * w;
    let py = p.pos.y * h;

    // Running bob
    if (state.playing && !p.tackled) {
      py += Math.sin(state.tick * 0.35) * 1.5;
    }

    const shadowR = p.tackled ? r * 0.7 : r;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(px, py + r + 3, shadowR * 0.85, shadowR * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPlayer(p: PlayerState, state: RenderState) {
    const { ctx, w, h } = this;
    const r = this.playerRadius();
    const px = p.pos.x * w;
    let py = p.pos.y * h;

    // Running bob
    if (state.playing && !p.tackled) {
      py += Math.sin(state.tick * 0.35) * 1.5;
    }

    const drawR = p.tackled ? r * 0.85 : r;
    const alpha = p.tackled ? 0.3 : 1.0;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Glow for ball carrier
    if (p.hasBall || p.hasDefBall) {
      ctx.shadowColor = "rgba(255,255,255,0.9)";
      ctx.shadowBlur = 18;
    } else if (p.isGK) {
      ctx.shadowColor = "rgba(255,255,200,0.4)";
      ctx.shadowBlur = 8;
    }

    // Flag image clipped to circle
    const team = p.team === "offense" ? state.offenseTeam : state.defenseTeam;
    const flagImg = team ? this.images.get(team.flagImg) : null;

    // Circle path
    ctx.beginPath();
    ctx.arc(px, py, drawR, 0, Math.PI * 2);

    if (flagImg) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(
        flagImg,
        px - drawR,
        py - drawR,
        drawR * 2,
        drawR * 2,
      );
      ctx.restore();
    } else {
      // Fallback solid color
      const color =
        p.team === "offense"
          ? state.offenseTeam?.primaryColor ?? "#3b82f6"
          : state.defenseTeam?.primaryColor ?? "#ef4444";
      ctx.fillStyle = color;
      ctx.fill();
    }

    // Border
    ctx.beginPath();
    ctx.arc(px, py, drawR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /* ================================================================ */
  /*  BALL                                                             */
  /* ================================================================ */

  private drawBallShadow(state: RenderState) {
    const { ctx, w, h } = this;
    const bx = state.ball.pos.x * w;
    const by = state.ball.pos.y * h;
    const scale = state.ball.free ? 1.3 : 1.0;
    const br = BALL_RADIUS_BASE * (this.h / 600) * scale;
    const shadowOffset = state.ball.free ? 8 : 4;

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(
      bx,
      by + br + shadowOffset,
      br * 0.75,
      br * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  private drawBall(state: RenderState) {
    const { ctx, w, h } = this;
    const bx = state.ball.pos.x * w;
    const by = state.ball.pos.y * h;
    const scale = state.ball.free ? 1.3 : 1.0;
    const br = BALL_RADIUS_BASE * (this.h / 600) * scale;

    const ballImg = this.images.get(BALL_SVG_URL);

    const rotSpeed = state.ball.free ? 40 : 12;
    const rotation = ((state.tick * rotSpeed) * Math.PI) / 180;

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(rotation);

    if (ballImg) {
      ctx.drawImage(ballImg, -br, -br, br * 2, br * 2);
    } else {
      // Fallback white circle
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /* ================================================================ */
  /*  EFFECTS                                                          */
  /* ================================================================ */

  private drawTackleFlash(flash: TackleFlash, currentTick: number) {
    const { ctx, w, h } = this;
    const elapsed = currentTick - flash.startTick;
    if (elapsed < 0 || elapsed > TACKLE_FLASH_DURATION) return;

    const progress = elapsed / TACKLE_FLASH_DURATION;
    const radius = 10 + progress * 40;
    const alpha = 1 - progress;

    const fx = flash.pos.x * w;
    const fy = flash.pos.y * h;

    ctx.save();
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = "#ff3333";
    ctx.lineWidth = 3 - progress * 2;
    ctx.beginPath();
    ctx.arc(fx, fy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /* ================================================================ */
  /*  SIDE STATS (multiplier + win chance)                             */
  /* ================================================================ */

  private drawSideStats(state: RenderState) {
    const { ctx, w, h } = this;
    const midY = h / 2;
    const padX = 6;
    const boxW = 52;
    const boxH = 36;
    const radius = 6;

    // Left — Multiplier
    this.drawStatBox(ctx, padX, midY - boxH / 2, boxW, boxH, radius, state.multiplier, "MULT", "#F3CA23");
    // Right — Win Chance
    this.drawStatBox(ctx, w - padX - boxW, midY - boxH / 2, boxW, boxH, radius, state.winChance, "WIN%", "#0ECC68");
  }

  private drawStatBox(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, bw: number, bh: number, r: number,
    value: string, label: string, color: string,
  ) {
    // Background
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = "rgba(15, 33, 46, 0.85)";
    this.roundRect(ctx, x, y, bw, bh, r);
    ctx.fill();
    ctx.restore();

    // Border
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, bw, bh, r);
    ctx.stroke();
    ctx.restore();

    // Value
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `bold ${Math.round(bh * 0.38)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(value, x + bw / 2, y + bh * 0.42);
    // Label
    ctx.fillStyle = "rgba(177, 186, 211, 0.5)";
    ctx.font = `600 ${Math.round(bh * 0.2)}px system-ui, sans-serif`;
    ctx.fillText(label, x + bw / 2, y + bh * 0.78);
    ctx.restore();
  }

  /* ================================================================ */
  /*  Utilities                                                        */
  /* ================================================================ */

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }
}
