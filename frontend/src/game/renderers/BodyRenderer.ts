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
  ceres: { base: '#9a948c', accent: '#5f5a54' },
  pluto: { base: '#cbab86', accent: '#7c5a44' },
  eris: { base: '#dfe3ea', accent: '#a7adba' },
  makemake: { base: '#6e3b2f', accent: '#3a1d17' },
  haumea: { base: '#c8c2ba', accent: '#857f77' },
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

/** One concentric ring in a planetary ring system. */
interface Ring {
  readonly rx: number;
  readonly scaleY: number;
  readonly width: number;
  readonly color: Hex;
  readonly alpha: number;
}

/**
 * Axial tilt (radians) used to orient each gas giant's bands. For ringed
 * bodies it matches the ring tilt so the bands stay parallel to the rings.
 */
const BODY_TILT: Record<string, number> = {
  jupiter: 0.05,
  saturn: -0.42,
  uranus: -1.3,
  neptune: 0.42,
};

/** Light/dark band tones per gas giant (lower contrast = subtler banding). */
const GAS_PALETTE: Record<string, { light: Hex; dark: Hex }> = {
  jupiter: { light: '#e7cda0', dark: '#9c6238' },
  saturn: { light: '#ead4a4', dark: '#bd9c5f' },
  uranus: { light: '#d4eff0', dark: '#a9dadd' },
  neptune: { light: '#5f82d6', dark: '#33579d' },
};

/** Ring system descriptor (tilt + concentric rings) for a given body, or null. */
function ringSystemFor(id: string, r: number): { tilt: number; rings: Ring[] } | null {
  if (id === 'saturn') {
    return {
      tilt: BODY_TILT.saturn,
      rings: [
        // Outer A ring, the Cassini division gap, then the brighter B ring.
        { rx: r * 1.98, scaleY: 0.32, width: Math.max(1.5, r * 0.08), color: '#e9dcb0', alpha: 0.85 },
        { rx: r * 1.58, scaleY: 0.32, width: Math.max(2, r * 0.18), color: '#cdb98a', alpha: 0.95 },
      ],
    };
  }
  if (id === 'uranus') {
    // Uranus is tipped on its side, so its faint rings look nearly vertical.
    return {
      tilt: BODY_TILT.uranus,
      rings: [{ rx: r * 1.7, scaleY: 0.3, width: Math.max(1, r * 0.05), color: '#bfeef0', alpha: 0.5 }],
    };
  }
  return null;
}

/**
 * Draw a tilted planetary ring system. `half` selects the arc relative to the
 * planet's disc: 'back' (far side, drawn before the sphere) or 'front' (near
 * side, drawn on top of the sphere) so the planet appears to sit in the rings.
 */
function drawRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  tilt: number,
  rings: ReadonlyArray<Ring>,
  half: 'back' | 'front',
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  // In the tilted frame the far arc sits above center (y<0), the near arc below.
  ctx.beginPath();
  if (half === 'front') ctx.rect(-r * 4, 0, r * 8, r * 4);
  else ctx.rect(-r * 4, -r * 4, r * 8, r * 4);
  ctx.clip();
  for (const ring of rings) {
    ctx.globalAlpha = ring.alpha;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = ring.width;
    ctx.beginPath();
    ctx.ellipse(0, 0, ring.rx, ring.rx * ring.scaleY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/**
 * Draw a soft-edged elliptical blob (storm spot or cloud streak) whose color
 * fades to transparent at the rim so it blends into the surrounding bands.
 * `rgb` is an "r,g,b" string; coordinates are in the caller's current frame.
 */
function drawSoftBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rgb: string,
  alpha: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${rgb},${alpha})`);
  g.addColorStop(0.55, `rgba(${rgb},${alpha * 0.85})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draw a soft, downward-pointing heart (Pluto's Tombaugh Regio) filled with a
 * radial gradient so its center is brightest. `w` is the heart width.
 */
function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, rgb: string, alpha: number): void {
  const a = w / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(0.15);
  ctx.beginPath();
  ctx.moveTo(0, a * 0.95);
  ctx.bezierCurveTo(-a * 1.15, a * 0.05, -a * 0.95, -a * 0.85, 0, -a * 0.2);
  ctx.bezierCurveTo(a * 0.95, -a * 0.85, a * 1.15, a * 0.05, 0, a * 0.95);
  ctx.closePath();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, a * 1.25);
  g.addColorStop(0, `rgba(${rgb},1)`);
  g.addColorStop(1, `rgba(${rgb},0.55)`);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/**
 * Draw an elongated ellipsoid body (Haumea) tilted off-axis, with a reddish
 * surface patch and a soft highlight so it reads as a 3D egg shape.
 */
function drawEllipsoidBody(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  visual: BodyVisual,
): void {
  const rx = r * 1.12;
  const ry = r * 0.66;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  const grad = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, ry * 0.1, 0, 0, rx);
  grad.addColorStop(0, visual.base);
  grad.addColorStop(1, visual.accent);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();
  // Reddish mineral patch near the middle.
  drawSoftBlob(ctx, rx * 0.1, 0, rx * 0.4, ry * 0.55, '150,96,72', 0.4);
  // Limb darkening for volume.
  const limb = ctx.createRadialGradient(0, 0, ry * 0.5, 0, 0, rx);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = limb;
  ctx.fillRect(-rx, -ry, 2 * rx, 2 * ry);
  ctx.restore();
  ctx.restore();
}

/**
 * Paint a gas giant's disc: latitude bands bunched toward the poles and tilted
 * to the body's axis, per-body storm/cloud features, then spherical shading
 * (limb darkening + a soft highlight) so the disc reads as a sphere, not a flat
 * stack of stripes. Must be called inside the circular clip.
 */
