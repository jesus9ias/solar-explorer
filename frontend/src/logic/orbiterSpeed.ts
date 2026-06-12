/**
 * Solar Explorer — Ellipse mode orbiter speed factors.
 *
 * Moons and host-orbiting spacecraft share one calm base period
 * (ELLIPSE_ORBITER_PERIOD_YEARS), which read as everything moving in lockstep. A
 * speed factor multiplies angular speed (period = base / factor) to break that
 * up. By default inner rings run faster than outer ones — cosmetic, not real,
 * just livelier and reminiscent of how close moons orbit faster. Any object can
 * override its factor with a `speedFactor` field in the JSON data.
 *
 * Pure and DOM/Phaser-free so the speed math is unit-testable; the motion itself
 * is verified by running the app.
 */
import {
  ELLIPSE_ORBITER_SPEED_INNER,
  ELLIPSE_ORBITER_SPEED_OUTER,
} from '../constants/constants';

/**
 * Default speed factor for a ring, fastest at the innermost ring (index 0) and
 * easing linearly to the slowest at the outermost. A lone orbiter gets the
 * midpoint so it is neither the fastest nor the slowest.
 */
export function ringSpeedFactor(ringIndex: number, ringCount: number): number {
  if (ringCount <= 1) {
    return (ELLIPSE_ORBITER_SPEED_INNER + ELLIPSE_ORBITER_SPEED_OUTER) / 2;
  }
  const t = ringIndex / (ringCount - 1);
  return (
    ELLIPSE_ORBITER_SPEED_INNER -
    t * (ELLIPSE_ORBITER_SPEED_INNER - ELLIPSE_ORBITER_SPEED_OUTER)
  );
}

/**
 * Resolve an orbiter's speed factor: the explicit per-object value when set,
 * otherwise the ring-proximity default.
 */
export function resolveOrbiterSpeedFactor(
  explicitFactor: number | undefined,
  ringIndex: number,
  ringCount: number,
): number {
  return explicitFactor ?? ringSpeedFactor(ringIndex, ringCount);
}
