import { phasePoint } from '../logic/phases';

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
