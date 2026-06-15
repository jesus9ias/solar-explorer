/**
 * Solar Explorer — mission data access.
 *
 * Loads the typed mission collection from config and provides lookup by id.
 * Each mission references a spacecraft (in spacecraft.json) by id for its name,
 * image and objectives, and adds the Mission-mode-specific itinerary and copy.
 */
import missionsJson from '../config/missions.json';
import type { MissionData } from './library';

/** All missions, typed. */
export const missions = missionsJson as unknown as MissionData[];

/** Find a mission by id. */
export function findMission(id: string): MissionData | null {
  return missions.find((m) => m.id === id) ?? null;
}
