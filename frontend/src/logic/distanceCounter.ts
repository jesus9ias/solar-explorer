/**
 * Solar Explorer — Linear-mode distance counter logic.
 *
 * Pure helpers for the fixed left-side readout: which "zone" of the journey a
 * distance falls in (used to recolor the counter), the color for a zone, and
 * the quantized, unit-aware string the counter displays.
 */
import {
  Unit,
  COUNTER_STEP_MKM,
  COUNTER_STEP_AU,
  COUNTER_ZONE_INNER_MAX_MKM,
  COUNTER_ZONE_OUTER_MAX_MKM,
  COUNTER_ZONE_KUIPER_MAX_MKM,
  COLOR_ZONE_INNER,
  COLOR_ZONE_OUTER,
  COLOR_ZONE_KUIPER,
  COLOR_ZONE_INTERSTELLAR,
} from '../constants/constants';
import { convertMkmToAU } from './scale';

/** Regions of the journey, ordered outward, each with its own counter color. */
export enum DistanceZone {
  Inner = 'inner',
  Outer = 'outer',
  Kuiper = 'kuiper',
  Interstellar = 'interstellar',
}

/** Classify a solar distance (million km) into its journey zone. */
export function distanceZone(distanceMkm: number): DistanceZone {
  if (distanceMkm < COUNTER_ZONE_INNER_MAX_MKM) return DistanceZone.Inner;
  if (distanceMkm < COUNTER_ZONE_OUTER_MAX_MKM) return DistanceZone.Outer;
  if (distanceMkm < COUNTER_ZONE_KUIPER_MAX_MKM) return DistanceZone.Kuiper;
  return DistanceZone.Interstellar;
}

/** The theme color (hex string) used to render the counter within a zone. */
export function zoneColor(zone: DistanceZone): string {
  switch (zone) {
    case DistanceZone.Inner:
      return COLOR_ZONE_INNER;
    case DistanceZone.Outer:
      return COLOR_ZONE_OUTER;
    case DistanceZone.Kuiper:
      return COLOR_ZONE_KUIPER;
    case DistanceZone.Interstellar:
      return COLOR_ZONE_INTERSTELLAR;
  }
}

/**
 * Quantize a solar distance to the counter's step in the active unit and format
 * it for display: nearest 10 in million km (integer), nearest 0.1 in AU (one
 * decimal).
 */
export function formatCounter(distanceMkm: number, unit: Unit): string {
  if (unit === Unit.AU) {
    const au = convertMkmToAU(distanceMkm);
    const stepped = Math.round(au / COUNTER_STEP_AU) * COUNTER_STEP_AU;
    return stepped.toFixed(1);
  }
  const stepped = Math.round(distanceMkm / COUNTER_STEP_MKM) * COUNTER_STEP_MKM;
  return `${stepped}`;
}
