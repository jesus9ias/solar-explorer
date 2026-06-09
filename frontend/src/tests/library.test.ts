import {
  buildLibraryTree,
  type BodyData,
  type SpacecraftData,
} from '../logic/library';
import { Language, MissionStatus } from '../constants/constants';
import bodiesJson from '../config/bodies.json';
import spacecraftJson from '../config/spacecraft.json';

const bodies = bodiesJson as unknown as BodyData[];
const spacecraft = spacecraftJson as unknown as SpacecraftData[];

const EXPECTED_PLANET_COUNT = 8;
const EXPECTED_DWARF_PLANET_COUNT = 5;
const CASSINI_ID = 'cassini';

describe('library — buildLibraryTree', () => {
  it('groups the planets correctly', () => {
    const tree = buildLibraryTree(bodies, spacecraft, Language.EN);
    expect(tree.planets).toHaveLength(EXPECTED_PLANET_COUNT);
  });

  it('groups the dwarf planets correctly', () => {
    const tree = buildLibraryTree(bodies, spacecraft, Language.EN);
    expect(tree.dwarfPlanets).toHaveLength(EXPECTED_DWARF_PLANET_COUNT);
  });

  it('marks completed missions', () => {
    const tree = buildLibraryTree(bodies, spacecraft, Language.EN);
    const cassini = tree.spacecraft.find((item) => item.id === CASSINI_ID);
    expect(cassini?.missionStatus).toBe(MissionStatus.COMPLETE);
  });

  it('total element count matches the config', () => {
    const tree = buildLibraryTree(bodies, spacecraft, Language.EN);
    expect(tree.totalCount).toBe(bodies.length + spacecraft.length);
  });
});
