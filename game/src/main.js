// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens:
// title, play, paused, game over and the win screen.
//
// ?seed=N fixes the storm's pattern. ?shot=start|play|storm|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOAT, EVENT_HIT, EVENT_LEVEL, EVENT_OVER, EVENT_RING, EVENT_STAR, EVENT_WIN } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const input = createInput(canvas);

// For play-tests and screenshots: the live state, readable from the page.
window.__game = { world, get screen() { return screen; } };

let screen = SCREEN_TITLE;
let best = readBest();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function announce(message) {
  status.textContent = message;
}

function react(events) {
  if (events & EVENT_STAR) audio.star(world.state.combo);
  if (events & EVENT_RING) audio.ring();
  if (events & EVENT_BOAT) audio.boat();
  if (events & EVENT_HIT) audio.hit();
  if (events & EVENT_LEVEL) {
    audio.levelUp();
    announce(`Level ${world.state.level}. The storm quickens.`);
  }
  if (events & EVENT_WIN) {
    audio.win();
    screen = SCREEN_WIN;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Storm tamed! Score ${world.state.score}.`);
  }
  if (events & EVENT_OVER) {
    audio.over();
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }
}

function startGame() {
  audio.unlock();
  world.reset();
  screen = SCREEN_PLAY;
  announce(`Playing. ${LIVES} lives. Survive 90 seconds to tame the storm.`);
}

function runShot(name) {
  const scene = stageShot(name, world);
  screen = scene.screen;
  best = scene.best;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, screen, best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function controlFromInput() {
  const keys = input.steer();
  const pointer = input.pointer();
  // The mouse steers when it moved recently; the keys override it.
  let x = keys.x;
  let y = keys.y;
  if (pointer.active && keys.x === 0 && keys.y === 0) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 960, rect.height / 540);
    const ox = (rect.width - 960 * scale) / 2;
    const oy = (rect.height - 540 * scale) / 2;
    const px = (pointer.x - ox) / scale;
    const py = (pointer.y - oy) / scale;
    const dx = px - world.state.player.x;
    const dy = py - world.state.player.y;
    const d = Math.hypot(dx, dy);
    if (d > 24) {
      x = Math.max(-1, Math.min(1, dx / 90));
      y = Math.max(-1, Math.min(1, dy / 90));
    }
  }
  return { x, y, dash: input.takeDash() };
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    input.tick(dt);
    audio.setWind(screen === SCREEN_PLAY ? Math.min(1, Math.hypot(world.state.player.vx, world.state.player.vy) / 400) : 0.15);

    if (input.takeMute()) audio.setMuted(!audio.isMuted());

    if (screen === SCREEN_TITLE) {
      if (input.takeConfirm()) {
        startGame();
      } else {
        world.step(dt, { x: 0, y: 0, dash: false }, true);
      }
    } else if (screen === SCREEN_PLAY) {
      if (input.takePause()) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else {
        accumulator += dt;
        while (accumulator >= STEP) {
          accumulator -= STEP;
          react(world.step(STEP, controlFromInput()));
          if (screen !== SCREEN_PLAY) break;
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      if (input.takePause() || input.takeConfirm()) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      if (input.takeConfirm()) startGame();
    } else if (screen === SCREEN_WIN) {
      if (input.takeConfirm()) {
        // Keep flying, endlessly: the win is already banked.
        world.state.won = false;
        screen = SCREEN_PLAY;
        announce('Flying on, past the Eye.');
      }
    }
    // R restarts from the win screen (KeyR is not in the input map, so
    // listen for it here through the key state the loop already reads).
    renderer.draw(world.state, screen, best);
    requestAnimationFrame(frame);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyR' && (screen === SCREEN_WIN || screen === SCREEN_OVER)) {
      startGame();
    }
  });
  requestAnimationFrame(frame);
}

if (shot !== null) runShot(shot);
else runGame();
