/**
 * Solar Explorer — Linear mode distance↔pixel mapping.
 *
 * The solar system spans ~3 orders of magnitude: the four inner planets occupy
 * under 1% of the distance out to the interstellar probes. A single uniform
 * pixels-per-Mkm scale therefore can't serve both ends — separating the inner
 * planets makes the outer scroll absurdly long, and fitting the outer system
 * crushes the inner planets into one column.
 *
 * This module applies a piecewise-linear scale: an expanded rate up to the
 * asteroid belt seam, then the base zoom rate beyond it. The outer system is
 * therefore drawn exactly as it would be without the seam — same spacing, just
 * shifted down by the inner expansion — while the inner planets get room to
 * breathe. The scale stays linear (and faithful) within each zone; only the rate
 * changes at the seam, which the ruler marks so it is visible, not misleading.
 *
 * Single source of truth for the forward and inverse mapping. Pure: no Phaser,
 * no DOM, no state. The seam and expansion come from constants; zoom (the base
 * outer rate) and the top padding are supplied by the caller.
 */
import {
  LINEAR_SCALE_SEAM_MKM,
  LINEAR_INNER_EXPANSION,
} from '../constants/constants';

/**
 * Map a solar distance (million km) to a world-space Y (px) under the piecewise
 * scale, given the base outer rate (zoom) and the top padding before the Sun.
 */
export function linearDistanceToY(
  distanceMkm: number,
  zoom: number,
  topPaddingPx: number,
): number {
  const inner = Math.min(distanceMkm, LINEAR_SCALE_SEAM_MKM);
  const outer = Math.max(0, distanceMkm - LINEAR_SCALE_SEAM_MKM);
  return topPaddingPx + (inner * LINEAR_INNER_EXPANSION + outer) * zoom;
}

/**
 * Inverse of {@link linearDistanceToY}: map a world-space Y (px) back to a solar
 * distance (million km). Distances above the top padding clamp to zero.
 */
export function linearYToDistance(
  y: number,
  zoom: number,
  topPaddingPx: number,
): number {
  const offset = Math.max(0, (y - topPaddingPx) / zoom);
  const seamOffset = LINEAR_SCALE_SEAM_MKM * LINEAR_INNER_EXPANSION;
  if (offset <= seamOffset) return offset / LINEAR_INNER_EXPANSION;
  return LINEAR_SCALE_SEAM_MKM + (offset - seamOffset);
}
