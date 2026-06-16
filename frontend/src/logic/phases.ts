/**
 * Solar Explorer — multi-phase trajectory geometry.
 *
 * Some spacecraft do not trace a single closed orbit: they hop between bodies
 * in stages (cruise out, survey, return). This module holds the pure geometry
 * shared by those trajectories — the {@link Phase} shape and the heliocentric
 * transfer arc {@link phasePoint}. The *timing* of a mission (which phase is
 * active, when it ends) lives in {@link mission} (a clear start/end, no loop).
 *
 * Pure functions: no Phaser, no state. The scene supplies the live anchor
 * positions (which themselves move); this helper places the craft along the arc
 * between two anchors.
 */
import { FULL_CIRCLE_RAD } from '../constants/constants';

/** A single stage of a multi-phase trajectory between two anchor body ids. */
export interface Phase {
  /** Anchor body id the craft departs from. */
  readonly from: string;
  /** Anchor body id the craft arrives at (equal to `from` for station-keeping). */
  readonly to: string;
  /** Stage length in Earth years (same time base as orbital periods). */
  readonly durationYears: number;
}

/** A 2D point in world space. */
export interface Point {
  readonly x: number;
  readonly y: number;
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
  // Unwrap so the sweep is prograde. Bodies orbit counterclockwise on screen,
  // which — because the vertical axis is flipped (y-down) — is a *decreasing*
  // stored polar angle, so the arc sweeps toward the smaller angle.
  while (aTo > aFrom) aTo -= FULL_CIRCLE_RAD;

  const r = rFrom + (rTo - rFrom) * t;
  const angle = aFrom + (aTo - aFrom) * t;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}
