/**
 * Solar Explorer — Ellipse mode orbiter ring radii.
 *
 * In the orbital map a body is drawn at an exaggerated size so it stays visible,
 * but its moons (and host-orbiting spacecraft) orbit at a small real distance.
 * At a fixed orbit radius the moons of a giant fall inside the host's rendered
 * disc — Jupiter and the Sun clamp to ~80 px — and several moons land on top of
 * one another.
 *
 * This assigns each orbiter its own concentric ring: the first clears the host
 * disc, each next clears the previous orbiter's disc, all separated by a gap. The
 * caller supplies orbiters already ordered inner-to-outer by true distance so the
 * rings reflect reality.
 *
 * Pure and DOM/Phaser-free so the ring math is unit-testable; the rendering is
 * verified by running the app.
 *
 * @param hostRadiusPx  rendered radius of the body being orbited
 * @param orbiterRadiiPx  rendered radius of each orbiter, inner-to-outer
 * @param gapPx  clear space kept between consecutive discs
 * @returns one orbit radius (px) per orbiter, in the same order
 */
export function computeOrbitRingRadii(
  hostRadiusPx: number,
  orbiterRadiiPx: readonly number[],
  gapPx: number,
): number[] {
  const radii: number[] = [];
  let previousEdge = hostRadiusPx;
  for (const radiusPx of orbiterRadiiPx) {
    const orbit = previousEdge + gapPx + radiusPx;
    radii.push(orbit);
    previousEdge = orbit + radiusPx;
  }
  return radii;
}
