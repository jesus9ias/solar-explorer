import {
  missionDurationYears,
  missionProgressAt,
  completedPhaseCount,
  missionElapsedYears,
  formatElapsedYears,
} from '../logic/mission';
import { EARTH_YEAR_MS } from '../constants/constants';
import type { Phase } from '../logic/phases';

// A representative escape itinerary: cruise to Jupiter, brief flyby, then a long
// coast out to the probe's current known position. Mirrors the shape of a
// Voyager-style mission (the final `self` leg is resolved by the scene).
const PHASES: readonly Phase[] = [
  { from: 'earth', to: 'jupiter', durationYears: 2 },
  { from: 'jupiter', to: 'jupiter', durationYears: 1 },
  { from: 'jupiter', to: 'self', durationYears: 4 },
];
const TOTAL = 7;
const YEAR = EARTH_YEAR_MS;

describe('mission — total duration', () => {
  it('sums the phase durations', () => {
    expect(missionDurationYears(PHASES)).toBeCloseTo(TOTAL, 6);
  });
});

describe('mission — progress over time (non-cyclic)', () => {
  it('at t=0 starts in the first phase at fraction 0, not done', () => {
    const p = missionProgressAt(0, PHASES);
    expect(p.index).toBe(0);
    expect(p.from).toBe('earth');
    expect(p.to).toBe('jupiter');
    expect(p.t).toBeCloseTo(0, 6);
    expect(p.done).toBe(false);
  });

  it('reports the fraction within the current phase', () => {
    const p = missionProgressAt(1 * YEAR, PHASES);
    expect(p.index).toBe(0);
    expect(p.t).toBeCloseTo(0.5, 6);
    expect(p.done).toBe(false);
  });

  it('a phase boundary belongs to the next phase at fraction 0', () => {
    const p = missionProgressAt(2 * YEAR, PHASES);
    expect(p.index).toBe(1);
    expect(p.from).toBe('jupiter');
    expect(p.to).toBe('jupiter');
    expect(p.t).toBeCloseTo(0, 6);
  });

  it('clamps a negative elapsed to the start', () => {
    const p = missionProgressAt(-5 * YEAR, PHASES);
    expect(p.index).toBe(0);
    expect(p.t).toBeCloseTo(0, 6);
    expect(p.done).toBe(false);
  });

  it('settles on the final phase at fraction 1 and marks done at the total', () => {
    const p = missionProgressAt(TOTAL * YEAR, PHASES);
    expect(p.index).toBe(PHASES.length - 1);
    expect(p.from).toBe('jupiter');
    expect(p.to).toBe('self');
    expect(p.t).toBeCloseTo(1, 6);
    expect(p.done).toBe(true);
  });

  it('stays done and clamped past the total (does NOT loop)', () => {
    const p = missionProgressAt((TOTAL + 5) * YEAR, PHASES);
    expect(p.index).toBe(PHASES.length - 1);
    expect(p.t).toBeCloseTo(1, 6);
    expect(p.done).toBe(true);
  });
});

describe('mission — completed phase count (for the progress checklist)', () => {
  it('counts zero completed phases at the start', () => {
    expect(completedPhaseCount(0, PHASES)).toBe(0);
  });

  it('counts a phase as completed once its end time is reached', () => {
    expect(completedPhaseCount(2 * YEAR, PHASES)).toBe(1);
    expect(completedPhaseCount((2 + 1) * YEAR, PHASES)).toBe(2);
  });

  it('does not count a phase still in progress', () => {
    expect(completedPhaseCount(1.5 * YEAR, PHASES)).toBe(0);
    expect(completedPhaseCount(2.5 * YEAR, PHASES)).toBe(1);
  });

  it('counts every phase once the mission is complete', () => {
    expect(completedPhaseCount(TOTAL * YEAR, PHASES)).toBe(PHASES.length);
    expect(completedPhaseCount((TOTAL + 10) * YEAR, PHASES)).toBe(PHASES.length);
  });
});

describe('mission — elapsed years readout', () => {
  it('converts elapsed milliseconds to Earth years', () => {
    expect(missionElapsedYears(47.3 * YEAR)).toBeCloseTo(47.3, 6);
    expect(missionElapsedYears(0)).toBeCloseTo(0, 6);
  });

  it('formats elapsed years with one decimal', () => {
    expect(formatElapsedYears(0)).toBe('0.0');
    expect(formatElapsedYears(2 * YEAR)).toBe('2.0');
    expect(formatElapsedYears(47.3 * YEAR)).toBe('47.3');
  });
});
