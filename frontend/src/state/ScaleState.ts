/**
 * Solar Explorer — ScaleState.
 *
 * Current distance unit and Linear-mode zoom level. In memory, derived from
 * UserPreferences on load. The zoom is stored as a pixels-per-million-km
 * multiplier and clamped to the configured range.
 */
import { Unit, ZOOM_MAX_PX_PER_MKM } from '../constants/constants';
import { pixelsPerMkm } from '../logic/scale';
import { userPreferences } from './UserPreferences';

type Listener = () => void;

/**
 * Sensible starting zoom within the allowed range. This is the base (outer) rate;
 * the inner planets are spread independently by the piecewise Linear scale, so
 * the outer system keeps its original 1 px/Mkm spacing.
 */
const INITIAL_PX_PER_MKM = 1;

export class ScaleState {
  private unit: Unit;
  private zoomPxPerMkm: number;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.unit = userPreferences.getUnit();
    this.zoomPxPerMkm = pixelsPerMkm(INITIAL_PX_PER_MKM);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  getUnit(): Unit {
    return this.unit;
  }

  /** Update the distance unit and persist it through UserPreferences. */
  setUnit(unit: Unit): void {
    if (unit === this.unit) return;
    this.unit = unit;
    userPreferences.setUnit(unit);
    this.notify();
  }

  getZoom(): number {
    return this.zoomPxPerMkm;
  }

  /** Set the zoom multiplier, clamped to the allowed pixels-per-Mkm range. */
  setZoom(pxPerMkm: number): void {
    this.zoomPxPerMkm = pixelsPerMkm(pxPerMkm);
    this.notify();
  }

  /** Maximum zoom multiplier, exposed for HUD bounds. */
  get maxZoom(): number {
    return ZOOM_MAX_PX_PER_MKM;
  }
}

/** Shared singleton used by the app. */
export const scaleState = new ScaleState();
