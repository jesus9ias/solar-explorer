import {
  DistanceZone,
  distanceZone,
  zoneColor,
  formatCounter,
} from '../logic/distanceCounter';
import {
  Unit,
  MKM_PER_AU,
  COUNTER_ZONE_INNER_MAX_MKM,
  COUNTER_ZONE_OUTER_MAX_MKM,
  COUNTER_ZONE_KUIPER_MAX_MKM,
  COLOR_ZONE_INNER,
  COLOR_ZONE_OUTER,
  COLOR_ZONE_KUIPER,
  COLOR_ZONE_INTERSTELLAR,
} from '../constants/constants';

describe('distanceCounter — distanceZone', () => {
  it('classifies the Sun and inner planets as the inner zone', () => {
    expect(distanceZone(0)).toBe(DistanceZone.Inner);
    expect(distanceZone(COUNTER_ZONE_INNER_MAX_MKM - 0.1)).toBe(DistanceZone.Inner);
  });

  it('switches to the outer zone at the asteroid-belt seam', () => {
    expect(distanceZone(COUNTER_ZONE_INNER_MAX_MKM)).toBe(DistanceZone.Outer);
    expect(distanceZone(COUNTER_ZONE_OUTER_MAX_MKM - 0.1)).toBe(DistanceZone.Outer);
  });

  it('switches to the Kuiper zone at Neptune and to interstellar at the heliopause', () => {
    expect(distanceZone(COUNTER_ZONE_OUTER_MAX_MKM)).toBe(DistanceZone.Kuiper);
    expect(distanceZone(COUNTER_ZONE_KUIPER_MAX_MKM - 0.1)).toBe(DistanceZone.Kuiper);
    expect(distanceZone(COUNTER_ZONE_KUIPER_MAX_MKM)).toBe(DistanceZone.Interstellar);
    expect(distanceZone(30000)).toBe(DistanceZone.Interstellar);
  });
});

describe('distanceCounter — zoneColor', () => {
  it('maps each zone to its theme color', () => {
    expect(zoneColor(DistanceZone.Inner)).toBe(COLOR_ZONE_INNER);
    expect(zoneColor(DistanceZone.Outer)).toBe(COLOR_ZONE_OUTER);
    expect(zoneColor(DistanceZone.Kuiper)).toBe(COLOR_ZONE_KUIPER);
    expect(zoneColor(DistanceZone.Interstellar)).toBe(COLOR_ZONE_INTERSTELLAR);
  });
});

describe('distanceCounter — formatCounter', () => {
  it('quantizes million-km readings to the nearest 10', () => {
    expect(formatCounter(1253, Unit.MKM)).toBe('1250');
    expect(formatCounter(1255, Unit.MKM)).toBe('1260');
    expect(formatCounter(0, Unit.MKM)).toBe('0');
  });

  it('quantizes AU readings to the nearest 0.1', () => {
    expect(formatCounter(MKM_PER_AU, Unit.AU)).toBe('1.0');
    expect(formatCounter(MKM_PER_AU * 1.04, Unit.AU)).toBe('1.0');
    expect(formatCounter(MKM_PER_AU * 8.37, Unit.AU)).toBe('8.4');
  });
});
