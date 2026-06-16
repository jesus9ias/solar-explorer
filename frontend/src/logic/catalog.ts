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

/** Solar distance (Mkm) contributed by a host body — its own orbital radius
 * around the Sun, or 0 when there is no solar-orbiting host. */
function hostSolarRadiusMkm(hostId: string | null): number {
  if (!hostId) return 0;
  return bodies.find((b) => b.id === hostId)?.orbitalRadius_mkm ?? 0;
}

/** Distance from the Sun (Mkm) of a body: a moon adds its host planet's solar
 * distance to its own orbital radius; the Sun itself is at zero. */
export function bodySolarDistanceMkm(body: BodyData): number {
  if (body.type === 'star') return 0;
  return hostSolarRadiusMkm(body.host) + body.orbitalRadius_mkm;
}

/** Distance from the Sun (Mkm) of a spacecraft: a host-orbiting craft adds its
 * host's solar distance; solar-orbiting and interstellar craft use their own
 * orbital radius directly. */
export function craftSolarDistanceMkm(craft: SpacecraftData): number {
  if (craft.host === null || craft.host === 'sun') return craft.orbitalRadius_mkm;
  return hostSolarRadiusMkm(craft.host) + craft.orbitalRadius_mkm;
}

/** Find any body or spacecraft by id. */
export function findEntry(id: string): CatalogEntry | null {
  const body = bodies.find((b) => b.id === id);
  if (body) return { kind: 'body', body };
  const craft = spacecraft.find((s) => s.id === id);
  if (craft) return { kind: 'spacecraft', craft };
  return null;
}

/** The Sun body. */
export function sun(): BodyData | undefined {
  return bodies.find((b) => b.type === 'star');
}
