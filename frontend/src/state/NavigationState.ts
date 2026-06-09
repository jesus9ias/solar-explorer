/**
 * Solar Explorer — NavigationState.
 *
 * The current position expressed as a solar distance (million km). Held in
 * memory only (never persisted) so it survives a mode switch but is lost on
 * page reload. Shared between scenes so position is preserved across modes.
 */

type Listener = (distanceMkm: number) => void;

const INITIAL_DISTANCE_MKM = 0;

export class NavigationState {
  private distanceMkm = INITIAL_DISTANCE_MKM;
  private readonly listeners = new Set<Listener>();

  /** Subscribe to distance changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Current distance from the Sun in million km. */
  getDistance(): number {
    return this.distanceMkm;
  }

  /** Set the current distance from the Sun in million km. */
  setDistance(distanceMkm: number): void {
    this.distanceMkm = distanceMkm;
    for (const listener of this.listeners) listener(distanceMkm);
  }
}

/** Shared singleton used by the app. */
export const navigationState = new NavigationState();
