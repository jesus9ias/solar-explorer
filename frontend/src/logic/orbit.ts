/**
 * Solar Explorer — orbital position calculations.
 *
 * Pure functions: no Phaser, no state. Implements the simplified circular
 * approximation described in the spec.
 */
import {
  EARTH_YEAR_MS,
  FULL_CIRCLE_RAD,
  NON_ORBITING_PROBE_IDS,
} from '../constants/constants';

/** Convert an orbital period in Earth years to simulation milliseconds. */
export function yearsToOrbitMs(orbitalPeriodYears: number): number {
  return orbitalPeriodYears * EARTH_YEAR_MS;
}

/**
 * Compute the orbital angle (radians) for a body.
 *
 * The angle advances by `(elapsed / period) * 2π * speed` from the initial
 * angle, matching the per-frame increment used by the Ellipse scene.
 *
 * @param elapsedMs Simulation time elapsed.
 * @param orbitPeriodMs The body's orbital period in simulation ms.
 * @param speedMultiplier The active speed multiplier (1, 2 or 5).
 * @param initialAngleRad Starting angle (defaults to 0).
 */
export function orbitAngleRad(
  elapsedMs: number,
  orbitPeriodMs: number,
  speedMultiplier: number,
  initialAngleRad = 0,
): number {
  const revolutions = elapsedMs / orbitPeriodMs;
  return initialAngleRad + revolutions * FULL_CIRCLE_RAD * speedMultiplier;
}

/** Whether a body follows a solar orbit (false for interstellar probes). */
export function isOrbiting(bodyId: string): boolean {
  return !NON_ORBITING_PROBE_IDS.includes(bodyId);
}
