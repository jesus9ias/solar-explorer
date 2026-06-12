import { computeOrbitRingRadii } from '../logic/orbitRings';

const GAP = 10;

describe('orbitRings — computeOrbitRingRadii', () => {
  it('returns no rings for a host with no orbiters', () => {
    expect(computeOrbitRingRadii(80, [], GAP)).toEqual([]);
  });

  it('places a single orbiter clear of the host disc', () => {
    // host disc 80 + gap + orbiter radius 6
    expect(computeOrbitRingRadii(80, [6], GAP)).toEqual([80 + GAP + 6]);
  });

  it('stacks multiple orbiters as concentric, non-overlapping rings', () => {
    const radii = computeOrbitRingRadii(80, [6, 6, 7], GAP);
    const r0 = 80 + GAP + 6; // 96
    const r1 = r0 + 6 + GAP + 6; // clears previous orbiter's disc
    const r2 = r1 + 6 + GAP + 7;
    expect(radii).toEqual([r0, r1, r2]);
  });

  it('clears even a tiny host disc by the full gap', () => {
    expect(computeOrbitRingRadii(8, [3], GAP)).toEqual([8 + GAP + 3]);
  });

  it('keeps every ring strictly increasing', () => {
    const radii = computeOrbitRingRadii(70, [5, 6, 4, 8], GAP);
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]).toBeGreaterThan(radii[i - 1]);
    }
  });
});
