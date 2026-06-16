/**
 * Solar Explorer — HUD.
 *
 * The mission-control overlay: language, mode, unit and audio switches, the
 * library button, and the mode-specific controls (prev/next for Linear; orbit
 * speed and orbit lines for Ellipse). All labels come from ui.json.
 */
import {
  Language,
  Mode,
  Unit,
  MissionRestartMode,
  ORBIT_SPEED_MULTIPLIERS,
  ORBIT_SPEED_PAUSED,
  DEFAULT_ORBIT_SPEED,
  DEFAULT_ORBIT_LINES_VISIBLE,
  EVENT_LINEAR_PREV,
  EVENT_LINEAR_NEXT,
  EVENT_ELLIPSE_SPEED,
  EVENT_ELLIPSE_LINES,
  EVENT_MISSION_SPEED,
  EVENT_MISSION_LINES,
  EVENT_MISSION_RESTART,
} from '../constants/constants';
import { getText } from '../logic/i18n';
import { userPreferences } from '../state/UserPreferences';
import { scaleState } from '../state/ScaleState';
import { modeState } from '../state/ModeState';
import { missionState } from '../state/MissionState';

/** Controls background ambient audio playback. */
export interface AudioController {
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
}

/** Emits an app event to the running scene. */
export type EmitFn = (event: string, payload?: unknown) => void;

export interface HUDDeps {
  readonly root: HTMLElement;
  readonly emit: EmitFn;
  readonly audio: AudioController;
  readonly onLibrary: () => void;
  readonly onMissions: () => void;
}

interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
  readonly icon?: string;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class HUD {
  private readonly container: HTMLDivElement;
  private readonly deps: HUDDeps;
  private orbitSpeed = DEFAULT_ORBIT_SPEED;
  private orbitLinesVisible = DEFAULT_ORBIT_LINES_VISIBLE;
  private missionLinesVisible = DEFAULT_ORBIT_LINES_VISIBLE;

  constructor(deps: HUDDeps) {
    this.deps = deps;
    this.container = el('div', 'se-hud');
    deps.root.append(this.container);
    modeState.subscribe(() => this.build());
    this.build();
  }

  /** Rebuild all controls (also refreshes labels after a language change). */
  refresh(): void {
    this.build();
  }

  private segment<T>(
    labelKey: string,
    options: readonly SegmentOption<T>[],
    current: T,
    onChange: (value: T) => void,
  ): HTMLDivElement {
    const lang = userPreferences.getLanguage();
    const control = el('div', 'se-control');
    const label = el('span', 'se-control-label');
    label.textContent = getText(labelKey, lang);
    const segments = el('div', 'se-segments');
    for (const option of options) {
      const button = el('button', 'se-segment');
      if (option.icon !== undefined) {
        const iconSpan = el('span', 'se-btn-icon');
        iconSpan.textContent = option.icon;
        iconSpan.setAttribute('aria-hidden', 'true');
        const textSpan = el('span', 'se-btn-text');
        textSpan.textContent = option.label;
        button.append(iconSpan, textSpan);
      } else {
        button.textContent = option.label;
      }
      if (option.value === current) button.classList.add('is-active');
      button.addEventListener('click', () => onChange(option.value));
      segments.append(button);
    }
    control.append(label, segments);
    return control;
  }

  private button(labelKey: string, onClick: () => void, icon?: string): HTMLButtonElement {
    const lang = userPreferences.getLanguage();
    const button = el('button', 'se-button');
    const text = getText(labelKey, lang);
    if (icon !== undefined) {
      const iconSpan = el('span', 'se-btn-icon');
      iconSpan.textContent = icon;
      iconSpan.setAttribute('aria-hidden', 'true');
      const textSpan = el('span', 'se-btn-text');
      textSpan.textContent = text;
      button.append(iconSpan, textSpan);
    } else {
      button.textContent = text;
    }
    button.addEventListener('click', onClick);
    return button;
  }

  private build(): void {
    const lang = userPreferences.getLanguage();
    this.container.replaceChildren();

    // Language.
    this.container.append(
      this.segment<Language>(
        'hud.language',
        [
          { value: Language.EN, label: 'EN' },
          { value: Language.ES, label: 'ES' },
        ],
        lang,
        (value) => userPreferences.setLanguage(value),
      ),
    );

    // Mode.
    this.container.append(
      this.segment<Mode>(
        'hud.mode',
        [
          { value: Mode.LINEAR, label: getText('hud.linear', lang) },
          { value: Mode.ELLIPSE, label: getText('hud.ellipse', lang) },
          { value: Mode.MISSION, label: getText('hud.mission', lang) },
        ],
        modeState.getMode(),
        (value) => modeState.setMode(value),
      ),
    );

    // Distance unit.
    this.container.append(
      this.segment<Unit>(
        'hud.unit',
        [
          { value: Unit.MKM, label: getText('hud.mkm', lang) },
          { value: Unit.AU, label: getText('hud.au', lang) },
        ],
        scaleState.getUnit(),
        (value) => scaleState.setUnit(value),
      ),
    );

    // Audio.
    this.container.append(
      this.segment<boolean>(
        'hud.audio',
        [
          { value: true, label: getText('hud.on', lang), icon: '🔊' },
          { value: false, label: getText('hud.off', lang), icon: '🔇' },
        ],
        userPreferences.isAudioEnabled(),
        (value) => {
          userPreferences.setAudio(value);
          this.deps.audio.setEnabled(value);
        },
      ),
    );

    // Library button.
    this.container.append(this.button('hud.library', () => this.deps.onLibrary(), '≡'));

    // Mode-specific controls.
    const mode = modeState.getMode();
    if (mode === Mode.LINEAR) {
      this.container.append(this.button('hud.prevElement', () => this.deps.emit(EVENT_LINEAR_PREV), '◀'));
      this.container.append(this.button('hud.nextElement', () => this.deps.emit(EVENT_LINEAR_NEXT), '▶'));
    } else if (mode === Mode.ELLIPSE) {
      this.container.append(this.speedControl(EVENT_ELLIPSE_SPEED));
      this.container.append(
        this.toggleControl('hud.orbitLines', this.orbitLinesVisible, (value) => {
          this.orbitLinesVisible = value;
          this.deps.emit(EVENT_ELLIPSE_LINES, value);
          this.build();
        }),
      );
    } else {
      this.buildMissionControls(lang);
    }
  }

  /** Orbit-speed segment (shared by Ellipse and Mission); 0 = paused (||). */
  private speedControl(event: string): HTMLDivElement {
    return this.segment<number>(
      'hud.orbitSpeed',
      ORBIT_SPEED_MULTIPLIERS.map((m) =>
        m === ORBIT_SPEED_PAUSED ? { value: m, label: '||' } : { value: m, label: `${m}×` },
      ),
      this.orbitSpeed,
      (value) => {
        this.orbitSpeed = value;
        this.deps.emit(event, value);
        this.build();
      },
    );
  }

  /** Show/Hide toggle segment for orbit or mission lines. */
  private toggleControl(
    labelKey: string,
    current: boolean,
    onChange: (value: boolean) => void,
  ): HTMLDivElement {
    const lang = userPreferences.getLanguage();
    return this.segment<boolean>(
      labelKey,
      [
        { value: true, label: getText('hud.show', lang), icon: '⊙' },
        { value: false, label: getText('hud.hide', lang), icon: '⊘' },
      ],
      current,
      onChange,
    );
  }

  private buildMissionControls(lang: Language): void {
    // Open the mission picker — also the way back to it after dismissing it.
    this.container.append(this.button('hud.missions', () => this.deps.onMissions(), '🚀'));
    // Speed doubles as pause/advance for the running mission.
    this.container.append(this.speedControl(EVENT_MISSION_SPEED));
    // Restart + on-finish behavior.
    this.container.append(this.button('hud.restart', () => this.deps.emit(EVENT_MISSION_RESTART), '↻'));
    this.container.append(
      this.segment<MissionRestartMode>(
        'hud.onFinish',
        [
          { value: MissionRestartMode.MANUAL, label: getText('hud.manual', lang) },
          { value: MissionRestartMode.AUTO, label: getText('hud.auto', lang) },
        ],
        missionState.getRestartMode(),
        (value) => {
          missionState.setRestartMode(value);
          this.build();
        },
      ),
    );
    // Mission trajectory lines, controlled separately from orbit lines.
    this.container.append(
      this.toggleControl('hud.missionLines', this.missionLinesVisible, (value) => {
        this.missionLinesVisible = value;
        this.deps.emit(EVENT_MISSION_LINES, value);
        this.build();
      }),
    );
  }
}
