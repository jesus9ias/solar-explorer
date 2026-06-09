/**
 * Solar Explorer — catalog data access.
 *
 * Loads the typed body and spacecraft collections from config and provides
 * lookups by id. (Support module for the game/UI layer; the config shapes
 * themselves are defined in library.ts.)
 */
import bodiesJson from '../config/bodies.json';
import spacecraftJson from '../config/spacecraft.json';
import type { BodyData, SpacecraftData } from './library';

/** All celestial bodies, typed. */
export const bodies = bodiesJson as unknown as BodyData[];
/** All artificial spacecraft, typed. */
export const spacecraft = spacecraftJson as unknown as SpacecraftData[];

/** A resolved catalog entry, discriminated by kind. */
export type CatalogEntry =
  | { readonly kind: 'body'; readonly body: BodyData }
  | { readonly kind: 'spacecraft'; readonly craft: SpacecraftData };

/** Find any body or spacecraft by id. */
export function findEntry(id: string): CatalogEntry | null {
  const body = bodies.find((b) => b.id === id);
  if (body) return { kind: 'body', body };
  const craft = spacecraft.find((s) => s.id === id);
  if (craft) return { kind: 'spacecraft', craft };
  return null;
}

/** Bodies that orbit the Sun directly (excludes the Sun and moons). */
export function solarOrbitingBodies(): BodyData[] {
  return bodies.filter((b) => b.host === null && b.orbitalRadius_mkm > 0);
}

/** Moons grouped under a given host body id. */
export function moonsOf(hostId: string): BodyData[] {
  return bodies.filter((b) => b.type === 'moon' && b.host === hostId);
}

/** The Sun body. */
export function sun(): BodyData | undefined {
  return bodies.find((b) => b.type === 'star');
}
