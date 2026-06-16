/**
 * Solar Explorer — pointer interaction logic.
 *
 * Pure functions deciding how raw pointer gestures map to intent: how big a
 * body's tappable hit area is, and whether a press/release pair is a tap
 * (selection) or a drag (pan/pinch). No Phaser, no DOM, no state — so the
 * tap-vs-drag rule and the hit-area sizing are unit-testable.
 */
import {
  HIT_RADIUS_FACTOR,
  MIN_HIT_RADIUS_PX,
  HIT_PADDING_MAX_PX,
  TAP_MAX_MOVE_PX,
} from '../constants/constants';

/**
 * Hit radius (px, in the body's own texture space) for a body rendered at
 * `renderedRadiusPx`. Pads small bodies up to a tappable size but caps the
 * padding so a large, later-scaled body (the Sun) never claims empty space past
 * the nearest orbit.
 */
export function bodyHitRadiusPx(renderedRadiusPx: number): number {
  const capped = Math.min(renderedRadiusPx * HIT_RADIUS_FACTOR, renderedRadiusPx + HIT_PADDING_MAX_PX);
  return Math.max(capped, MIN_HIT_RADIUS_PX);
}

/**
 * Whether a press→release that moved `pointerTravelPx` is a tap (element
 * selection) rather than a drag. A drag is a pan or pinch and must not open an
 * element's info.
 */
export function isTapGesture(pointerTravelPx: number): boolean {
  return pointerTravelPx <= TAP_MAX_MOVE_PX;
}
