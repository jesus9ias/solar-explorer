import { sceneKeyForMode, otherSceneKey } from '../logic/scenes';
import { Mode, SCENE_LINEAR, SCENE_ELLIPSE } from '../constants/constants';

describe('scenes — sceneKeyForMode', () => {
  it('maps Linear mode to the Linear scene', () => {
    expect(sceneKeyForMode(Mode.LINEAR)).toBe(SCENE_LINEAR);
  });

  it('maps Ellipse mode to the Ellipse scene', () => {
    expect(sceneKeyForMode(Mode.ELLIPSE)).toBe(SCENE_ELLIPSE);
  });
});

describe('scenes — otherSceneKey', () => {
  it('returns the Ellipse scene as the counterpart of the Linear scene', () => {
    expect(otherSceneKey(SCENE_LINEAR)).toBe(SCENE_ELLIPSE);
  });

  it('returns the Linear scene as the counterpart of the Ellipse scene', () => {
    expect(otherSceneKey(SCENE_ELLIPSE)).toBe(SCENE_LINEAR);
  });
});
