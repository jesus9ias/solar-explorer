/**
 * Solar Explorer — scene routing.
 *
 * Pure mapping between navigation modes and Phaser scene keys. Kept free of
 * Phaser so the switch decision is unit-testable; the actual scene transition
 * is performed by the game layer.
 */
import { Mode, SCENE_LINEAR, SCENE_ELLIPSE, SCENE_MISSION } from '../constants/constants';

/** Every scene key, one per mode. */
export const ALL_SCENE_KEYS: readonly string[] = [SCENE_LINEAR, SCENE_ELLIPSE, SCENE_MISSION];

/** The scene key that should be active for a given mode. */
export function sceneKeyForMode(mode: Mode): string {
  switch (mode) {
    case Mode.ELLIPSE:
      return SCENE_ELLIPSE;
    case Mode.MISSION:
      return SCENE_MISSION;
    default:
      return SCENE_LINEAR;
  }
}

/** The scene keys that should NOT be active for a given target scene. */
export function otherSceneKeys(target: string): readonly string[] {
  return ALL_SCENE_KEYS.filter((key) => key !== target);
}
