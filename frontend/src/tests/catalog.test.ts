import {
  bodies,
  spacecraft,
  bodySolarDistanceMkm,
  craftSolarDistanceMkm,
} from '../logic/catalog';

describe('catalog — solar distance', () => {
  it('places the Sun at distance zero', () => {
    const sun = bodies.find((b) => b.type === 'star')!;
    expect(bodySolarDistanceMkm(sun)).toBe(0);
  });

  it('places a solar-orbiting body at its own orbital radius', () => {
    const earth = bodies.find((b) => b.id === 'earth')!;
    expect(bodySolarDistanceMkm(earth)).toBeCloseTo(earth.orbitalRadius_mkm, 6);
  });

  it('adds the host planet distance for every moon', () => {
    const moons = bodies.filter((b) => b.type === 'moon');
    expect(moons.length).toBeGreaterThan(0);
    for (const moon of moons) {
      const host = bodies.find((b) => b.id === moon.host)!;
      expect(bodySolarDistanceMkm(moon)).toBeCloseTo(
        host.orbitalRadius_mkm + moon.orbitalRadius_mkm,
        6,
      );
    }
  });

  it('adds the host distance for a host-orbiting craft', () => {
    const hosted = spacecraft.filter((c) => c.host !== null && c.host !== 'sun');
    for (const craft of hosted) {
      const host = bodies.find((b) => b.id === craft.host)!;
      expect(craftSolarDistanceMkm(craft)).toBeCloseTo(
        host.orbitalRadius_mkm + craft.orbitalRadius_mkm,
        6,
      );
    }
  });

  it('uses its own orbital radius for solar/interstellar craft', () => {
    const free = spacecraft.filter((c) => c.host === null || c.host === 'sun');
    for (const craft of free) {
      expect(craftSolarDistanceMkm(craft)).toBeCloseTo(craft.orbitalRadius_mkm, 6);
    }
  });
});
