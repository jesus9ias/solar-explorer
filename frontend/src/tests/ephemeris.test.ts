import { yearsSinceJ2000, heliocentricAngleAt } from '../logic/ephemeris';
import {
  FULL_CIRCLE_RAD,
  J2000_EPOCH_MS,
  MS_PER_JULIAN_YEAR,
} from '../constants/constants';

const DEG = Math.PI / 180;
const EARTH_PERIOD_YEARS = 1;

describe('ephemeris — years since J2000', () => {
  it('is zero at the J2000 epoch', () => {
    expect(yearsSinceJ2000(J2000_EPOCH_MS)).toBeCloseTo(0, 9);
  });

  it('is positive after J2000 and negative before', () => {
    expect(yearsSinceJ2000(J2000_EPOCH_MS + MS_PER_JULIAN_YEAR)).toBeCloseTo(1, 9);
    expect(yearsSinceJ2000(J2000_EPOCH_MS - MS_PER_JULIAN_YEAR)).toBeCloseTo(-1, 9);
  });

  it('measures a real launch date as years before J2000', () => {
    // Voyager 1 launched 5 Sept 1977 — about 22.3 years before J2000.
    const launch = Date.parse('1977-09-05');
    expect(yearsSinceJ2000(launch)).toBeCloseTo(-22.32, 1);
  });
});

describe('ephemeris — heliocentric angle from mean longitude', () => {
  const L0 = 100.46; // Earth-ish mean longitude at J2000, in degrees.

  it('returns the J2000 mean longitude (in radians) at the epoch', () => {
    expect(heliocentricAngleAt(J2000_EPOCH_MS, EARTH_PERIOD_YEARS, L0)).toBeCloseTo(L0 * DEG, 9);
  });

  it('advances one full circle per orbital period', () => {
    const oneYearLater = J2000_EPOCH_MS + MS_PER_JULIAN_YEAR;
    expect(heliocentricAngleAt(oneYearLater, EARTH_PERIOD_YEARS, L0)).toBeCloseTo(
      L0 * DEG + FULL_CIRCLE_RAD,
      9,
    );
  });

  it('advances slower for a longer period', () => {
    const oneYearLater = J2000_EPOCH_MS + MS_PER_JULIAN_YEAR;
    // Jupiter (~11.86 yr) sweeps 1/11.86 of a circle in one year.
    const ang = heliocentricAngleAt(oneYearLater, 11.86, 0);
    expect(ang).toBeCloseTo(FULL_CIRCLE_RAD / 11.86, 9);
  });

  it('runs backward (smaller angle) before J2000', () => {
    const oneYearBefore = J2000_EPOCH_MS - MS_PER_JULIAN_YEAR;
    expect(heliocentricAngleAt(oneYearBefore, EARTH_PERIOD_YEARS, L0)).toBeCloseTo(
      L0 * DEG - FULL_CIRCLE_RAD,
      9,
    );
  });
});
