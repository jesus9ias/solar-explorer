/**
 * Solar Explorer — multi-phase trajectory calculations.
 *
 * Some spacecraft do not trace a single closed orbit: they hop between bodies
 * in stages (cruise out, survey, return). OSIRIS-REx is the canonical example —
 * Earth → Bennu → (survey) → Earth. Each stage is a {@link Phase} that connects
 * two anchor bodies over a duration; the whole itinerary repeats as a cycle.
 *
 * Pure functions: no Phaser, no state. The scene supplies the live anchor
 * positions (which themselves move) and the elapsed simulation time; these
 * helpers decide which phase is active and where along its arc the craft sits.
 */
import { EARTH_YEAR_MS, FULL_CIRCLE_RAD } from '../constants/constants';

/** A single stage of a multi-phase trajectory between two anchor body ids. */
export interface Phase {
  /** Anchor body id the craft departs from. */
  readonly from: string;
  /** Anchor body id the craft arrives at (equal to `from` for station-keeping). */
  readonly to: string;
  /** Stage length in Earth years (same time base as orbital periods). */
  readonly durationYears: number;
}

/** The active phase plus how far through it the craft is. */
export interface PhaseProgress {
  /** Index of the active phase within the itinerary. */
  readonly index: number;
  readonly from: string;
  readonly to: string;
  /** Fraction through the active phase, 0..1. */
  readonly t: number;
}

/** A 2D point in world space. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** Total length of one full itinerary cycle, in Earth years. */
export function phaseCycleYears(phases: readonly Phase[]): number {
  return phases.reduce((sum, p) => sum + p.durationYears, 0);
}

/**
 * Resolve the active phase and intra-phase fraction at a given elapsed time.
 *
 * The itinerary loops: elapsed time is wrapped into one cycle (negative values
 * are handled too). A phase boundary belongs to the *next* phase at fraction 0.
 */
export function phaseProgressAt(
  elapsedMs: number,
  phases: readonly Phase[],
): PhaseProgress {
  const cycleMs = phaseCycleYears(phases) * EARTH_YEAR_MS;
  // Wrap into [0, cycleMs), tolerating negative elapsed values.
  let remaining = ((elapsedMs % cycleMs) + cycleMs) % cycleMs;
  for (let i = 0; i < phases.length; i++) {
    const durMs = phases[i].durationYears * EARTH_YEAR_MS;
    if (remaining < durMs || i === phases.length - 1) {
      return {
        index: i,
        from: phases[i].from,
        to: phases[i].to,
        t: durMs === 0 ? 0 : remaining / durMs,
      };
    }
    remaining -= durMs;
  }
  // Unreachable for a non-empty itinerary; kept for type completeness.
  const last = phases[phases.length - 1];
  return { index: phases.length - 1, from: last.from, to: last.to, t: 1 };
}

/**
 * Point along a phase's heliocentric transfer arc at fraction `t` (0..1).
 *
 * Interpolated in polar coordinates about the Sun (the world origin): the solar
 * distance blends from `|from|` to `|to|` while the angle sweeps **prograde** (the
 * same direction the bodies orbit). This keeps the craft on the ring between the
 * two orbits — so it never cuts across the Sun — and always moving forward, so it
 * never appears to retreat. A straight chord would do neither.
 *
 * When the endpoints coincide (a station-keeping phase) the craft tracks the
 * shared anchor; the scene handles that case by orbiting the anchor instead.
 */
export function phasePoint(from: Point, to: Point, t: number): Point {
  const rFrom = Math.hypot(from.x, from.y);
  const rTo = Math.hypot(to.x, to.y);
  // A point at the Sun has no defined angle; borrow the other endpoint's angle so
  // the move is purely radial rather than NaN.
  const aFrom = rFrom === 0 ? Math.atan2(to.y, to.x) : Math.atan2(from.y, from.x);
  let aTo = rTo === 0 ? aFrom : Math.atan2(to.y, to.x);
  // Unwrap so the sweep is prograde (increasing angle, matching orbital motion).
  while (aTo < aFrom) aTo += FULL_CIRCLE_RAD;

  const r = rFrom + (rTo - rFrom) * t;
  const angle = aFrom + (aTo - aFrom) * t;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}
