// Paper Storm — tuning knobs, all in one place. The field is 960x540 logical
// pixels; the renderer scales it to the window. Times are seconds, speeds are
// pixels per second. Nothing here is read at runtime except through these
// names, so balancing the game means editing this file only.
export const STEP = 1 / 60;
export const FIELD = { width: 960, height: 540 };
export const BEST_KEY = 'paper-storm-best';

// The plane: a paper dart. It steers with acceleration and drag, so it feels
// weighty, and banks into its turns.
export const PLANE = {
  width: 46,
  height: 18,
  accel: 2400,
  drag: 2.6,
  maxSpeed: 350,
  dashSpeed: 720,
  dashTime: 0.22,
  dashCooldown: 1.6,
  hitRadius: 13,
};

export const LIVES = 3;
export const MAX_LIVES = 3;
// Survive this long to reach the Eye and tame the storm (the win).
export const WIN_SECONDS = 90;
// A level every 30 seconds: the storm gets faster and denser.
export const LEVEL_SECONDS = 30;

// Hazards. Clouds drift in from the right; cranes cross with a sine bob;
// lightning is telegraphed: a warning glow, then a strike.
export const CLOUD = {
  minWidth: 90,
  maxWidth: 190,
  height: 54,
  baseSpeed: 55,
  speedPerLevel: 9,
  interval: 2.9,
  intervalPerLevel: 0.16,
};
export const CRANE = {
  width: 44,
  height: 26,
  baseSpeed: 150,
  speedPerLevel: 14,
  interval: 4.2,
  intervalPerLevel: 0.22,
  bobAmplitude: 46,
  bobFrequency: 1.7,
};
export const BOLT = {
  width: 26,
  warnTime: 0.9,
  strikeTime: 0.45,
  interval: 7.0,
  intervalPerLevel: 0.5,
};

// Pickups. Stars feed the combo; a paper boat mends a life (or pays 250
// when the plane is whole); a wind ring refills the dash.
export const STAR = {
  radius: 13,
  baseSpeed: 70,
  interval: 1.5,
  points: 10,
};
export const BOAT = { interval: 26, points: 250 };
export const RING = { radius: 34, interval: 11, points: 50 };

// Combo: stars collected within this window raise the multiplier, up to x5.
// A hit resets it.
export const COMBO_WINDOW = 3;
export const COMBO_MAX = 5;

// Distance score: one point per this many seconds survived.
export const DISTANCE_POINT_EVERY = 0.5;

// Pool sizes: the world allocates these once and reuses them, so a long run
// never grows memory.
export const POOL = { hazards: 48, pickups: 24, particles: 160 };

// Sunset palette: violet dusk above, amber horizon below.
export const PALETTE = {
  skyTop: '#2b1d4e',
  skyMid: '#7a3b6e',
  skyLow: '#e2703a',
  horizon: '#f7b267',
  sun: '#ffd97a',
  sunGlow: 'rgba(255, 201, 110, 0.35)',
  cloudDark: '#3a2b52',
  cloudRim: '#8d6bb0',
  crane: '#fdf6ec',
  craneShade: '#d9c8b8',
  plane: '#ffffff',
  planeShade: '#c9d4e8',
  star: '#ffd23e',
  ring: '#7fe3ff',
  boat: '#fdf6ec',
  ink: '#241a33',
  hud: '#fff7e8',
  danger: '#ff5d5d',
};
