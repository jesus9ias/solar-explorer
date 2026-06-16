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
  LINEAR_TOP_PADDING_PX,
  LINEAR_BODY_GAP_PX,
  SPACECRAFT_RADIUS_PX,
  BodyType,
  ELEMENT_JUMP_DURATION_MS,
  EVENT_LINEAR_PREV,
  EVENT_LINEAR_NEXT,
  EVENT_FOCUS_ELEMENT,
  EVENT_LANG_CHANGED,
  REGISTRY_ON_SELECT,
  COLOR_BG,
  COLOR_TEXT,
  COLOR_ACCENT_AMBER,
} from '../../constants/constants';
import {
  bodies,
  spacecraft,
  bodySolarDistanceMkm,
  craftSolarDistanceMkm,
} from '../../logic/catalog';
import type { BodyData } from '../../logic/library';
import { bodyRadiusPx } from '../../logic/scale';
import { getText } from '../../logic/i18n';
import { getFunFactsAtDistance } from '../../logic/funfacts';
import { computeLinearLayout } from '../../logic/linearLayout';
import { linearDistanceToY, linearYToDistance } from '../../logic/linearScale';
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
const SCROLL_DRAG_FRICTION = 0.92;
const SCROLL_DRAG_MIN_VELOCITY_PX = 0.5;
const SCROLL_VELOCITY_SAMPLES = 5;
const LABEL_OFFSET_X = 26;
/** Fun-fact overlay: distance from the viewport bottom edge, in pixels. */
const FUNFACT_BOTTOM_MARGIN_PX = 18;
/** Fun-fact overlay: horizontal inset from each viewport edge, in pixels. */
const FUNFACT_SIDE_MARGIN_PX = 16;
/** Fun-fact overlay: cross-fade duration when the active fact changes. */
const FUNFACT_FADE_MS = 250;
/**
 * Fun-fact overlay: how far (as a fraction of the viewport height) the center
 * of the screen may drift from a fact's trigger before the fact is hidden.
 * Keeps each note tied to its region instead of lingering until the next one.
 */
const FUNFACT_VISIBLE_RANGE_VH = 0.5;
/** No facts are ever suppressed in the overlay; it always reflects position. */
const EMPTY_SHOWN_IDS: ReadonlySet<string> = new Set();

export class LinearScene extends Phaser.Scene {
  private pxPerMkm = 1;
  private ruler!: RulerRenderer;
  private layouts: ElementLayout[] = [];
  private funFactOverlay!: Phaser.GameObjects.Text;
  private activeFactId: string | null = null;
  private isDragging = false;
  private dragVelocity = 0;
  private readonly velocitySamples: number[] = [];

  constructor() {
    super(SCENE_LINEAR);
  }

  private get onSelect(): SelectHandler {
    return (this.registry.get(REGISTRY_ON_SELECT) as SelectHandler | undefined) ?? (() => {});
  }

  /** Rendered radius (px) of a body — mirrors CelestialBody's texture sizing. */
  private bodyRadius(body: BodyData): number {
    const small = body.type === BodyType.ASTEROID || body.type === BodyType.COMET;
    return small ? SPACECRAFT_RADIUS_PX : bodyRadiusPx(body.radius_km);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR_BG);
    this.pxPerMkm = scaleState.getZoom();
    this.layouts = [];

    const lang = userPreferences.getLanguage();

    const baseY = (distanceMkm: number): number =>
      linearDistanceToY(distanceMkm, this.pxPerMkm, LINEAR_TOP_PADDING_PX);

    const bodyById = new Map(bodies.map((b) => [b.id, b]));
    const craftById = new Map(spacecraft.map((c) => [c.id, c]));

    const placements = computeLinearLayout(
      [
        ...bodies.map((b) => ({
          id: b.id,
          baseY: baseY(bodySolarDistanceMkm(b)),
          radiusPx: this.bodyRadius(b),
        })),
        ...spacecraft.map((c) => ({
          id: c.id,
          baseY: baseY(craftSolarDistanceMkm(c)),
          radiusPx: SPACECRAFT_RADIUS_PX,
        })),
      ],
      LINEAR_BODY_GAP_PX,
    );

    const axisX = this.scale.width / 2;

    let worldHeight = LINEAR_TOP_PADDING_PX;
    for (const element of placements) {
      const y = element.y;
      worldHeight = Math.max(worldHeight, y);

      const body = bodyById.get(element.id);
      if (body) {
        const obj = new CelestialBody(this, body, this.onSelect);
        obj.setPosition(axisX, y);
      } else {
        const craft = craftById.get(element.id);
        if (craft) {
          const obj = new Spacecraft(this, craft, this.onSelect);
          obj.setPosition(axisX, y);
        }
      }

      const label = this.add
        .text(axisX + LABEL_OFFSET_X, y, getText(`${element.id}.name`, lang), {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: COLOR_TEXT,
        })
        .setOrigin(0, 0.5);
      this.layouts.push({ id: element.id, y, label });
    }

    this.cameras.main.setBounds(0, 0, this.scale.width, worldHeight + this.scale.height);

    this.ruler = new RulerRenderer(this);

