/**
 * Solar Explorer — single-mission timeline.
 *
 * Mission mode plays one spacecraft's itinerary from a clear start to a clear
 * end. Unlike {@link phases} (which loops endlessly for the Ellipse-mode
 * overview), a mission does NOT cycle: once the craft reaches its final anchor
 * the mission is *done* and the scene freezes. Re-running is driven from above
 * (the restart control), not by wrapping elapsed time.
 *
 * Pure functions: no Phaser, no state. They reuse the {@link Phase} shape and
 * the heliocentric arc helper from {@link phases}; only the time→phase mapping
 * differs (clamped, not modular).
 */
import { EARTH_YEAR_MS, MISSION_YEARS_DECIMALS } from '../constants/constants';
import type { Phase } from './phases';

/** The active phase plus how far through it the craft is, and whether it ended. */
export interface MissionProgress {
  /** Index of the active phase within the itinerary. */
  readonly index: number;
  readonly from: string;
  readonly to: string;
  /** Fraction through the active phase, 0..1. */
  readonly t: number;
  /** True once elapsed time has reached the end of the last phase. */
  readonly done: boolean;
}

/** The elapsed-time window [startMs, endMs] a phase occupies in the itinerary. */
export interface PhaseWindow {
  readonly startMs: number;
  readonly endMs: number;
}

/**
 * Elapsed-time bounds of the phase at `index`. Used to freeze a transfer arc:
 * the craft departs from where the `from` anchor sits at `startMs` and arrives
 * where the `to` anchor *will be* at `endMs`, so the arc no longer chases a
 * moving target (which caused stray loops and jumps when the target wrapped).
 */
export function phaseWindowMs(index: number, phases: readonly Phase[]): PhaseWindow {
  let startMs = 0;
  for (let i = 0; i < index; i++) startMs += phases[i].durationYears * EARTH_YEAR_MS;
  const endMs = startMs + phases[index].durationYears * EARTH_YEAR_MS;
  return { startMs, endMs };
}

/** Total length of a mission itinerary, in Earth years. */
export function missionDurationYears(phases: readonly Phase[]): number {
  return phases.reduce((sum, p) => sum + p.durationYears, 0);
}

/**
 * Resolve the active phase and intra-phase fraction at a given elapsed time.
 *
 * Clamped, not modular: elapsed times below 0 pin to the start, and times at or
 * beyond the total settle on the final phase at fraction 1 with `done = true`.
 * A phase boundary belongs to the *next* phase at fraction 0 (matching
 * {@link phases.phaseProgressAt}).
 */
export function missionProgressAt(
  elapsedMs: number,
  phases: readonly Phase[],
): MissionProgress {
  const totalMs = missionDurationYears(phases) * EARTH_YEAR_MS;
  const last = phases.length - 1;

  if (elapsedMs >= totalMs) {
    return { index: last, from: phases[last].from, to: phases[last].to, t: 1, done: true };
  }

  let remaining = Math.max(elapsedMs, 0);
  for (let i = 0; i < phases.length; i++) {
    const durMs = phases[i].durationYears * EARTH_YEAR_MS;
    if (remaining < durMs) {
      return {
        index: i,
        from: phases[i].from,
        to: phases[i].to,
        t: durMs === 0 ? 0 : remaining / durMs,
        done: false,
      };
    }
    remaining -= durMs;
  }
  // Unreachable: the `>= totalMs` guard above covers the end. Kept for safety.
  return { index: last, from: phases[last].from, to: phases[last].to, t: 1, done: true };
}

/**
 * How many phases have fully completed at a given elapsed time. Used to light up
 * the per-phase progress checklist; a phase counts as completed once its end
 * time is reached.
 */
export function completedPhaseCount(
  elapsedMs: number,
  phases: readonly Phase[],
): number {
  let count = 0;
  let cumulativeMs = 0;
  for (const phase of phases) {
    cumulativeMs += phase.durationYears * EARTH_YEAR_MS;
    if (elapsedMs >= cumulativeMs) count++;
    else break;
  }
  return count;
}

/** Elapsed simulation time expressed in Earth years. */
export function missionElapsedYears(elapsedMs: number): number {
  return elapsedMs / EARTH_YEAR_MS;
}

/** Elapsed years formatted with a single decimal, for the years counter. */
export function formatElapsedYears(elapsedMs: number): string {
  return missionElapsedYears(elapsedMs).toFixed(MISSION_YEARS_DECIMALS);
}