function drawGasGiant(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  id: string,
  visual: BodyVisual,
): void {
  const tilt = BODY_TILT[id] ?? 0;
  const pal = GAS_PALETTE[id] ?? { light: visual.base, dark: visual.accent };

  // Bands + features in the tilted band frame.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  const grad = ctx.createLinearGradient(0, -r, 0, r);
  const steps = 9;
  for (let i = 0; i <= steps; i++) {
    // Even latitude steps map to sin() screen offsets → bands compress at poles.
    const lat = -Math.PI / 2 + (i / steps) * Math.PI;
    const pos = (Math.sin(lat) + 1) / 2;
    grad.addColorStop(pos, i % 2 === 0 ? pal.dark : pal.light);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);

  if (id === 'jupiter') {
    // Great Red Spot embedded just south of the equator, soft-edged.
    drawSoftBlob(ctx, r * 0.34, r * 0.3, r * 0.26, r * 0.15, '194,90,58', 0.85);
    drawSoftBlob(ctx, r * 0.34, r * 0.3, r * 0.13, r * 0.07, '150,52,32', 0.5);
  } else if (id === 'neptune') {
    // Wispy white methane clouds, then a soft dark spot.
    drawSoftBlob(ctx, r * 0.1, -r * 0.45, r * 0.5, r * 0.08, '236,242,255', 0.45);
    drawSoftBlob(ctx, -r * 0.25, r * 0.4, r * 0.42, r * 0.07, '236,242,255', 0.38);
    drawSoftBlob(ctx, r * 0.3, r * 0.12, r * 0.3, r * 0.06, '236,242,255', 0.3);
    drawSoftBlob(ctx, -r * 0.28, -r * 0.12, r * 0.2, r * 0.13, '20,34,78', 0.5);
  }
  ctx.restore();

  // Spherical shading in screen space, over the bands and features.
  const limb = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r);
  limb.addColorStop(0, 'rgba(0,0,0,0)');
  limb.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = limb;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);

  const hx = cx - r * 0.32;
  const hy = cy - r * 0.32;
  const hi = ctx.createRadialGradient(hx, hy, r * 0.05, hx, hy, r * 1.1);
  hi.addColorStop(0, 'rgba(255,255,255,0.16)');
  hi.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi;
  ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
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

  if (id === 'haumea') {
    // Haumea's defining trait is its extreme elongation (a fast-spin ellipsoid).
    drawEllipsoidBody(ctx, cx, cy, r, visual);
    ctx.restore();
    return;
  }

  // Planetary rings (Saturn, Uranus): far arc behind the sphere.
  const ringSystem = ringSystemFor(id, r);
  if (ringSystem) {
    drawRings(ctx, cx, cy, r, ringSystem.tilt, ringSystem.rings, 'back');
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
    case 'gas':
    case 'ringed':
      drawGasGiant(ctx, cx, cy, r, id, visual);
      break;
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
      drawCraters(ctx, cx, cy, r, visual.accent, id);
      break;
    case 'dwarf':
      if (id === 'pluto') {
        // Dark reddish region on one side, then the bright "heart".
        drawSoftBlob(ctx, cx - r * 0.45, cy - r * 0.1, r * 0.55, r * 0.6, '92,62,46', 0.4);
        drawHeart(ctx, cx + r * 0.18, cy + r * 0.28, r * 1.0, '237,225,205', 0.85);
      } else if (id === 'makemake') {
        // Fairly uniform dark surface with faint mottling.
        drawCraters(ctx, cx, cy, r, visual.accent, id);
        drawSoftBlob(ctx, cx + r * 0.2, cy + r * 0.1, r * 0.4, r * 0.4, '58,29,23', 0.3);
      } else if (id === 'ceres') {
        drawCraters(ctx, cx, cy, r, visual.accent, id);
        // Occator's bright carbonate spots.
        drawSoftBlob(ctx, cx + r * 0.18, cy - r * 0.12, r * 0.09, r * 0.09, '246,246,250', 0.95);
        drawSoftBlob(ctx, cx - r * 0.25, cy + r * 0.3, r * 0.05, r * 0.05, '246,246,250', 0.8);
      } else {
        // Eris and others: bright, mottled icy surface.
        drawCraters(ctx, cx, cy, r, visual.accent, id);
      }
      break;
    default:
      break;
  }
  ctx.restore();

  // Planetary rings: near arc drawn over the sphere.
  if (ringSystem) {
    drawRings(ctx, cx, cy, r, ringSystem.tilt, ringSystem.rings, 'front');
  }

  ctx.restore();
}

/** Convert a "#rrggbb" hex color to an "r,g,b" string for rgba() templates. */
function hexToRgb(hex: Hex): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

/** Trace an irregular closed blob (ellipse with seeded jitter) into the current path. */
function traceBlob(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rand: () => number,
  jitter: number,
  points = 11,
): void {
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 - jitter * rand();
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Per-asteroid silhouette (elongation, squash, rotation) for an oval-irregular look. */
const ASTEROID_SHAPE: Record<string, { elong: number; squash: number; rot: number }> = {
  vesta: { elong: 1.1, squash: 0.96, rot: 0.25 },
  pallas: { elong: 1.06, squash: 0.82, rot: -0.5 },
  hygiea: { elong: 1.22, squash: 0.78, rot: 0.5 },
  halley: { elong: 1.35, squash: 0.7, rot: -0.2 },
};

/** Scatter a few soft dark pits over a small body's surface (frame-local). */
function drawRockSpeckles(ctx: CanvasRenderingContext2D, r: number, rand: () => number, accentRgb: string): void {
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * r * 0.55;
    const cr = r * (0.08 + rand() * 0.12);
    drawSoftBlob(ctx, Math.cos(a) * d, Math.sin(a) * d, cr, cr * 0.85, accentRgb, 0.3);
  }
}

