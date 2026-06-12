/**
 * Solar Explorer — library tree builder.
 *
 * Groups the raw config collections into the categories shown by the library
 * panel, localizing each item's name to the requested language.
 */
import { BodyType, Language } from '../constants/constants';
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
  /** Optional multi-phase itinerary (e.g. Earth → Bennu → Earth). When present,
   * the craft follows the phased trajectory instead of a single orbit — see
   * logic/phases and EllipseScene. */
  readonly phases?: readonly Phase[];
  readonly en: LocalizedSpacecraftText;
  readonly es: LocalizedSpacecraftText;
}

/** A single navigable item in the library panel. */
export interface LibraryItem {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly missionStatus: string | null;
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
    missionStatus: body.missionStatus ?? null,
  };
}

function spacecraftToItem(craft: SpacecraftData, lang: Language): LibraryItem {
  return {
    id: craft.id,
    name: craft[lang].name,
    type: craft.type,
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
