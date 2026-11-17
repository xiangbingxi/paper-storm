// Paper Storm's painter: one canvas, no images, no fonts fetched. The sky
// is a sunset gradient with a low sun and drifting cloud silhouettes; the
// plane, cranes, clouds, stars and rings are all drawn from paths. Every
// animated effect reads the world's elapsed time, never the wall clock, so
// a screenshot staged from a seed always paints the same frame.
import { BOLT, FIELD, PALETTE, PLANE, RING, STAR } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;
export const SCREEN_WIN = 4;

const TAU = Math.PI * 2;

function starPath(ctx, x, y, r, points, rotation) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = rotation + (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function cloudPuff(ctx, x, y, w, h, color, rim) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.28, w * 0.52, h * 0.42, 0, 0, TAU);
  ctx.ellipse(x - w * 0.3, y + h * 0.32, w * 0.3, h * 0.34, 0, 0, TAU);
  ctx.ellipse(x + w * 0.32, y + h * 0.3, w * 0.32, h * 0.36, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.05, w * 0.5, h * 0.36, 0, Math.PI, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
  let skyGradient = null;
  let vignette = null;
  const trail = [];

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    view = {
      scale: scale * dpr,
      ox: (rect.width * dpr - FIELD.width * scale * dpr) / 2,
      oy: (rect.height * dpr - FIELD.height * scale * dpr) / 2,
      w, h, dpr,
    };
    skyGradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    skyGradient.addColorStop(0, PALETTE.skyTop);
    skyGradient.addColorStop(0.45, PALETTE.skyMid);
    skyGradient.addColorStop(0.75, PALETTE.skyLow);
    skyGradient.addColorStop(1, PALETTE.horizon);
    vignette = ctx.createRadialGradient(
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45,
      FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85,
    );
    vignette.addColorStop(0, 'rgba(20, 10, 40, 0)');
    vignette.addColorStop(1, 'rgba(20, 10, 40, 0.35)');
  }

  function frame(state) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    const shake = state.shake;
    const sx = shake > 0 ? Math.sin(state.elapsed * 91) * shake * 7 : 0;
    const sy = shake > 0 ? Math.cos(state.elapsed * 83) * shake * 7 : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + sx * view.scale, view.oy + sy * view.scale);
  }

  function drawSky(state) {
    ctx.fillStyle = skyGradient;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    // The low sun, with its glow.
    const sunX = FIELD.width - 190;
    const sunY = 118;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 150);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 201, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 46, 0, TAU);
    ctx.fill();
    // Distant cloud silhouettes, drifting with elapsed time.
    ctx.fillStyle = 'rgba(58, 43, 82, 0.55)';
    for (let i = 0; i < 5; i += 1) {
      const baseX = i * 230 + 60;
      const x = ((baseX - state.elapsed * 12) % (FIELD.width + 260) + FIELD.width + 260) % (FIELD.width + 260) - 130;
      const y = 120 + (i % 3) * 46;
      ctx.beginPath();
      ctx.ellipse(x, y, 90, 16, 0, 0, TAU);
      ctx.ellipse(x + 55, y + 6, 60, 12, 0, 0, TAU);
      ctx.fill();
    }
    // Rain: fine diagonal streaks, placed by a hash of their index so the
    // pattern is fixed for a given elapsed time.
    ctx.strokeStyle = 'rgba(220, 225, 255, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 70; i += 1) {
      const hx = (i * 137.5) % FIELD.width;
      const hy = (i * 89.3) % FIELD.height;
      const x = (hx - state.elapsed * 260 + (hy * 0.35)) % FIELD.width;
      const y = (hy + state.elapsed * 340) % FIELD.height;
      const px = x < 0 ? x + FIELD.width : x;
      const py = y < 0 ? y + FIELD.height : y;
      ctx.moveTo(px, py);
      ctx.lineTo(px - 6, py + 14);
    }
    ctx.stroke();
  }

  function drawBoltWarning(hazard, state) {
    const pulse = 0.5 + 0.5 * Math.sin(state.elapsed * 14);
    ctx.strokeStyle = `rgba(255, 215, 90, ${0.35 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(hazard.x, 0);
    ctx.lineTo(hazard.x, FIELD.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 215, 90, ${0.4 + pulse * 0.4})`;
    ctx.beginPath();
    ctx.arc(hazard.x, 26, 10 + pulse * 4, 0, TAU);
    ctx.fill();
  }

  function drawBoltStrike(hazard) {
    ctx.strokeStyle = 'rgba(255, 244, 180, 0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    let x = hazard.x;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= FIELD.height; y += 42) {
      x += ((y * 7919 + hazard.x * 13) % 37) - 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    x = hazard.x;
    ctx.moveTo(x, 0);
    for (let y = 0; y <= FIELD.height; y += 42) {
      x += ((y * 7919 + hazard.x * 13) % 37) - 18;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawCrane(hazard) {
    const flap = Math.sin(hazard.phase) * 0.7;
    ctx.save();
    ctx.translate(hazard.x, hazard.y);
    // Cranes fly right to left, so the folded bird points left.
    ctx.scale(-1, 1);
    ctx.fillStyle = PALETTE.crane;
    // Body: a folded-paper dart pointing left, into the wind.
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-18, -7);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 7);
    ctx.closePath();
    ctx.fill();
    // Wings, flapping.
    ctx.fillStyle = PALETTE.craneShade;
    ctx.save();
    ctx.rotate(-0.5 - flap * 0.5);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-14, -26);
    ctx.lineTo(-2, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.rotate(0.5 + flap * 0.5);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-14, 26);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawPlane(state) {
    const p = state.player;
    if (p.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0) return;
    // Motion trail: a fading ribbon of where the plane has been.
    trail.push({ x: p.x, y: p.y });
    if (trail.length > 14) trail.shift();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i += 1) {
      const t = trail[i];
      if (i === 0) ctx.moveTo(t.x, t.y);
      else ctx.lineTo(t.x, t.y);
    }
    ctx.stroke();
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // The dart: a long nose, folded wings, a shaded underside.
    ctx.fillStyle = PALETTE.plane;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-18, -9);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-18, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeShade;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-18, 9);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(36, 26, 51, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-8, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      if (p.kind === 0) {
        const tw = 0.75 + 0.25 * Math.sin(p.phase * 2);
        ctx.save();
        ctx.translate(p.x, p.y + Math.sin(p.phase) * 4);
        ctx.rotate(Math.sin(p.phase * 0.5) * 0.3);
        ctx.fillStyle = PALETTE.star;
        ctx.globalAlpha = tw;
        starPath(ctx, 0, 0, STAR.radius, 5, 0);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff3c4';
        starPath(ctx, 0, 0, STAR.radius * 0.45, 5, 0);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 1) {
        ctx.save();
        ctx.translate(p.x, p.y + Math.sin(p.phase) * 3);
        ctx.fillStyle = PALETTE.boat;
        ctx.beginPath();
        ctx.moveTo(-16, 4);
        ctx.lineTo(16, 4);
        ctx.lineTo(10, 12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(0, -14);
        ctx.lineTo(12, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.strokeStyle = PALETTE.ring;
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(0, 0, RING.radius, RING.radius * 0.55, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([8, 10]);
        ctx.lineDashOffset = -state.elapsed * 40;
        ctx.beginPath();
        ctx.ellipse(0, 0, RING.radius - 6, (RING.radius - 6) * 0.55, 0, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
  }

  function drawHud(state, best) {
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.hud;
    ctx.textAlign = 'left';
    ctx.font = '700 34px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(`SCORE ${state.score}`, 22, 44);
    ctx.font = '600 15px system-ui, "Segoe UI", sans-serif';
    ctx.globalAlpha = 0.85;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 22, 68);
    ctx.globalAlpha = 1;
    // Lives: little paper darts, top right.
    for (let i = 0; i < state.lives; i += 1) {
      const x = FIELD.width - 34 - i * 34;
      ctx.save();
      ctx.translate(x, 34);
      ctx.fillStyle = PALETTE.hud;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, -5);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Level and its progress, top centre.
    ctx.textAlign = 'center';
    ctx.font = '700 17px system-ui, "Segoe UI", sans-serif';
    ctx.fillText(`LEVEL ${state.level}`, FIELD.width / 2, 34);
    const progress = (state.elapsed % 30) / 30;
    ctx.fillStyle = 'rgba(255, 247, 232, 0.25)';
    ctx.fillRect(FIELD.width / 2 - 70, 44, 140, 5);
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(FIELD.width / 2 - 70, 44, 140 * progress, 5);
    // Combo, floating by the plane.
    if (state.combo > 1) {
      ctx.font = '800 20px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.star;
      ctx.textAlign = 'center';
      ctx.fillText(`x${state.combo} COMBO`, state.player.x, state.player.y - 34);
    }
    // Dash meter, bottom centre.
    const dashReady = 1 - Math.max(0, state.player.dashCd) / 1.6;
    ctx.textAlign = 'center';
    ctx.font = '600 12px system-ui, "Segoe UI", sans-serif';
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PALETTE.hud;
    ctx.fillText('DASH', FIELD.width / 2, FIELD.height - 34);
    ctx.fillStyle = 'rgba(255, 247, 232, 0.25)';
    ctx.fillRect(FIELD.width / 2 - 60, FIELD.height - 28, 120, 6);
    ctx.fillStyle = dashReady >= 1 ? PALETTE.ring : PALETTE.hud;
    ctx.fillRect(FIELD.width / 2 - 60, FIELD.height - 28, 120 * dashReady, 6);
    ctx.globalAlpha = 1;
  }

  function panel(title, lines, accent) {
    ctx.fillStyle = 'rgba(24, 14, 42, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '800 54px system-ui, "Segoe UI", sans-serif';
    try {
      ctx.letterSpacing = '6px';
    } catch {
      // letterSpacing is Chrome-only; the title reads fine without it.
    }
    ctx.fillText(title, FIELD.width / 2, 178);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // Ignore.
    }
    ctx.fillStyle = PALETTE.hud;
    ctx.font = '500 19px system-ui, "Segoe UI", sans-serif';
    let y = 224;
    for (const line of lines) {
      ctx.fillText(line, FIELD.width / 2, y);
      y += 30;
    }
    return y;
  }

  function draw(state, screen, best) {
    resize();
    frame(state);
    drawSky(state);
    const striking = state.hazards.some((h) => h.active && h.kind === 2 && h.t <= 0);
    if (striking) {
      ctx.fillStyle = 'rgba(255, 246, 200, 0.22)';
      ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    }
    for (const h of state.hazards) {
      if (!h.active) continue;
      if (h.kind === 0) cloudPuff(ctx, h.x, h.y + h.h / 2, h.w, h.h, PALETTE.cloudDark, PALETTE.cloudRim);
      else if (h.kind === 1) drawCrane(h);
      else if (h.t > 0) drawBoltWarning(h, state);
      else drawBoltStrike(h);
    }
    drawPickups(state);
    drawParticles(state);
    drawPlane(state);
    ctx.fillStyle = vignette;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 60, ${state.flash * 0.28})`;
      ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    }

    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state, best);
      if (screen === SCREEN_PAUSED) {
        panel('PAUSED', ['Press P or click to keep flying.'], PALETTE.hud);
      }
      return;
    }
    if (screen === SCREEN_TITLE) {
      const y = panel('PAPER STORM', [
        'A paper plane in a stormy sky.',
        'Steer with arrows, WASD or the mouse. Space or click to dash.',
        'Dodge clouds, cranes and lightning. Catch stars, ride wind rings.',
        'Survive 90 seconds to tame the storm.',
      ], PALETTE.hud);
      ctx.font = '700 21px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.star;
      ctx.fillText('PRESS ENTER OR CLICK TO FLY', FIELD.width / 2, y + 26);
      if (best > 0) {
        ctx.font = '600 16px system-ui, "Segoe UI", sans-serif';
        ctx.fillStyle = PALETTE.hud;
        ctx.fillText(`BEST ${best}`, FIELD.width / 2, y + 56);
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      const isBest = state.score >= best && state.score > 0;
      const y = panel('THE STORM WINS', [
        `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
        `You flew ${Math.floor(state.elapsed)} seconds and reached level ${state.level}.`,
        isBest ? 'A new best — the sky remembers.' : 'The sky keeps your best. Fly again.',
      ], PALETTE.danger);
      ctx.font = '700 21px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.star;
      ctx.fillText('PRESS ENTER TO FLY AGAIN', FIELD.width / 2, y + 26);
      return;
    }
    if (screen === SCREEN_WIN) {
      const y = panel('STORM TAMED!', [
        `You reached the Eye of the Storm in ${Math.floor(state.elapsed)} seconds.`,
        `Score ${state.score}   ·   Best ${Math.max(best, state.score)}`,
        'The paper plane outflew the weather.',
      ], PALETTE.star);
      ctx.font = '700 21px system-ui, "Segoe UI", sans-serif';
      ctx.fillStyle = PALETTE.hud;
      ctx.fillText('ENTER: KEEP FLYING    ·    R: FLY AGAIN', FIELD.width / 2, y + 26);
    }
  }

  return { draw, resize };
}
