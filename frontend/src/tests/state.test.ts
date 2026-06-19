import { UserPreferences } from '../state/UserPreferences';
import { NavigationState } from '../state/NavigationState';
import {
  Language,
  Mode,
  Unit,
  LS_KEY_LANGUAGE,
  LS_KEY_MODE,
  LS_KEY_UNIT,
  LS_KEY_AUDIO,
} from '../constants/constants';

beforeEach(() => {
  localStorage.clear();
});

describe('UserPreferences — defaults with no stored values', () => {
  it('defaults language to English', () => {
    expect(new UserPreferences().getLanguage()).toBe(Language.EN);
  });

  it('defaults mode to Ellipse', () => {
    expect(new UserPreferences().getMode()).toBe(Mode.ELLIPSE);
  });

  it('defaults unit to Million km', () => {
    expect(new UserPreferences().getUnit()).toBe(Unit.MKM);
  });

  it('defaults audio to off', () => {
    expect(new UserPreferences().isAudioEnabled()).toBe(false);
  });
});

describe('UserPreferences — persistence to localStorage', () => {
  it('setLanguage persists to localStorage', () => {
    new UserPreferences().setLanguage(Language.ES);
    expect(localStorage.getItem(LS_KEY_LANGUAGE)).toBe('es');
  });

  it('setMode persists to localStorage', () => {
    new UserPreferences().setMode(Mode.ELLIPSE);
    expect(localStorage.getItem(LS_KEY_MODE)).toBe('ellipse');
  });

  it('setUnit persists to localStorage', () => {
    new UserPreferences().setUnit(Unit.AU);
    expect(localStorage.getItem(LS_KEY_UNIT)).toBe('au');
  });

  it('setAudio persists to localStorage', () => {
    new UserPreferences().setAudio(true);
    expect(localStorage.getItem(LS_KEY_AUDIO)).toBe('true');
  });
});

describe('NavigationState — in-memory solar distance', () => {
  it('stores and returns the solar distance', () => {
    const nav = new NavigationState();
    nav.setDistance(149.598);
    expect(nav.getDistance()).toBe(149.598);
  });

  it('does not persist the distance to localStorage', () => {
    const nav = new NavigationState();
    nav.setDistance(149.598);
    const persisted = Object.keys(localStorage).some(
      (key) => localStorage.getItem(key) === '149.598',
    );
    expect(persisted).toBe(false);
  });

  it('preserves the distance across a mode switch', () => {
    const nav = new NavigationState();
    const prefs = new UserPreferences();
    nav.setDistance(500);
    prefs.setMode(Mode.ELLIPSE);
    expect(nav.getDistance()).toBe(500);
  });
});
