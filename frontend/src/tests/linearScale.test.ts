import { linearDistanceToY, linearYToDistance } from '../logic/linearScale';
import {
  LINEAR_SCALE_SEAM_MKM as SEAM,
  LINEAR_INNER_EXPANSION as EXPANSION,
} from '../constants/constants';

const TOP = 100;

describe('linearScale — linearDistanceToY', () => {
  it('places the Sun at the top padding', () => {
    expect(linearDistanceToY(0, 1, TOP)).toBe(TOP);
  });

  it('uses the expanded rate inside the inner zone', () => {
    expect(linearDistanceToY(200, 1, TOP)).toBe(TOP + 200 * EXPANSION);
    expect(linearDistanceToY(200, 2, TOP)).toBe(TOP + 200 * EXPANSION * 2);
  });

  it('reaches the seam at the expanded rate', () => {
    expect(linearDistanceToY(SEAM, 1, TOP)).toBe(TOP + SEAM * EXPANSION);
  });

  it('keeps the base rate beyond the seam', () => {
    const past = 100;
    // outer body moves at the base (zoom) rate, just offset by the inner expansion
    expect(linearDistanceToY(SEAM + past, 1, TOP)).toBeCloseTo(
      TOP + SEAM * EXPANSION + past,
    );
  });

  it('preserves outer spacing: two outer bodies are base-rate apart', () => {
    const a = linearDistanceToY(800, 1, TOP);
    const b = linearDistanceToY(900, 1, TOP);
    expect(b - a).toBeCloseTo(100); // base rate of 1 px/Mkm, unaffected by the seam
  });

  it('increases monotonically across the seam', () => {
    const ys = [0, 100, SEAM - 1, SEAM, SEAM + 1, 2000, 5000].map((d) =>
      linearDistanceToY(d, 1, TOP),
    );
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    }
  });
});

describe('linearScale — linearYToDistance', () => {
  it('is the exact inverse in the inner zone', () => {
    const d = 250;
    expect(linearYToDistance(linearDistanceToY(d, 1.5, TOP), 1.5, TOP)).toBeCloseTo(d);
  });

  it('is the exact inverse in the outer zone', () => {
    const d = 4495; // Neptune
    expect(linearYToDistance(linearDistanceToY(d, 1.5, TOP), 1.5, TOP)).toBeCloseTo(d);
  });

  it('clamps anything above the top padding to a non-negative distance', () => {
    expect(linearYToDistance(TOP - 50, 1, TOP)).toBe(0);
  });
});
