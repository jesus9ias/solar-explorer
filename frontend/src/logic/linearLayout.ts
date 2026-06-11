/**
 * Solar Explorer — Linear mode vertical layout.
 *
 * Linear mode draws every element on a single axis at a baseline position given
 * by the scale curve (see logic/linearScale.ts). A moon sits a fraction of a Mkm
 * from its host, so at any usable scale its baseline lands within a sub-pixel of
 * its planet and the two would render on top of each other.
 *
 * This module takes those baseline positions and runs a single top-to-bottom
 * declutter pass: each element is pushed down just enough to clear the previous
 * element's rendered disc. The required center-to-center gap is the sum of both
 * radii plus a margin, so a moon lands past the edge of a huge host (the Sun and
 * Jupiter clamp to ~80 px) instead of inside it. Displacement stays local to a
 * cluster — the next planet is hundreds of pixels away, so it never cascades into
 * and distorts the spacing. Several moons under one host form an even ladder.
 *
 * Pure and DOM/Phaser-free, and deliberately ignorant of the scale curve: it only
 * sees baseline pixels, so any scale (uniform, piecewise, …) reuses it unchanged.
 * The rendering itself is verified by running the app.
 */

/**
 * An element to place: its id, baseline Y (px) from the scale curve, and the
 * radius (px) at which it is rendered — the radius is what the pass must clear.
 */
export interface LinearElement {
  readonly id: string;
  readonly baseY: number;
  readonly radiusPx: number;
}

/** The resolved vertical position (px) for an element. */
export interface LinearPlacement {
  readonly id: string;
  readonly y: number;
}

/**
 * Resolve vertical positions for Linear mode, ordered by distance from the Sun.
 *
 * @param elements   elements to place (any order; sorted by baseline internally)
 * @param gapMarginPx  clear space kept between the discs of consecutive elements
 */
export function computeLinearLayout(
  elements: readonly LinearElement[],
  gapMarginPx: number,
): LinearPlacement[] {
  const sorted = [...elements].sort((a, b) => a.baseY - b.baseY);

  const placements: LinearPlacement[] = [];
  let previous: { y: number; radiusPx: number } | null = null;
  for (const element of sorted) {
    const minY = previous
      ? previous.y + previous.radiusPx + element.radiusPx + gapMarginPx
      : -Infinity;
    const y = Math.max(element.baseY, minY);
    placements.push({ id: element.id, y });
    previous = { y, radiusPx: element.radiusPx };
  }
  return placements;
}
