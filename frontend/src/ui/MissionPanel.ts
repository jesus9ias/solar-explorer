/**
 * Solar Explorer — MissionPanel.
 *
 * The Mission-mode overlay: an elapsed-years counter (styled after the Linear
 * distance counter) and a per-phase progress checklist that lights up as the
 * mission advances. Subscribes to {@link missionState} (updated each frame by
 * the scene) and updates text/classes cheaply rather than rebuilding; it only
 * rebuilds the phase list when the selected mission or language changes.
 */
import { Mode, Language, MISSION_YEARS_DECIMALS } from '../constants/constants';
import { getText } from '../logic/i18n';
import { findMission } from '../logic/missions';
import { completedPhaseCount, formatElapsedYears } from '../logic/mission';
import type { MissionData } from '../logic/library';
import { userPreferences } from '../state/UserPreferences';
import { modeState } from '../state/ModeState';
import { missionState } from '../state/MissionState';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class MissionPanel {
  private readonly container: HTMLDivElement;
  private readonly yearsValue: HTMLSpanElement;
  private readonly checklist: HTMLOListElement;
  private renderedMissionId: string | null = null;
  private renderedLang = userPreferences.getLanguage();
  private phaseItems: HTMLLIElement[] = [];

  constructor(root: HTMLElement) {
    this.container = el('div', 'se-mission-panel');

    const counter = el('div', 'se-mission-counter');
    const label = el('span', 'se-mission-counter-label');
    label.textContent = getText('mission.elapsed', this.renderedLang);
    this.yearsValue = el('span', 'se-mission-counter-value');
    counter.append(this.yearsValue, label);

    this.checklist = el('ol', 'se-mission-checklist');
    this.container.append(counter, this.checklist);
    root.append(this.container);

    modeState.subscribe(() => this.refresh());
    missionState.subscribe(() => this.update());
    userPreferences.subscribe(() => this.refresh());
    this.refresh();
  }

  /** Full re-render: visibility, counter label, and the phase checklist. */
  private refresh(): void {
    const visible = modeState.getMode() === Mode.MISSION;
    this.container.hidden = !visible;
    if (!visible) return;

    const lang = userPreferences.getLanguage();
    this.renderedLang = lang;
    const counterLabel = this.container.querySelector('.se-mission-counter-label');
    if (counterLabel) counterLabel.textContent = getText('mission.elapsed', lang);

    const id = missionState.getSelectedId();
    const mission = id ? findMission(id) : null;
    this.buildChecklist(mission, lang);
    this.renderedMissionId = id;
    this.update();
  }

  private buildChecklist(mission: MissionData | null, lang: Language): void {
    this.checklist.replaceChildren();
    this.phaseItems = [];

    if (!mission) {
      const prompt = el('li', 'se-mission-prompt');
      prompt.textContent = getText('mission.selectPrompt', lang);
      this.checklist.append(prompt);
      return;
    }

    const unit = getText('mission.years', lang);
    mission.phases.forEach((phase) => {
      const item = el('li', 'se-mission-phase');
      const mark = el('span', 'se-mission-check');
      mark.setAttribute('aria-hidden', 'true');
      const duration = el('span', 'se-mission-phase-duration');
      duration.textContent = `${phase.durationYears.toFixed(MISSION_YEARS_DECIMALS)} ${unit}`;
      const text = el('span', 'se-mission-phase-label');
      text.textContent = phase[lang].label;
      item.append(mark, duration, text);
      this.checklist.append(item);
      this.phaseItems.push(item);
    });
  }

  /** Cheap per-frame update: years readout and which phases are complete. */
  private update(): void {
    if (this.container.hidden) return;

    // The selection can change without a mode switch (Start in the modal).
    if (missionState.getSelectedId() !== this.renderedMissionId ||
      userPreferences.getLanguage() !== this.renderedLang) {
      this.refresh();
      return;
    }

    const elapsedMs = missionState.getElapsedMs();
    const unit = getText('mission.years', this.renderedLang);
    this.yearsValue.textContent = `${formatElapsedYears(elapsedMs)} ${unit}`;

    const id = missionState.getSelectedId();
    const mission = id ? findMission(id) : null;
    if (!mission) return;
    const done = completedPhaseCount(elapsedMs, mission.phases);
    this.phaseItems.forEach((item, i) => {
      item.classList.toggle('is-done', i < done);
    });
  }
}
