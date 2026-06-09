/**
 * Solar Explorer — InfoModal.
 *
 * Click → modal overlay showing a procedural preview and the localized data of
 * any body or spacecraft. Fields not applicable to the element are omitted.
 */
import {
  Language,
  Unit,
  MissionStatus,
} from '../constants/constants';
import { getText } from '../logic/i18n';
import { convertMkmToAU } from '../logic/scale';
import { findEntry, bodies } from '../logic/catalog';
import type { BodyData, SpacecraftData } from '../logic/library';
import { userPreferences } from '../state/UserPreferences';
import { scaleState } from '../state/ScaleState';
import {
  resolveBodyVisual,
  drawCelestialBody,
  drawSmallBody,
  drawSpacecraftIcon,
} from '../game/renderers/BodyRenderer';
import { COLOR_ACCENT_GREEN } from '../constants/constants';

const CANVAS_SIZE = 160;
const PREVIEW_RADIUS = 56;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class InfoModal {
  private readonly overlay: HTMLDivElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly title: HTMLHeadingElement;
  private readonly badge: HTMLDivElement;
  private readonly fields: HTMLDListElement;
  private readonly facts: HTMLDivElement;
  private currentId: string | null = null;

  constructor(root: HTMLElement) {
    this.overlay = el('div', 'se-modal-overlay');
    this.overlay.hidden = true;

    const panel = el('div', 'se-modal');
    const closeBtn = el('button', 'se-modal-close');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());

    this.canvas = el('canvas', 'se-modal-canvas');
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;

    this.title = el('h2', 'se-modal-title');
    this.badge = el('div', 'se-badge');
    this.badge.hidden = true;
    this.fields = el('dl', 'se-modal-fields');
    this.facts = el('div', 'se-modal-facts');

    panel.append(closeBtn, this.canvas, this.title, this.badge, this.fields, this.facts);
    this.overlay.append(panel);
    this.overlay.addEventListener('click', (event) => {
      if (event.target === this.overlay) this.close();
    });
    root.append(this.overlay);
  }

  /** Open the modal for the body/spacecraft with the given id. */
  openById(id: string): void {
    const entry = findEntry(id);
    if (!entry) return;
    this.currentId = id;
    const lang = userPreferences.getLanguage();
    const unit = scaleState.getUnit();

    this.title.textContent = getText(`${id}.name`, lang);
    this.fields.replaceChildren();
    this.facts.replaceChildren();
    this.badge.hidden = true;

    if (entry.kind === 'body') {
      this.renderBody(entry.body, lang, unit);
      this.drawBodyPreview(entry.body);
    } else {
      this.renderSpacecraft(entry.craft, lang, unit);
      this.drawSpacecraftPreview();
    }

    this.overlay.hidden = false;
  }

  /** Re-render the open modal (e.g. after a language or unit change). */
  refresh(): void {
    if (this.currentId && !this.overlay.hidden) this.openById(this.currentId);
  }

  close(): void {
    this.overlay.hidden = true;
    this.currentId = null;
  }

  private addField(label: string, value: string): void {
    const dt = el('dt');
    dt.textContent = label;
    const dd = el('dd');
    dd.textContent = value;
    this.fields.append(dt, dd);
  }

  private formatDistance(distanceMkm: number, unit: Unit, lang: Language): string {
    if (unit === Unit.AU) {
      return `${convertMkmToAU(distanceMkm).toFixed(2)} ${getText('hud.au', lang)}`;
    }
    return `${Math.round(distanceMkm).toLocaleString()} ${getText('hud.mkm', lang)}`;
  }

  private solarDistance(body: BodyData): number {
    if (body.host) {
      const host = bodies.find((b) => b.id === body.host);
      return (host?.orbitalRadius_mkm ?? 0) + body.orbitalRadius_mkm;
    }
    return body.orbitalRadius_mkm;
  }

  private renderBody(body: BodyData, lang: Language, unit: Unit): void {
    const distance = this.solarDistance(body);
    if (distance > 0) {
      this.addField(getText('modal.distanceToSun', lang), this.formatDistance(distance, unit, lang));
    }
    if (body.orbitalPeriod_years > 0) {
      this.addField(
        getText('modal.orbitalPeriod', lang),
        `${body.orbitalPeriod_years} ${getText('modal.years', lang)}`,
      );
    }
    if (body.rotationPeriod_days > 0) {
      this.addField(
        getText('modal.rotationPeriod', lang),
        `${body.rotationPeriod_days} ${getText('modal.days', lang)}`,
      );
    }
    this.addField(
      getText('modal.temperature', lang),
      `${body.temperatureMin_c}°C / ${body.temperatureMax_c}°C`,
    );
    this.renderFacts(getText(`${body.id}.description`, lang), body[lang].facts);
  }

  private renderSpacecraft(craft: SpacecraftData, lang: Language, unit: Unit): void {
    if (craft.missionStatus === MissionStatus.COMPLETE && craft.missionEndYear) {
      this.badge.textContent = `${getText('modal.missionComplete', lang)} · ${craft.missionEndYear}`;
      this.badge.hidden = false;
    }
    this.addField(getText('modal.launched', lang), String(craft.launchYear));
    if (craft.host) {
      this.addField(getText('modal.host', lang), getText(`${craft.host}.name`, lang));
    }
    if (craft.orbitalRadius_mkm > 0) {
      this.addField(
        getText('modal.distanceToSun', lang),
        this.formatDistance(craft.orbitalRadius_mkm, unit, lang),
      );
    }

    const localized = craft[lang];
    if (localized.objectives) {
      const h = el('h3', 'se-modal-subtitle');
      h.textContent = getText('modal.objectives', lang);
      const p = el('p', 'se-modal-text');
      p.textContent = localized.objectives;
      this.facts.append(h, p);
    }
    if (localized.instruments && localized.instruments.length > 0) {
      const h = el('h3', 'se-modal-subtitle');
      h.textContent = getText('modal.instruments', lang);
      const ul = el('ul', 'se-modal-list');
      for (const instrument of localized.instruments) {
        const li = el('li');
        li.innerHTML = '';
        const strong = el('strong');
        strong.textContent = `${instrument.name}: `;
        li.append(strong, document.createTextNode(instrument.description));
        ul.append(li);
      }
      this.facts.append(h, ul);
    }
    this.renderFacts(undefined, localized.facts);
  }

  private renderFacts(description: string | undefined, facts: readonly string[] | undefined): void {
    const lang = userPreferences.getLanguage();
    if (description) {
      const p = el('p', 'se-modal-text');
      p.textContent = description;
      this.facts.append(p);
    }
    if (facts && facts.length > 0) {
      const h = el('h3', 'se-modal-subtitle');
      h.textContent = getText('modal.facts', lang);
      const ul = el('ul', 'se-modal-list');
      for (const fact of facts) {
        const li = el('li');
        li.textContent = fact;
        ul.append(li);
      }
      this.facts.append(h, ul);
    }
  }

  private drawBodyPreview(body: BodyData): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const visual = resolveBodyVisual(body.id, body.type);
    const center = CANVAS_SIZE / 2;
    if (body.type === 'asteroid' || body.type === 'comet') {
      drawSmallBody(ctx, center, center, PREVIEW_RADIUS * 0.7, body.id, visual);
    } else {
      drawCelestialBody(ctx, center, center, PREVIEW_RADIUS, body.id, visual);
    }
  }

  private drawSpacecraftPreview(): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    const center = CANVAS_SIZE / 2;
    drawSpacecraftIcon(ctx, center, center, COLOR_ACCENT_GREEN, 14);
  }
}
