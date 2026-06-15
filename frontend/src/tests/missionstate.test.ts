import { UserPreferences } from '../state/UserPreferences';
import { MissionState } from '../state/MissionState';
import {
  MissionRestartMode,
  MissionRunState,
  LS_KEY_MISSION,
  LS_KEY_MISSION_RESTART,
} from '../constants/constants';

beforeEach(() => {
  localStorage.clear();
});

describe('UserPreferences — mission persistence', () => {
  it('defaults the mission id to null and restart to manual', () => {
    const prefs = new UserPreferences();
    expect(prefs.getMissionId()).toBeNull();
    expect(prefs.getMissionRestart()).toBe(MissionRestartMode.MANUAL);
  });

  it('persists the selected mission id', () => {
    new UserPreferences().setMissionId('voyager1');
    expect(localStorage.getItem(LS_KEY_MISSION)).toBe('voyager1');
  });

  it('clears the stored mission id when set to null', () => {
    const prefs = new UserPreferences();
    prefs.setMissionId('voyager1');
    prefs.setMissionId(null);
    expect(localStorage.getItem(LS_KEY_MISSION)).toBeNull();
  });

  it('persists the restart mode', () => {
    new UserPreferences().setMissionRestart(MissionRestartMode.AUTO);
    expect(localStorage.getItem(LS_KEY_MISSION_RESTART)).toBe('auto');
  });

  it('reads back persisted mission values on a new instance', () => {
    const a = new UserPreferences();
    a.setMissionId('new_horizons');
    a.setMissionRestart(MissionRestartMode.AUTO);
    const b = new UserPreferences();
    expect(b.getMissionId()).toBe('new_horizons');
    expect(b.getMissionRestart()).toBe(MissionRestartMode.AUTO);
  });
});

describe('MissionState — runtime timeline state', () => {
  it('starts idle with no elapsed time, mirroring the persisted selection', () => {
    const prefs = new UserPreferences();
    prefs.setMissionId('voyager1');
    const mission = new MissionState(prefs);
    expect(mission.getStatus()).toBe(MissionRunState.IDLE);
    expect(mission.getElapsedMs()).toBe(0);
    expect(mission.getSelectedId()).toBe('voyager1');
  });

  it('start(id) selects the mission, runs it, and resets elapsed time', () => {
    const prefs = new UserPreferences();
    const mission = new MissionState(prefs);
    mission.setElapsedMs(5000);
    mission.start('voyager2');
    expect(mission.getSelectedId()).toBe('voyager2');
    expect(mission.getStatus()).toBe(MissionRunState.RUNNING);
    expect(mission.getElapsedMs()).toBe(0);
    // Selection is persisted through preferences.
    expect(prefs.getMissionId()).toBe('voyager2');
  });

  it('advances elapsed time and notifies subscribers', () => {
    const mission = new MissionState(new UserPreferences());
    mission.start('pioneer10');
    let seen = -1;
    mission.subscribe(() => {
      seen = mission.getElapsedMs();
    });
    mission.setElapsedMs(1234);
    expect(mission.getElapsedMs()).toBe(1234);
    expect(seen).toBe(1234);
  });

  it('marks the mission complete', () => {
    const mission = new MissionState(new UserPreferences());
    mission.start('voyager1');
    mission.complete();
    expect(mission.getStatus()).toBe(MissionRunState.COMPLETE);
  });

  it('restart re-runs the current mission from zero', () => {
    const mission = new MissionState(new UserPreferences());
    mission.start('voyager1');
    mission.setElapsedMs(9999);
    mission.complete();
    mission.restart();
    expect(mission.getStatus()).toBe(MissionRunState.RUNNING);
    expect(mission.getElapsedMs()).toBe(0);
    expect(mission.getSelectedId()).toBe('voyager1');
  });

  it('exposes and persists the restart mode through preferences', () => {
    const prefs = new UserPreferences();
    const mission = new MissionState(prefs);
    expect(mission.getRestartMode()).toBe(MissionRestartMode.MANUAL);
    mission.setRestartMode(MissionRestartMode.AUTO);
    expect(mission.getRestartMode()).toBe(MissionRestartMode.AUTO);
    expect(prefs.getMissionRestart()).toBe(MissionRestartMode.AUTO);
  });
});
