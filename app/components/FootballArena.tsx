"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AudioEngine } from "../lib/audio";
import { worldCup2026Teams, type WorldCupTeam } from "../lib/teams";
import { GameRenderer, type RenderState, type TackleFlash as CanvasTackleFlash } from "../lib/GameRenderer";
import TeamPicker from "./TeamPicker";
import GameInfoModal from "./GameInfoModal";
import ProvablyFairModal from "./ProvablyFairModal";

const HALF_TICKS = 240;
const EXTRA_TICKS = 120;
const HALFTIME_MS = 1800; // halftime pause duration
const PLAYER_R = 13;
const GOAL_X_MIN = 0.30;
const GOAL_X_MAX = 0.70;
const TICK_MS_STANDARD = 35;
const TICK_MS_FAST = 17;
const MIN_BET = 1;
const MAX_BET = 500;
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 9;

type Pos = { x: number; y: number };

type Player = {
  id: number;
  team: "offense" | "defense";
  pos: Pos;
  vel: Pos;
  hasBall: boolean;
  tackled: boolean;
  tackleCooldown: number;
  homePos: Pos;
  hasDefBall: boolean;
  isGK: boolean; // goalkeeper
};

type HistoryEntry = {
  id: number;
  won: boolean;
  multiplier: number;
  payout: number;
};

function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)); }
function dist(a: Pos, b: Pos) { return Math.hypot(a.x - b.x, a.y - b.y); }
function normalize(v: Pos): Pos {
  const len = Math.hypot(v.x, v.y);
  return len === 0 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}
function fmt(n: number) { return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

const HOUSE_EDGE = 0.035; // 3.5% house edge = 96.5% RTP

// Win chance based on individual offense & defense counts
// Every (off, def) pair produces a unique value — no duplicates
// Coefficients 5.65/5.85 are coprime when scaled (113/117), guaranteeing
// uniqueness for all integer pairs in [1,9] range
function getWinChance(offCount: number, defCount: number): number {
  const raw = 50 + 5.65 * offCount - 5.85 * defCount;
  return parseFloat(Math.max(2, Math.min(96, raw)).toFixed(1));
}

// Multiplier calculated from win chance to maintain 96.5% RTP
// Formula: multiplier = (1 - HOUSE_EDGE) / (winChance / 100)
function getMultiplier(offCount: number, defCount: number): number {
  const chance = getWinChance(offCount, defCount) / 100;
  return parseFloat(((1 - HOUSE_EDGE) / chance).toFixed(2));
}

type BallState = {
  pos: Pos;
  vel: Pos;
  free: boolean; // ball is flying (pass/shot)
  target: Pos | null; // where ball is heading if free
};

// Build a formation shape: splits players into rows, spreads across width
function buildFormation(count: number, rows: number[], yPositions: number[]): Pos[] {
  const positions: Pos[] = [];
  let idx = 0;
  for (let r = 0; r < rows.length && idx < count; r++) {
    const inRow = Math.min(rows[r], count - idx);
    for (let c = 0; c < inRow; c++) {
      const col = inRow <= 1 ? 0.5 : 0.15 + (c / (inRow - 1)) * 0.7;
      // Deterministic jitter — avoids Math.random() to prevent SSR/CSR hydration mismatch
      positions.push({ x: col, y: yPositions[r] + ((idx * 7 % 11) / 11 - 0.5) * 0.02 });
      idx++;
    }
  }
  // Any remaining players fill the last row
  while (idx < count) {
    positions.push({ x: 0.3 + ((idx * 13 % 10) / 10) * 0.4, y: yPositions[yPositions.length - 1] });
    idx++;
  }
  return positions;
}

function getOffenseFormation(count: number): Pos[] {
  // Offense formations: mirrored from bottom half (y 0.60 to 0.82)
  // Front row closer to center, back row closer to own goal
  if (count <= 2) return buildFormation(count, [2], [0.68]);
  if (count <= 3) return buildFormation(count, [1, 2], [0.62, 0.74]);
  if (count <= 5) return buildFormation(count, [2, 3], [0.62, 0.75]);
  if (count <= 7) return buildFormation(count, [3, 2, 2], [0.58, 0.68, 0.78]);
  return buildFormation(count, [3, 3, 3], [0.56, 0.66, 0.78]);
}

function getDefenseFormation(count: number): Pos[] {
  // Defense formations: upper half (y 0.18 to 0.40)
  if (count <= 2) return buildFormation(count, [2], [0.30]);
  if (count <= 3) return buildFormation(count, [2, 1], [0.25, 0.36]);
  if (count <= 5) return buildFormation(count, [3, 2], [0.22, 0.34]);
  if (count <= 7) return buildFormation(count, [3, 2, 2], [0.18, 0.28, 0.38]);
  return buildFormation(count, [3, 3, 3], [0.18, 0.28, 0.40]);
}

// Stable IDs: offense 0-8, defense 100-108, GKs 200/201
function createPlayers(offenseCount: number, defenseCount: number): Player[] {
  const players: Player[] = [];

  const offPositions = getOffenseFormation(offenseCount);
  for (let i = 0; i < offenseCount; i++) {
    const home = offPositions[i];
    players.push({
      id: i,
      team: "offense",
      pos: { ...home },
      vel: { x: 0, y: 0 },
      hasBall: i === 0,
      tackled: false,
      tackleCooldown: 0,
      homePos: { ...home },
      hasDefBall: false,
      isGK: false,
    });
  }

  const defPositions = getDefenseFormation(defenseCount);
  for (let i = 0; i < defenseCount; i++) {
    const home = defPositions[i];
    players.push({
      id: 100 + i,
      team: "defense",
      pos: { ...home },
      vel: { x: 0, y: 0 },
      hasBall: false,
      tackled: false,
      tackleCooldown: 0,
      homePos: { ...home },
      hasDefBall: false,
      isGK: false,
    });
  }

  // Goalkeeper for defense (guards top goal)
  players.push({
    id: 200,
    team: "defense",
    pos: { x: 0.5, y: 0.06 },
    vel: { x: 0, y: 0 },
    hasBall: false,
    tackled: false,
    tackleCooldown: 0,
    homePos: { x: 0.5, y: 0.06 },
    hasDefBall: false,
    isGK: true,
  });

  // Goalkeeper for offense (guards bottom goal)
  players.push({
    id: 201,
    team: "offense",
    pos: { x: 0.5, y: 0.94 },
    vel: { x: 0, y: 0 },
    hasBall: false,
    tackled: false,
    tackleCooldown: 0,
    homePos: { x: 0.5, y: 0.94 },
    hasDefBall: false,
    isGK: true,
  });

  return players;
}

function createBall(offenseCount?: number): BallState {
  const positions = getOffenseFormation(offenseCount ?? 5);
  const front = positions[0];
  return { pos: { x: front.x, y: front.y + 0.015 }, vel: { x: 0, y: 0 }, free: false, target: null };
}

// Smooth steering: accelerate toward target instead of instant movement
function steer(current: Pos, vel: Pos, target: Pos, maxSpeed: number, accel: number): { pos: Pos; vel: Pos } {
  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.005) return { pos: current, vel: { x: vel.x * 0.8, y: vel.y * 0.8 } };

  const desired = normalize({ x: dx, y: dy });
  // Accelerate toward desired direction
  let nvx = vel.x + (desired.x * accel);
  let nvy = vel.y + (desired.y * accel);

  // Limit speed
  const speed = Math.hypot(nvx, nvy);
  if (speed > maxSpeed) {
    nvx = (nvx / speed) * maxSpeed;
    nvy = (nvy / speed) * maxSpeed;
  }

  return {
    pos: { x: current.x + nvx, y: current.y + nvy },
    vel: { x: nvx, y: nvy },
  };
}

