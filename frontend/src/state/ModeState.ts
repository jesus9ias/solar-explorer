/**
 * Solar Explorer — ModeState.
 *
 * Current navigation mode (Linear | Ellipse). In memory, derived from
 * UserPreferences on load and kept in sync with it. Scenes subscribe here to
 * react to mode changes.
 */
import { Mode } from '../constants/constants';
import { userPreferences } from './UserPreferences';

type Listener = (mode: Mode) => void;

export class ModeState {
  private mode: Mode;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.mode = userPreferences.getMode();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getMode(): Mode {
    return this.mode;
  }

  /** Update the mode and persist it through UserPreferences. */
  setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    userPreferences.setMode(mode);
    for (const listener of this.listeners) listener(mode);
  }
}

/** Shared singleton used by the app. */
export const modeState = new ModeState();
