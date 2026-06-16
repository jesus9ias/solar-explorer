/**
 * Solar Explorer — MissionModal.
 *
 * Two-column modal sitting beside the Library: left, the list of missions;
 * right, the selected mission's plan (summary, duration, phases, highlights) and
 * a Start button. Opening it does not interrupt a mission in progress — only
 * pressing Start (re)launches one, which resets the scene to that itinerary.
 *
 * Entering Mission mode opens this modal automatically, but choosing a mission
 * is optional: the modal can be dismissed (×, Esc, click-outside), leaving the
 * scene frozen until the user picks one — they decide what to do. On mobile the
 * columns collapse into tabs, like the Library modal.
 */
import { Language } from '../constants/constants';
import { MissionRunState } from '../constants/constants';
import { getText } from '../logic/i18n';
import { missions, findMission } from '../logic/missions';
import { userPreferences } from '../state/UserPreferences';
import { missionState } from '../state/MissionState';

type StartHandler = (id: string) => void;
type Tab = 'list' | 'info';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class MissionModal {
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly info: HTMLDivElement;
  private readonly tabListBtn: HTMLButtonElement;
  private readonly tabInfoBtn: HTMLButtonElement;
  private readonly title: HTMLHeadingElement;
  private readonly closeBtn: HTMLButtonElement;
  private readonly onStart: StartHandler;
  private selectedId: string | null = null;

  constructor(root: HTMLElement, onStart: StartHandler) {
    this.onStart = onStart;

    this.overlay = el('div', 'se-modal-overlay');
    this.overlay.hidden = true;

    this.panel = el('div', 'se-lib-modal');
    this.panel.dataset.tab = 'list';

    this.closeBtn = el('button', 'se-modal-close');
    this.closeBtn.textContent = '×';
    this.closeBtn.setAttribute('aria-label', 'Close');
    this.closeBtn.addEventListener('click', () => this.close());

    const tabs = el('div', 'se-lib-tabs');
    this.tabListBtn = el('button', 'se-lib-tab');
    this.tabInfoBtn = el('button', 'se-lib-tab');
    this.tabListBtn.addEventListener('click', () => this.setTab('list'));
    this.tabInfoBtn.addEventListener('click', () => this.setTab('info'));
    tabs.append(this.tabListBtn, this.tabInfoBtn);

    const left = el('div', 'se-lib-left');
    this.title = el('h2', 'se-lib-group-title');
    this.list = el('div', 'se-lib-list');
    left.append(this.title, this.list);

    const right = el('div', 'se-lib-right');
    this.info = el('div', 'se-info');
    right.append(this.info);

    this.panel.append(this.closeBtn, tabs, left, right);
    this.overlay.append(this.panel);
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
    root.append(this.overlay);
  }

  /**
   * Open the modal, preselecting the last chosen mission if any. It can always be
   * dismissed (× / Esc / click-outside); dismissing without starting leaves the
   * scene frozen until the user picks one.
   */
  open(): void {
    this.selectedId = missionState.getSelectedId();
    this.refresh();
    this.setTab(this.selectedId ? 'info' : 'list');
    this.overlay.hidden = false;
    document.addEventListener('keydown', this.onKeyDown);
  }

  close(): void {
    this.overlay.hidden = true;
    document.removeEventListener('keydown', this.onKeyDown);
  }

  /** Rebuild localized chrome, the list, and the detail panel. */
  refresh(): void {
    const lang = userPreferences.getLanguage();
    this.title.textContent = getText('missionModal.title', lang);
    this.tabListBtn.textContent = getText('library.tabList', lang);
    this.tabInfoBtn.textContent = getText('library.tabInfo', lang);
    this.renderList(lang);
    this.renderInfo(lang);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  /**
   * Whether a mission is the one actually playing right now. Selection persists
   * across reloads, but the run state does not (memory-only, resets to IDLE), so
   * "in progress" must follow the live status — not just which id is stored.
   */
  private isActive(id: string): boolean {
    return (
      missionState.getStatus() === MissionRunState.RUNNING &&
      missionState.getSelectedId() === id
    );
  }

  private setTab(tab: Tab): void {
    this.panel.dataset.tab = tab;
    this.tabListBtn.classList.toggle('is-active', tab === 'list');
    this.tabInfoBtn.classList.toggle('is-active', tab === 'info');
  }

  private select(id: string): void {
    this.selectedId = id;
    this.renderInfo(userPreferences.getLanguage());
    this.highlightSelected();
    this.setTab('info');
  }

  private highlightSelected(): void {
    for (const button of this.list.querySelectorAll<HTMLButtonElement>('.se-lib-item')) {
      button.classList.toggle('is-selected', button.dataset.id === this.selectedId);
    }
  }

  private renderList(lang: Language): void {
    this.list.replaceChildren();
    const items = el('div', 'se-lib-items se-mission-list');
    for (const mission of missions) {
      const button = el('button', 'se-lib-item');
      button.dataset.id = mission.id;
      button.textContent = mission[lang].name;
      if (this.isActive(mission.id)) {
        const badge = el('span', 'se-mission-active-dot');
        badge.textContent = ' ●';
        badge.title = getText('missionModal.active', lang);
        button.append(badge);
      }
      button.addEventListener('click', () => this.select(mission.id));
      items.append(button);
    }
    this.list.append(items);
    this.highlightSelected();
  }

  private renderInfo(lang: Language): void {
    this.info.replaceChildren();
    const mission = this.selectedId ? findMission(this.selectedId) : null;
    if (!mission) {
      const placeholder = el('p', 'se-info-placeholder');
      placeholder.textContent = getText('missionModal.placeholder', lang);
      this.info.append(placeholder);
      return;
    }

    const text = mission[lang];
    const title = el('h2', 'se-modal-title');
    title.textContent = text.name;
    this.info.append(title);

    if (this.isActive(mission.id)) {
      const badge = el('span', 'se-badge');
      badge.textContent = getText('missionModal.active', lang);
      this.info.append(badge);
    }

    const summary = el('p', 'se-modal-text');
    summary.textContent = text.summary;
    this.info.append(summary);

    const fields = el('dl', 'se-modal-fields');
    const dt = el('dt');
    dt.textContent = getText('missionModal.duration', lang);
    const dd = el('dd');
    dd.textContent = `${mission.durationYears.toFixed(1)} ${getText('missionModal.years', lang)}`;
    fields.append(dt, dd);
    this.info.append(fields);

    this.info.append(this.subtitle(getText('missionModal.phases', lang)));
    const phaseList = el('ol', 'se-mission-modal-phases');
    for (const phase of mission.phases) {
      const li = el('li');
      li.textContent = phase[lang].label;
      phaseList.append(li);
    }
    this.info.append(phaseList);

    if (text.highlights && text.highlights.length > 0) {
      this.info.append(this.subtitle(getText('missionModal.highlights', lang)));
      const ul = el('ul', 'se-modal-list');
      for (const h of text.highlights) {
        const li = el('li');
        li.textContent = h;
        ul.append(li);
      }
      this.info.append(ul);
    }

    const startBtn = el('button', 'se-button se-lib-goto');
    startBtn.textContent = getText('missionModal.start', lang);
    startBtn.addEventListener('click', () => {
      const id = mission.id;
      this.close();
      this.onStart(id);
    });
    this.info.append(startBtn);
  }

  private subtitle(text: string): HTMLHeadingElement {
    const h = el('h3', 'se-modal-subtitle');
    h.textContent = text;
    return h;
  }
}
