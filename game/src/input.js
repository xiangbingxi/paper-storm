// Keyboard and mouse, read fresh every frame. Arrow keys or WASD steer;
// Space (or a mouse click) dashes; Enter confirms; P pauses; M mutes.
// The mouse also steers: move the pointer and the plane chases it, until the
// keys take over again.
export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_DASH = 'dash';

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'dash',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
};

export function createInput(canvas) {
  const held = { left: false, right: false, up: false, down: false };
  const pressed = new Set();
  let mouse = { x: 0, y: 0, active: false, age: Infinity };
  let dashQueued = false;

  function onKeyDown(event) {
    const action = KEYMAP[event.code];
    if (action === undefined) return;
    event.preventDefault();
    if (action === 'dash') {
      if (!event.repeat) dashQueued = true;
      held.dash = true;
      return;
    }
    if (event.repeat) return;
    if (action === 'confirm' || action === 'pause' || action === 'mute') {
      pressed.add(action);
      return;
    }
    held[action] = true;
  }

  function onKeyUp(event) {
    const action = KEYMAP[event.code];
    if (action === undefined || action === 'dash') {
      if (action === 'dash') held.dash = false;
      return;
    }
    if (action in held) held[action] = false;
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, active: true, age: 0 };
  }

  function onPointerDown(event) {
    onPointerMove(event);
    dashQueued = true;
    pressed.add(ACTION_CONFIRM);
  }

  function onBlur() {
    held.left = held.right = held.up = held.down = false;
    held.dash = false;
    mouse.active = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** -1/0/1 on each axis from the keys held this frame. */
    steer() {
      return {
        x: (held.right ? 1 : 0) - (held.left ? 1 : 0),
        y: (held.down ? 1 : 0) - (held.up ? 1 : 0),
      };
    },
    /** The pointer's position in canvas pixels, when it steered recently. */
    pointer() {
      return mouse;
    },
    /** True once when Space or a click asked for a dash; consumes the ask. */
    takeDash() {
      const asked = dashQueued;
      dashQueued = false;
      return asked;
    },
    /** True once when Enter or a click confirmed; consumes the press. */
    takeConfirm() {
      return take(pressed, ACTION_CONFIRM);
    },
    takePause() {
      return take(pressed, ACTION_PAUSE);
    },
    takeMute() {
      return take(pressed, ACTION_MUTE);
    },
    /** Age the pointer so the keys win back steering after it idles. */
    tick(dt) {
      mouse.age += dt;
      if (mouse.age > 2) mouse.active = false;
    },
  };
}

function take(pressed, action) {
  if (!pressed.has(action)) return false;
  pressed.delete(action);
  return true;
}
