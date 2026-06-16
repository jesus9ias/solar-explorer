import {
  convertMkmToAU,
  linearScale,
  pixelsPerMkm,
  bodyRadiusPx,
} from '../logic/scale';
import {
  MKM_PER_AU,
  MIN_REAL_RADIUS_MKM,
  MAX_REAL_RADIUS_MKM,
  MIN_SCREEN_RADIUS,
  MAX_SCREEN_RADIUS,
  ZOOM_MIN_PX_PER_MKM,
  ZOOM_MAX_PX_PER_MKM,
  BODY_MIN_RADIUS_PX,
  BODY_MAX_RADIUS_PX,
} from '../constants/constants';

const FLOAT_TOLERANCE = 1e-6;

describe('scale — unit conversion', () => {
  it('convertMkmToAU converts correctly', () => {
    expect(convertMkmToAU(MKM_PER_AU)).toBeCloseTo(1.0, 6);
  });
});

describe('scale — linear orbital radii', () => {
  it('linearScale returns MIN_SCREEN_RADIUS for the smallest real radius', () => {
    expect(linearScale(MIN_REAL_RADIUS_MKM)).toBeCloseTo(MIN_SCREEN_RADIUS, 6);
  });

  it('linearScale returns MAX_SCREEN_RADIUS for the largest real radius', () => {
    expect(linearScale(MAX_REAL_RADIUS_MKM)).toBeCloseTo(MAX_SCREEN_RADIUS, 6);
  });

  it('linearScale returns a value between min and max for mid-range input', () => {
    const mid = (MIN_REAL_RADIUS_MKM + MAX_REAL_RADIUS_MKM) / 2;
    const result = linearScale(mid);
    expect(result).toBeGreaterThan(MIN_SCREEN_RADIUS);
    expect(result).toBeLessThan(MAX_SCREEN_RADIUS);
  });

  it('linearScale maps the arithmetic midpoint to the arithmetic midpoint of screen radii', () => {
    const mid = (MIN_REAL_RADIUS_MKM + MAX_REAL_RADIUS_MKM) / 2;
    const expectedMid = (MIN_SCREEN_RADIUS + MAX_SCREEN_RADIUS) / 2;
    expect(linearScale(mid)).toBeCloseTo(expectedMid, 6);
  });

  it('linearScale is monotonically increasing', () => {
    const r1 = MIN_REAL_RADIUS_MKM * 2;
    const r2 = MIN_REAL_RADIUS_MKM * 4;
    expect(linearScale(r1)).toBeLessThan(linearScale(r2));
  });

  it('linearScale extrapolates beyond MAX_REAL_RADIUS_MKM for distant probes', () => {
    const voyager1 = 24000;
    expect(linearScale(voyager1)).toBeGreaterThan(MAX_SCREEN_RADIUS);
  });
});

describe('scale — zoom clamping', () => {
  it('pixelsPerMkm clamps to the minimum zoom', () => {
    expect(pixelsPerMkm(ZOOM_MIN_PX_PER_MKM - 1)).toBeCloseTo(
      ZOOM_MIN_PX_PER_MKM,
      FLOAT_TOLERANCE,
    );
  });

  it('pixelsPerMkm clamps to the maximum zoom', () => {
    expect(pixelsPerMkm(ZOOM_MAX_PX_PER_MKM + 100)).toBeCloseTo(
      ZOOM_MAX_PX_PER_MKM,
      FLOAT_TOLERANCE,
    );
  });
});

describe('scale — body radius bounds', () => {
  it('bodyRadiusPx respects the minimum', () => {
    const verySmallRadiusKm = 1;
    expect(bodyRadiusPx(verySmallRadiusKm)).toBeGreaterThanOrEqual(
      BODY_MIN_RADIUS_PX,
    );
  });

  it('bodyRadiusPx respects the maximum', () => {
    const veryLargeRadiusKm = 1_000_000;
    expect(bodyRadiusPx(veryLargeRadiusKm)).toBeLessThanOrEqual(
      BODY_MAX_RADIUS_PX,
    );
  });
});
