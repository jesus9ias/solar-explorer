/**
 * Solar Explorer — language resolution helper.
 *
 * Builds, per language, a flat dictionary of dotted keys from:
 *   - ui.json (UI labels, button text, modal titles, ...),
 *   - body names/descriptions from bodies.json (`<id>.name`, `<id>.description`),
 *   - spacecraft names/objectives from spacecraft.json.
 *
 * `getText` resolves a key in the requested language and falls back to English
 * when the localized value is missing, throwing when the key exists nowhere.
 */
import { Language } from '../constants/constants';
import uiJson from '../config/ui.json';
import bodiesJson from '../config/bodies.json';
import spacecraftJson from '../config/spacecraft.json';

/** Thrown when a requested i18n key does not exist in any language. */
export class I18nKeyNotFoundError extends Error {
  constructor(key: string) {
    super(`i18n key not found: ${key}`);
    this.name = 'I18nKeyNotFoundError';
  }
}

type FlatDictionary = Record<string, string>;

interface LocalizedEntry {
  readonly name?: string;
  readonly description?: string;
  readonly objectives?: string;
}

interface ConfigEntry {
  readonly id: string;
  readonly en?: LocalizedEntry;
  readonly es?: LocalizedEntry;
}

const KEY_SEPARATOR = '.';

const dictionaryCache: Partial<Record<Language, FlatDictionary>> = {};

/** Recursively flatten a nested object into dotted-key string leaves. */
function flatten(
  source: Record<string, unknown>,
  prefix: string,
  out: FlatDictionary,
): void {
  for (const [rawKey, value] of Object.entries(source)) {
    const key = prefix ? `${prefix}${KEY_SEPARATOR}${rawKey}` : rawKey;
    if (typeof value === 'string') {
      out[key] = value;
    } else if (value && typeof value === 'object') {
      flatten(value as Record<string, unknown>, key, out);
    }
  }
}

/** Add `<id>.name`, `<id>.description`, `<id>.objectives` for config entries. */
function addEntries(
  entries: readonly ConfigEntry[],
  lang: Language,
  out: FlatDictionary,
): void {
  for (const entry of entries) {
    const localized = entry[lang];
    if (!localized) continue;
    if (localized.name) out[`${entry.id}${KEY_SEPARATOR}name`] = localized.name;
    if (localized.description) {
      out[`${entry.id}${KEY_SEPARATOR}description`] = localized.description;
    }
    if (localized.objectives) {
      out[`${entry.id}${KEY_SEPARATOR}objectives`] = localized.objectives;
    }
  }
}

function buildDictionary(lang: Language): FlatDictionary {
  const dictionary: FlatDictionary = {};

  const uiByLang = (uiJson as Record<string, unknown>)[lang];
  if (uiByLang && typeof uiByLang === 'object') {
    flatten(uiByLang as Record<string, unknown>, '', dictionary);
  }

  if (Array.isArray(bodiesJson)) {
    addEntries(bodiesJson as ConfigEntry[], lang, dictionary);
  }
  if (Array.isArray(spacecraftJson)) {
    addEntries(spacecraftJson as ConfigEntry[], lang, dictionary);
  }

  return dictionary;
}

function dictionaryFor(lang: Language): FlatDictionary {
  let cached = dictionaryCache[lang];
  if (!cached) {
    cached = buildDictionary(lang);
    dictionaryCache[lang] = cached;
  }
  return cached;
}

/**
 * Resolve a localized string by dotted key for the given language, falling
 * back to English when the key is missing in the requested language.
 */
export function getText(key: string, lang: Language): string {
  const localized = dictionaryFor(lang);
  if (key in localized) return localized[key];

  const english = dictionaryFor(Language.EN);
  if (key in english) return english[key];

  throw new I18nKeyNotFoundError(key);
}
