/**
 * Solar Explorer — LibraryModal.
 *
 * A single modal that merges the old library sidebar and the info modal into
 * two columns. Left: name search, a "group by type / orbits" selector, and the
 * grouped list of every element. Right: the InfoView for the selected element
 * plus a button that closes the modal and flies the camera to that element.
 *
 * Reached two ways: the HUD Library button (opens with no selection → info
 * placeholder) and selecting an element on screen or in the list (opens with
 * that element shown). On mobile the two columns collapse into tabs.
 */
import { Language, MissionStatus } from '../constants/constants';
import { getText } from '../logic/i18n';
import {
  buildLibraryTree,
  buildGroupsByHost,
  filterLibraryItems,
  type LibraryItem,
  type LibraryGroup,
  type LibraryTree,
} from '../logic/library';
import { bodies, spacecraft } from '../logic/catalog';
import { userPreferences } from '../state/UserPreferences';
import { InfoView } from './InfoView';

type FocusHandler = (id: string) => void;
type Grouping = 'type' | 'host';
type Tab = 'list' | 'info';

interface TypeCategory {
  readonly icon: string;
  readonly labelKey: string;
  readonly items: (tree: LibraryTree) => readonly LibraryItem[];
}

const TYPE_CATEGORIES: readonly TypeCategory[] = [
  { icon: '☀', labelKey: 'library.star', items: (t) => t.star },
  { icon: '🪐', labelKey: 'library.planets', items: (t) => t.planets },
  { icon: '🔵', labelKey: 'library.dwarfPlanets', items: (t) => t.dwarfPlanets },
  { icon: '🌕', labelKey: 'library.moons', items: (t) => t.moons },
  { icon: '🛸', labelKey: 'library.spacecraft', items: (t) => t.spacecraft },
  { icon: '☄', labelKey: 'library.asteroidsComets', items: (t) => t.asteroidsComets },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class LibraryModal {
  private readonly overlay: HTMLDivElement;
  private readonly panel: HTMLDivElement;
  private readonly searchInput: HTMLInputElement;
  private readonly groupTypeBtn: HTMLButtonElement;
  private readonly groupHostBtn: HTMLButtonElement;
  private readonly list: HTMLDivElement;
  private readonly tabListBtn: HTMLButtonElement;
  private readonly tabInfoBtn: HTMLButtonElement;
  private readonly info: InfoView;
  private readonly goToBtn: HTMLButtonElement;
  private readonly groupLabelEl: HTMLSpanElement;
  private readonly onFocus: FocusHandler;

  private grouping: Grouping = 'type';
  private query = '';

  constructor(root: HTMLElement, onFocus: FocusHandler) {
    this.onFocus = onFocus;

    this.overlay = el('div', 'se-modal-overlay');
    this.overlay.hidden = true;

    this.panel = el('div', 'se-lib-modal');
    this.panel.dataset.tab = 'list';

    const closeBtn = el('button', 'se-modal-close');
    closeBtn.textContent = '×';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => this.close());

    // Mobile tab bar (hidden on desktop via CSS).
    const tabs = el('div', 'se-lib-tabs');
    this.tabListBtn = el('button', 'se-lib-tab');
    this.tabInfoBtn = el('button', 'se-lib-tab');
    this.tabListBtn.addEventListener('click', () => this.setTab('list'));
    this.tabInfoBtn.addEventListener('click', () => this.setTab('info'));
    tabs.append(this.tabListBtn, this.tabInfoBtn);

    // Left column.
    const left = el('div', 'se-lib-left');
    this.searchInput = el('input', 'se-lib-search');
    this.searchInput.type = 'search';
    this.searchInput.addEventListener('input', () => {
      this.query = this.searchInput.value;
      this.renderList();
    });

    const groupControl = el('div', 'se-lib-group-control');
    const groupLabel = el('span', 'se-lib-group-label');
    this.groupLabelEl = groupLabel;
    const segments = el('div', 'se-segments');
    this.groupTypeBtn = el('button', 'se-segment');
    this.groupHostBtn = el('button', 'se-segment');
    this.groupTypeBtn.addEventListener('click', () => this.setGrouping('type'));
    this.groupHostBtn.addEventListener('click', () => this.setGrouping('host'));
    segments.append(this.groupTypeBtn, this.groupHostBtn);
    groupControl.append(groupLabel, segments);

    this.list = el('div', 'se-lib-list');
    left.append(this.searchInput, groupControl, this.list);

    // Right column.
    const right = el('div', 'se-lib-right');
    this.info = new InfoView();
    this.goToBtn = el('button', 'se-button se-lib-goto');
    this.goToBtn.hidden = true;
    this.goToBtn.addEventListener('click', () => {
      const id = this.info.getCurrentId();
      if (!id) return;
      this.close();
      this.onFocus(id);
    });
    right.append(this.info.root, this.goToBtn);

    this.panel.append(closeBtn, tabs, left, right);
    this.overlay.append(this.panel);
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
    root.append(this.overlay);

    this.refresh();
  }

  /** Open with no preselection (HUD Library button): list tab, info placeholder. */
  open(): void {
    this.resetSearch();
    this.info.clear();
    this.goToBtn.hidden = true;
    this.refresh();
    this.setTab('list');
    this.overlay.hidden = false;
    document.addEventListener('keydown', this.onKeyDown);
    this.searchInput.focus();
  }

  /** Open showing a specific element (selection on screen / in the list). */
  openById(id: string): void {
    this.resetSearch();
    this.refresh();
    this.select(id);
    this.setTab('info');
    this.overlay.hidden = false;
    document.addEventListener('keydown', this.onKeyDown);
  }

  private resetSearch(): void {
    this.query = '';
    this.searchInput.value = '';
  }

  close(): void {
    this.overlay.hidden = true;
    document.removeEventListener('keydown', this.onKeyDown);
  }

  /** Rebuild localized chrome and the list (on open and after a language change). */
  refresh(): void {
    const lang = userPreferences.getLanguage();
    this.searchInput.placeholder = getText('library.search', lang);
    this.groupLabelEl.textContent = getText('library.groupBy', lang);
    this.groupTypeBtn.textContent = getText('library.byType', lang);
    this.groupHostBtn.textContent = getText('library.byHost', lang);
    this.tabListBtn.textContent = getText('library.tabList', lang);
    this.tabInfoBtn.textContent = getText('library.tabInfo', lang);
    this.goToBtn.textContent = getText('library.goToElement', lang);
    this.groupTypeBtn.classList.toggle('is-active', this.grouping === 'type');
    this.groupHostBtn.classList.toggle('is-active', this.grouping === 'host');
    this.info.refresh();
    this.goToBtn.hidden = this.info.getCurrentId() === null;
    this.renderList();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
  };

  private setTab(tab: Tab): void {
    this.panel.dataset.tab = tab;
    this.tabListBtn.classList.toggle('is-active', tab === 'list');
    this.tabInfoBtn.classList.toggle('is-active', tab === 'info');
  }

  private setGrouping(grouping: Grouping): void {
    if (this.grouping === grouping) return;
    this.grouping = grouping;
    this.groupTypeBtn.classList.toggle('is-active', grouping === 'type');
    this.groupHostBtn.classList.toggle('is-active', grouping === 'host');
    this.renderList();
  }

  private select(id: string): void {
    this.info.render(id);
    this.goToBtn.hidden = this.info.getCurrentId() === null;
    this.highlightSelected();
  }

  private highlightSelected(): void {
    const current = this.info.getCurrentId();
    for (const button of this.list.querySelectorAll<HTMLButtonElement>('.se-lib-item')) {
      button.classList.toggle('is-selected', button.dataset.id === current);
    }
  }

  private currentGroups(lang: Language): readonly LibraryGroup[] {
    if (this.grouping === 'host') return buildGroupsByHost(bodies, spacecraft, lang);
    const tree = buildLibraryTree(bodies, spacecraft, lang);
    return TYPE_CATEGORIES.map((c) => ({
      key: c.labelKey,
      label: `${c.icon} ${getText(c.labelKey, lang)}`,
      items: c.items(tree),
    }));
  }

  private renderList(): void {
    const lang = userPreferences.getLanguage();
    this.list.replaceChildren();
    for (const group of this.currentGroups(lang)) {
      const items = filterLibraryItems(group.items, this.query);
      if (items.length === 0) continue;

      const groupEl = el('div', 'se-lib-group');
      const heading = el('h3', 'se-lib-group-title');
      heading.textContent = group.label;
      groupEl.append(heading);

      const itemsEl = el('div', 'se-lib-items');
      for (const item of items) itemsEl.append(this.renderItem(item, lang));
      groupEl.append(itemsEl);
      this.list.append(groupEl);
    }
    this.highlightSelected();
  }

  private renderItem(item: LibraryItem, lang: Language): HTMLButtonElement {
    const button = el('button', 'se-lib-item');
    button.dataset.id = item.id;
    button.textContent = item.name;
    if (item.missionStatus === MissionStatus.COMPLETE) {
      const star = el('span', 'se-library-complete');
      star.textContent = ' ✦';
      star.title = getText('modal.missionComplete', lang);
      button.append(star);
    }
    button.addEventListener('click', () => {
      this.select(item.id);
      this.setTab('info');
    });
    return button;
  }
}
