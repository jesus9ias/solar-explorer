/**
 * Solar Explorer — historical body positions (simplified ephemeris).
 *
 * A planet's heliocentric position at a date is approximated with the linear
 * mean-longitude model: its known mean longitude at the J2000 epoch advances at
 * a constant rate (one full turn per orbital period). This is deliberately
 * circular — eccentricity and planetary perturbations are ignored — which is
 * plenty for an educational scale model and keeps it a pure, testable function.
 *
 * Used by Mission mode to seed the planets at the configuration they had on a
 * mission's launch date, so transfer arcs resemble the real trajectory diagrams.
 *
 * Pure functions: no Phaser, no state.
 */
import {
  DEG_TO_RAD,
  FULL_CIRCLE_RAD,
  J2000_EPOCH_MS,
  MS_PER_JULIAN_YEAR,
} from '../constants/constants';

/** Julian years between the J2000 epoch and `epochMs` (negative before J2000). */
export function yearsSinceJ2000(epochMs: number): number {
  return (epochMs - J2000_EPOCH_MS) / MS_PER_JULIAN_YEAR;
}

/**
 * Heliocentric angle (radians) of a body at `epochMs`, from its mean longitude
 * at J2000 and its orbital period. The ecliptic longitude is used directly as
 * the polar angle about the Sun: only relative positions matter for the transfer
 * geometry, so a single shared frame (and the same prograde sense the orbits
 * advance in) is enough.
 */
export function heliocentricAngleAt(
  epochMs: number,
  periodYears: number,
  meanLongitudeJ2000Deg: number,
): number {
  const revolutions = yearsSinceJ2000(epochMs) / periodYears;
  return meanLongitudeJ2000Deg * DEG_TO_RAD + revolutions * FULL_CIRCLE_RAD;
}
