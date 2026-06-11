import { computeLinearLayout } from '../logic/linearLayout';

const MARGIN = 10;

describe('linearLayout — computeLinearLayout', () => {
  it('keeps a single element at its baseline position regardless of radius', () => {
    const out = computeLinearLayout([{ id: 'earth', baseY: 175, radiusPx: 80 }], MARGIN);
    expect(out).toEqual([{ id: 'earth', y: 175 }]);
  });

  it('keeps well-separated elements at their exact baseline positions', () => {
    const out = computeLinearLayout(
      [
        { id: 'earth', baseY: 175, radiusPx: 6 },
        { id: 'mars', baseY: 214, radiusPx: 5 }, // 39 px apart > radii + margin (21)
      ],
      MARGIN,
    );
    expect(out).toEqual([
      { id: 'earth', y: 175 },
      { id: 'mars', y: 214 },
    ]);
  });

  it('pushes a satellite clear of its host disc, not just its center', () => {
    const out = computeLinearLayout(
      [
        { id: 'jupiter', baseY: 489.25, radiusPx: 80 },
        { id: 'io', baseY: 489.45, radiusPx: 6 }, // ~0.2 px away
      ],
      MARGIN,
    );
    expect(out[0].y).toBe(489.25);
    expect(out[1].y).toBe(489.25 + 80 + 6 + MARGIN);
  });

  it('stacks a cluster of moons clearing each prior disc in turn', () => {
    const out = computeLinearLayout(
      [
        { id: 'jupiter', baseY: 489.25, radiusPx: 80 },
        { id: 'io', baseY: 489.45, radiusPx: 6 },
        { id: 'europa', baseY: 489.6, radiusPx: 6 },
        { id: 'ganymede', baseY: 489.8, radiusPx: 7 },
      ],
      MARGIN,
    );
    const ioY = 489.25 + 80 + 6 + MARGIN;
    const europaY = ioY + 6 + 6 + MARGIN;
    const ganymedeY = europaY + 6 + 7 + MARGIN;
    expect(out.map((p) => p.y)).toEqual([489.25, ioY, europaY, ganymedeY]);
  });

  it('does not cascade the gap beyond the cluster onto a distant body', () => {
    const out = computeLinearLayout(
      [
        { id: 'jupiter', baseY: 489.25, radiusPx: 80 },
        { id: 'io', baseY: 489.45, radiusPx: 6 },
        { id: 'saturn', baseY: 817, radiusPx: 70 }, // far enough to keep its baseline
      ],
      MARGIN,
    );
    expect(out[2]).toEqual({ id: 'saturn', y: 817 });
  });

  it('sorts elements by baseline position before laying them out', () => {
    const out = computeLinearLayout(
      [
        { id: 'mars', baseY: 214, radiusPx: 5 },
        { id: 'sun', baseY: 100, radiusPx: 80 },
        { id: 'earth', baseY: 175, radiusPx: 6 },
      ],
      MARGIN,
    );
    expect(out.map((p) => p.id)).toEqual(['sun', 'earth', 'mars']);
  });
});
