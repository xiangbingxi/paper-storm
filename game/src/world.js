// Paper Storm's rules and state, with no drawing and no browser in it: the
// paper plane, the storm's hazards, the pickups, the score, lives and
// levels. step() advances one fixed step and returns what happened as bit
// flags, so the caller can react (sounds, screens) without the world
// knowing about them. Nothing here allocates after createWorld returns:
// hazards, pickups and particles live in fixed pools.
import {
  BOAT, BOLT, CLOUD, COMBO_MAX, COMBO_WINDOW, CRANE, DISTANCE_POINT_EVERY,
  FIELD, LEVEL_SECONDS, LIVES, MAX_LIVES, PLANE, POOL, RING, STAR,
  WIN_SECONDS,
} from './config.js';
import { range } from './random.js';

export const EVENT_HIT = 1;
export const EVENT_STAR = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_LEVEL = 16;
export const EVENT_RING = 32;
export const EVENT_BOAT = 64;
export const EVENT_BOLT = 128;

const KIND_CLOUD = 0;
const KIND_CRANE = 1;
const KIND_BOLT = 2;
const KIND_STAR = 0;
const KIND_BOAT = 1;
const KIND_RING = 2;

function circleHitsRect(cx, cy, r, rx, ry, rw, rh) {
  const nx = Math.max(rx, Math.min(cx, rx + rw));
  const ny = Math.max(ry, Math.min(cy, ry + rh));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

export function createWorld(random) {
  const player = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    invulnerable: 0, dashT: 0, dashCd: 0,
  };
  const hazards = [];
  for (let i = 0; i < POOL.hazards; i += 1) {
    hazards.push({ active: false, kind: KIND_CLOUD, x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, phase: 0, baseY: 0, t: 0 });
  }
  const pickups = [];
  for (let i = 0; i < POOL.pickups; i += 1) {
    pickups.push({ active: false, kind: KIND_STAR, x: 0, y: 0, vx: 0, phase: 0 });
  }
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#ffffff', spin: 0, angle: 0 });
  }
  const state = {
    player, hazards, pickups, particles,
    score: 0, lives: LIVES, level: 1, elapsed: 0,
    combo: 1, comboTimer: 0, won: false, wonAck: false, over: false,
    shake: 0, flash: 0, distanceAcc: 0,
    cloudTimer: 1.2, craneTimer: 2.2, boltTimer: 5, starTimer: 0.6, boatTimer: 14, ringTimer: 6,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const a = random() * Math.PI * 2;
      const s = range(random, speed * 0.3, speed);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - 30;
      p.maxLife = range(random, 0.4, 0.9);
      p.life = p.maxLife;
      p.size = range(random, 2, 6);
      p.color = color;
      p.spin = range(random, -6, 6);
      p.angle = random() * Math.PI * 2;
    }
  }

  function reset() {
    player.x = 170;
    player.y = FIELD.height / 2;
    player.vx = 0;
    player.vy = 0;
    player.angle = 0;
    player.invulnerable = 0;
    player.dashT = 0;
    player.dashCd = 0;
    for (const h of hazards) h.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.combo = 1;
    state.comboTimer = 0;
    state.won = false;
    state.wonAck = false;
    state.over = false;
    state.shake = 0;
    state.flash = 0;
    state.distanceAcc = 0;
    state.cloudTimer = 1.2;
    state.craneTimer = 2.2;
    state.boltTimer = 5;
    state.starTimer = 0.6;
    state.boatTimer = 14;
    state.ringTimer = 6;
  }

  function levelInterval(base, perLevel, min) {
    return Math.max(min, base - (state.level - 1) * perLevel);
  }

  function spawnCloud() {
    const h = free(hazards);
    if (h === null) return;
    h.active = true;
    h.kind = KIND_CLOUD;
    h.w = range(random, CLOUD.minWidth, CLOUD.maxWidth);
    h.h = CLOUD.height;
    h.x = FIELD.width + h.w / 2;
    h.y = range(random, 30, FIELD.height - CLOUD.height - 60);
    h.vx = -(CLOUD.baseSpeed + (state.level - 1) * CLOUD.speedPerLevel + random() * 25);
    h.vy = 0;
    h.phase = random() * Math.PI * 2;
  }

  function spawnCrane() {
    const h = free(hazards);
    if (h === null) return;
    h.active = true;
    h.kind = KIND_CRANE;
    h.w = CRANE.width;
    h.h = CRANE.height;
    h.x = FIELD.width + 30;
    h.baseY = range(random, 70, FIELD.height - 70);
    h.y = h.baseY;
    h.vx = -(CRANE.baseSpeed + (state.level - 1) * CRANE.speedPerLevel + random() * 40);
    h.vy = 0;
    h.phase = random() * Math.PI * 2;
  }

  function spawnBolt() {
    const h = free(hazards);
    if (h === null) return;
    h.active = true;
    h.kind = KIND_BOLT;
    h.x = range(random, 90, FIELD.width - 90);
    h.y = 0;
    h.w = BOLT.width;
    h.h = FIELD.height;
    h.vx = 0;
    h.vy = 0;
    h.phase = 0;
    h.t = BOLT.warnTime;
  }

  function spawnStar() {
    const p = free(pickups);
    if (p === null) return;
    p.active = true;
    p.kind = KIND_STAR;
    p.x = FIELD.width + 20;
    p.y = range(random, 50, FIELD.height - 50);
    p.vx = -STAR.baseSpeed;
    p.phase = random() * Math.PI * 2;
  }

  function spawnBoat() {
    const p = free(pickups);
    if (p === null) return;
    p.active = true;
    p.kind = KIND_BOAT;
    p.x = FIELD.width + 20;
    p.y = range(random, 120, FIELD.height - 120);
    p.vx = -55;
    p.phase = 0;
  }

  function spawnRing() {
    const p = free(pickups);
    if (p === null) return;
    p.active = true;
    p.kind = KIND_RING;
    p.x = FIELD.width + 40;
    p.y = range(random, 90, FIELD.height - 90);
    p.vx = -80;
    p.phase = 0;
  }

  function hitPlayer() {
    state.lives -= 1;
    state.combo = 1;
    state.comboTimer = 0;
    player.invulnerable = 1.6;
    state.shake = 1;
    state.flash = 1;
    burst(player.x, player.y, '#ffffff', 22, 260);
    burst(player.x, player.y, '#ff5d5d', 12, 180);
    if (state.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  // step(dt, control, attract): attract runs the storm behind the title
  // screen — hazards and pickups move, but nothing can hurt or reward.
  function step(dt, control, attract = false) {
    if (state.over || state.won) return 0;
    let events = 0;
    state.elapsed += dt;

    const level = 1 + Math.floor(state.elapsed / LEVEL_SECONDS);
    if (level !== state.level) {
      state.level = level;
      events |= EVENT_LEVEL;
    }
    if (!state.wonAck && !attract && state.elapsed >= WIN_SECONDS) {
      state.won = true;
      state.wonAck = true;
      return events | EVENT_WIN;
    }

    state.distanceAcc += dt;
    if (state.distanceAcc >= DISTANCE_POINT_EVERY) {
      state.distanceAcc -= DISTANCE_POINT_EVERY;
      state.score += 1;
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 1;
    }
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.dashCd > 0) player.dashCd -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.5);

    // Steering: accelerate toward the wanted velocity, drag when idle.
    const maxSpeed = PLANE.maxSpeed + Math.min(60, (state.level - 1) * 8);
    const tx = control.x * maxSpeed;
    const ty = control.y * maxSpeed;
    player.vx += (tx - player.vx) * Math.min(1, PLANE.drag * dt * 2.4);
    player.vy += (ty - player.vy) * Math.min(1, PLANE.drag * dt * 2.4);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed && player.dashT <= 0) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vy = (player.vy / speed) * maxSpeed;
    }

    if (control.dash && player.dashCd <= 0) {
      const dx = player.vx;
      const dy = player.vy;
      const len = Math.hypot(dx, dy) || 1;
      const dirX = speed > 40 ? dx / len : 1;
      const dirY = speed > 40 ? dy / len : 0;
      player.vx = dirX * PLANE.dashSpeed;
      player.vy = dirY * PLANE.dashSpeed;
      player.dashT = PLANE.dashTime;
      player.dashCd = PLANE.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, 0.3);
      burst(player.x, player.y, '#cfe8ff', 8, 120);
    }
    if (player.dashT > 0) player.dashT -= dt;

    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = Math.max(24, Math.min(FIELD.width - 24, player.x));
    player.y = Math.max(20, Math.min(FIELD.height - 20, player.y));
    const targetAngle = Math.max(-0.45, Math.min(0.45, player.vy * 0.0012 + player.vx * 0.0004));
    player.angle += (targetAngle - player.angle) * Math.min(1, dt * 10);

    // Spawning: faster and denser as the level rises.
    state.cloudTimer -= dt;
    if (state.cloudTimer <= 0) {
      state.cloudTimer = levelInterval(CLOUD.interval, CLOUD.intervalPerLevel, 1.1);
      spawnCloud();
      if (random() < 0.2 + state.level * 0.04) spawnCloud();
    }
    state.craneTimer -= dt;
    if (state.craneTimer <= 0) {
      state.craneTimer = levelInterval(CRANE.interval, CRANE.intervalPerLevel, 1.6);
      spawnCrane();
      if (random() < 0.35) spawnCrane();
    }
    state.boltTimer -= dt;
    if (state.boltTimer <= 0 && state.level >= 2) {
      state.boltTimer = levelInterval(BOLT.interval, BOLT.intervalPerLevel, 3.5);
      spawnBolt();
      events |= EVENT_BOLT;
    }
    state.starTimer -= dt;
    if (state.starTimer <= 0) {
      state.starTimer = STAR.interval;
      spawnStar();
    }
    state.boatTimer -= dt;
    if (state.boatTimer <= 0) {
      state.boatTimer = BOAT.interval;
      spawnBoat();
    }
    state.ringTimer -= dt;
    if (state.ringTimer <= 0) {
      state.ringTimer = RING.interval;
      spawnRing();
    }

    // Hazards move and, when armed, hurt. Invulnerability is read live:
    // a hit mid-step shields the plane from the next hazard that same step.
    for (const h of hazards) {
      if (!h.active) continue;
      if (h.kind === KIND_CLOUD) {
        h.x += h.vx * dt;
        h.phase += dt * 1.5;
        if (h.x + h.w / 2 < -20) h.active = false;
        else if (!attract && player.invulnerable <= 0 && circleHitsRect(player.x, player.y, PLANE.hitRadius, h.x - h.w / 2, h.y, h.w, h.h)) {
          events |= hitPlayer();
        }
      } else if (h.kind === KIND_CRANE) {
        h.x += h.vx * dt;
        h.phase += dt * CRANE.bobFrequency * Math.PI * 2;
        h.y = h.baseY + Math.sin(h.phase) * CRANE.bobAmplitude;
        if (h.x < -60) h.active = false;
        else if (!attract && player.invulnerable <= 0) {
          const dx = player.x - h.x;
          const dy = player.y - h.y;
          if (dx * dx + dy * dy < (PLANE.hitRadius + 15) * (PLANE.hitRadius + 15)) events |= hitPlayer();
        }
      } else {
        h.t -= dt;
        if (h.t <= -BOLT.strikeTime) {
          h.active = false;
        } else if (!attract && h.t <= 0 && player.invulnerable <= 0 && Math.abs(player.x - h.x) < BOLT.width / 2 + PLANE.hitRadius) {
          events |= hitPlayer();
        }
      }
      if (state.over) break;
    }

    // Pickups drift left; touching one collects it.
    for (const p of pickups) {
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.phase += dt * 3;
      if (p.x < -40) {
        p.active = false;
        continue;
      }
      if (attract) continue;
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      if (p.kind === KIND_STAR) {
        if (dx * dx + dy * dy < (PLANE.hitRadius + STAR.radius) * (PLANE.hitRadius + STAR.radius)) {
          p.active = false;
          state.score += STAR.points * state.combo;
          state.combo = Math.min(state.combo + 1, COMBO_MAX);
          state.comboTimer = COMBO_WINDOW;
          burst(p.x, p.y, '#ffd23e', 10, 140);
          events |= EVENT_STAR;
        }
      } else if (p.kind === KIND_BOAT) {
        if (dx * dx + dy * dy < (PLANE.hitRadius + 20) * (PLANE.hitRadius + 20)) {
          p.active = false;
          if (state.lives < MAX_LIVES) state.lives += 1;
          else state.score += BOAT.points;
          burst(p.x, p.y, '#ffffff', 14, 160);
          events |= EVENT_BOAT;
        }
      } else if (dx * dx + dy * dy < (PLANE.hitRadius + RING.radius) * (PLANE.hitRadius + RING.radius)) {
        p.active = false;
        player.dashCd = 0;
        state.score += RING.points;
        burst(p.x, p.y, '#7fe3ff', 12, 150);
        events |= EVENT_RING;
      }
    }

    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt;
      p.angle += p.spin * dt;
    }

    return events;
  }

  reset();
  return { state, reset, step };
}
