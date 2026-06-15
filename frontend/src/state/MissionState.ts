/**
 * Solar Explorer — MissionState.
 *
 * Runtime state of the single active mission: which one is selected, whether it
 * is idle / running / complete, and how much simulation time has elapsed. The
 * selection and restart mode are persisted (delegated to {@link UserPreferences},
 * the localStorage owner); the run status and elapsed time are in-memory only —
 * a reload reopens the mission modal rather than resuming mid-flight.
 *
 * The scene advances `elapsedMs` every frame; the HUD years counter and the
 * phase-progress checklist subscribe here.
 */
import { MissionRestartMode, MissionRunState } from '../constants/constants';
import { userPreferences, type UserPreferences } from './UserPreferences';

type Listener = () => void;

export class MissionState {
  private readonly prefs: UserPreferences;
  private status: MissionRunState = MissionRunState.IDLE;
  private elapsedMs = 0;
  private readonly listeners = new Set<Listener>();

  constructor(prefs: UserPreferences) {
    this.prefs = prefs;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  /** The selected mission id (persisted), or null if none chosen yet. */
  getSelectedId(): string | null {
    return this.prefs.getMissionId();
  }

  /** Select a mission without starting it (e.g. preselect in the modal). */
  select(id: string | null): void {
    this.prefs.setMissionId(id);
    this.notify();
  }

  getStatus(): MissionRunState {
    return this.status;
  }

  getElapsedMs(): number {
    return this.elapsedMs;
  }

  /** Begin a mission: select it, reset the clock, and start running. */
  start(id: string): void {
    this.prefs.setMissionId(id);
    this.elapsedMs = 0;
    this.status = MissionRunState.RUNNING;
    this.notify();
  }

  /** Re-run the currently selected mission from the start. */
  restart(): void {
    this.elapsedMs = 0;
    this.status = MissionRunState.RUNNING;
    this.notify();
  }

  /** Advance (or set) the elapsed simulation time. Called each frame. */
  setElapsedMs(ms: number): void {
    this.elapsedMs = ms;
    this.notify();
  }

  /** Mark the active mission as finished; the scene freezes. */
  complete(): void {
    this.status = MissionRunState.COMPLETE;
    this.notify();
  }

  getRestartMode(): MissionRestartMode {
    return this.prefs.getMissionRestart();
  }

  setRestartMode(mode: MissionRestartMode): void {
    this.prefs.setMissionRestart(mode);
    this.notify();
  }
}

/** Shared singleton used by the app. */
export const missionState = new MissionState(userPreferences);
