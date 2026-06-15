/**
 * Solar Explorer — EllipseScene.
 *
 * Orbital map with the Sun at the origin. Builds on {@link OrbitalMapScene} for
 * the shared sun/planets/moons/camera/input, and adds every spacecraft (solar-
 * orbiting, host-orbiting and static interstellar probes) plus element focusing.
 */
import Phaser from 'phaser';
import {
  SCENE_ELLIPSE,
  EVENT_ELLIPSE_SPEED,
  EVENT_ELLIPSE_LINES,
  EVENT_FOCUS_ELEMENT,
  MIN_REAL_RADIUS_MKM,
} from '../../constants/constants';
import { spacecraft } from '../../logic/catalog';
import type { SpacecraftData } from '../../logic/library';
import { linearScale } from '../../logic/scale';
import { yearsToOrbitMs, isOrbiting } from '../../logic/orbit';
import { Spacecraft } from '../objects/Spacecraft';
import { SunArrow } from '../objects/SunArrow';
import { OrbitalMapScene, seedAngle } from './OrbitalMapScene';

export class EllipseScene extends OrbitalMapScene {
  constructor() {
    super(SCENE_ELLIPSE);
  }

  create(): void {
    this.resetMap();

    const hostObjects = this.buildSunAndPlanets();
    // Moons and host-orbiting spacecraft, stacked as concentric rings.
    this.placeOrbiterRings(hostObjects, true);
    // Solar-orbiting and interstellar spacecraft (host-orbiting craft handled above).
    for (const craft of spacecraft) this.placeSpacecraft(craft);

    this.sunArrow = new SunArrow(this);
    this.setupCamera();
    this.setupInput();

    this.game.events.on(EVENT_ELLIPSE_SPEED, this.setSpeed, this);
    this.game.events.on(EVENT_ELLIPSE_LINES, this.setOrbitLines, this);
    this.game.events.on(EVENT_FOCUS_ELEMENT, this.focusElement, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  /**
   * Place solar-orbiting and interstellar spacecraft. Host-orbiting craft are
   * handled by {@link placeOrbiterRings} so they share their host's ring stack.
   */
  private placeSpacecraft(craft: SpacecraftData): void {
    if (isOrbiting(craft.id) && craft.host !== null && craft.host !== 'sun') return;

    const obj = new Spacecraft(this, craft, this.onSelect);

    if (!isOrbiting(craft.id)) {
      const angle = seedAngle(craft.id);
      const radius = linearScale(craft.orbitalRadius_mkm);
      obj.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius);
      return;
    }

    const radius = linearScale(Math.max(craft.orbitalRadius_mkm, MIN_REAL_RADIUS_MKM));
    this.entries.push({
      obj,
      radiusX: radius,
      radiusY: radius,
      periodMs: yearsToOrbitMs(1),
      center: () => ({ x: 0, y: 0 }),
      angle: seedAngle(craft.id),
    });
  }

  private onShutdown(): void {
    // Do NOT touch the camera here: during Phaser's shutdown it is already torn
    // down. The solar distance is saved every frame in update() instead.
    this.game.events.off(EVENT_ELLIPSE_SPEED, this.setSpeed, this);
    this.game.events.off(EVENT_ELLIPSE_LINES, this.setOrbitLines, this);
    this.game.events.off(EVENT_FOCUS_ELEMENT, this.focusElement, this);
  }

  update(_time: number, delta: number): void {
    this.advanceOrbits(delta);
    this.refreshOrbitLineZoom();
    this.updateSunArrow();
    this.syncNavigation();
  }
}
