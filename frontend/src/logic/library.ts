/**
 * Solar Explorer — library tree builder.
 *
 * Groups the raw config collections into the categories shown by the library
 * panel, localizing each item's name to the requested language.
 */
import { BodyType, Language, NON_ORBITING_PROBE_IDS } from '../constants/constants';
import { getText } from './i18n';
import type { Phase } from './phases';

/** Per-language text block for a celestial body. */
export interface LocalizedText {
  readonly name: string;
  readonly description?: string;
  readonly facts?: readonly string[];
}

/** A spacecraft instrument description. */
export interface Instrument {
  readonly name: string;
  readonly description: string;
}

/** Per-language text block for a spacecraft. */
export interface LocalizedSpacecraftText {
  readonly name: string;
  readonly objectives?: string;
  readonly instruments?: readonly Instrument[];
  readonly facts?: readonly string[];
}

/** Shape of a single entry in `bodies.json`. */
export interface BodyData {
  readonly id: string;
  readonly image?: string;
  readonly type: string;
  readonly host: string | null;
  readonly orbitalRadius_mkm: number;
  readonly orbitalPeriod_years: number;
  readonly rotationPeriod_days: number;
  readonly radius_km: number;
  readonly eccentricity: number;
  /** Optional Ellipse-mode visual speed factor (higher = faster); overrides the
   * ring-proximity default. Cosmetic only — see logic/orbiterSpeed. */
  readonly speedFactor?: number;
  readonly temperatureMin_c: number;
  readonly temperatureMax_c: number;
  readonly missionStatus?: string | null;
  readonly missionEndYear?: number | null;
  readonly en: LocalizedText;
  readonly es: LocalizedText;
}

/** Shape of a single entry in `spacecraft.json`. */
export interface SpacecraftData {
  readonly id: string;
  readonly image?: string;
  readonly type: string;
  readonly host: string | null;
  readonly launchYear: number;
  readonly missionStatus: string;
  readonly missionEndYear: number | null;
  readonly orbitalRadius_mkm: number;
  /** Optional Ellipse-mode visual speed factor (higher = faster); overrides the
   * ring-proximity default. Cosmetic only — see logic/orbiterSpeed. */
  readonly speedFactor?: number;
  readonly en: LocalizedSpacecraftText;
  readonly es: LocalizedSpacecraftText;
}

/** A localized label attached to a single mission phase. */
export interface LocalizedPhaseLabel {
  readonly label: string;
}

/** A mission phase: a transfer/station-keeping leg with a localized label. */
export interface MissionPhase extends Phase {
  readonly en: LocalizedPhaseLabel;
  readonly es: LocalizedPhaseLabel;
}

/** Per-language text block for a mission. */
export interface LocalizedMissionText {
  readonly name: string;
  readonly summary: string;
  readonly highlights?: readonly string[];
}

/** Shape of a single entry in `missions.json`. */
export interface MissionData {
  readonly id: string;
  /** Id of the spacecraft (in spacecraft.json) that flies this mission. */
  readonly spacecraftId: string;
  /** Total mission length in Earth years (sum of the phase durations). */
  readonly durationYears: number;
  /** Ordered itinerary legs. A final `to` of `self` is the craft's current pos. */
  readonly phases: readonly MissionPhase[];
  readonly en: LocalizedMissionText;
  readonly es: LocalizedMissionText;
}

/** A single navigable item in the library panel. */
export interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  /** Id of the body this item orbits, or `null` for solar-orbiting/interstellar. */
  readonly host: string | null;
  readonly missionStatus: string | null;
}

/** A labelled group of library items (used by the "group by host" view). */
export interface LibraryGroup {
  /** Stable key: a host body id, `'sun'`, or `'interstellar'`. */
  readonly key: string;
  readonly label: string;
  readonly items: readonly LibraryItem[];
}

/** The full grouped library tree. */
export interface LibraryTree {
  readonly star: readonly LibraryItem[];
  readonly planets: readonly LibraryItem[];
  readonly dwarfPlanets: readonly LibraryItem[];
  readonly moons: readonly LibraryItem[];
  readonly spacecraft: readonly LibraryItem[];
  readonly asteroidsComets: readonly LibraryItem[];
  readonly totalCount: number;
}

