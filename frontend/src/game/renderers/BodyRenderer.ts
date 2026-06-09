/**
 * Solar Explorer — procedural body renderer.
 *
 * Draws every celestial body and spacecraft programmatically onto a 2D canvas
 * context. No external image assets are used. The same routines drive both the
 * in-scene textures and the Info modal preview.
 */
import { BodyType, SPACECRAFT_RADIUS_PX } from '../../constants/constants';

/** A simple RGB color tuple helper. */
type Hex = string;

/** Visual style descriptor resolved for a body. */
export interface BodyVisual {
  readonly style:
    | 'star'
    | 'rocky'
    | 'earth'
    | 'gas'
    | 'ringed'
    | 'dwarf'
    | 'asteroid'
    | 'comet';
  readonly base: Hex;
  readonly accent: Hex;
}

/** Per-id base/accent colors; falls back to a per-type default. */
const BODY_COLORS: Record<string, { base: Hex; accent: Hex }> = {
  sun: { base: '#ffd34d', accent: '#ff8a1e' },
  mercury: { base: '#8c8278', accent: '#5c544c' },
  venus: { base: '#d9a441', accent: '#b07d2a' },
  earth: { base: '#2b6fb3', accent: '#3da35d' },
  mars: { base: '#b5532e', accent: '#7a3219' },
  jupiter: { base: '#caa472', accent: '#9c6b42' },
  saturn: { base: '#d8c08a', accent: '#a98a4f' },
  uranus: { base: '#9fd6d9', accent: '#6fb3b8' },
  neptune: { base: '#3a64c8', accent: '#27408a' },
  moon: { base: '#9a9a9a', accent: '#6a6a6a' },
  io: { base: '#d8cf6a', accent: '#a89a3a' },
  europa: { base: '#cdb79a', accent: '#9c876a' },
  titan: { base: '#c98f3a', accent: '#94621f' },
  triton: { base: '#bcd0d6', accent: '#88a3ab' },
};

const TYPE_DEFAULTS: Record<string, { base: Hex; accent: Hex }> = {
  [BodyType.STAR]: { base: '#ffd34d', accent: '#ff8a1e' },
  [BodyType.PLANET]: { base: '#9a8f80', accent: '#5c5247' },
  [BodyType.DWARF_PLANET]: { base: '#a89384', accent: '#6f5d50' },
  [BodyType.MOON]: { base: '#9a9a9a', accent: '#6a6a6a' },
  [BodyType.ASTEROID]: { base: '#6f6256', accent: '#403830' },
  [BodyType.COMET]: { base: '#9fb6c4', accent: '#5d7a88' },
};

/** Gas-giant ids that render as horizontal bands. */
const GAS_GIANT_IDS = new Set(['jupiter', 'saturn', 'uranus', 'neptune']);
const RINGED_IDS = new Set(['saturn']);

/** Resolve the visual style descriptor for a body. */
export function resolveBodyVisual(id: string, type: string): BodyVisual {
  const colors = BODY_COLORS[id] ?? TYPE_DEFAULTS[type] ?? TYPE_DEFAULTS[BodyType.PLANET];
  let style: BodyVisual['style'];
  if (type === BodyType.STAR) style = 'star';
  else if (id === 'earth') style = 'earth';
  else if (RINGED_IDS.has(id)) style = 'ringed';
  else if (GAS_GIANT_IDS.has(id)) style = 'gas';
  else if (type === BodyType.DWARF_PLANET) style = 'dwarf';
  else if (type === BodyType.ASTEROID) style = 'asteroid';
  else if (type === BodyType.COMET) style = 'comet';
  else style = 'rocky';
  return { style, base: colors.base, accent: colors.accent };
}

/** Deterministic pseudo-random generator seeded by a string. */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clipCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
}

function drawCraters(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  accent: Hex,
  seed: string,
): void {
  const rand = seeded(seed);
  const count = Math.max(4, Math.floor(r / 6));
  ctx.fillStyle = accent;
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.8;
    const cr = r * (0.06 + rand() * 0.12);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, cr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw a celestial body centered at (cx, cy) with the given radius.
 */
export function drawCelestialBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  id: string,
  visual: BodyVisual,
): void {
  ctx.save();

  if (visual.style === 'star') {
    const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    glow.addColorStop(0, '#fff3b0');
    glow.addColorStop(0.5, visual.base);
    glow.addColorStop(1, visual.accent);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (visual.style === 'ringed') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.3);
    ctx.strokeStyle = visual.accent;
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.8, r * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Base sphere with a soft shaded gradient.
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  grad.addColorStop(0, visual.base);
  grad.addColorStop(1, visual.accent);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  clipCircle(ctx, cx, cy, r);
  switch (visual.style) {
    case 'gas': {
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        ctx.globalAlpha = i % 2 === 0 ? 0.18 : 0.0;
        ctx.fillStyle = visual.accent;
        const y = cy - r + (i / bands) * 2 * r;
        ctx.fillRect(cx - r, y, 2 * r, (2 * r) / bands);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'earth': {
      const rand = seeded(id);
      ctx.fillStyle = visual.accent;
      for (let i = 0; i < 7; i++) {
        const a = rand() * Math.PI * 2;
        const d = rand() * r * 0.7;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * (0.12 + rand() * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
      // Polar caps.
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#f2f6fa';
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.95, r * 0.5, 0, Math.PI * 2);
      ctx.arc(cx, cy + r * 0.95, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'rocky':
    case 'dwarf':
      drawCraters(ctx, cx, cy, r, visual.accent, id);
      break;
    default:
      break;
  }
  ctx.restore();

  ctx.restore();
}

/** Draw an irregular asteroid / comet shape (with a tail for comets). */
export function drawSmallBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  id: string,
  visual: BodyVisual,
): void {
  ctx.save();
  if (visual.style === 'comet') {
    const tail = ctx.createLinearGradient(cx, cy, cx + r * 4, cy);
    tail.addColorStop(0, 'rgba(180,220,235,0.7)');
    tail.addColorStop(1, 'rgba(180,220,235,0)');
    ctx.fillStyle = tail;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.6);
    ctx.lineTo(cx + r * 4, cy);
    ctx.lineTo(cx, cy + r * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  const rand = seeded(id);
  const points = 9;
  ctx.fillStyle = visual.base;
  ctx.beginPath();
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const rr = r * (0.7 + rand() * 0.5);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a schematic spacecraft icon (central body + solar panels) centered at
 * (cx, cy). Size defaults to the fixed illustrative radius.
 */
export function drawSpacecraftIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accent: Hex,
  size: number = SPACECRAFT_RADIUS_PX,
): void {
  ctx.save();
  ctx.fillStyle = accent;
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(1, size * 0.3);
  // Solar panels.
  ctx.fillRect(cx - size * 2.2, cy - size * 0.6, size * 1.4, size * 1.2);
  ctx.fillRect(cx + size * 0.8, cy - size * 0.6, size * 1.4, size * 1.2);
  // Connecting beam.
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.8, cy);
  ctx.lineTo(cx + size * 0.8, cy);
  ctx.stroke();
  // Central body.
  ctx.fillStyle = '#e9f2ef';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
