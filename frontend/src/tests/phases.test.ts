import {
  phaseCycleYears,
  phaseProgressAt,
  phasePoint,
  type Phase,
} from '../logic/phases';
import { EARTH_YEAR_MS } from '../constants/constants';
import type { BodyData, SpacecraftData } from '../logic/library';
import bodiesJson from '../config/bodies.json';
import spacecraftJson from '../config/spacecraft.json';

// Mirrors OSIRIS-REx's real itinerary: cruise to Bennu, survey it, return to Earth.
const OSIRIS_PHASES: readonly Phase[] = [
  { from: 'earth', to: 'bennu', durationYears: 2.2 },
  { from: 'bennu', to: 'bennu', durationYears: 2.4 },
  { from: 'bennu', to: 'earth', durationYears: 2.4 },
];

const CYCLE_YEARS = 2.2 + 2.4 + 2.4;
const YEAR = EARTH_YEAR_MS;

describe('phases — cycle length', () => {
  it('sums the phase durations', () => {
    expect(phaseCycleYears(OSIRIS_PHASES)).toBeCloseTo(CYCLE_YEARS, 6);
  });
});

describe('phases — progress over time', () => {
  it('at t=0 starts in the first phase at fraction 0', () => {
    const p = phaseProgressAt(0, OSIRIS_PHASES);
    expect(p.index).toBe(0);
    expect(p.from).toBe('earth');
    expect(p.to).toBe('bennu');
    expect(p.t).toBeCloseTo(0, 6);
  });

  it('reports the fraction within the current phase', () => {
    // Halfway through the 2.2-year outbound cruise.
    const p = phaseProgressAt(1.1 * YEAR, OSIRIS_PHASES);
    expect(p.index).toBe(0);
    expect(p.t).toBeCloseTo(0.5, 6);
  });

  it('a phase boundary belongs to the next phase at fraction 0', () => {
    const p = phaseProgressAt(2.2 * YEAR, OSIRIS_PHASES);
    expect(p.index).toBe(1);
    expect(p.from).toBe('bennu');
    expect(p.to).toBe('bennu');
    expect(p.t).toBeCloseTo(0, 6);
  });

  it('advances into the survey (station-keeping) phase', () => {
    const p = phaseProgressAt((2.2 + 1.2) * YEAR, OSIRIS_PHASES);
    expect(p.index).toBe(1);
    expect(p.t).toBeCloseTo(0.5, 6);
  });

  it('loops back to the first phase after a full cycle', () => {
    const p = phaseProgressAt(CYCLE_YEARS * YEAR, OSIRIS_PHASES);
    expect(p.index).toBe(0);
    expect(p.t).toBeCloseTo(0, 6);
  });

  it('is periodic across multiple cycles', () => {
    const once = phaseProgressAt(1.1 * YEAR, OSIRIS_PHASES);
    const later = phaseProgressAt((CYCLE_YEARS + 1.1) * YEAR, OSIRIS_PHASES);
    expect(later.index).toBe(once.index);
    expect(later.t).toBeCloseTo(once.t, 6);
  });
});

describe('phases — point along the heliocentric transfer arc', () => {
  // Two anchors on the +x axis at different solar distances.
  const A = { x: 100, y: 0 };
  const B = { x: 300, y: 0 };

  it('returns the start anchor at t=0', () => {
    const p = phasePoint(A, B, 0);
    expect(p.x).toBeCloseTo(A.x, 6);
    expect(p.y).toBeCloseTo(A.y, 6);
  });

  it('returns the end anchor at t=1', () => {
    const p = phasePoint(A, B, 1);
    expect(p.x).toBeCloseTo(B.x, 6);
    expect(p.y).toBeCloseTo(B.y, 6);
  });

  it('blends the solar distance between the two orbits', () => {
    // Same angle (both on +x), so the point stays on the axis at the mid radius.
    const p = phasePoint(A, B, 0.5);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('keeps the arc on the ring between the orbits, never near the Sun', () => {
    // Anchors on opposite sides of the Sun, same radius. A straight chord would
    // pass through the origin; the heliocentric arc must stay at the orbit radius.
    const left = { x: 100, y: 0 };
    const right = { x: -100, y: 0 };
    for (let i = 1; i < 10; i++) {
      const p = phasePoint(left, right, i / 10);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 4);
    }
  });

  it('sweeps the angle prograde (forward), never retreating', () => {
    // `to` sits just clockwise (negative angle) of `from`; going prograde means
    // sweeping the long way round, so the craft first moves to positive y.
    const from = { x: 100, y: 0 };
    const to = { x: 100 * Math.cos(-0.2), y: 100 * Math.sin(-0.2) };
    const p = phasePoint(from, to, 0.01);
    expect(p.y).toBeGreaterThan(0);
  });

  it('collapses to the shared anchor when the endpoints coincide', () => {
    const p = phasePoint(A, A, 0.5);
    expect(p.x).toBeCloseTo(A.x, 6);
    expect(p.y).toBeCloseTo(A.y, 6);
  });
});

describe('phases — mission itinerary config', () => {
  const bodies = bodiesJson as unknown as BodyData[];
  const spacecraft = spacecraftJson as unknown as SpacecraftData[];

  // Anchors must be bodies that orbit the Sun directly; an unknown id would make
  // the scene fall back to the origin and park the craft on the Sun.
  const solarBodyIds = new Set(
    bodies.filter((b) => b.host === null && b.orbitalRadius_mkm > 0).map((b) => b.id),
  );
  const phased = spacecraft.filter((c) => c.phases && c.phases.length > 0);

  it('every phased craft anchors only to real solar-orbiting bodies', () => {
    for (const craft of phased) {
      for (const phase of craft.phases!) {
        expect(solarBodyIds.has(phase.from)).toBe(true);
        expect(solarBodyIds.has(phase.to)).toBe(true);
      }
    }
  });

  it('BepiColombo cruises Earth -> Venus -> Mercury and settles at Mercury', () => {
    const bepi = spacecraft.find((c) => c.id === 'bepicolombo');
    expect(bepi?.phases).toBeDefined();
    const legs = bepi!.phases!.map((p) => `${p.from}->${p.to}`);
    expect(legs).toEqual([
      'earth->venus',
      'venus->venus',
      'venus->mercury',
      'mercury->mercury',
    ]);
    // One-way mission: it ends parked at Mercury, never returning to Earth.
    expect(bepi!.phases![bepi!.phases!.length - 1].to).toBe('mercury');
  });
});
