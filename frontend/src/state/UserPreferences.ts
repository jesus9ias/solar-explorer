/**
 * Solar Explorer — UserPreferences.
 *
 * The persisted switch state (language, mode, unit, audio). Values are read
 * from and written to localStorage. UI and scenes never touch localStorage
 * directly — they go through this state layer and subscribe for changes.
 */
import {
  Language,
  Mode,
  Unit,
  LS_KEY_LANGUAGE,
  LS_KEY_MODE,
  LS_KEY_UNIT,
  LS_KEY_AUDIO,
  DEFAULT_LANGUAGE,
  DEFAULT_MODE,
  DEFAULT_UNIT,
  DEFAULT_AUDIO_ENABLED,
} from '../constants/constants';

type Listener = () => void;

const BOOLEAN_TRUE = 'true';
const BOOLEAN_FALSE = 'false';

/** localStorage if available (guards against SSR / non-browser contexts). */
function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Read a stored enum value, falling back to a default when absent/invalid. */
function readEnum<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const raw = safeStorage()?.getItem(key);
  return raw !== null && raw !== undefined && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : fallback;
}

export class UserPreferences {
  private language: Language;
  private mode: Mode;
  private unit: Unit;
  private audioEnabled: boolean;
  private readonly listeners = new Set<Listener>();

  constructor() {
    this.language = readEnum(LS_KEY_LANGUAGE, Object.values(Language), DEFAULT_LANGUAGE);
    this.mode = readEnum(LS_KEY_MODE, Object.values(Mode), DEFAULT_MODE);
    this.unit = readEnum(LS_KEY_UNIT, Object.values(Unit), DEFAULT_UNIT);
    this.audioEnabled =
      (safeStorage()?.getItem(LS_KEY_AUDIO) ?? String(DEFAULT_AUDIO_ENABLED)) ===
      BOOLEAN_TRUE;
  }

  /** Subscribe to any preference change. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private persist(key: string, value: string): void {
    safeStorage()?.setItem(key, value);
  }

  getLanguage(): Language {
    return this.language;
  }

  setLanguage(language: Language): void {
    this.language = language;
    this.persist(LS_KEY_LANGUAGE, language);
    this.notify();
  }

  getMode(): Mode {
    return this.mode;
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.persist(LS_KEY_MODE, mode);
    this.notify();
  }

  getUnit(): Unit {
    return this.unit;
  }

  setUnit(unit: Unit): void {
    this.unit = unit;
    this.persist(LS_KEY_UNIT, unit);
    this.notify();
  }

  isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  setAudio(enabled: boolean): void {
    this.audioEnabled = enabled;
    this.persist(LS_KEY_AUDIO, enabled ? BOOLEAN_TRUE : BOOLEAN_FALSE);
    this.notify();
  }
}

/** Shared singleton used by the app. */
export const userPreferences = new UserPreferences();
