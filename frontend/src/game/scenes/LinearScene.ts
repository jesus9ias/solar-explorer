/**
 * Solar Explorer — LinearScene.
 *
 * Vertical, single-axis view of the solar system ordered by distance from the
 * Sun. The user scrolls (wheel or drag) from the Sun down to Voyager 1. A left
 * ruler shows the distance traveled and contextual fun facts appear as trigger
 * distances are crossed.
 */
import Phaser from 'phaser';
import {
  SCENE_LINEAR,
  LINEAR_AXIS_X,
  LINEAR_TOP_PADDING_PX,
  ELEMENT_JUMP_DURATION_MS,
  EVENT_LINEAR_PREV,
  EVENT_LINEAR_NEXT,
  EVENT_LANG_CHANGED,
  REGISTRY_ON_SELECT,
  RULER_WIDTH_PX,
  COLOR_BG,
  COLOR_TEXT,
  COLOR_ACCENT_AMBER,
} from '../../constants/constants';
import { bodies, spacecraft } from '../../logic/catalog';
import type { BodyData, SpacecraftData } from '../../logic/library';
import { getText } from '../../logic/i18n';
import { getFunFactsAtDistance } from '../../logic/funfacts';
import { userPreferences } from '../../state/UserPreferences';
import { scaleState } from '../../state/ScaleState';
import { navigationState } from '../../state/NavigationState';
import { CelestialBody, type SelectHandler } from '../objects/CelestialBody';
import { Spacecraft } from '../objects/Spacecraft';
import { RulerRenderer } from '../renderers/RulerRenderer';

interface ElementLayout {
  readonly id: string;
  readonly y: number;
  readonly label: Phaser.GameObjects.Text;
}

const SCROLL_WHEEL_FACTOR = 0.6;
const LABEL_OFFSET_X = 26;
const FUNFACT_VISIBLE_MS = 7000;

export class LinearScene extends Phaser.Scene {
  private pxPerMkm = 1;
  private ruler!: RulerRenderer;
  private layouts: ElementLayout[] = [];
  private readonly shownFunFacts = new Set<string>();
  private funFactText!: Phaser.GameObjects.Text;
  private funFactTimer?: Phaser.Time.TimerEvent;
  private isDragging = false;

  constructor() {
    super(SCENE_LINEAR);
  }

  private get onSelect(): SelectHandler {
    return (this.registry.get(REGISTRY_ON_SELECT) as SelectHandler | undefined) ?? (() => {});
  }

  private hostDistance(hostId: string | null): number {
    if (!hostId) return 0;
    const host = bodies.find((b) => b.id === hostId);
    return host ? host.orbitalRadius_mkm : 0;
  }

  private bodyDistance(body: BodyData): number {
    if (body.type === 'star') return 0;
    return this.hostDistance(body.host) + body.orbitalRadius_mkm;
  }

  private craftDistance(craft: SpacecraftData): number {
    if (craft.host === null) return craft.orbitalRadius_mkm;
    if (craft.host === 'sun') return craft.orbitalRadius_mkm;
    return this.hostDistance(craft.host) + craft.orbitalRadius_mkm;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR_BG);
    this.pxPerMkm = scaleState.getZoom();
    this.shownFunFacts.clear();
    this.layouts = [];

    const lang = userPreferences.getLanguage();

    const elements: { id: string; distance: number }[] = [
      ...bodies.map((b) => ({ id: b.id, distance: this.bodyDistance(b) })),
      ...spacecraft.map((c) => ({ id: c.id, distance: this.craftDistance(c) })),
    ].sort((a, b) => a.distance - b.distance);

