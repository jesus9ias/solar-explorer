import {
  buildLibraryTree,
  buildGroupsByHost,
  filterLibraryItems,
  type BodyData,
  type LibraryItem,
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

describe('library — buildGroupsByHost', () => {
  it('places solar-orbiting bodies under the Sun group', () => {
    const groups = buildGroupsByHost(bodies, spacecraft, Language.EN);
    const sun = groups.find((g) => g.key === 'sun');
    expect(sun).toBeDefined();
    const ids = sun!.items.map((i) => i.id);
    expect(ids).toContain('earth');
    expect(ids).toContain('ceres');
    expect(ids).toContain('sun');
  });

  it('groups moons under the planet they orbit', () => {
    const groups = buildGroupsByHost(bodies, spacecraft, Language.EN);
    const jupiter = groups.find((g) => g.key === 'jupiter');
    expect(jupiter).toBeDefined();
    expect(jupiter!.items.map((i) => i.id)).toContain('io');
  });

  it('groups a host-orbiting spacecraft under its host', () => {
    const groups = buildGroupsByHost(bodies, spacecraft, Language.EN);
    const saturn = groups.find((g) => g.key === 'saturn');
    expect(saturn!.items.map((i) => i.id)).toContain('cassini');
  });

  it('groups interstellar probes under their own group', () => {
    const groups = buildGroupsByHost(bodies, spacecraft, Language.EN);
    const interstellar = groups.find((g) => g.key === 'interstellar');
    expect(interstellar).toBeDefined();
    expect(interstellar!.items.map((i) => i.id)).toContain('voyager1');
  });

  it('orders the Sun group first and interstellar last', () => {
    const groups = buildGroupsByHost(bodies, spacecraft, Language.EN);
    expect(groups[0].key).toBe('sun');
    expect(groups[groups.length - 1].key).toBe('interstellar');
  });

  it('omits empty groups', () => {
    const groups = buildGroupsByHost(bodies, spacecraft, Language.EN);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });
});

describe('library — filterLibraryItems', () => {
  const items: LibraryItem[] = [
    { id: 'earth', name: 'Earth', type: 'planet', host: null, missionStatus: null },
    { id: 'mars', name: 'Mars', type: 'planet', host: null, missionStatus: null },
    { id: 'phobos', name: 'Fobos', type: 'moon', host: 'mars', missionStatus: null },
  ];

  it('returns all items for an empty query', () => {
    expect(filterLibraryItems(items, '')).toHaveLength(3);
    expect(filterLibraryItems(items, '   ')).toHaveLength(3);
  });

  it('matches a case-insensitive substring of the name', () => {
    expect(filterLibraryItems(items, 'mar').map((i) => i.id)).toEqual(['mars']);
  });

  it('ignores accents when matching', () => {
    expect(filterLibraryItems(items, 'fobos').map((i) => i.id)).toEqual(['phobos']);
  });
});