    // A single fun-fact panel pinned to the viewport bottom (scrollFactor 0).
    // It shows the most recently crossed fact for the current scroll position
    // (see getFunFactsAtDistance) and never competes with bodies for world Y,
    // so it cannot overlap them on any viewport — notably narrow phones.
    this.activeFactId = null;
    this.funFactOverlay = this.add
      .text(this.scale.width / 2, this.scale.height - FUNFACT_BOTTOM_MARGIN_PX, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: COLOR_ACCENT_AMBER,
        align: 'center',
        wordWrap: { width: this.scale.width - FUNFACT_SIDE_MARGIN_PX * 2 },
        backgroundColor: 'rgba(5,8,15,0.85)',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false);

    this.setupInput();
    this.restoreScrollFromNavigation();

    this.game.events.on(EVENT_LINEAR_PREV, this.goPrevious, this);
    this.game.events.on(EVENT_LINEAR_NEXT, this.goNext, this);
    this.game.events.on(EVENT_FOCUS_ELEMENT, this.focusElement, this);
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
      this.dragVelocity = 0;
      this.velocitySamples.length = 0;
      // Cancel any in-flight tween so drag takes immediate control
      this.tweens.killTweensOf(this.cameras.main);
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
      // Hand off average velocity to the coasting animation
      if (this.velocitySamples.length > 0) {
        const sum = this.velocitySamples.reduce((a, b) => a + b, 0);
        this.dragVelocity = sum / this.velocitySamples.length;
      }
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const delta = pointer.y - pointer.prevPosition.y;
      this.cameras.main.scrollY -= delta;
      this.syncNavigation();
      this.velocitySamples.push(delta);
      if (this.velocitySamples.length > SCROLL_VELOCITY_SAMPLES) {
        this.velocitySamples.shift();
      }
    });
  }

  private centerDistance(): number {
    return linearYToDistance(
      this.cameras.main.scrollY + this.scale.height / 2,
      this.pxPerMkm,
      LINEAR_TOP_PADDING_PX,
    );
  }

  private syncNavigation(): void {
    navigationState.setDistance(this.centerDistance());
  }

  private restoreScrollFromNavigation(): void {
    const distance = navigationState.getDistance();
    const targetScroll =
      linearDistanceToY(distance, this.pxPerMkm, LINEAR_TOP_PADDING_PX) -
      this.scale.height / 2;
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

  private focusElement(id: string): void {
    const layout = this.layouts.find((l) => l.id === id);
    if (layout) this.scrollToY(layout.y);
  }

  private relabel(): void {
    const lang = userPreferences.getLanguage();
    for (const layout of this.layouts) {
      layout.label.setText(getText(`${layout.id}.name`, lang));
    }
    // Re-resolve the visible fact in the new language without animating.
    this.activeFactId = null;
    this.refreshFunFact();
  }

  /**
   * Sync the pinned fun-fact overlay to the current scroll position: show the
   * most recently crossed fact, hide it before the first trigger, and
   * cross-fade only when the active fact actually changes.
   */
  private refreshFunFact(): void {
    const lang = userPreferences.getLanguage();
    const crossed = getFunFactsAtDistance(this.centerDistance(), lang, EMPTY_SHOWN_IDS);

    // Hide the note once the viewport center drifts beyond a scroll range from
    // its trigger, so it stays tied to its region rather than lingering until
    // the next trigger is crossed.
    let fact = crossed;
    if (crossed) {
      const centerY = this.cameras.main.scrollY + this.scale.height / 2;
      const triggerY = linearDistanceToY(
        crossed.triggerDistanceMkm,
        this.pxPerMkm,
        LINEAR_TOP_PADDING_PX,
      );
      const range = this.scale.height * FUNFACT_VISIBLE_RANGE_VH;
      if (Math.abs(centerY - triggerY) > range) fact = null;
    }

    const nextId = fact?.id ?? null;
    if (nextId === this.activeFactId) return;
    this.activeFactId = nextId;

    this.tweens.killTweensOf(this.funFactOverlay);
    if (!fact) {
      this.tweens.add({
        targets: this.funFactOverlay,
        alpha: 0,
        duration: FUNFACT_FADE_MS,
        ease: 'Sine.easeIn',
        onComplete: () => this.funFactOverlay.setVisible(false),
      });
      return;
    }
    this.funFactOverlay.setText(fact.text).setVisible(true).setAlpha(0);
    this.tweens.add({
      targets: this.funFactOverlay,
      alpha: 1,
      duration: FUNFACT_FADE_MS,
      ease: 'Sine.easeOut',
    });
  }

  private onShutdown(): void {
    // Do NOT touch the camera here: during Phaser's shutdown the camera is
    // already torn down. navigationState is kept current every frame in
    // update(), so the position handoff to the other mode is already saved.
    this.game.events.off(EVENT_LINEAR_PREV, this.goPrevious, this);
    this.game.events.off(EVENT_LINEAR_NEXT, this.goNext, this);
    this.game.events.off(EVENT_FOCUS_ELEMENT, this.focusElement, this);
    this.game.events.off(EVENT_LANG_CHANGED, this.relabel, this);
  }

  update(): void {
    if (!this.isDragging && Math.abs(this.dragVelocity) > SCROLL_DRAG_MIN_VELOCITY_PX) {
      this.cameras.main.scrollY -= this.dragVelocity;
      this.dragVelocity *= SCROLL_DRAG_FRICTION;
    }
    this.syncNavigation();
    this.refreshFunFact();
    this.ruler.update(
      this.pxPerMkm,
      LINEAR_TOP_PADDING_PX,
      scaleState.getUnit(),
      this.centerDistance(),
    );
  }
}
