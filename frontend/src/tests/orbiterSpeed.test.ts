import { ringSpeedFactor, resolveOrbiterSpeedFactor } from '../logic/orbiterSpeed';
import {
  ELLIPSE_ORBITER_SPEED_INNER as INNER,
  ELLIPSE_ORBITER_SPEED_OUTER as OUTER,
} from '../constants/constants';

describe('orbiterSpeed — ringSpeedFactor', () => {
  it('gives the innermost ring the fastest factor', () => {
    expect(ringSpeedFactor(0, 4)).toBe(INNER);
  });

  it('gives the outermost ring the slowest factor', () => {
    expect(ringSpeedFactor(3, 4)).toBe(OUTER);
  });

  it('decreases monotonically from inner to outer', () => {
    const factors = [0, 1, 2, 3].map((i) => ringSpeedFactor(i, 4));
    for (let i = 1; i < factors.length; i++) {
      expect(factors[i]).toBeLessThan(factors[i - 1]);
    }
  });

  it('gives a lone orbiter the midpoint factor', () => {
    expect(ringSpeedFactor(0, 1)).toBeCloseTo((INNER + OUTER) / 2);
  });
});

describe('orbiterSpeed — resolveOrbiterSpeedFactor', () => {
  it('uses the explicit data factor when provided', () => {
    expect(resolveOrbiterSpeedFactor(2.5, 0, 4)).toBe(2.5);
  });

  it('falls back to the ring default when no explicit factor', () => {
    expect(resolveOrbiterSpeedFactor(undefined, 2, 4)).toBe(ringSpeedFactor(2, 4));
  });
});
