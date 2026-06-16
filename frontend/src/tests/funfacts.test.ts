import { getFunFactsAtDistance } from '../logic/funfacts';
import { Language } from '../constants/constants';

// Mid-belt distance (≈ Ceres orbital radius) chosen to fall inside the
// Asteroid Belt fun-fact trigger window. Stage 4 config must keep the belt
// trigger consistent with this fixture.
const ASTEROID_BELT_DISTANCE_MKM = 414;
const BEFORE_FIRST_TRIGGER_MKM = 0;

describe('funfacts — getFunFactsAtDistance', () => {
  it('returns the Asteroid Belt fact at the belt trigger distance', () => {
    const fact = getFunFactsAtDistance(
      ASTEROID_BELT_DISTANCE_MKM,
      Language.EN,
      new Set<string>(),
    );
    expect(fact?.id).toBe('asteroid_belt');
  });

  it('returns null before the first trigger distance', () => {
    const fact = getFunFactsAtDistance(
      BEFORE_FIRST_TRIGGER_MKM,
      Language.EN,
      new Set<string>(),
    );
    expect(fact).toBeNull();
  });

  it('returns the fact text localized to the requested language', () => {
    const en = getFunFactsAtDistance(
      ASTEROID_BELT_DISTANCE_MKM,
      Language.EN,
      new Set<string>(),
    );
    const es = getFunFactsAtDistance(
      ASTEROID_BELT_DISTANCE_MKM,
      Language.ES,
      new Set<string>(),
    );
    expect(es?.text).toBeTruthy();
    expect(es?.text).not.toBe(en?.text);
  });

  it('does not repeat a fact already shown', () => {
    // 200 Mkm sits between goldilocks_zone (150) and asteroid_belt (330),
    // so exactly one fact is reachable — after showing it the result must be null.
    const SINGLE_FACT_DISTANCE = 200;
    const shown = new Set<string>();
    const first = getFunFactsAtDistance(SINGLE_FACT_DISTANCE, Language.EN, shown);
    shown.add(first?.id ?? '');
    const second = getFunFactsAtDistance(SINGLE_FACT_DISTANCE, Language.EN, shown);
    expect(second).toBeNull();
  });
});
