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
  EVENT_LANG_CHANGED,
  REGISTRY_ON_SELECT,
  RULER_WIDTH_PX,
  COLOR_BG,
  COLOR_TEXT,
  COLOR_ACCENT_AMBER,
} from '../../constants/constants';
import { bodies, spacecraft } from '../../logic/catalog';
import type { BodyData, SpacecraftData } from '../../logic/library';
import { bodyRadiusPx } from '../../logic/scale';
import { getText } from '../../logic/i18n';
import { getAllFunFacts } from '../../logic/funfacts';
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

export class LinearScene extends Phaser.Scene {
  private pxPerMkm = 1;
  private ruler!: RulerRenderer;
  private layouts: ElementLayout[] = [];
  private funFactTexts: Phaser.GameObjects.Text[] = [];
  private isDragging = false;
  private dragVelocity = 0;
  private readonly velocitySamples: number[] = [];

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

    const placements = computeLinearLayout(
      [
        ...bodies.map((b) => ({
          id: b.id,
          baseY: baseY(this.bodyDistance(b)),
          radiusPx: this.bodyRadius(b),
        })),
        ...spacecraft.map((c) => ({
          id: c.id,
          baseY: baseY(this.craftDistance(c)),
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

      const body = bodies.find((b) => b.id === element.id);
      if (body) {
        const obj = new CelestialBody(this, body, this.onSelect);
        obj.setPosition(axisX, y);
      } else {
        const craft = spacecraft.find((c) => c.id === element.id);
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
    this.funFactTexts = [];
    const centerX = this.scale.width / 2 + RULER_WIDTH_PX / 2;
    for (const fact of getAllFunFacts(lang)) {
      const worldY = baseY(fact.triggerDistanceMkm);
      this.funFactTexts.push(
        this.add
          .text(centerX, worldY, fact.text, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: COLOR_ACCENT_AMBER,
            align: 'center',
            wordWrap: { width: this.scale.width - RULER_WIDTH_PX - 80 },
            backgroundColor: 'rgba(5,8,15,0.85)',
            padding: { x: 10, y: 8 },
          })
          .setOrigin(0.5, 0.5)
          .setDepth(1000),
      );
    }

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

  private relabel(): void {
    const lang = userPreferences.getLanguage();
    for (const layout of this.layouts) {
      layout.label.setText(getText(`${layout.id}.name`, lang));
    }
    const updated = getAllFunFacts(lang);
    for (let i = 0; i < this.funFactTexts.length; i++) {
      this.funFactTexts[i].setText(updated[i].text);
    }
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
    if (!this.isDragging && Math.abs(this.dragVelocity) > SCROLL_DRAG_MIN_VELOCITY_PX) {
      this.cameras.main.scrollY -= this.dragVelocity;
      this.dragVelocity *= SCROLL_DRAG_FRICTION;
    }
    this.syncNavigation();
    this.ruler.update(this.pxPerMkm, LINEAR_TOP_PADDING_PX, scaleState.getUnit());
  }
}