/**
 * Draw an irregular small body centered at (cx, cy). Shape is chosen by id:
 * Churyumov is bilobed ("rubber duck"), Bennu is a spinning-top diamond, and
 * the rest are oval-irregular rocks. Comets also get a sublimation tail.
 */
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
  const accentRgb = hexToRgb(visual.accent);
  ctx.translate(cx, cy);
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.1, 0, 0, r * 1.25);
  grad.addColorStop(0, visual.base);
  grad.addColorStop(1, visual.accent);
  ctx.fillStyle = grad;

  if (id === 'churyumov') {
    // Two lobes (body + smaller head) joined at a narrow neck.
    ctx.beginPath();
    traceBlob(ctx, r * 0.05, r * 0.42, r * 0.78, r * 0.6, rand, 0.26);
    traceBlob(ctx, -r * 0.08, -r * 0.52, r * 0.58, r * 0.52, rand, 0.26);
    ctx.fill();
    drawRockSpeckles(ctx, r, rand, accentRgb);
  } else if (id === 'bennu') {
    // Spinning-top: bulges at the equator, tapers toward the poles.
    ctx.beginPath();
    const pts = 18;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const eq = Math.abs(Math.cos(a)); // 1 at the equator, 0 at the poles
      const rr = r * (0.7 + 0.32 * eq * eq) * (0.97 + 0.05 * rand());
      const x = Math.cos(a) * rr;
      const y = Math.sin(a) * rr * 0.92;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    // Faint bright equatorial ridge.
    drawSoftBlob(ctx, 0, 0, r * 0.95, r * 0.1, '210,205,198', 0.22);
    drawRockSpeckles(ctx, r, rand, accentRgb);
  } else {
    const s = ASTEROID_SHAPE[id] ?? { elong: 1.1, squash: 0.85, rot: 0 };
    ctx.rotate(s.rot);
    ctx.beginPath();
    const pts = 11;
    for (let i = 0; i <= pts; i++) {
      const a = (i / pts) * Math.PI * 2;
      const k = 0.78 + rand() * 0.22;
      const x = Math.cos(a) * r * s.elong * k;
      const y = Math.sin(a) * r * s.squash * k;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    drawRockSpeckles(ctx, r, rand, accentRgb);
  }
  ctx.restore();
}