function bodyToItem(body: BodyData, lang: Language): LibraryItem {
  return {
    id: body.id,
    name: body[lang].name,
    type: body.type,
    host: body.host,
    missionStatus: body.missionStatus ?? null,
  };
}

function spacecraftToItem(craft: SpacecraftData, lang: Language): LibraryItem {
  return {
    id: craft.id,
    name: craft[lang].name,
    type: craft.type,
    host: craft.host,
    missionStatus: craft.missionStatus,
  };
}

/**
 * Build the grouped, localized library tree from the raw config collections.
 */
export function buildLibraryTree(
  bodies: readonly BodyData[],
  spacecraft: readonly SpacecraftData[],
  lang: Language,
): LibraryTree {
  const byType = (type: BodyType): LibraryItem[] =>
    bodies
      .filter((body) => body.type === type)
      .map((body) => bodyToItem(body, lang));

  const asteroidsComets = bodies
    .filter(
      (body) => body.type === BodyType.ASTEROID || body.type === BodyType.COMET,
    )
    .map((body) => bodyToItem(body, lang));

  return {
    star: byType(BodyType.STAR),
    planets: byType(BodyType.PLANET),
    dwarfPlanets: byType(BodyType.DWARF_PLANET),
    moons: byType(BodyType.MOON),
    spacecraft: spacecraft.map((craft) => spacecraftToItem(craft, lang)),
    asteroidsComets,
    totalCount: bodies.length + spacecraft.length,
  };
}

const SUN_GROUP_KEY = 'sun';
const INTERSTELLAR_GROUP_KEY = 'interstellar';

/** The group key for a body: its host, or the Sun for solar-orbiting bodies. */
function bodyGroupKey(body: BodyData): string {
  return body.host ?? SUN_GROUP_KEY;
}

/** The group key for a spacecraft: its host, or the interstellar group. */
function spacecraftGroupKey(craft: SpacecraftData): string {
  if (craft.host) return craft.host;
  return NON_ORBITING_PROBE_IDS.includes(craft.id)
    ? INTERSTELLAR_GROUP_KEY
    : SUN_GROUP_KEY;
}

/** Localized heading for a host group key. */
function groupLabel(key: string, lang: Language): string {
  if (key === INTERSTELLAR_GROUP_KEY) return getText('library.interstellar', lang);
  return getText(`${key}.name`, lang);
}

/**
 * Build the library grouped by the body each item orbits: the Sun first
 * (every solar-orbiting body and the Sun itself), then each planet that hosts
 * moons or spacecraft ordered by its distance from the Sun, and finally the
 * interstellar probes. Empty groups are omitted.
 */
export function buildGroupsByHost(
  bodies: readonly BodyData[],
  spacecraft: readonly SpacecraftData[],
  lang: Language,
): readonly LibraryGroup[] {
  const grouped = new Map<string, LibraryItem[]>();
  const push = (key: string, item: LibraryItem): void => {
    const list = grouped.get(key);
    if (list) list.push(item);
    else grouped.set(key, [item]);
  };

  for (const body of bodies) push(bodyGroupKey(body), bodyToItem(body, lang));
  for (const craft of spacecraft) push(spacecraftGroupKey(craft), spacecraftToItem(craft, lang));

  // Order: Sun, then host planets by solar distance, then interstellar.
  const hostDistance = (key: string): number =>
    bodies.find((b) => b.id === key)?.orbitalRadius_mkm ?? 0;
  const rank = (key: string): number => {
    if (key === SUN_GROUP_KEY) return Number.NEGATIVE_INFINITY;
    if (key === INTERSTELLAR_GROUP_KEY) return Number.POSITIVE_INFINITY;
    return hostDistance(key);
  };

  return [...grouped.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => ({ key, label: groupLabel(key, lang), items: grouped.get(key)! }));
}

/** Strip diacritics and lowercase, for accent-insensitive name matching. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Filter items whose name contains the query (case- and accent-insensitive). */
export function filterLibraryItems(
  items: readonly LibraryItem[],
  query: string,
): readonly LibraryItem[] {
  const needle = normalize(query.trim());
  if (!needle) return items;
  return items.filter((item) => normalize(item.name).includes(needle));
}
