import { missions, findMission } from '../logic/missions';
import { missionDurationYears } from '../logic/mission';
import {
  MISSION_SELF_ANCHOR,
  NON_ORBITING_PROBE_IDS,
  INTERSTELLAR_ESCAPE_LONGITUDE_DEG,
  BODY_MEAN_LONGITUDE_J2000_DEG,
} from '../constants/constants';
import type { BodyData, SpacecraftData } from '../logic/library';
import bodiesJson from '../config/bodies.json';
import spacecraftJson from '../config/spacecraft.json';

const bodies = bodiesJson as unknown as BodyData[];
const spacecraft = spacecraftJson as unknown as SpacecraftData[];

const solarBodyIds = new Set(
  bodies.filter((b) => b.host === null && b.orbitalRadius_mkm > 0).map((b) => b.id),
);
const craftIds = new Set(spacecraft.map((c) => c.id));

// The agreed first-delivery roster of Mission mode.
const EXPECTED_IDS = [
  'osiris_rex',
  'bepicolombo',
  'voyager1',
  'voyager2',
  'pioneer10',
  'pioneer11',
  'new_horizons',
];

describe('missions — config integrity', () => {
  it('includes exactly the agreed roster', () => {
    expect(missions.map((m) => m.id).sort()).toEqual([...EXPECTED_IDS].sort());
  });

  it('each mission references a real spacecraft', () => {
    for (const m of missions) expect(craftIds.has(m.spacecraftId)).toBe(true);
  });

  it('every phase anchor is a real solar-orbiting body or the self anchor', () => {
    for (const m of missions) {
      for (const phase of m.phases) {
        expect(solarBodyIds.has(phase.from)).toBe(true);
        expect(solarBodyIds.has(phase.to) || phase.to === MISSION_SELF_ANCHOR).toBe(true);
      }
    }
  });

  it('only the final phase may target the self anchor', () => {
    for (const m of missions) {
      m.phases.forEach((phase, i) => {
        if (phase.to === MISSION_SELF_ANCHOR) {
          expect(i).toBe(m.phases.length - 1);
        }
        expect(phase.from).not.toBe(MISSION_SELF_ANCHOR);
      });
    }
  });

  it('every phase has a positive duration and localized label', () => {
    for (const m of missions) {
      for (const phase of m.phases) {
        expect(phase.durationYears).toBeGreaterThan(0);
        expect(phase.en.label.length).toBeGreaterThan(0);
        expect(phase.es.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('every mission has localized name and summary', () => {
    for (const m of missions) {
      expect(m.en.name.length).toBeGreaterThan(0);
      expect(m.es.name.length).toBeGreaterThan(0);
      expect(m.en.summary.length).toBeGreaterThan(0);
      expect(m.es.summary.length).toBeGreaterThan(0);
    }
  });

  it('every mission has a parseable ISO launch date', () => {
    for (const m of missions) {
      expect(m.launchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(m.launchDate))).toBe(false);
    }
  });

  it('the stored durationYears matches the sum of its phases', () => {
    for (const m of missions) {
      expect(m.durationYears).toBeCloseTo(missionDurationYears(m.phases), 6);
    }
  });
});

describe('missions — historical seeding data completeness', () => {
  it('every interstellar (self-anchored) probe has an escape direction', () => {
    for (const id of NON_ORBITING_PROBE_IDS) {
      const lon = INTERSTELLAR_ESCAPE_LONGITUDE_DEG[id];
      expect(typeof lon).toBe('number');
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    }
  });

  it('every non-self mission anchor has a J2000 mean longitude', () => {
    const anchors = new Set<string>();
    for (const m of missions) {
      for (const p of m.phases) {
        if (p.from !== MISSION_SELF_ANCHOR) anchors.add(p.from);
        if (p.to !== MISSION_SELF_ANCHOR) anchors.add(p.to);
      }
    }
    for (const id of anchors) {
      expect(typeof BODY_MEAN_LONGITUDE_J2000_DEG[id]).toBe('number');
    }
  });
});

describe('missions — itinerary endpoints', () => {
  it('OSIRIS-REx returns to Earth', () => {
    const m = findMission('osiris_rex');
    expect(m?.phases.at(-1)?.to).toBe('earth');
  });

  it('BepiColombo settles in Mercury orbit', () => {
    const m = findMission('bepicolombo');
    expect(m?.phases.at(-1)?.to).toBe('mercury');
  });

  it('the escape probes end at their current known position (self)', () => {
    for (const id of ['voyager1', 'voyager2', 'pioneer10', 'pioneer11', 'new_horizons']) {
      expect(findMission(id)?.phases.at(-1)?.to).toBe(MISSION_SELF_ANCHOR);
    }
  });

  it('Voyager 2 visits all four giant planets in order', () => {
    const legs = findMission('voyager2')?.phases.map((p) => `${p.from}->${p.to}`);
    expect(legs).toEqual([
      'earth->jupiter',
      'jupiter->saturn',
      'saturn->uranus',
      'uranus->neptune',
      `neptune->${MISSION_SELF_ANCHOR}`,
    ]);
  });

  it('findMission returns null for an unknown id', () => {
    expect(findMission('nope')).toBeNull();
  });
});