    let worldHeight = LINEAR_TOP_PADDING_PX;
    for (const element of elements) {
      const y = LINEAR_TOP_PADDING_PX + element.distance * this.pxPerMkm;
      worldHeight = Math.max(worldHeight, y);

      const body = bodies.find((b) => b.id === element.id);
      if (body) {
        const obj = new CelestialBody(this, body, this.onSelect);
        obj.setPosition(LINEAR_AXIS_X, y);
      } else {
        const craft = spacecraft.find((c) => c.id === element.id);
        if (craft) {
          const obj = new Spacecraft(this, craft, this.onSelect);
          obj.setPosition(LINEAR_AXIS_X, y);
        }
      }

      const label = this.add
        .text(LINEAR_AXIS_X + LABEL_OFFSET_X, y, getText(`${element.id}.name`, lang), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: COLOR_TEXT,
        })
        .setOrigin(0, 0.5);
      this.layouts.push({ id: element.id, y, label });
    }

    this.cameras.main.setBounds(0, 0, this.scale.width, worldHeight + this.scale.height);

    this.ruler = new RulerRenderer(this);
    this.funFactText = this.add
      .text(this.scale.width / 2 + RULER_WIDTH_PX / 2, this.scale.height - 60, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: COLOR_ACCENT_AMBER,
        align: 'center',
        wordWrap: { width: this.scale.width - RULER_WIDTH_PX - 80 },
        backgroundColor: 'rgba(5,8,15,0.85)',
        padding: { x: 10, y: 8 },
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 1)
      .setDepth(1000)
      .setVisible(false);

    this.setupInput();
    this.restoreScrollFromNavigation();

    this.game.events.on(EVENT_LINEAR_PREV, this.goPrevious, this);
    this.game.events.on(EVENT_LINEAR_NEXT, this.goNext, this);
    this.game.events.on(EVENT_LANG_CHANGED, this.relabel, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private setupInput(): void {
    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        this.cameras.main.scrollY += dy * SCROLL_WHEEL_FACTOR;
        this.syncNavigation();
      },
    );

    this.input.on('pointerdown', () => {
      this.isDragging = true;
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      this.cameras.main.scrollY -= pointer.y - pointer.prevPosition.y;
      this.syncNavigation();
    });
  }

  private centerDistance(): number {
    return Math.max(
      0,
      (this.cameras.main.scrollY + this.scale.height / 2 - LINEAR_TOP_PADDING_PX) /
        this.pxPerMkm,
    );
  }

  private syncNavigation(): void {
    navigationState.setDistance(this.centerDistance());
  }

  private restoreScrollFromNavigation(): void {
    const distance = navigationState.getDistance();
    const targetScroll =
      LINEAR_TOP_PADDING_PX + distance * this.pxPerMkm - this.scale.height / 2;
    this.cameras.main.scrollY = targetScroll;
  }

  private scrollToY(targetY: number): void {
    const destination = targetY - this.scale.height / 2;
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: destination,
      duration: ELEMENT_JUMP_DURATION_MS,
      ease: 'Sine.easeInOut',
      onComplete: () => this.syncNavigation(),
    });
  }

  private goNext(): void {
    const center = this.cameras.main.scrollY + this.scale.height / 2;
    const next = this.layouts.find((l) => l.y > center + 1);
    if (next) this.scrollToY(next.y);
  }

  private goPrevious(): void {
    const center = this.cameras.main.scrollY + this.scale.height / 2;
    const previous = [...this.layouts].reverse().find((l) => l.y < center - 1);
    if (previous) this.scrollToY(previous.y);
  }

  private relabel(): void {
    const lang = userPreferences.getLanguage();
    for (const layout of this.layouts) {
      layout.label.setText(getText(`${layout.id}.name`, lang));
    }
  }

  private maybeShowFunFact(): void {
    const lang = userPreferences.getLanguage();
    const fact = getFunFactsAtDistance(this.centerDistance(), lang, this.shownFunFacts);
    if (!fact) return;
    this.shownFunFacts.add(fact.id);
    this.funFactText.setText(fact.text).setVisible(true);
    this.funFactTimer?.remove();
    this.funFactTimer = this.time.delayedCall(FUNFACT_VISIBLE_MS, () => {
      this.funFactText.setVisible(false);
    });
  }

  private onShutdown(): void {
    // Do NOT touch the camera here: during Phaser's shutdown the camera is
    // already torn down. navigationState is kept current every frame in
    // update(), so the position handoff to the other mode is already saved.
    this.game.events.off(EVENT_LINEAR_PREV, this.goPrevious, this);
    this.game.events.off(EVENT_LINEAR_NEXT, this.goNext, this);
    this.game.events.off(EVENT_LANG_CHANGED, this.relabel, this);
  }

  update(): void {
    this.syncNavigation();
    this.ruler.update(this.pxPerMkm, LINEAR_TOP_PADDING_PX, scaleState.getUnit());
    this.maybeShowFunFact();
  }
}