export default function FootballArena() {
  const [offenseTeam, setOffenseTeam] = useState<WorldCupTeam | null>(null);
  const [defenseTeam, setDefenseTeam] = useState<WorldCupTeam | null>(null);
  const [teamSearch, setTeamSearch] = useState("");

  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState("10.00");
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [alert, setAlert] = useState<string | null>(null);

  const [offenseCount, setOffenseCount] = useState(5);
  const [defenseCount, setDefenseCount] = useState(5);
  const [playing, setPlaying] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [ballPos, setBallPos] = useState<Pos>({ x: 0.5, y: 0.65 });
  const [ballFree, setBallFree] = useState(false);
  const [mounted, setMounted] = useState(false); // ball is flying in air
  const [goalFlash, setGoalFlash] = useState(false);
  const [goalText, setGoalText] = useState<string | null>(null);
  const [tackleFlashes, setTackleFlashes] = useState<{ id: number; pos: Pos }[]>([]);
  const [roundResult, setRoundResult] = useState<"win" | "lose" | null>(null);
  const [showPayout, setShowPayout] = useState<string | null>(null);
  const [resultBet, setResultBet] = useState(0);
  const [resultMult, setResultMult] = useState(0);
  const [celebrating, setCelebrating] = useState(false);
  const [cameraShake, setCameraShake] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; x: number; color: string; delay: number }[]>([]);
  const [newPlayerIds, setNewPlayerIds] = useState<Set<number>>(new Set());
  const [gameSpeed, setGameSpeed] = useState<"standard" | "fast">("standard");
  const [matchPhase, setMatchPhase] = useState<"1st" | "halftime" | "2nd" | "fulltime" | "extra-intro" | "extra" | null>(null);
  const [offScore, setOffScore] = useState(0);
  const [defScore, setDefScore] = useState(0);
  const [halfTick, setHalfTick] = useState(0);

  const playersRef = useRef(players);
  const ballRef = useRef<BallState>(createBall());
  const tickCountRef = useRef(0);
  const histIdRef = useRef(0);
  const roundResultRef = useRef<"win" | "lose" | null>(null);
  const balanceRef = useRef(balance);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRunning = useRef(false);
  const finishedRef = useRef(false);
  const rafIdRef = useRef(0);
  const phaseTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioRef = useRef<AudioEngine | null>(null);
  const phaseRef = useRef<"1st" | "2nd" | "extra">("1st");
  const halfTickRef = useRef(0);
  const offScoreRef = useRef(0);
  const defScoreRef = useRef(0);
  const goalCooldownRef = useRef(0); // prevent goals right after reset

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameInfoOpen, setGameInfoOpen] = useState(false);
  const [pfModalOpen, setPfModalOpen] = useState(false);
  const [showTeamPicker, setShowTeamPicker] = useState(false);

  // Canvas renderer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const canvasRafRef = useRef(0);
  const canvasTacklesRef = useRef<CanvasTackleFlash[]>([]);

  useEffect(() => {
    audioRef.current = new AudioEngine();
    const np = createPlayers(5, 5);
    playersRef.current = np;
    setPlayers(np);
    const bs = createBall(5);
    ballRef.current = bs;
    setBallPos(bs.pos);
    setMounted(true);
  }, []);
  useEffect(() => { balanceRef.current = balance; }, [balance]);

  // Canvas renderer setup + render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const renderer = new GameRenderer(ctx);
    rendererRef.current = renderer;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      renderer.resize(canvas.width, canvas.height, dpr);
    };
    resize();

    // Preload all flag images
    const allFlagUrls = worldCup2026Teams.map(t => t.flagImg);
    const allRectUrls = worldCup2026Teams.map(t => t.flagRect);
    renderer.preloadImages(allFlagUrls, allRectUrls).then(() => {
      renderer.invalidateField();
    });

    const drawLoop = () => {
      const state: RenderState = {
        players: playersRef.current.map(p => ({
          pos: p.pos,
          team: p.team,
          isGK: p.isGK,
          hasBall: p.hasBall,
          hasDefBall: p.hasDefBall,
          tackled: p.tackled,
        })),
        ball: { pos: ballRef.current.pos, free: ballRef.current.free },
        offenseTeam: offenseTeam ? { flagImg: offenseTeam.flagImg, flagRect: offenseTeam.flagRect, primaryColor: offenseTeam.primaryColor, secondaryColor: offenseTeam.secondaryColor } : null,
        defenseTeam: defenseTeam ? { flagImg: defenseTeam.flagImg, flagRect: defenseTeam.flagRect, primaryColor: defenseTeam.primaryColor, secondaryColor: defenseTeam.secondaryColor } : null,
        playing,
        tick: tickCountRef.current,
        cameraShake,
        tackleFlashes: canvasTacklesRef.current,
      };
      renderer.render(state);
      canvasRafRef.current = requestAnimationFrame(drawLoop);
    };
    canvasRafRef.current = requestAnimationFrame(drawLoop);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(canvasRafRef.current);
      ro.disconnect();
    };
  }, [offenseTeam, defenseTeam, playing, cameraShake]);

  const multiplier = getMultiplier(offenseCount, defenseCount);
  const winChance = getWinChance(offenseCount, defenseCount);

  const resetField = useCallback((oc: number, dc: number) => {
    const prev = playersRef.current;
    const np = createPlayers(oc, dc);

    // Track new player IDs for fade-in animation
    const prevIds = new Set(prev.map(p => p.id));
    const entering = new Set(np.filter(p => !prevIds.has(p.id)).map(p => p.id));
    setNewPlayerIds(entering);
    if (entering.size > 0) {
      setTimeout(() => setNewPlayerIds(new Set()), 700);
    }

    playersRef.current = np;
    setPlayers(np);
    const bs = createBall(oc);
    ballRef.current = bs;
    setBallPos(bs.pos);
    setBallFree(false);
  }, []);

  const adjustCount = (team: "offense" | "defense", delta: number) => {
    if (playing) return;
    if (team === "offense") {
      const v = clamp(offenseCount + delta, MIN_PLAYERS, MAX_PLAYERS);
      setOffenseCount(v);
      resetField(v, defenseCount);
    } else {
      const v = clamp(defenseCount + delta, MIN_PLAYERS, MAX_PLAYERS);
      setDefenseCount(v);
      resetField(offenseCount, v);
    }
    setRoundResult(null);
  };

  const dismissOverlay = useCallback(() => {
    setRoundResult(null);
    setGoalFlash(false);
    setGoalText(null);
    setShowPayout(null);
    setMatchPhase(null);
    setOffScore(0);
    setDefScore(0);
    offScoreRef.current = 0;
    defScoreRef.current = 0;
    resetField(offenseCount, defenseCount);
  }, [offenseCount, defenseCount, resetField]);

  const playRound = useCallback(() => {
    if (loopRunning.current) return; // prevent double-click
    const betAmt = parseFloat(bet);
    if (!isFinite(betAmt) || betAmt < MIN_BET || betAmt > MAX_BET) {
      setAlert(`Bet must be $${MIN_BET}-$${MAX_BET}`);
      setTimeout(() => setAlert(null), 2500);
      return;
    }
    if (betAmt > balanceRef.current) {
      setAlert("Insufficient balance");
      setTimeout(() => setAlert(null), 2500);
      return;
    }

    // Kill any previous round's loops and timers
    loopRunning.current = false;
    cancelAnimationFrame(rafIdRef.current);
    for (const t of phaseTimersRef.current) clearTimeout(t);
    phaseTimersRef.current = [];
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);

    setRoundResult(null);
    setGoalFlash(false);
    setGoalText(null);
    setShowPayout(null);

    const newBal = balanceRef.current - betAmt;
    setBalance(newBal);
    balanceRef.current = newBal;

    const oc = offenseCount;
    const dc = defenseCount;
    const willWin = Math.random() < (getWinChance(oc, dc) / 100);
    const mult = getMultiplier(oc, dc);

    setResultBet(betAmt);
    setResultMult(mult);

    const newPlayers = createPlayers(oc, dc);
    playersRef.current = newPlayers;
    const bs = createBall(oc);
    ballRef.current = bs;
    tickCountRef.current = 0;
    roundResultRef.current = null;
    finishedRef.current = false;

    // Reset match state
    phaseRef.current = "1st";
    halfTickRef.current = 0;
    offScoreRef.current = 0;
    defScoreRef.current = 0;
    goalCooldownRef.current = 0;
    setMatchPhase("1st");
    setOffScore(0);
    setDefScore(0);
    setHalfTick(0);

    setPlayers(newPlayers);
    setBallPos(bs.pos);
    setBallFree(false);
    setPlaying(true);
    audioRef.current?.sndWhistle();

    const offSpd = willWin ? 1.25 : 0.80;
    const defSpd = willWin ? 0.70 : 1.30;
    const tackleRate = willWin ? 0.08 : 0.40;

    const finishRound = (won: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      loopRunning.current = false;

      setMatchPhase(null);

      // Confetti on win
      if (won) {
        setCelebrating(true);
        setTimeout(() => setCelebrating(false), 1500);
        const bits = Array.from({ length: 20 }, (_, i) => ({
          id: Date.now() + i,
          x: 20 + Math.random() * 60,
          color: [offenseTeam?.primaryColor || '#0ECC68', offenseTeam?.secondaryColor || '#fff', '#FFD700'][i % 3],
          delay: Math.random() * 0.3,
        }));
        setConfetti(bits);
        setTimeout(() => setConfetti([]), 2000);
      } else {
        audioRef.current?.sndLose();
      }

      // Wait for goal effects (already playing from goalScored), then show result
      setTimeout(() => {
        setGoalFlash(false);
        setGoalText(null);
        setRoundResult(won ? "win" : "lose");

        if (won) {
          const payout = betAmt * mult;
          const winBal = balanceRef.current + payout;
          setBalance(winBal);
          balanceRef.current = winBal;
          setWins(w => w + 1);
          setShowPayout(`+$${fmt(payout)}`);
          setTimeout(() => setShowPayout(null), 1500);
        } else {
          setLosses(l => l + 1);
        }

        histIdRef.current++;
        setHistory(prev => [{
          id: histIdRef.current,
          won,
          multiplier: mult,
          payout: won ? betAmt * mult : 0,
        }, ...prev].slice(0, 50));

        setPlaying(false);

        // Auto-dismiss overlay after 2.5s
        overlayTimerRef.current = setTimeout(() => {
          setRoundResult(null);
          resetField(oc, dc);
        }, 2500);
      }, 800);
    };

    const tick = () => {
      if (!loopRunning.current) return;
      if (roundResultRef.current !== null) {
        finishRound(roundResultRef.current === "win");
        return;
      }

      tickCountRef.current++;
      const t = tickCountRef.current;
      const pls = playersRef.current.map(p => ({ ...p, pos: { ...p.pos }, vel: { ...p.vel }, homePos: { ...p.homePos } }));
      const ball = { ...ballRef.current, pos: { ...ballRef.current.pos }, vel: { ...ballRef.current.vel } };

      const offPls = pls.filter(p => p.team === "offense" && !p.tackled && !p.isGK);
      const defPls = pls.filter(p => p.team === "defense" && !p.isGK);
      const allField = pls.filter(p => !p.isGK);

      let offCarrier = pls.find(p => p.team === "offense" && p.hasBall && !p.tackled && !p.isGK);
      let defCarrier = pls.find(p => p.team === "defense" && p.hasDefBall && !p.isGK);
      const defHasBall = !!defCarrier;

      for (const p of pls) {
        if (p.isGK) { p.hasBall = false; p.hasDefBall = false; }
      }

      // --- Ball physics ---
      if (ball.free && ball.target) {
        const d = dist(ball.pos, ball.target);
        if (d < 0.03) {
          ball.free = false;
          ball.target = null;
          ball.vel = { x: 0, y: 0 };
        } else {
          const dir = normalize({ x: ball.target.x - ball.pos.x, y: ball.target.y - ball.pos.y });
          const spd = Math.min(0.028, d * 0.5 + 0.012); // slow down near target
          ball.pos.x += dir.x * spd;
          ball.pos.y += dir.y * spd;
        }
      }

      // --- Loose ball pickup ---
      if (!offCarrier && !defCarrier && !ball.free && offPls.length > 0) {
        let nearest = offPls[0];
        let nd = dist(nearest.pos, ball.pos);
        for (const op of offPls) {
          const d = dist(op.pos, ball.pos);
          if (d < nd) { nearest = op; nd = d; }
        }
        if (nd < 0.06) {
          nearest.hasBall = true;
          offCarrier = nearest;
        } else {
          // Only nearest 2 chase ball, rest hold position
          const sorted = [...offPls].sort((a, b) => dist(a.pos, ball.pos) - dist(b.pos, ball.pos));
          for (let i = 0; i < sorted.length; i++) {
            const op = sorted[i];
            if (i < 2) {
              const s = steer(op.pos, op.vel, ball.pos, 0.008 * offSpd, 0.002);
              op.pos = s.pos; op.vel = s.vel;
            }
          }
        }
      }

      const ACCEL = 0.002;
      const FRICTION = 0.92; // natural deceleration

      // --- Separation force: players avoid overlapping ---
      const SEP_DIST = 0.065;
      const SEP_FORCE = 0.002;
      for (let i = 0; i < allField.length; i++) {
        for (let j = i + 1; j < allField.length; j++) {
          const a = allField[i], b = allField[j];
          if (a.tackled || b.tackled) continue;
          const d = dist(a.pos, b.pos);
          if (d < SEP_DIST && d > 0.001) {
            const pushX = (a.pos.x - b.pos.x) / d * SEP_FORCE;
            const pushY = (a.pos.y - b.pos.y) / d * SEP_FORCE;
            a.pos.x += pushX; a.pos.y += pushY;
            b.pos.x -= pushX; b.pos.y -= pushY;
          }
        }
      }

      // --- Defense line Y: shift as a unit based on ball position ---
      const defLineY = clamp(ball.pos.y - 0.15, 0.15, 0.45);

      for (const p of pls) {
        if (p.tackled) {
          p.tackleCooldown--;
          if (p.tackleCooldown <= 0) { p.tackled = false; p.tackleCooldown = 0; }
          p.vel = { x: p.vel.x * 0.8, y: p.vel.y * 0.8 };
          continue;
        }

        // --- Goalkeeper ---
        if (p.isGK) {
          const goalY = p.team === "defense" ? 0.06 : 0.94;
          const targetX = clamp(ball.pos.x, GOAL_X_MIN + 0.02, GOAL_X_MAX - 0.02);
          const s = steer(p.pos, p.vel, { x: targetX, y: goalY }, 0.010, 0.003);
          p.pos.x = s.pos.x; p.vel.x = s.vel.x;
          p.pos.y = goalY; p.vel.y = 0;
          p.pos.x = clamp(p.pos.x, GOAL_X_MIN - 0.02, GOAL_X_MAX + 0.02);
          continue;
        }

        // Apply friction to all players
        p.vel.x *= FRICTION;
        p.vel.y *= FRICTION;

        // --- OFFENSE ---
        if (p.team === "offense") {
          if (defHasBall && defCarrier) {
            // Press: nearest 2 chase carrier, rest cut passing lanes
            const distToDC = dist(p.pos, defCarrier.pos);
            const chasers = [...offPls].sort((a, b) => dist(a.pos, defCarrier!.pos) - dist(b.pos, defCarrier!.pos));
            const isChaser = chasers.indexOf(p) < 2;

            if (isChaser) {
              const s = steer(p.pos, p.vel, defCarrier.pos, 0.009 * offSpd, ACCEL * 1.2);
              p.pos = s.pos; p.vel = s.vel;
            } else {
              // Hold shape, cut off passing lanes
              const blockX = clamp(defCarrier.pos.x + (p.homePos.x - 0.5) * 0.5, 0.15, 0.85);
              const blockY = clamp(defCarrier.pos.y + 0.12, 0.2, 0.75);
              const s = steer(p.pos, p.vel, { x: blockX, y: blockY }, 0.005 * offSpd, ACCEL * 0.6);
              p.pos = s.pos; p.vel = s.vel;
            }

          } else if (p.hasBall && !ball.free) {
            // --- Dribbling with vision ---
            let targetY = p.pos.y - 0.08; // progress gradually, not sprint
            let targetX = p.pos.x;

            // Look for open lane to goal
            const goalDir = normalize({ x: 0.5 - p.pos.x, y: 0 - p.pos.y });
            targetX = p.pos.x + goalDir.x * 0.05;
            targetY = p.pos.y + goalDir.y * 0.05;

            // Scan for defenders
            let closestDef: Player | null = null;
            let closestDefDist = 999;
            for (const d of defPls) {
              const dd = dist(p.pos, d.pos);
              if (dd < closestDefDist) { closestDefDist = dd; closestDef = d; }
            }

            // Dribble sideways to avoid pressure
            if (closestDef && closestDefDist < 0.14) {
              const dx = p.pos.x - closestDef.pos.x;
              const dy = p.pos.y - closestDef.pos.y;
              // Move perpendicular to defender
              targetX = p.pos.x + (dx > 0 ? 0.1 : -0.1);
              targetY = p.pos.y + Math.min(dy * -0.3, -0.02);
              targetX = clamp(targetX, 0.08, 0.92);

              // Feint: occasional sharp cut
              if (Math.random() < 0.015) {
                targetX = p.pos.x + (dx > 0 ? -0.12 : 0.12);
                targetX = clamp(targetX, 0.08, 0.92);
              }
            }

            // --- Passing: build up play ---
            const passChance = closestDefDist < 0.08 ? 0.07 : (closestDefDist < 0.14 ? 0.03 : 0.012);
            if (offPls.length > 1 && Math.random() < passChance) {
              let bestMate: Player | null = null;
              let bestScore = -1;
              for (const mate of offPls) {
                if (mate.id === p.id) continue;
                // Score: forward position + space from defenders + not behind ball
                const space = defPls.reduce((min, d) => Math.min(min, dist(mate.pos, d.pos)), 999);
                const forward = (p.pos.y - mate.pos.y); // higher = more forward
                const angle = Math.abs(mate.pos.x - p.pos.x); // width
                const score = forward * 0.4 + space * 0.35 + angle * 0.25;
                if (mate.pos.y < p.pos.y + 0.05 && score > bestScore) {
                  bestScore = score; bestMate = mate;
                }
              }
              // Back pass if no forward option
              if (!bestMate) {
                for (const mate of offPls) {
                  if (mate.id === p.id) continue;
                  const space = defPls.reduce((min, d) => Math.min(min, dist(mate.pos, d.pos)), 999);
                  if (space > 0.12) { bestMate = mate; break; }
                }
              }
              if (bestMate) {
                p.hasBall = false;
                bestMate.hasBall = true;
                ball.free = true;
                // Lead the pass slightly ahead of teammate
                ball.target = { x: bestMate.pos.x, y: bestMate.pos.y - 0.02 };
                audioRef.current?.sndPass();
              }
            }

            // Shoot if in the box
            if (p.pos.y < 0.22 && Math.abs(p.pos.x - 0.5) < 0.28 && Math.random() < 0.14) {
              p.hasBall = false;
              ball.free = true;
              const side = p.pos.x < 0.5 ? 0.38 : 0.62;
              ball.target = { x: side + (Math.random() - 0.5) * 0.1, y: 0.01 };
              audioRef.current?.sndKick();
            }
            // Long shot from outside the box
            if (p.pos.y < 0.35 && p.pos.y >= 0.22 && Math.random() < 0.025) {
              p.hasBall = false;
              ball.free = true;
              ball.target = { x: 0.35 + Math.random() * 0.3, y: 0.01 };
              audioRef.current?.sndKick();
            }

            targetX = clamp(targetX, 0.08, 0.92);
            targetY = clamp(targetY, 0.04, 0.88);
            const dribbleSpd = closestDefDist < 0.12 ? 0.007 : 0.008;
            const s = steer(p.pos, p.vel, { x: targetX, y: targetY }, dribbleSpd * offSpd, ACCEL * offSpd);
            p.pos = s.pos; p.vel = s.vel;

            if (!ball.free) {
              // Dribble: ball close to feet with natural wobble
              const wobX = Math.sin(t * 0.35) * 0.006;
              const wobY = Math.cos(t * 0.25) * 0.003;
              ball.pos.x = p.pos.x + wobX + (p.vel.x > 0 ? 0.008 : -0.008);
              ball.pos.y = p.pos.y + 0.014 + wobY;
            }

          } else if (!p.hasBall) {
            // --- Support runs: find space, make yourself available ---
            if (offCarrier) {
              const carrierDist = dist(p.pos, offCarrier.pos);
              // Dynamic positioning based on carrier position
              const idx = offPls.filter(op => op.id !== offCarrier!.id).indexOf(p);
              const totalSupport = offPls.length - 1;

              // Spread across width, stay ahead of carrier
              let runX: number, runY: number;

              if (totalSupport <= 0) {
                runX = p.homePos.x;
                runY = p.homePos.y;
              } else {
                // Spread evenly across pitch width
                const widthSlot = totalSupport <= 1 ? 0.5 : idx / (totalSupport - 1);
                runX = 0.15 + widthSlot * 0.70;
                // Run ahead of carrier but not too far
                runY = clamp(offCarrier.pos.y - 0.08 - (idx * 0.06), 0.12, offCarrier.pos.y + 0.05);

                // Diagonal runs toward goal periodically
                if (t % 80 < 40 && idx === 0) {
                  runY -= 0.05;
                  runX += (runX < 0.5 ? 0.08 : -0.08);
                }
              }

              // Stay away from defenders (find space)
              let nearestDefDist = 999;
              for (const d of defPls) {
                const dd = dist({ x: runX, y: runY }, d.pos);
                if (dd < nearestDefDist) nearestDefDist = dd;
              }
              if (nearestDefDist < 0.10) {
                runX += (Math.random() - 0.5) * 0.1;
              }

              runX = clamp(runX, 0.08, 0.92);
              runY = clamp(runY, 0.10, 0.82);

              const spd = carrierDist > 0.3 ? 0.007 : 0.005;
              const s = steer(p.pos, p.vel, { x: runX, y: runY }, spd * offSpd, ACCEL * 0.8);
              p.pos = s.pos; p.vel = s.vel;
            } else {
              // Return to formation slowly
              const s = steer(p.pos, p.vel, p.homePos, 0.004 * offSpd, ACCEL * 0.5);
              p.pos = s.pos; p.vel = s.vel;
            }
          }
        }

        // --- DEFENSE ---
        if (p.team === "defense") {
          if (p.hasDefBall && !ball.free) {
            // Counter-attack with awareness
            let targetY = p.pos.y + 0.06;
            let targetX = p.pos.x;

            // Look for space toward goal
            const goalDir = normalize({ x: 0.5 - p.pos.x, y: 1.0 - p.pos.y });
            targetX = p.pos.x + goalDir.x * 0.04;
            targetY = p.pos.y + goalDir.y * 0.04;

            let closestOff: Player | null = null;
            let closestOffDist = 999;
            for (const o of offPls) {
              const dd = dist(p.pos, o.pos);
              if (dd < closestOffDist) { closestOffDist = dd; closestOff = o; }
            }
            if (closestOff && closestOffDist < 0.14) {
              const dx = p.pos.x - closestOff.pos.x;
              targetX = p.pos.x + (dx > 0 ? 0.1 : -0.1);
              targetX = clamp(targetX, 0.08, 0.92);
            }

            // Pass to a teammate if pressured
            if (closestOffDist < 0.10 && defPls.length > 1 && Math.random() < 0.05) {
              const mates = defPls.filter(d => d.id !== p.id);
              const bestMate = mates.reduce((a, b) => {
                const aDist = offPls.reduce((min, o) => Math.min(min, dist(a.pos, o.pos)), 999);
                const bDist = offPls.reduce((min, o) => Math.min(min, dist(b.pos, o.pos)), 999);
                return aDist > bDist ? a : b;
              });
              if (bestMate) {
                p.hasDefBall = false;
                bestMate.hasDefBall = true;
                ball.free = true;
                ball.target = { ...bestMate.pos };
                audioRef.current?.sndPass();
              }
            }

            // Shoot if near goal
            if (p.pos.y > 0.78 && Math.abs(p.pos.x - 0.5) < 0.28 && Math.random() < 0.14) {
              p.hasDefBall = false;
              ball.free = true;
              const side = p.pos.x < 0.5 ? 0.38 : 0.62;
              ball.target = { x: side + (Math.random() - 0.5) * 0.1, y: 0.99 };
              audioRef.current?.sndKick();
            }
            // Long shot
            if (p.pos.y > 0.65 && p.pos.y <= 0.78 && Math.random() < 0.025) {
              p.hasDefBall = false;
              ball.free = true;
              ball.target = { x: 0.35 + Math.random() * 0.3, y: 0.99 };
              audioRef.current?.sndKick();
            }

            targetX = clamp(targetX, 0.08, 0.92);
            targetY = clamp(targetY, 0.12, 0.96);
            const s = steer(p.pos, p.vel, { x: targetX, y: targetY }, 0.008 * defSpd, ACCEL * defSpd);
            p.pos = s.pos; p.vel = s.vel;

            if (!ball.free) {
              ball.pos.x = p.pos.x + Math.sin(t * 0.3) * 0.005;
              ball.pos.y = p.pos.y + 0.014;
            }

          } else if (offCarrier && !defHasBall) {
            // --- Defensive shape: line shifts as a unit ---
            const distToCarrier = dist(p.pos, offCarrier.pos);
            const idx = defPls.indexOf(p);
            const totalDef = defPls.length;

            // One or two nearest press the carrier, rest hold the line
            const sortedByDist = [...defPls].sort((a, b) => dist(a.pos, offCarrier!.pos) - dist(b.pos, offCarrier!.pos));
            const pressIdx = sortedByDist.indexOf(p);
            const numPressers = Math.min(2, totalDef);

            if (pressIdx < numPressers) {
              // Press: sprint toward carrier
              const s = steer(p.pos, p.vel, offCarrier.pos, 0.009 * defSpd, ACCEL * 1.3);
              p.pos = s.pos; p.vel = s.vel;
            } else {
              // Hold defensive line — shift laterally to track ball
              const lineIdx = pressIdx - numPressers;
              const lineTotal = totalDef - numPressers;
              const slot = lineTotal <= 1 ? 0.5 : lineIdx / (lineTotal - 1);

              // Line X: spread across, biased toward ball side
              const ballBias = (offCarrier.pos.x - 0.5) * 0.2;
              const lineX = 0.15 + slot * 0.70 + ballBias;

              // Line Y: track ball height as a unit
              const lineTarget = { x: clamp(lineX, 0.08, 0.92), y: defLineY };
              const s = steer(p.pos, p.vel, lineTarget, 0.006 * defSpd, ACCEL * 0.8);
              p.pos = s.pos; p.vel = s.vel;
            }

          } else if (!defHasBall) {
            // Return to formation when nobody has ball
            const s = steer(p.pos, p.vel, p.homePos, 0.004, ACCEL * 0.5);
            p.pos = s.pos; p.vel = s.vel;
          }
        }

        // --- Boundary clamps ---
        p.pos.x = clamp(p.pos.x, 0.04, 0.96);
        if (p.isGK) {
          // stays on line
        } else if (p.team === "offense") {
          p.pos.y = clamp(p.pos.y, 0.04, 0.88);
        } else {
          p.pos.y = clamp(p.pos.y, 0.10, 0.96);
        }
      }

      // Tackle: defense near offense carrier
      if (offCarrier && !defHasBall && !ball.free) {
        for (const d of defPls) {
          if (dist(d.pos, offCarrier.pos) < 0.045 && Math.random() < tackleRate) {
            offCarrier.hasBall = false;
            offCarrier.tackled = true;
            offCarrier.tackleCooldown = 18;
            d.hasDefBall = true;
            ball.pos = { ...d.pos };
            ball.free = false;
            ball.target = null;

            setTackleFlashes(prev => [...prev, { id: Date.now(), pos: { ...offCarrier!.pos } }]);
            setTimeout(() => setTackleFlashes(prev => prev.slice(1)), 600);
            canvasTacklesRef.current = [...canvasTacklesRef.current, { pos: { ...offCarrier!.pos }, startTick: tickCountRef.current }];
            setTimeout(() => { canvasTacklesRef.current = canvasTacklesRef.current.slice(1); }, 600);
            audioRef.current?.sndTackle();
            break;
          }
        }
      }

      // Offense recovers from defense carrier
      if (defCarrier && !ball.free) {
        for (const o of offPls) {
          if (dist(o.pos, defCarrier.pos) < 0.045 && Math.random() < 0.15) {
            defCarrier.hasDefBall = false;
            o.hasBall = true;
            ball.pos = { ...o.pos };
            ball.free = false;
            setTackleFlashes(prev => [...prev, { id: Date.now(), pos: { ...defCarrier!.pos } }]);
            setTimeout(() => setTackleFlashes(prev => prev.slice(1)), 600);
            canvasTacklesRef.current = [...canvasTacklesRef.current, { pos: { ...defCarrier!.pos }, startTick: tickCountRef.current }];
            setTimeout(() => { canvasTacklesRef.current = canvasTacklesRef.current.slice(1); }, 600);
            break;
          }
        }
      }

      // GK save — goalkeeper intercepts a shot near the goal
      if (ball.free) {
        const gks = pls.filter(p => p.isGK);
        for (const gk of gks) {
          if (dist(gk.pos, ball.pos) < 0.04 && Math.random() < 0.7) {
            // GK catches the ball — save!
            ball.free = false;
            ball.target = null;
            audioRef.current?.sndSave();

            // Clear ALL ball possession first
            for (const pp of pls) {
              pp.hasBall = false;
              pp.hasDefBall = false;
            }

            if (gk.team === "defense") {
              // Defense GK saved offense shot — kick ball to midfield for a defender
              ball.pos = { x: gk.pos.x, y: 0.30 };
              const outfield = pls.filter(p => p.team === "defense" && !p.isGK);
              if (outfield.length > 0) {
                const nearest = outfield.reduce((a, b) => dist(a.pos, ball.pos) < dist(b.pos, ball.pos) ? a : b);
                nearest.hasDefBall = true;
                ball.pos = { ...nearest.pos };
              }
            } else {
              // Offense GK saved defense counter-attack — kick ball to midfield for an attacker
              ball.pos = { x: gk.pos.x, y: 0.70 };
              let outfield = pls.filter(p => p.team === "offense" && !p.isGK && !p.tackled);
              // If all attackers are tackled, force-untackle the one with least cooldown
              if (outfield.length === 0) {
                const allOff = pls.filter(p => p.team === "offense" && !p.isGK);
                if (allOff.length > 0) {
                  const best = allOff.reduce((a, b) => a.tackleCooldown < b.tackleCooldown ? a : b);
                  best.tackled = false;
                  best.tackleCooldown = 0;
                  outfield = [best];
                }
              }
              if (outfield.length > 0) {
                const nearest = outfield.reduce((a, b) => dist(a.pos, ball.pos) < dist(b.pos, ball.pos) ? a : b);
                nearest.hasBall = true;
                ball.pos = { ...nearest.pos };
              }
            }
            break;
          }
        }
      }

      // --- GOAL DETECTION ---
      const goalScored = (team: "offense" | "defense") => {
        if (goalCooldownRef.current > 0) return; // just reset, ignore
        goalCooldownRef.current = 25;

        if (team === "offense") {
          offScoreRef.current++;
          setOffScore(offScoreRef.current);
        } else {
          defScoreRef.current++;
          setDefScore(defScoreRef.current);
        }

        // Flash + effects
        setGoalFlash(true);
        setGoalText("GOAL!");
        setCameraShake(true);
        setTimeout(() => setCameraShake(false), 500);
        setTimeout(() => { setGoalFlash(false); setGoalText(null); }, 1000);
        audioRef.current?.sndGoal();

        // In extra time, first goal ends match (golden goal)
        if (phaseRef.current === "extra") {
          const won = offScoreRef.current > defScoreRef.current;
          roundResultRef.current = won ? "win" : "lose";
          return;
        }

        // Reset positions to center after goal
        phaseTimersRef.current.push(setTimeout(() => {
          const np = createPlayers(oc, dc);
          playersRef.current = np;
          const newBs = createBall(oc);
          ballRef.current = newBs;
        }, 600));
      };

      if (goalCooldownRef.current > 0) goalCooldownRef.current--;

      // Check goals — ball in top net = offense scores, bottom = defense scores
      const ballInTopGoal = ball.pos.y < 0.04 && ball.pos.x > GOAL_X_MIN && ball.pos.x < GOAL_X_MAX;
      const ballInBotGoal = ball.pos.y > 0.96 && ball.pos.x > GOAL_X_MIN && ball.pos.x < GOAL_X_MAX;

      if (ballInTopGoal && goalCooldownRef.current <= 0) {
        goalScored("offense");
        playersRef.current = pls; ballRef.current = ball;
        setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
        if (roundResultRef.current !== null) return;
      }
      if (ballInBotGoal && goalCooldownRef.current <= 0) {
        goalScored("defense");
        playersRef.current = pls; ballRef.current = ball;
        setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
        if (roundResultRef.current !== null) return;
      }

      // --- HALF / PHASE MANAGEMENT ---
      halfTickRef.current++;
      setHalfTick(halfTickRef.current);
      const phase = phaseRef.current;
      const maxTicks = phase === "extra" ? EXTRA_TICKS : HALF_TICKS;

      // Force goal: 2nd half only if LOSING (ties go to extra time), extra time if tied or losing
      const shouldForce2nd = phase === "2nd" && halfTickRef.current >= maxTicks - 20;
      const shouldForceET = phase === "extra" && halfTickRef.current >= maxTicks - 20;
      if (shouldForce2nd || shouldForceET) {
        const os = offScoreRef.current;
        const ds = defScoreRef.current;
        // 2nd half: only force if strictly losing — allow ties for extra time
        // Extra time: force if tied or losing — must decide winner
        const needOffGoal = willWin && (shouldForceET ? os <= ds : os < ds);
        const needDefGoal = !willWin && (shouldForceET ? ds <= os : ds < os);

        if (needOffGoal) {
          let c = pls.find(p => p.team === "offense" && p.hasBall && !p.tackled && !p.isGK);
          if (!c && !ball.free) {
            const any = pls.find(p => p.team === "offense" && !p.isGK && !p.tackled);
            if (any) {
              for (const pp of pls) { pp.hasBall = false; pp.hasDefBall = false; }
              any.hasBall = true; c = any;
            }
          }
          if (c && !ball.free) {
            c.pos.y -= 0.03; c.pos.x += (0.5 - c.pos.x) * 0.12;
            c.pos.y = Math.max(c.pos.y, 0.02);
            ball.pos = { x: c.pos.x, y: c.pos.y };
          }
        }
        if (needDefGoal) {
          let dc2 = pls.find(p => p.team === "defense" && p.hasDefBall && !p.isGK);
          if (!dc2 && !ball.free) {
            const any = pls.find(p => p.team === "defense" && !p.isGK);
            if (any) {
              for (const pp of pls) { pp.hasBall = false; pp.hasDefBall = false; }
              any.hasDefBall = true; any.pos.y = Math.max(any.pos.y, 0.55); dc2 = any;
            }
          }
          if (dc2 && !ball.free) {
            dc2.pos.y += 0.03; dc2.pos.x += (0.5 - dc2.pos.x) * 0.12;
            dc2.pos.y = Math.min(dc2.pos.y, 0.98);
            ball.pos = { x: dc2.pos.x, y: dc2.pos.y };
          }
        }
      }

      // Hard force at end of phase
      if (halfTickRef.current >= maxTicks + 5) {
        const os = offScoreRef.current;
        const ds = defScoreRef.current;

        if (phase === "1st") {
          // End of 1st half → halftime
          loopRunning.current = false;
          playersRef.current = pls; ballRef.current = ball;
          setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
          setMatchPhase("halftime");
          audioRef.current?.sndWhistle();

          phaseTimersRef.current.push(setTimeout(() => {
            if (finishedRef.current) return; // round already ended, don't restart
            // Start 2nd half
            phaseRef.current = "2nd";
            halfTickRef.current = 0;
            goalCooldownRef.current = 0;
            setMatchPhase("2nd");
            setHalfTick(0);

            const np2 = createPlayers(oc, dc);
            playersRef.current = np2;
            setPlayers(np2);
            const bs2 = createBall(oc);
            ballRef.current = bs2;
            setBallPos(bs2.pos);
            setBallFree(false);

            audioRef.current?.sndWhistle();
            loopRunning.current = true;
            rafIdRef.current = requestAnimationFrame(loop);
          }, HALFTIME_MS));
          return;
        }

        if (phase === "2nd") {
          if (os === ds) {
            // Tied → show fulltime, then extra time
            loopRunning.current = false;
            playersRef.current = pls; ballRef.current = ball;
            setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
            setMatchPhase("fulltime");
            audioRef.current?.sndWhistle();

            phaseTimersRef.current.push(setTimeout(() => {
              setMatchPhase("extra-intro");

              phaseTimersRef.current.push(setTimeout(() => {
                phaseRef.current = "extra";
                halfTickRef.current = 0;
                goalCooldownRef.current = 0;
                setMatchPhase("extra");
                setHalfTick(0);

                const np3 = createPlayers(oc, dc);
                playersRef.current = np3;
                setPlayers(np3);
                const bs3 = createBall(oc);
                ballRef.current = bs3;
                setBallPos(bs3.pos);
                setBallFree(false);

                audioRef.current?.sndWhistle();
                loopRunning.current = true;
                rafIdRef.current = requestAnimationFrame(loop);
              }, 1500));
            }, HALFTIME_MS));
            return;
          }
          // Not tied → show fulltime then result
          loopRunning.current = false;
          playersRef.current = pls; ballRef.current = ball;
          setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
          setMatchPhase("fulltime");
          audioRef.current?.sndWhistle();

          phaseTimersRef.current.push(setTimeout(() => {
            roundResultRef.current = os > ds ? "win" : "lose";
            finishRound(os > ds);
          }, HALFTIME_MS));
          return;
        }

        if (phase === "extra") {
          // Force result with goal effects
          ball.pos = willWin ? { x: 0.5, y: 0.02 } : { x: 0.5, y: 0.98 };
          ball.free = false;
          goalScored(willWin ? "offense" : "defense");
          playersRef.current = pls; ballRef.current = ball;
          setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
          return;
        }
      }

      playersRef.current = pls;
      ballRef.current = ball;
      // Canvas reads directly from refs — no React state updates needed per tick
      tickCountRef.current++;
    };

    loopRunning.current = true;
    let lastTime = 0;
    const tickMs = gameSpeed === "fast" ? TICK_MS_FAST : TICK_MS_STANDARD;
    function loop(time: number) {
      if (!loopRunning.current) return;
      if (time - lastTime >= tickMs) {
        lastTime = time;
        tick();
      }
      rafIdRef.current = requestAnimationFrame(loop);
    }
    rafIdRef.current = requestAnimationFrame(loop);
  }, [bet, offenseCount, defenseCount, resetField, gameSpeed, offenseTeam, defenseTeam]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      loopRunning.current = false;
      cancelAnimationFrame(rafIdRef.current);
      for (const t of phaseTimersRef.current) clearTimeout(t);
      phaseTimersRef.current = [];
    };
  }, []);

  return (
    <>
      <div className="app">
        {/* Header — swaps to scoreboard during gameplay */}
        <div className="header">
          {(playing || matchPhase === "halftime" || matchPhase === "fulltime" || matchPhase === "extra-intro") ? (
            <>
              <div className="hdr-team">
                {offenseTeam?.flagImg && <img className="hdr-flag" src={offenseTeam.flagImg} alt="" />}
                <span className="hdr-code off">{offenseTeam?.code}</span>
              </div>
              <div className="hdr-score-block">
                <span className="hdr-score">{offScore} - {defScore}</span>
                <div className="hdr-phase-row">
                  <span className="hdr-phase">{matchPhase === "1st" ? "1ST HALF" : matchPhase === "2nd" ? "2ND HALF" : matchPhase === "extra" ? "EXTRA TIME" : matchPhase === "fulltime" ? "FULL TIME" : matchPhase === "extra-intro" ? "EXTRA TIME" : "HALF TIME"}</span>
                  {matchPhase !== "halftime" && matchPhase !== "fulltime" && matchPhase !== "extra-intro" && (
                    <div className="hdr-timer">
                      <div className="hdr-timer-fill" style={{ width: `${Math.min(100, (halfTick / (matchPhase === "extra" ? EXTRA_TICKS : HALF_TICKS)) * 100)}%` }} />
                    </div>
                  )}
                </div>
              </div>
              <div className="hdr-team">
                <span className="hdr-code def">{defenseTeam?.code}</span>
                {defenseTeam?.flagImg && <img className="hdr-flag" src={defenseTeam.flagImg} alt="" />}
              </div>
            </>
          ) : (
            <>
              <div className="header-left">
                <div className="game-name">
                  <span className="ico">{offenseTeam?.flag}</span>
                  <span>vs</span>
                  <span className="ico">{defenseTeam?.flag}</span>
                </div>
              </div>
              <div className="header-balance">
                <span className="header-bal-icon">{"\uD83D\uDCB0"}</span>
                <span className="header-bal-value">{fmt(balance)}</span>
              </div>
              <div className="header-right">
                <div className="fairplay" onClick={() => setPfModalOpen(true)}>
                  Fair Play
                </div>
                <div className="info-btn" onClick={() => setGameInfoOpen(true)}>
                  i
                </div>
              </div>
            </>
          )}
        </div>

        {/* History bar */}
        <div className="history-bar">
          {history.length === 0 ? (
            <span className="history-empty">No rounds played yet</span>
          ) : (
            history.map(h => (
              <span key={h.id} className={`history-chip ${h.won ? "hc-win" : "hc-lose"}`}>
                {h.won ? `${h.multiplier.toFixed(2)}x` : "0x"}
              </span>
            ))
          )}
        </div>

        {/* Field */}
        <div className={`field-area${cameraShake ? " shake" : ""}`}>
          <div className={`football-field${goalFlash ? " goal-active" : ""}`}>
            {/* Canvas — draws field, players, ball, effects */}
            <canvas
              ref={canvasRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: "inherit" }}
            />

            {/* DOM overlays on top of canvas */}

            {/* Confetti on win */}
            {confetti.map(c => (
              <div
                key={c.id}
                className="confetti-bit"
                style={{
                  left: `${c.x}%`,
                  top: '30%',
                  backgroundColor: c.color,
                  animationDelay: `${c.delay}s`,
                }}
              />
            ))}

            {goalFlash && <div className="goal-flash" />}
            {goalText && <div className="goal-text">{goalText}</div>}
            {showPayout && <div className="payout-float">{showPayout}</div>}

            {/* Halftime overlay */}
            {matchPhase === "halftime" && (
              <div className="halftime-overlay">
                <div className="ht-text">HALF TIME</div>
                <div className="ht-score">{offScore} - {defScore}</div>
              </div>
            )}

            {/* Fulltime overlay */}
            {matchPhase === "fulltime" && (
              <div className="halftime-overlay">
                <div className="ht-text">FULL TIME</div>
                <div className="ht-score">{offScore} - {defScore}</div>
              </div>
            )}

            {/* Extra time intro overlay */}
            {matchPhase === "extra-intro" && (
              <div className="halftime-overlay">
                <div className="ht-text">EXTRA TIME</div>
                <div className="ht-sub">Next goal wins</div>
              </div>
            )}

            {/* Bet modal on stadium — visible when NOT playing */}
            {!playing && !roundResult && (
              <div className="bet-modal-overlay">
                <div className="bet-modal">
                  {/* --- TEAM SELECTION MODE --- */}
                  {(!offenseTeam || showTeamPicker) ? (
                    <>
                      <div className="bm-pick-title">Choose Your Team</div>
                      <div className="bm-pick-search">
                        <input
                          type="text"
                          placeholder="Search..."
                          value={teamSearch}
                          onChange={e => setTeamSearch(e.target.value)}
                        />
                      </div>
                      <div className="bm-pick-grid">
                        {(() => {
                          const filtered = worldCup2026Teams
                            .filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()) || t.code.toLowerCase().includes(teamSearch.toLowerCase()))
                            .sort((a, b) => a.name.localeCompare(b.name));
                          const grouped: Record<string, typeof filtered> = {};
                          for (const t of filtered) {
                            const letter = t.name[0].toUpperCase();
                            (grouped[letter] ??= []).push(t);
                          }
                          return Object.entries(grouped).map(([letter, teams]) => (
                            <div key={letter} className="bm-pick-group">
                              <div className="bm-pick-letter">{letter}</div>
                              {teams.map(team => (
                                <button
                                  key={team.code}
                                  className="bm-pick-team"
                                  onClick={() => {
                                    const others = worldCup2026Teams.filter(t => t.code !== team.code);
                                    const opponent = others[Math.floor(Math.random() * others.length)];
                                    audioRef.current?.unlock();
                                    setOffenseTeam(team);
                                    setDefenseTeam(opponent);
                                    setShowTeamPicker(false);
                                    setTeamSearch("");
                                    resetField(offenseCount, defenseCount);
                                    setTimeout(() => audioRef.current?.startBgMusic(), 200);
                                  }}
                                >
                                  <span className="bpt-flag">{team.flag}</span>
                                  <span className="bpt-name">{team.name}</span>
                                  <span className="bpt-code">{team.code}</span>
                                </button>
                              ))}
                            </div>
                          ));
                        })()}
                      </div>
                    </>
                  ) : (
                    <>
                      {/* --- BET CONTROLS MODE --- */}
                      {/* Team display + change */}
                      <div className="bm-teams" onClick={() => setShowTeamPicker(true)}>
                        <div className="bm-team-badge">
                          <span className="bm-team-flag">{offenseTeam?.flag}</span>
                          <span className="bm-team-name">{offenseTeam?.code}</span>
                        </div>
                        <span className="bm-team-vs">VS</span>
                        <div className="bm-team-badge">
                          <span className="bm-team-flag">{defenseTeam?.flag}</span>
                          <span className="bm-team-name">{defenseTeam?.code}</span>
                        </div>
                        <span className="bm-change-btn">Change</span>
                      </div>

                      {/* Stats strip */}
                      <div className="bm-stats">
                        <div className="bm-stat">
                          <span className="bm-stat-val accent">{multiplier.toFixed(2)}x</span>
                          <span className="bm-stat-label">Multiplier</span>
                        </div>
                        <div className="bm-stat-divider" />
                        <div className="bm-stat">
                          <span className="bm-stat-val green">{winChance.toFixed(1)}%</span>
                          <span className="bm-stat-label">Win Chance</span>
                        </div>
                      </div>

                      {/* Formation counters */}
                      <div className="bm-counters">
                        <div className="bm-counter">
                          <div className="bm-counter-ctrl">
                            <button onClick={() => adjustCount("defense", -1)} disabled={defenseCount <= MIN_PLAYERS}>-</button>
                            <div className="bm-counter-mid">
                              <span className="bm-counter-val def-c">{defenseCount + 1}</span>
                              <span className="bm-counter-tag def-c">{defenseTeam?.code || "DEF"}</span>
                            </div>
                            <button onClick={() => adjustCount("defense", 1)} disabled={defenseCount >= MAX_PLAYERS}>+</button>
                          </div>
                        </div>
                        <span className="bm-vs">VS</span>
                        <div className="bm-counter">
                          <div className="bm-counter-ctrl">
                            <button onClick={() => adjustCount("offense", -1)} disabled={offenseCount <= MIN_PLAYERS}>-</button>
                            <div className="bm-counter-mid">
                              <span className="bm-counter-val off-c">{offenseCount + 1}</span>
                              <span className="bm-counter-tag off-c">{offenseTeam?.code || "ATK"}</span>
                            </div>
                            <button onClick={() => adjustCount("offense", 1)} disabled={offenseCount >= MAX_PLAYERS}>+</button>
                          </div>
                        </div>
                      </div>

                      {/* Bet input + payout */}
                      <div className="bm-bet-section">
                        <div className="bm-input-wrap">
                          <span className="bm-currency">$</span>
                          <input
                            type="number"
                            value={bet}
                            onChange={e => setBet(e.target.value)}
                            min={MIN_BET}
                            max={MAX_BET}
                            step="0.01"
                            placeholder="Bet amount"
                          />
                          <div className="bm-chips">
                            <button onClick={() => setBet(prev => Math.max(MIN_BET, parseFloat(prev) / 2).toFixed(2))}>½</button>
                            <button onClick={() => setBet(prev => Math.min(balanceRef.current, MAX_BET, parseFloat(prev) * 2).toFixed(2))}>2x</button>
                            <button onClick={() => setBet(Math.min(balanceRef.current, MAX_BET).toFixed(2))}>Max</button>
                          </div>
                        </div>
                        <div className="bm-payout-strip">
                          <span className="bm-payout-label">Potential Win</span>
                          <span className="bm-payout-val">${fmt(parseFloat(bet || "0") * multiplier)}</span>
                        </div>
                      </div>

                      {/* Speed picker */}
                      <div className="bm-speed">
                        <button className={`bm-speed-btn${gameSpeed === "standard" ? " active" : ""}`} onClick={() => setGameSpeed("standard")}>Standard</button>
                        <button className={`bm-speed-btn${gameSpeed === "fast" ? " active" : ""}`} onClick={() => setGameSpeed("fast")}>Fast 2x</button>
                      </div>

                      {/* Kick off */}
                      {balance < MIN_BET && (
                        <div className="bm-broke">Insufficient balance</div>
                      )}
                      <button className="bm-kick-btn" onClick={playRound} disabled={balance < MIN_BET}>
                        <svg className="bm-kick-icon" viewBox="0 0 24 24" fill="none" width="18" height="18"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><polygon points="10,8 16,12 10,16" fill="currentColor"/></svg>
                        KICK OFF
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Floating bet ball during gameplay — behind players */}
            {playing && (
              <div className="bet-ball-modal">
                <div className="bet-ball">
                  <div className="bet-ball-glow" />
                  <div className="bet-ball-content">
                    <span className="bb-label">BET</span>
                    <span className="bb-amount">${fmt(parseFloat(bet || "0"))}</span>
                    <span className="bb-sep" />
                    <span className="bb-label">PAYOUT</span>
                    <span className="bb-payout">${fmt(parseFloat(bet || "0") * multiplier)}</span>
                  </div>
                </div>
              </div>
            )}





            {roundResult && !playing && (
              <div className="match-overlay" onClick={dismissOverlay}>
                <div className="mo-final-score">{offScore} - {defScore}</div>
                <div className="match-overlay-mult" style={{
                  color: roundResult === "win" ? "#10e676" : "#ED4163",
                }}>
                  {roundResult === "win" ? `${resultMult.toFixed(2)}x` : "0.00x"}
                </div>
                <div className="match-overlay-score" style={{
                  color: roundResult === "win" ? "#10e676" : "#ED4163",
                }}>
                  {roundResult === "win"
                    ? `+$${fmt(resultBet * resultMult)}`
                    : `-$${fmt(resultBet)}`}
                </div>
                <div className="match-overlay-tap">Tap to continue</div>
              </div>
            )}
          </div>
        </div>


        {/* Bottom Bar — same as Limbo */}
        <div className="footer-bar">
          <div className="footer-icons">
            <div
              className={`ic${!soundEnabled ? " muted" : ""}`}
              title="Toggle Sound"
              onClick={() => {
                const enabled = audioRef.current?.toggle() ?? true;
                setSoundEnabled(enabled);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {soundEnabled && (
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
                )}
              </svg>
            </div>
            <div className="ic" title="Settings">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div className="ic" title="Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
              </svg>
            </div>
            <div className="ic" title="Favorite">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </div>
          </div>
          <div className="footer-logo">MYBC</div>
        </div>
      </div>

      {alert && <div className="alert-toast">{alert}</div>}


      <GameInfoModal open={gameInfoOpen} onClose={() => setGameInfoOpen(false)} />
      <ProvablyFairModal open={pfModalOpen} onClose={() => setPfModalOpen(false)} />
    </>
  );
}
