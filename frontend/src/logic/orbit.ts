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
import type { Point } from './phases';

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

/**
 * Analytic world position of a body on its elliptical orbit at a given elapsed
 * time. Mirrors the per-frame placement in {@link OrbitalMapScene.advanceOrbits}
 * but as a closed form of elapsed time alone (speed multiplier cancels, since
 * elapsed already accumulates it). This lets a mission predict where an anchor
 * *will be* at a future rendezvous instead of chasing its live position.
 */
export function orbitPositionAt(
  elapsedMs: number,
  orbitPeriodMs: number,
  radiusX: number,
  radiusY: number,
  initialAngleRad: number,
): Point {
  const angle = orbitAngleRad(elapsedMs, orbitPeriodMs, 1, initialAngleRad);
  // Y is negated so that an increasing angle reads as counterclockwise on screen
  // (true prograde, as seen from ecliptic north) despite the screen's y-down axis.
  return { x: Math.cos(angle) * radiusX, y: -Math.sin(angle) * radiusY };
}

/** Whether a body follows a solar orbit (false for interstellar probes). */
export function isOrbiting(bodyId: string): boolean {
  return !NON_ORBITING_PROBE_IDS.includes(bodyId);
}
