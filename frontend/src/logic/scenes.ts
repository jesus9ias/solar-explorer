/**
 * Solar Explorer — scene routing.
 *
 * Pure mapping between navigation modes and Phaser scene keys. Kept free of
 * Phaser so the switch decision is unit-testable; the actual scene transition
 * is performed by the game layer.
 */
import { Mode, SCENE_LINEAR, SCENE_ELLIPSE } from '../constants/constants';

/** The scene key that should be active for a given mode. */
export function sceneKeyForMode(mode: Mode): string {
  return mode === Mode.ELLIPSE ? SCENE_ELLIPSE : SCENE_LINEAR;
}

/** The counterpart scene key (the one that should not be active). */
export function otherSceneKey(sceneKey: string): string {
  return sceneKey === SCENE_ELLIPSE ? SCENE_LINEAR : SCENE_ELLIPSE;
}
