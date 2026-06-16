import { orbitAngleRad, orbitPositionAt, yearsToOrbitMs, isOrbiting } from '../logic/orbit';
import {
  EARTH_YEAR_MS,
  FULL_CIRCLE_RAD,
  NON_ORBITING_PROBE_IDS,
} from '../constants/constants';

const EARTH_PERIOD_YEARS = 1;
const JUPITER_PERIOD_YEARS = 11.86;
const SPEED_1X = 1;
const SPEED_5X = 5;

describe('orbit — angle progression', () => {
  it('orbitAngle for Earth at t=0 returns the initial angle (0)', () => {
    expect(orbitAngleRad(0, yearsToOrbitMs(EARTH_PERIOD_YEARS), SPEED_1X)).toBeCloseTo(
      0,
      6,
    );
  });

  it('orbitAngle for Earth after one year at 1x returns a full circle', () => {
    const period = yearsToOrbitMs(EARTH_PERIOD_YEARS);
    expect(orbitAngleRad(EARTH_YEAR_MS, period, SPEED_1X)).toBeCloseTo(
      FULL_CIRCLE_RAD,
      6,
    );
  });

  it('orbitAngle at 5x is five times the angle at 1x', () => {
    const period = yearsToOrbitMs(EARTH_PERIOD_YEARS);
    const delta = EARTH_YEAR_MS / 4;
    const at1x = orbitAngleRad(delta, period, SPEED_1X);
    const at5x = orbitAngleRad(delta, period, SPEED_5X);
    expect(at5x).toBeCloseTo(at1x * SPEED_5X, 6);
  });

  it('orbitAngle for Jupiter advances ~11.86x slower than Earth', () => {
    const delta = EARTH_YEAR_MS;
    const earth = orbitAngleRad(delta, yearsToOrbitMs(EARTH_PERIOD_YEARS), SPEED_1X);
    const jupiter = orbitAngleRad(delta, yearsToOrbitMs(JUPITER_PERIOD_YEARS), SPEED_1X);
    expect(jupiter).toBeCloseTo(earth / JUPITER_PERIOD_YEARS, 6);
  });
});

describe('orbit — analytic position on an ellipse', () => {
  const PERIOD = yearsToOrbitMs(EARTH_PERIOD_YEARS);

  it('at t=0 sits at the initial angle on the major axis', () => {
    const p = orbitPositionAt(0, PERIOD, 100, 80, 0);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('after a quarter period reaches the minor-axis extreme', () => {
    // Y is flipped so bodies orbit counterclockwise on screen (true prograde,
    // as seen from ecliptic north), so a quarter turn lands at negative y.
    const p = orbitPositionAt(PERIOD / 4, PERIOD, 100, 80, 0);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(-80, 6);
  });

  it('honors the initial angle offset', () => {
    const p = orbitPositionAt(0, PERIOD, 100, 100, Math.PI / 2);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(-100, 6);
  });

  it('depends only on elapsed time (speed history is irrelevant)', () => {
    // The same elapsed time must yield the same point regardless of how it was
    // reached — this is what lets the mission predict a future rendezvous.
    const a = orbitPositionAt(PERIOD * 0.3, PERIOD, 50, 50, 1);
    const b = orbitPositionAt(PERIOD * 0.3, PERIOD, 50, 50, 1);
    expect(a).toEqual(b);
  });
});

describe('orbit — non-orbiting probes', () => {
  it('interstellar probes report isOrbiting === false', () => {
    expect(isOrbiting(NON_ORBITING_PROBE_IDS[0])).toBe(false);
  });
});
