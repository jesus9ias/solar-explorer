/**
 * Solar Explorer — scale and coordinate conversion functions.
 *
 * Pure functions: no Phaser, no DOM, no state. All bounds come from constants.
 */
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
  BODY_RADIUS_PX_PER_KM,
} from '../constants/constants';

/** Clamp a value into the inclusive [min, max] range. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Convert a distance in million km to astronomical units. */
export function convertMkmToAU(mkm: number): number {
  return mkm / MKM_PER_AU;
}

/** Convert a distance in astronomical units to million km. */
export function convertAUToMkm(au: number): number {
  return au * MKM_PER_AU;
}

/**
 * Map a real orbital radius (million km) onto a screen radius (px) using a
 * linear scale bounded by the configured min/max constants.
 *
 * Returns exactly MIN_SCREEN_RADIUS at MIN_REAL_RADIUS_MKM and exactly
 * MAX_SCREEN_RADIUS at MAX_REAL_RADIUS_MKM, increasing linearly between.
 * Preserves true distance proportions so the vast gaps beyond Jupiter are
 * faithfully represented in the ellipse view.
 */
export function linearScale(realRadiusMkm: number): number {
  const fraction =
    (realRadiusMkm - MIN_REAL_RADIUS_MKM) / (MAX_REAL_RADIUS_MKM - MIN_REAL_RADIUS_MKM);
  return MIN_SCREEN_RADIUS + fraction * (MAX_SCREEN_RADIUS - MIN_SCREEN_RADIUS);
}

/**
 * Inverse of {@link linearScale}: map a screen radius (px) back to the real
 * orbital radius (million km). Used to translate the Ellipse camera extent
 * into a solar distance when switching modes.
 */
export function inverseLinearScale(screenRadius: number): number {
  const fraction =
    (screenRadius - MIN_SCREEN_RADIUS) / (MAX_SCREEN_RADIUS - MIN_SCREEN_RADIUS);
  return MIN_REAL_RADIUS_MKM + fraction * (MAX_REAL_RADIUS_MKM - MIN_REAL_RADIUS_MKM);
}

/** Clamp a requested pixels-per-million-km zoom into the allowed range. */
export function pixelsPerMkm(requestedPxPerMkm: number): number {
  return clamp(requestedPxPerMkm, ZOOM_MIN_PX_PER_MKM, ZOOM_MAX_PX_PER_MKM);
}

/**
 * Map a real body radius (km) onto a rendered radius (px), proportional to the
 * real radius but clamped so every body stays between the min and max bounds.
 */
export function bodyRadiusPx(realRadiusKm: number): number {
  const proportional = realRadiusKm * BODY_RADIUS_PX_PER_KM;
  return clamp(proportional, BODY_MIN_RADIUS_PX, BODY_MAX_RADIUS_PX);
}