/** Trace a capsule (cylinder seen side-on) of length L and height H into the path. */
function traceCapsule(ctx: CanvasRenderingContext2D, L: number, H: number): void {
  const r = H / 2;
  ctx.beginPath();
  ctx.moveTo(-L / 2 + r, -r);
  ctx.lineTo(L / 2 - r, -r);
  ctx.arc(L / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-L / 2 + r, r);
  ctx.arc(-L / 2 + r, 0, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

/** Hubble: a silvery cylinder with an open aperture and two side solar wings. */
function drawHubble(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  const L = s * 3.0;
  const H = s * 1.5;
  // Solar wings above and below the body.
  ctx.lineWidth = Math.max(0.5, s * 0.1);
  for (const dy of [-(H / 2 + s * 0.75), H / 2 + s * 0.75]) {
    ctx.strokeStyle = '#7d93b4';
    ctx.beginPath();
    ctx.moveTo(0, dy < 0 ? -H / 2 : H / 2);
    ctx.lineTo(0, dy);
    ctx.stroke();
    ctx.fillStyle = 'rgba(43,74,114,0.92)';
    ctx.fillRect(-L * 0.42, dy - s * 0.32, L * 0.84, s * 0.64);
    ctx.strokeRect(-L * 0.42, dy - s * 0.32, L * 0.84, s * 0.64);
  }
  // Cylinder body.
  const grad = ctx.createLinearGradient(0, -H / 2, 0, H / 2);
  grad.addColorStop(0, '#eef3f6');
  grad.addColorStop(0.5, '#c2ccd2');
  grad.addColorStop(1, '#89959c');
  traceCapsule(ctx, L, H);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#6a767d';
  ctx.lineWidth = Math.max(0.5, s * 0.06);
  ctx.stroke();
  // Open aperture at one end.
  ctx.fillStyle = '#20262c';
  ctx.beginPath();
  ctx.ellipse(L / 2 - H * 0.28, 0, H * 0.16, H * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // A couple of structural bands.
  ctx.strokeStyle = 'rgba(96,110,120,0.7)';
  for (const bx of [-L * 0.12, L * 0.04]) {
    ctx.beginPath();
    ctx.moveTo(bx, -H / 2 + s * 0.1);
    ctx.lineTo(bx, H / 2 - s * 0.1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw JWST's gold, segmented hexagonal primary mirror centered at the origin. */
function drawGoldHex(ctx: CanvasRenderingContext2D, x: number, y: number, R: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = Math.cos(a) * R;
    const py = Math.sin(a) * R;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#f0c552');
  g.addColorStop(1, '#b07d1c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#7c5510';
  ctx.lineWidth = Math.max(0.5, R * 0.07);
  ctx.stroke();
  // Segment lines: three diagonals through the center plus an inner hexagon.
  ctx.strokeStyle = 'rgba(124,85,16,0.55)';
  ctx.lineWidth = Math.max(0.4, R * 0.05);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R);
    ctx.lineTo(Math.cos(a + Math.PI) * R, Math.sin(a + Math.PI) * R);
    ctx.stroke();
  }
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const px = Math.cos(a) * R * 0.5;
    const py = Math.sin(a) * R * 0.5;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** JWST: gold hexagonal mirror above a layered, diamond-shaped sunshield. */
function drawJwst(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.18);
  const sw = s * 3.2;
  const sh = s * 1.8;
  const sy = s * 0.95; // sunshield center, below the mirror
  // Sunshield diamond.
  ctx.beginPath();
  ctx.moveTo(-sw / 2, sy);
  ctx.lineTo(0, sy - sh / 2);
  ctx.lineTo(sw / 2, sy);
  ctx.lineTo(0, sy + sh / 2);
  ctx.closePath();
  const sg = ctx.createLinearGradient(-sw / 2, sy, sw / 2, sy);
  sg.addColorStop(0, '#878f9c');
  sg.addColorStop(0.5, '#d7dee6');
  sg.addColorStop(1, '#7b8590');
  ctx.fillStyle = sg;
  ctx.fill();
  ctx.strokeStyle = '#5a626c';
  ctx.lineWidth = Math.max(0.5, s * 0.07);
  ctx.stroke();
  // Stacked layer lines parallel to the long axis.
  ctx.strokeStyle = 'rgba(88,96,106,0.7)';
  ctx.lineWidth = Math.max(0.4, s * 0.05);
  for (const t of [-0.6, -0.3, 0.3, 0.6]) {
    const span = (sw / 2) * (1 - Math.abs(t));
    ctx.beginPath();
    ctx.moveTo(-span, sy + (t * sh) / 2);
    ctx.lineTo(span, sy + (t * sh) / 2);
    ctx.stroke();
  }
  // Support struts then the mirror.
  const mY = -s * 1.05;
  const mR = s * 1.25;
  ctx.strokeStyle = '#3a3f45';
  ctx.lineWidth = Math.max(0.6, s * 0.12);
  ctx.beginPath();
  ctx.moveTo(-mR * 0.4, mY + mR * 0.5);
  ctx.lineTo(-s * 0.3, sy - sh * 0.3);
  ctx.moveTo(mR * 0.4, mY + mR * 0.5);
  ctx.lineTo(s * 0.3, sy - sh * 0.3);
  ctx.stroke();
  drawGoldHex(ctx, 0, mY, mR);
  ctx.restore();
}

/**
 * Draw a schematic spacecraft icon centered at (cx, cy). Most craft use a
 * generic body + solar-panel glyph; Hubble (cylinder) and JWST (hex mirror +
 * sunshield) get their own signature silhouettes selected by `id`.
 */
export function drawSpacecraftIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accent: Hex,
  size: number = SPACECRAFT_RADIUS_PX,
  id?: string,
): void {
  if (id === 'hubble') {
    drawHubble(ctx, cx, cy, size);
    return;
  }
  if (id === 'jwst') {
    drawJwst(ctx, cx, cy, size);
    return;
  }
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
