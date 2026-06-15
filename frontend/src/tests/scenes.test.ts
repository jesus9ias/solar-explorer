import { sceneKeyForMode, otherSceneKeys, ALL_SCENE_KEYS } from '../logic/scenes';
import { Mode, SCENE_LINEAR, SCENE_ELLIPSE, SCENE_MISSION } from '../constants/constants';

describe('scenes — sceneKeyForMode', () => {
  it('maps Linear mode to the Linear scene', () => {
    expect(sceneKeyForMode(Mode.LINEAR)).toBe(SCENE_LINEAR);
  });

  it('maps Ellipse mode to the Ellipse scene', () => {
    expect(sceneKeyForMode(Mode.ELLIPSE)).toBe(SCENE_ELLIPSE);
  });

  it('maps Mission mode to the Mission scene', () => {
    expect(sceneKeyForMode(Mode.MISSION)).toBe(SCENE_MISSION);
  });
});

describe('scenes — otherSceneKeys', () => {
  it('returns the two non-active scenes for a target', () => {
    expect([...otherSceneKeys(SCENE_LINEAR)].sort()).toEqual(
      [SCENE_ELLIPSE, SCENE_MISSION].sort(),
    );
    expect([...otherSceneKeys(SCENE_MISSION)].sort()).toEqual(
      [SCENE_LINEAR, SCENE_ELLIPSE].sort(),
    );
  });

  it('never includes the target itself', () => {
    for (const key of ALL_SCENE_KEYS) {
      expect(otherSceneKeys(key)).not.toContain(key);
    }
  });
});
