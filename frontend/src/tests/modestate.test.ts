import { ModeState } from '../state/ModeState';
import { userPreferences } from '../state/UserPreferences';
import { Mode, LS_KEY_MODE } from '../constants/constants';

beforeEach(() => {
  localStorage.clear();
  // Reset the shared UserPreferences singleton (ModeState derives from it).
  userPreferences.setMode(Mode.LINEAR);
});

describe('ModeState — derivation from UserPreferences', () => {
  it('initializes its mode from UserPreferences', () => {
    userPreferences.setMode(Mode.ELLIPSE);
    expect(new ModeState().getMode()).toBe(Mode.ELLIPSE);
  });
});

describe('ModeState — setMode', () => {
  it('updates the current mode', () => {
    const mode = new ModeState();
    mode.setMode(Mode.ELLIPSE);
    expect(mode.getMode()).toBe(Mode.ELLIPSE);
  });

  it('persists the mode through UserPreferences (localStorage)', () => {
    new ModeState().setMode(Mode.ELLIPSE);
    expect(localStorage.getItem(LS_KEY_MODE)).toBe('ellipse');
  });

  it('keeps UserPreferences in sync', () => {
    new ModeState().setMode(Mode.ELLIPSE);
    expect(userPreferences.getMode()).toBe(Mode.ELLIPSE);
  });
});

describe('ModeState — subscription', () => {
  it('notifies subscribers with the new mode on change', () => {
    const mode = new ModeState();
    const received: Mode[] = [];
    mode.subscribe((next) => received.push(next));
    mode.setMode(Mode.ELLIPSE);
    expect(received).toEqual([Mode.ELLIPSE]);
  });

  it('does not notify when the mode is unchanged', () => {
    const mode = new ModeState(); // starts as LINEAR
    let calls = 0;
    mode.subscribe(() => calls++);
    mode.setMode(Mode.LINEAR);
    expect(calls).toBe(0);
  });

  it('stops notifying after unsubscribe', () => {
    const mode = new ModeState();
    let calls = 0;
    const unsubscribe = mode.subscribe(() => calls++);
    unsubscribe();
    mode.setMode(Mode.ELLIPSE);
    expect(calls).toBe(0);
  });
});
