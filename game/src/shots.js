// The screenshot scenes behind ?shot=start|play|storm|end. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by an autopilot that looks ahead in every direction and takes the
// one it survives longest (breaking ties toward the nearest star), so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.
import { BOLT, CRANE, FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const STORM_SECONDS = 58;
const END_LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;
// The play and storm pilots look well ahead; the end pilot barely looks,
// so it is caught out once the storm speeds up, as a hurried player is.
const HORIZON_PLAY = 0.9;
const HORIZON_END = 0.15;
const PLANE_SPEED = 330;
const HIT_R = 13;
const DIRECTIONS = [
  [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Seconds until steering in (dx, dy) runs the plane into a hazard. */
function timeToHit(state, dx, dy, horizon) {
  const p = state.player;
  const len = Math.hypot(dx, dy) || 1;
  const vx = (dx / len) * PLANE_SPEED;
  const vy = (dy / len) * PLANE_SPEED;
  for (let t = SAMPLE; t <= horizon; t += SAMPLE) {
    const x = Math.max(24, Math.min(FIELD.width - 24, p.x + vx * t));
    const y = Math.max(20, Math.min(FIELD.height - 20, p.y + vy * t));
    for (const h of state.hazards) {
      if (!h.active) continue;
      if (h.kind === 0) {
        const hx = h.x + h.vx * t;
        const nx = Math.max(hx - h.w / 2, Math.min(x, hx + h.w / 2));
        const ny = Math.max(h.y, Math.min(y, h.y + h.h));
        const ddx = x - nx;
        const ddy = y - ny;
        if (ddx * ddx + ddy * ddy < HIT_R * HIT_R) return t;
      } else if (h.kind === 1) {
        const hx = h.x + h.vx * t;
        const hy = h.baseY + Math.sin(h.phase + t * CRANE.bobFrequency * Math.PI * 2) * CRANE.bobAmplitude;
        const ddx = x - hx;
        const ddy = y - hy;
        if (ddx * ddx + ddy * ddy < 28 * 28) return t;
      } else {
        // A bolt strikes from h.t seconds from now until strikeTime later.
        const strikeStart = Math.max(0, h.t);
        const strikeEnd = h.t + BOLT.strikeTime;
        if (t >= strikeStart && t <= strikeEnd && Math.abs(x - h.x) < BOLT.width / 2 + HIT_R) return t;
      }
    }
  }
  return Infinity;
}

function autopilot(state, skill) {
  const p = state.player;
  const horizon = skill > 0.5 ? HORIZON_PLAY : HORIZON_END;
  let nearestStar = null;
  let nearestStarD2 = Infinity;
  for (const pk of state.pickups) {
    if (!pk.active || pk.kind !== 0) continue;
    const dx = pk.x - p.x;
    const dy = pk.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestStarD2) {
      nearestStarD2 = d2;
      nearestStar = pk;
    }
  }
  const starDir = nearestStar === null || skill <= 0.5
    ? null
    : { x: nearestStar.x - p.x, y: nearestStar.y - p.y };
  if (starDir !== null) {
    const len = Math.hypot(starDir.x, starDir.y) || 1;
    starDir.x /= len;
    starDir.y /= len;
  }

  let best = DIRECTIONS[0];
  let bestTime = -1;
  let bestAlign = -Infinity;
  for (const [dx, dy] of DIRECTIONS) {
    const time = timeToHit(state, dx, dy, horizon);
    const len = Math.hypot(dx, dy) || 1;
    const align = starDir === null ? 0 : (dx / len) * starDir.x + (dy / len) * starDir.y;
    if (time > bestTime + 0.05 || (time >= bestTime - 0.05 && align > bestAlign)) {
      best = [dx, dy];
      bestTime = time;
      bestAlign = align;
    }
  }
  const len = Math.hypot(best[0], best[1]) || 1;
  return { x: best[0] / len, y: best[1] / len, dash: false };
}

function playFor(world, seconds, skill) {
  for (let i = 0; i < seconds / STEP; i += 1) {
    const control = autopilot(world.state, skill);
    if (world.step(STEP, control) & EVENT_OVER) return true;
  }
  return world.state.over;
}

/**
 * Set `world` to the named scene (start, play, storm or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'storm' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0, dash: false }, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    const over = playFor(world, PLAY_SECONDS, 1);
    return { screen: world.state.won ? SCREEN_WIN : over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'storm') {
    const over = playFor(world, STORM_SECONDS, 1);
    return { screen: world.state.won ? SCREEN_WIN : over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  const over = playFor(world, END_LIMIT_SECONDS, 0.35);
  return { screen: world.state.won ? SCREEN_WIN : over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
