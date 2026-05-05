"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AudioEngine } from "../lib/audio";
import { type WorldCupTeam } from "../lib/teams";
import TeamPicker from "./TeamPicker";
import GameInfoModal from "./GameInfoModal";
import ProvablyFairModal from "./ProvablyFairModal";

const ROUND_TICKS = 220;
const PLAYER_R = 13;
const GOAL_X_MIN = 0.30;
const GOAL_X_MAX = 0.70;
const TICK_MS = 35;
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

// Win chance based on defense/offense ratio
function getWinChance(offCount: number, defCount: number): number {
  const ratio = defCount / offCount;
  if (ratio <= 0.3) return 92;
  if (ratio <= 0.5) return 82;
  if (ratio <= 0.8) return 68;
  if (ratio <= 1.0) return 55;
  if (ratio <= 1.5) return 40;
  if (ratio <= 2.0) return 28;
  if (ratio <= 3.0) return 18;
  if (ratio <= 4.0) return 12;
  if (ratio <= 5.0) return 8;
  if (ratio <= 6.0) return 5;
  if (ratio <= 7.0) return 3.5;
  if (ratio <= 8.0) return 2.5;
  return 2;
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
      id: offenseCount + i,
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
    id: offenseCount + defenseCount,
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
    id: offenseCount + defenseCount + 1,
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
  const [gameStarted, setGameStarted] = useState(false);

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

  const playersRef = useRef(players);
  const ballRef = useRef<BallState>(createBall());
  const tickCountRef = useRef(0);
  const histIdRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundResultRef = useRef<"win" | "lose" | null>(null);
  const balanceRef = useRef(balance);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [gameInfoOpen, setGameInfoOpen] = useState(false);
  const [pfModalOpen, setPfModalOpen] = useState(false);

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

  const multiplier = getMultiplier(offenseCount, defenseCount);
  const winChance = getWinChance(offenseCount, defenseCount);

  const resetField = useCallback((oc: number, dc: number) => {
    const np = createPlayers(oc, dc);
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
    resetField(offenseCount, defenseCount);
  }, [offenseCount, defenseCount, resetField]);

  const playRound = useCallback(() => {
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

    // Clear previous overlay
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

    setPlayers(newPlayers);
    setBallPos(bs.pos);
    setBallFree(false);
    setPlaying(true);
    audioRef.current?.sndWhistle();

    const offSpd = willWin ? 1.25 : 0.80;
    const defSpd = willWin ? 0.70 : 1.30;
    const tackleRate = willWin ? 0.08 : 0.40;

    const finishRound = (won: boolean) => {
      if (tickRef.current) clearInterval(tickRef.current);

      // Shoot ball into the goal with velocity
      const b = ballRef.current;
      if (won) {
        b.pos.y = 0.01;
        b.pos.x = clamp(b.pos.x, GOAL_X_MIN + 0.05, GOAL_X_MAX - 0.05);
      } else {
        b.pos.y = 0.99;
        b.pos.x = clamp(b.pos.x, GOAL_X_MIN + 0.05, GOAL_X_MAX - 0.05);
      }
      b.free = false;
      ballRef.current = b;
      setBallPos({ ...b.pos });
      setBallFree(false);

      // Flash + text immediately (ball is in the net now)
      setGoalFlash(true);
      if (won) {
        setGoalText("GOAL!");
        if (mult >= 4) {
          audioRef.current?.sndBigGoal();
        } else {
          audioRef.current?.sndGoal();
        }
      } else {
        setGoalText("GOAL!");
        audioRef.current?.sndLose();
      }

      // Wait 800ms so player can SEE the ball in the net, then show overlay
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
      if (roundResultRef.current !== null) {
        finishRound(roundResultRef.current === "win");
        return;
      }

      tickCountRef.current++;
      const pls = playersRef.current.map(p => ({ ...p, pos: { ...p.pos }, vel: { ...p.vel }, homePos: { ...p.homePos } }));
      const ball = { ...ballRef.current, pos: { ...ballRef.current.pos }, vel: { ...ballRef.current.vel } };

      const offPls = pls.filter(p => p.team === "offense" && !p.tackled && !p.isGK);
      const defPls = pls.filter(p => p.team === "defense" && !p.isGK);

      let offCarrier = pls.find(p => p.team === "offense" && p.hasBall && !p.tackled && !p.isGK);
      let defCarrier = pls.find(p => p.team === "defense" && p.hasDefBall && !p.isGK);
      const defHasBall = !!defCarrier;

      // GKs should never hold the ball — clear if bugged
      for (const p of pls) {
        if (p.isGK) { p.hasBall = false; p.hasDefBall = false; }
      }

      // Ball is free (flying pass/shot) — move it independently
      if (ball.free && ball.target) {
        const d = dist(ball.pos, ball.target);
        if (d < 0.03) {
          ball.free = false;
          ball.target = null;
          ball.vel = { x: 0, y: 0 };
        } else {
          const dir = normalize({ x: ball.target.x - ball.pos.x, y: ball.target.y - ball.pos.y });
          ball.pos.x += dir.x * 0.025;
          ball.pos.y += dir.y * 0.025;
        }
      }

      // If no one has ball and ball not free, nearest offense (not GK) picks up
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
          // Run toward loose ball
          for (const op of offPls) {
            const s = steer(op.pos, op.vel, ball.pos, 0.009 * offSpd, 0.003);
            op.pos = s.pos;
            op.vel = s.vel;
          }
        }
      }

      const ACCEL = 0.0025;

      for (const p of pls) {
        if (p.tackled) {
          p.tackleCooldown--;
          if (p.tackleCooldown <= 0) { p.tackled = false; p.tackleCooldown = 0; }
          p.vel = { x: p.vel.x * 0.85, y: p.vel.y * 0.85 };
          continue;
        }

        // Goalkeeper AI — slides along goal line tracking the ball
        if (p.isGK) {
          const goalY = p.team === "defense" ? 0.06 : 0.94;
          // Track ball X position
          const targetX = clamp(ball.pos.x, GOAL_X_MIN + 0.02, GOAL_X_MAX - 0.02);
          const s = steer(p.pos, p.vel, { x: targetX, y: goalY }, 0.012, 0.004);
          p.pos.x = s.pos.x;
          p.vel.x = s.vel.x;
          // Stay on goal line
          p.pos.y = goalY;
          p.vel.y = 0;
          p.pos.x = clamp(p.pos.x, GOAL_X_MIN - 0.02, GOAL_X_MAX + 0.02);
          continue;
        }

        if (p.team === "offense") {
          if (defHasBall && defCarrier) {
            // Chase defense carrier
            const s = steer(p.pos, p.vel, defCarrier.pos, 0.008 * offSpd, ACCEL);
            p.pos = s.pos; p.vel = s.vel;
          } else if (p.hasBall && !ball.free) {
            // Dribble toward top goal
            let targetY = 0.0;
            let targetX = clamp(p.pos.x, GOAL_X_MIN, GOAL_X_MAX);

            // Find closest defender
            let closestDef: Player | null = null;
            let closestDefDist = 999;
            for (const d of defPls) {
              const dd = dist(p.pos, d.pos);
              if (dd < closestDefDist) { closestDefDist = dd; closestDef = d; }
            }

            // Dodge defender
            if (closestDef && closestDefDist < 0.16) {
              const dx = p.pos.x - closestDef.pos.x;
              targetX = p.pos.x + (dx > 0 ? 0.15 : -0.15);
              targetX = clamp(targetX, 0.10, 0.90);
            }

            // Pass when pressured
            if (closestDefDist < 0.10 && offPls.length > 1 && Math.random() < 0.04) {
              let bestMate: Player | null = null;
              let bestScore = -1;
              for (const mate of offPls) {
                if (mate.id === p.id) continue;
                const mdd = defPls.reduce((min, d) => Math.min(min, dist(mate.pos, d.pos)), 999);
                const score = (1 - mate.pos.y) * 0.5 + mdd * 0.5;
                if (score > bestScore) { bestScore = score; bestMate = mate; }
              }
              if (bestMate) {
                p.hasBall = false;
                bestMate.hasBall = true;
                // Ball flies to teammate
                ball.free = true;
                ball.target = { ...bestMate.pos };
                audioRef.current?.sndPass();
              }
            }

            // Shoot if close to goal
            if (p.pos.y < 0.15 && Math.abs(p.pos.x - 0.5) < 0.25 && Math.random() < 0.08) {
              p.hasBall = false;
              ball.free = true;
              ball.target = { x: 0.4 + Math.random() * 0.2, y: 0.01 };
              audioRef.current?.sndKick();
            }

            const target = { x: targetX, y: targetY };
            const s = steer(p.pos, p.vel, target, 0.009 * offSpd, ACCEL * offSpd);
            p.pos = s.pos; p.vel = s.vel;

            if (!ball.free) {
              // Dribble: ball slightly offset, wobbles
              const wobble = Math.sin(tickCountRef.current * 0.4) * 0.008;
              ball.pos.x = p.pos.x + wobble;
              ball.pos.y = p.pos.y + 0.015;
            }
          } else if (!p.hasBall) {
            // Support: run forward with spreading
            const supportY = Math.max(0.15, p.pos.y - 0.25);
            const spread = (p.id % 2 === 0 ? 0.1 : -0.1);
            const target = { x: clamp(p.homePos.x + spread, 0.1, 0.9), y: supportY };
            const s = steer(p.pos, p.vel, target, 0.006 * offSpd, ACCEL * 0.7);
            p.pos = s.pos; p.vel = s.vel;
          }
        }

        if (p.team === "defense") {
          if (p.hasDefBall && !ball.free) {
            // Counter-attack toward bottom goal
            let targetY = 1.0;
            let targetX = clamp(p.pos.x, GOAL_X_MIN, GOAL_X_MAX);

            let closestOff: Player | null = null;
            let closestOffDist = 999;
            for (const o of offPls) {
              const dd = dist(p.pos, o.pos);
              if (dd < closestOffDist) { closestOffDist = dd; closestOff = o; }
            }
            if (closestOff && closestOffDist < 0.14) {
              const dx = p.pos.x - closestOff.pos.x;
              targetX = p.pos.x + (dx > 0 ? 0.12 : -0.12);
              targetX = clamp(targetX, 0.08, 0.92);
            }

            // Shoot if near goal
            if (p.pos.y > 0.85 && Math.abs(p.pos.x - 0.5) < 0.25 && Math.random() < 0.1) {
              p.hasDefBall = false;
              ball.free = true;
              ball.target = { x: 0.4 + Math.random() * 0.2, y: 0.99 };
              audioRef.current?.sndKick();
            }

            const target = { x: targetX, y: targetY };
            const s = steer(p.pos, p.vel, target, 0.010 * defSpd, ACCEL * defSpd);
            p.pos = s.pos; p.vel = s.vel;

            if (!ball.free) {
              ball.pos.x = p.pos.x;
              ball.pos.y = p.pos.y + 0.015;
            }
          } else if (offCarrier && !defHasBall) {
            const distToCarrier = dist(p.pos, offCarrier.pos);
            let target: Pos;

            if (distToCarrier < 0.22) {
              target = offCarrier.pos;
            } else {
              // Intercept position
              const interceptX = clamp(offCarrier.pos.x, p.homePos.x - 0.15, p.homePos.x + 0.15);
              const interceptY = Math.min(p.homePos.y + 0.05, offCarrier.pos.y - 0.06);
              target = { x: interceptX, y: interceptY };
            }
            const maxSpd = distToCarrier < 0.22 ? 0.008 * defSpd : 0.006 * defSpd;
            const s = steer(p.pos, p.vel, target, maxSpd, ACCEL * defSpd);
            p.pos = s.pos; p.vel = s.vel;

            if (dist(p.pos, offCarrier.pos) > 0.18) {
              p.pos.y = clamp(p.pos.y, 0.04, 0.58);
            }
          } else if (!defHasBall) {
            const s = steer(p.pos, p.vel, p.homePos, 0.005, ACCEL * 0.5);
            p.pos = s.pos; p.vel = s.vel;
          }
        }

        p.pos.x = clamp(p.pos.x, 0.04, 0.96);
        if (p.isGK) {
          // GK stays on their line
        } else if (p.team === "offense") {
          // Offense can never go into their own goal (bottom)
          p.pos.y = clamp(p.pos.y, 0.04, 0.88);
        } else {
          // Defense can never go into their own goal (top)
          p.pos.y = clamp(p.pos.y, 0.12, 0.96);
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
            break;
          }
        }
      }

      // GK save — goalkeeper intercepts a shot near the goal
      if (ball.free) {
        const gks = pls.filter(p => p.isGK);
        for (const gk of gks) {
          if (dist(gk.pos, ball.pos) < 0.06) {
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
              const outfield = pls.filter(p => p.team === "offense" && !p.isGK && !p.tackled);
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

      // Free ball arrives at target — check if a player can collect
      if (!ball.free) {
        // Check goal conditions
        if (ball.pos.y < 0.04 && ball.pos.x > GOAL_X_MIN && ball.pos.x < GOAL_X_MAX) {
          roundResultRef.current = "win";
          playersRef.current = pls; ballRef.current = ball;
          setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
          return;
        }
        if (ball.pos.y > 0.96 && ball.pos.x > GOAL_X_MIN && ball.pos.x < GOAL_X_MAX) {
          roundResultRef.current = "lose";
          playersRef.current = pls; ballRef.current = ball;
          setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
          return;
        }
      }
      // Free ball hits goal
      if (ball.free && ball.pos.y < 0.04 && ball.pos.x > GOAL_X_MIN && ball.pos.x < GOAL_X_MAX) {
        ball.free = false;
        roundResultRef.current = "win";
        playersRef.current = pls; ballRef.current = ball;
        setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
        return;
      }
      if (ball.free && ball.pos.y > 0.96 && ball.pos.x > GOAL_X_MIN && ball.pos.x < GOAL_X_MAX) {
        ball.free = false;
        roundResultRef.current = "lose";
        playersRef.current = pls; ballRef.current = ball;
        setPlayers([...pls]); setBallPos({ ...ball.pos }); setBallFree(false);
        return;
      }

      // Timeout force — last 25 ticks, ensure the RIGHT team scores the RIGHT goal
      if (tickCountRef.current >= ROUND_TICKS - 25) {
        if (willWin) {
          // Make sure offense has the ball and rushes to TOP goal
          let c = pls.find(p => p.team === "offense" && p.hasBall && !p.tackled && !p.isGK);
          if (!c && !ball.free) {
            // Force give ball to an attacker
            const any = pls.find(p => p.team === "offense" && !p.isGK && !p.tackled);
            if (any) {
              // Clear all possession first
              for (const pp of pls) { pp.hasBall = false; pp.hasDefBall = false; }
              any.hasBall = true;
              c = any;
            }
          }
          if (c && !ball.free) {
            c.pos.y -= 0.03;
            c.pos.x += (0.5 - c.pos.x) * 0.12;
            c.pos.y = Math.max(c.pos.y, 0.02);
            ball.pos = { x: c.pos.x, y: c.pos.y };
          }
        } else {
          // Make sure defense has the ball and rushes to BOTTOM goal
          let dc = pls.find(p => p.team === "defense" && p.hasDefBall && !p.isGK);
          if (!dc && !ball.free) {
            // Force give ball to a defender
            const any = pls.find(p => p.team === "defense" && !p.isGK);
            if (any) {
              for (const pp of pls) { pp.hasBall = false; pp.hasDefBall = false; }
              any.hasDefBall = true;
              any.pos.y = Math.max(any.pos.y, 0.55); // move them to offense half
              dc = any;
            }
          }
          if (dc && !ball.free) {
            dc.pos.y += 0.03;
            dc.pos.x += (0.5 - dc.pos.x) * 0.12;
            dc.pos.y = Math.min(dc.pos.y, 0.98);
            ball.pos = { x: dc.pos.x, y: dc.pos.y };
          }
        }
      }

      if (tickCountRef.current >= ROUND_TICKS + 10) {
        roundResultRef.current = willWin ? "win" : "lose";
        // Place ball in correct goal
        if (willWin) {
          ball.pos = { x: 0.5, y: 0.02 };
        } else {
          ball.pos = { x: 0.5, y: 0.98 };
        }
        ballRef.current = ball;
        setBallPos({ ...ball.pos }); setBallFree(false);
        return;
      }

      playersRef.current = pls;
      ballRef.current = ball;
      setPlayers([...pls]);
      setBallPos({ ...ball.pos });
      setBallFree(ball.free);
    };

    tickRef.current = setInterval(tick, TICK_MS);
  }, [bet, offenseCount, defenseCount, resetField]);

  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
    };
  }, []);

  // Show team picker if no teams selected
  if (!gameStarted) {
    return (
      <TeamPicker onStart={(off, def) => {
        audioRef.current?.unlock();
        setOffenseTeam(off);
        setDefenseTeam(def);
        setGameStarted(true);
        setTimeout(() => audioRef.current?.startBgMusic(), 200);
      }} />
    );
  }

  return (
    <>
      <div className="app">
        {/* Header — same as Limbo */}
        <div className="header">
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
        <div className="field-area">
          <div className={`football-field${goalFlash ? " goal-active" : ""}`}>
            {/* Goal frames sit outside the clipping area */}
            <div className={`goal-frame top${goalFlash && ballPos.y < 0.1 ? " scored" : ""}`}>
              <div className="goal-net-mesh" />
              <div className="goal-post left" />
              <div className="goal-post right" />
              <div className="goal-crossbar" />
            </div>
            <div className={`goal-frame bottom${goalFlash && ballPos.y > 0.9 ? " scored" : ""}`}>
              <div className="goal-net-mesh" />
              <div className="goal-post left" />
              <div className="goal-post right" />
              <div className="goal-crossbar" />
            </div>
            {/* Field content clips inside the green area */}
            <div className="field-clip">
              <div className="field-stripes" />
              <div className="center-line" />
              <div className="center-circle" />
              <div className="center-dot" />
              <div className="penalty-area top" />
              <div className="penalty-area bottom" />
              <div className="goal-area top" />
              <div className="goal-area bottom" />
            </div>

            {mounted && players.map(p => {
              const team = p.team === "offense" ? offenseTeam : defenseTeam;
              const bg = p.isGK
                ? (p.team === "offense" ? team?.secondaryColor : team?.secondaryColor)
                : team?.primaryColor;
              const txt = p.isGK
                ? (p.team === "offense" ? team?.primaryColor : team?.primaryColor)
                : team?.secondaryColor;
              return (
                <div
                  key={p.id}
                  className={`player ${p.team}${p.isGK ? " gk" : ""}${p.hasBall || p.hasDefBall ? " has-ball" : ""}${p.tackled ? " tackled" : ""}`}
                  style={{
                    left: `calc(${p.pos.x * 100}% - ${PLAYER_R}px)`,
                    top: `calc(${p.pos.y * 100}% - ${PLAYER_R}px)`,
                    background: `linear-gradient(135deg, ${bg}, ${bg}dd)`,
                    color: txt,
                    borderColor: `${txt}66`,
                  }}
                >
                  {p.isGK ? "GK" : p.id + 1}
                </div>
              );
            })}

            {mounted && <div
              className={`ball-wrap${playing ? " rolling" : ""}${ballFree ? " flying" : ""}`}
              style={{
                left: `calc(${ballPos.x * 100}% - 8px)`,
                top: `calc(${ballPos.y * 100}% - 8px)`,
              }}
            >
              <svg className="ball-inner" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="15" fill="#f5f5f0" stroke="#222" strokeWidth="1"/>
                <circle cx="16" cy="16" r="15" fill="url(#ballShade)"/>
                <polygon points="16,6 19.5,9.5 18,14 14,14 12.5,9.5" fill="#333" stroke="#222" strokeWidth="0.5"/>
                <polygon points="24,12 26,16 23.5,19.5 20,18 20,14" fill="#333" stroke="#222" strokeWidth="0.5"/>
                <polygon points="22,24 18,26.5 14,26.5 10,24 12,20" fill="#333" stroke="#222" strokeWidth="0.5"/>
                <polygon points="6,16 8,12 12,14 12,18 8.5,19.5" fill="#333" stroke="#222" strokeWidth="0.5"/>
                <polygon points="20,18 23.5,19.5 22,24 18,22" fill="#444" stroke="#222" strokeWidth="0.3"/>
                <polygon points="12,18 8.5,19.5 10,24 14,22" fill="#444" stroke="#222" strokeWidth="0.3"/>
                <defs>
                  <radialGradient id="ballShade" cx="0.35" cy="0.3" r="0.65">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.3)"/>
                    <stop offset="100%" stopColor="rgba(0,0,0,0.15)"/>
                  </radialGradient>
                </defs>
              </svg>
            </div>}

            {goalFlash && <div className="goal-flash" />}
            {goalText && <div className="goal-text">{goalText}</div>}

            {tackleFlashes.map(tf => (
              <div
                key={tf.id}
                className="tackle-flash"
                style={{ left: `${tf.pos.x * 100}%`, top: `${tf.pos.y * 100}%` }}
              />
            ))}

            {showPayout && <div className="payout-float">{showPayout}</div>}

            {roundResult && !playing && (
              <div className="match-overlay" onClick={dismissOverlay}>
                <div className="match-overlay-mult" style={{
                  color: roundResult === "win" ? "#10e676" : "#ED4163",
                }}>
                  {roundResult === "win" ? `${resultMult.toFixed(2)}x` : "0.00x"}
                </div>
                <div className="match-overlay-score" style={{
                  color: roundResult === "win" ? "#10e676" : "#ED4163",
                }}>
                  {roundResult === "win"
                    ? `$${fmt(resultBet * resultMult)}`
                    : `$${fmt(resultBet)}`}
                </div>
                <div className="match-overlay-tap">Tap to continue</div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="controls">
          <div className="stats-row">
            <div className="stat-pill">
              <span className="s-label">Multiplier</span>
              <span className="s-val accent">{multiplier.toFixed(2)}x</span>
            </div>
            <div className="stat-pill">
              <span className="s-label">Win Chance</span>
              <span className="s-val green">{winChance}%</span>
            </div>
            <div className="stat-pill">
              <span className="s-label">Payout</span>
              <span className="s-val green">${fmt(parseFloat(bet || "0") * multiplier)}</span>
            </div>
          </div>

          {/* Formation +/- row — independent */}
          <div className="ctrl-row">
            <div className="ctrl-col" style={{ flex: 1 }}>
              <span className="ctrl-label">Offense</span>
              <div className="counter-control">
                <button className="counter-btn minus" onClick={() => adjustCount("offense", -1)} disabled={playing || offenseCount <= MIN_PLAYERS}>-</button>
                <span className="counter-value off-c">{offenseCount}</span>
                <button className="counter-btn plus" onClick={() => adjustCount("offense", 1)} disabled={playing || offenseCount >= MAX_PLAYERS}>+</button>
              </div>
              <span className="counter-badge offense">Attackers</span>
            </div>
            <div className="ctrl-col" style={{ flex: 1 }}>
              <span className="ctrl-label">Defense</span>
              <div className="counter-control">
                <button className="counter-btn minus" onClick={() => adjustCount("defense", -1)} disabled={playing || defenseCount <= MIN_PLAYERS}>-</button>
                <span className="counter-value def-c">{defenseCount}</span>
                <button className="counter-btn plus" onClick={() => adjustCount("defense", 1)} disabled={playing || defenseCount >= MAX_PLAYERS}>+</button>
              </div>
              <span className="counter-badge defense">Defenders</span>
            </div>
          </div>

          <div className="ctrl-row">
            <div className="ctrl-col" style={{ flex: 1 }}>
              <span className="ctrl-label">Bet Amount</span>
              <div className="bet-input-row">
                <span className="currency">$</span>
                <input
                  type="number"
                  value={bet}
                  onChange={e => setBet(e.target.value)}
                  disabled={playing}
                  min={MIN_BET}
                  max={MAX_BET}
                  step="0.01"
                />
                <div className="chips">
                  <button className="chip" onClick={() => setBet(prev => Math.max(MIN_BET, parseFloat(prev) / 2).toFixed(2))} disabled={playing}>&#xBD;</button>
                  <button className="chip" onClick={() => setBet(prev => Math.min(balanceRef.current, MAX_BET, parseFloat(prev) * 2).toFixed(2))} disabled={playing}>2x</button>
                  <button className="chip" onClick={() => setBet(Math.min(balanceRef.current, MAX_BET).toFixed(2))} disabled={playing}>Max</button>
                </div>
              </div>
            </div>
          </div>

          <button className="play-btn" onClick={playRound} disabled={playing}>
            {playing ? "ATTACKING..." : "KICK OFF"}
          </button>
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
