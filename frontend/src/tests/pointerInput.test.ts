import { bodyHitRadiusPx, isTapGesture } from '../logic/pointerInput';
import {
  HIT_RADIUS_FACTOR,
  MIN_HIT_RADIUS_PX,
  HIT_PADDING_MAX_PX,
  TAP_MAX_MOVE_PX,
  BODY_MAX_RADIUS_PX,
  SUN_ELLIPSE_SCALE,
  MIN_SCREEN_RADIUS,
} from '../constants/constants';

describe('pointerInput — bodyHitRadiusPx', () => {
  it('floors tiny bodies at the minimum tappable radius', () => {
    expect(bodyHitRadiusPx(1)).toBe(MIN_HIT_RADIUS_PX);
  });

  it('pads small bodies by the factor when below the padding cap', () => {
    // 6 * 1.4 = 8.4, which is above the floor and within +HIT_PADDING_MAX_PX.
    expect(bodyHitRadiusPx(6)).toBeCloseTo(6 * HIT_RADIUS_FACTOR, 6);
  });

  it('caps the padding so large bodies are not over-inflated', () => {
    const r = BODY_MAX_RADIUS_PX; // 80; 80*1.4=112 would far exceed the cap
    expect(bodyHitRadiusPx(r)).toBe(r + HIT_PADDING_MAX_PX);
  });

  it('keeps the scaled Sun hit area inside Mercury orbit', () => {
    // The Sun renders at BODY_MAX_RADIUS_PX then is scaled by SUN_ELLIPSE_SCALE.
    // Its world-space hit radius must stay clear of Mercury at MIN_SCREEN_RADIUS.
    const worldHit = bodyHitRadiusPx(BODY_MAX_RADIUS_PX) * SUN_ELLIPSE_SCALE;
    expect(worldHit).toBeLessThan(MIN_SCREEN_RADIUS);
  });

  it('never returns less than the rendered radius', () => {
    for (const r of [3, 10, 40, 80]) {
      expect(bodyHitRadiusPx(r)).toBeGreaterThanOrEqual(Math.min(r, MIN_HIT_RADIUS_PX));
    }
  });
});

describe('pointerInput — isTapGesture', () => {
  it('counts a stationary press as a tap', () => {
    expect(isTapGesture(0)).toBe(true);
  });

  it('counts small jitter within the threshold as a tap', () => {
    expect(isTapGesture(TAP_MAX_MOVE_PX)).toBe(true);
  });

  it('rejects a drag beyond the threshold', () => {
    expect(isTapGesture(TAP_MAX_MOVE_PX + 0.01)).toBe(false);
  });
});
