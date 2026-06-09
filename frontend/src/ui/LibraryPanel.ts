/**
 * Solar Explorer — LibraryPanel.
 *
 * A sliding panel listing every element grouped by category. Clicking an item
 * opens its Info modal. Completed missions are flagged.
 */
import { Language, MissionStatus } from '../constants/constants';
import { getText } from '../logic/i18n';
import { buildLibraryTree, type LibraryItem, type LibraryTree } from '../logic/library';
import { bodies, spacecraft } from '../logic/catalog';
import { userPreferences } from '../state/UserPreferences';

type SelectHandler = (id: string) => void;

interface CategoryMeta {
  readonly icon: string;
  readonly labelKey: string;
  readonly items: (tree: LibraryTree) => readonly LibraryItem[];
}

const CATEGORIES: readonly CategoryMeta[] = [
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

export class LibraryPanel {
  private readonly panel: HTMLDivElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly body: HTMLDivElement;
  private readonly onSelect: SelectHandler;

  constructor(root: HTMLElement, onSelect: SelectHandler) {
    this.onSelect = onSelect;
    this.panel = el('div', 'se-library');
    this.panel.hidden = true;

    const header = el('div', 'se-library-header');
    this.titleEl = el('h2');
    const close = el('button', 'se-library-close');
    close.textContent = '×';
    close.addEventListener('click', () => this.close());
    header.append(this.titleEl, close);

    this.body = el('div', 'se-library-body');
    this.panel.append(header, this.body);
    root.append(this.panel);

    this.refresh();
  }

  /** Rebuild the tree (used on open and after a language change). */
  refresh(): void {
    const lang = userPreferences.getLanguage();
    this.titleEl.textContent = getText('library.title', lang);
    this.body.replaceChildren();
    const tree = buildLibraryTree(bodies, spacecraft, lang);

    for (const category of CATEGORIES) {
      const items = category.items(tree);
      if (items.length === 0) continue;
      const group = el('div', 'se-library-group');
      const heading = el('h3', 'se-library-group-title');
      heading.textContent = `${category.icon} ${getText(category.labelKey, lang)}`;
      group.append(heading);

      const list = el('div', 'se-library-items');
      for (const item of items) {
        list.append(this.renderItem(item, lang));
      }
      group.append(list);
      this.body.append(group);
    }
  }

  private renderItem(item: LibraryItem, lang: Language): HTMLButtonElement {
    const button = el('button', 'se-library-item');
    button.textContent = item.name;
    if (item.missionStatus === MissionStatus.COMPLETE) {
      const star = el('span', 'se-library-complete');
      star.textContent = ' ✦';
      star.title = getText('modal.missionComplete', lang);
      button.append(star);
    }
    button.addEventListener('click', () => {
      this.onSelect(item.id);
      this.close();
    });
    return button;
  }

  open(): void {
    this.refresh();
    this.panel.hidden = false;
  }

  close(): void {
    this.panel.hidden = true;
  }

  toggle(): void {
    if (this.panel.hidden) this.open();
    else this.close();
  }
}
