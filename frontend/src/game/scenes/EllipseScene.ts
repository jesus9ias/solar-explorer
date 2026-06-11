/**
 * Solar Explorer — EllipseScene.
 *
 * Orbital map with the Sun at the origin. Bodies orbit on linearly
 * scaled radii that preserve true distance proportions; the camera pans and
 * zooms. A compass arrow always points to the Sun. Non-orbiting probes are
 * shown statically in interstellar space.
 */
import Phaser from 'phaser';
import {
  SCENE_ELLIPSE,
  EVENT_ELLIPSE_SPEED,
  EVENT_ELLIPSE_LINES,
  REGISTRY_ON_SELECT,
  DEFAULT_ORBIT_SPEED,
  ELLIPSE_DEFAULT_ZOOM,
  ELLIPSE_MIN_ZOOM,
  ELLIPSE_MAX_ZOOM,
  MIN_SCREEN_RADIUS,
  MAX_SCREEN_RADIUS,
  MIN_REAL_RADIUS_MKM,
  FULL_CIRCLE_RAD,
  COLOR_BG,
  ORBIT_LINE_COLORS,
  COLOR_ORBIT_LINE,
} from '../../constants/constants';
import { bodies, spacecraft, sun } from '../../logic/catalog';
import type { BodyData, SpacecraftData } from '../../logic/library';
import { linearScale, inverseLinearScale } from '../../logic/scale';
import { yearsToOrbitMs, isOrbiting } from '../../logic/orbit';
import { navigationState } from '../../state/NavigationState';
import { CelestialBody, type SelectHandler } from '../objects/CelestialBody';
import { Spacecraft } from '../objects/Spacecraft';
import { OrbitLine } from '../objects/OrbitLine';
import { SunArrow } from '../objects/SunArrow';

interface OrbitEntry {
  readonly obj: Phaser.GameObjects.Image;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly periodMs: number;
  readonly center: () => { x: number; y: number };
  angle: number;
}

const MOON_ORBIT_RADIUS_PX = 26;
const SATELLITE_ORBIT_RADIUS_PX = 20;
const ZOOM_IN_FACTOR = 1.1;
const ZOOM_OUT_FACTOR = 0.9;
const VIEW_FILL_FRACTION = 0.4;

/** Deterministic starting angle so bodies are spread around their orbits. */
function seedAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

export class EllipseScene extends Phaser.Scene {
  private readonly entries: OrbitEntry[] = [];
  private readonly orbitLines: OrbitLine[] = [];
  private speedMultiplier = DEFAULT_ORBIT_SPEED;
  private sunArrow!: SunArrow;
  private isDragging = false;
  private lastPinchDist = -1;
  private lastZoom = -1;

  constructor() {
    super(SCENE_ELLIPSE);
  }

  private get onSelect(): SelectHandler {
    return (this.registry.get(REGISTRY_ON_SELECT) as SelectHandler | undefined) ?? (() => {});
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLOR_BG);
    this.entries.length = 0;
    this.orbitLines.length = 0;
    this.speedMultiplier = DEFAULT_ORBIT_SPEED;

    const origin = () => ({ x: 0, y: 0 });

    // The Sun at the origin.
    const sunBody = sun();
    if (sunBody) {
      const sunObj = new CelestialBody(this, sunBody, this.onSelect);
      sunObj.setPosition(0, 0);
    }

    // Planets, dwarf planets, asteroids, comets (solar-orbiting).
    const hostObjects = new Map<string, Phaser.GameObjects.Image>();
    for (const body of bodies) {
      if (body.host !== null || body.orbitalRadius_mkm <= 0) continue;
      const radius = linearScale(body.orbitalRadius_mkm);
      const orbitColor = ORBIT_LINE_COLORS[body.type] ?? COLOR_ORBIT_LINE;
      this.orbitLines.push(new OrbitLine(this, radius, body.eccentricity, orbitColor));
      const obj = new CelestialBody(this, body, this.onSelect);
      hostObjects.set(body.id, obj);
      const minor = radius * Math.sqrt(1 - Math.min(body.eccentricity, 0.9) ** 2);
      this.entries.push({
        obj,
        radiusX: radius,
        radiusY: minor,
        periodMs: yearsToOrbitMs(body.orbitalPeriod_years),
        center: origin,
        angle: seedAngle(body.id),
      });
    }

    // Moons orbit their host body.
    for (const body of bodies) {
      if (body.type !== 'moon' || !body.host) continue;
      const hostObj = hostObjects.get(body.host);
      if (!hostObj) continue;
      this.addOrbiterAround(body, hostObj, MOON_ORBIT_RADIUS_PX);
    }

    // Spacecraft.
    for (const craft of spacecraft) {
      this.placeSpacecraft(craft, hostObjects);
    }

    this.sunArrow = new SunArrow(this);
    this.setupCamera();
    this.setupInput();

    this.game.events.on(EVENT_ELLIPSE_SPEED, this.setSpeed, this);
    this.game.events.on(EVENT_ELLIPSE_LINES, this.setOrbitLines, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private addOrbiterAround(
    body: BodyData,
    hostObj: Phaser.GameObjects.Image,
    radiusPx: number,
  ): void {
    const obj = new CelestialBody(this, body, this.onSelect);
    this.entries.push({
      obj,
      radiusX: radiusPx,
      radiusY: radiusPx,
      periodMs: yearsToOrbitMs(Math.max(body.orbitalPeriod_years, 0.01)),
      center: () => ({ x: hostObj.x, y: hostObj.y }),
      angle: seedAngle(body.id),
    });
  }

  private placeSpacecraft(
    craft: SpacecraftData,
    hostObjects: Map<string, Phaser.GameObjects.Image>,
  ): void {
    const obj = new Spacecraft(this, craft, this.onSelect);

    if (!isOrbiting(craft.id)) {
      const angle = seedAngle(craft.id);
      const radius = linearScale(craft.orbitalRadius_mkm);
      obj.setPosition(Math.cos(angle) * radius, Math.sin(angle) * radius);
      return;
    }

    if (craft.host === 'sun' || craft.host === null) {
      const radius = linearScale(Math.max(craft.orbitalRadius_mkm, MIN_REAL_RADIUS_MKM));
      this.entries.push({
        obj,
        radiusX: radius,
        radiusY: radius,
        periodMs: yearsToOrbitMs(1),
        center: () => ({ x: 0, y: 0 }),
        angle: seedAngle(craft.id),
      });
      return;
    }

    const hostObj = hostObjects.get(craft.host);
    const center = hostObj ? () => ({ x: hostObj.x, y: hostObj.y }) : () => ({ x: 0, y: 0 });
    this.entries.push({
      obj,
      radiusX: SATELLITE_ORBIT_RADIUS_PX,
      radiusY: SATELLITE_ORBIT_RADIUS_PX,
      periodMs: yearsToOrbitMs(0.2),
      center,
      angle: seedAngle(craft.id),
    });
  }

  private setupCamera(): void {
    const distance = navigationState.getDistance();
    let zoom = ELLIPSE_DEFAULT_ZOOM;
    if (distance > 0) {
      const targetRadius = linearScale(Math.max(distance, MIN_REAL_RADIUS_MKM));
      const desiredScreen = Math.min(this.scale.width, this.scale.height) * VIEW_FILL_FRACTION;
      zoom = Phaser.Math.Clamp(desiredScreen / targetRadius, ELLIPSE_MIN_ZOOM, ELLIPSE_MAX_ZOOM);
    }
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(0, 0);
  }

  private setupInput(): void {
    this.input.addPointer(1);

    this.input.on(
      'wheel',
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const camera = this.cameras.main;
        const factor = dy > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR;
        camera.setZoom(
          Phaser.Math.Clamp(camera.zoom * factor, ELLIPSE_MIN_ZOOM, ELLIPSE_MAX_ZOOM),
        );
      },
    );

    this.input.on('pointerdown', () => {
      this.isDragging = true;
    });
    this.input.on('pointerup', () => {
      this.isDragging = false;
      this.lastPinchDist = -1;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const p1 = this.input.pointer1;
      const p2 = this.input.pointer2;

      if (p1.isDown && p2.isDown) {
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        if (this.lastPinchDist > 0) {
          const factor = dist / this.lastPinchDist;
          const camera = this.cameras.main;
          camera.setZoom(
            Phaser.Math.Clamp(camera.zoom * factor, ELLIPSE_MIN_ZOOM, ELLIPSE_MAX_ZOOM),
          );
        }
        this.lastPinchDist = dist;
        return;
      }

      this.lastPinchDist = -1;

      if (!this.isDragging) return;
      const camera = this.cameras.main;
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    });
  }

  private setSpeed(multiplier: number): void {
    this.speedMultiplier = multiplier;
  }

  private setOrbitLines(visible: boolean): void {
    for (const line of this.orbitLines) line.setVisible(visible);
  }

  private updateSunArrow(): void {
    const view = this.cameras.main.worldView;
    const sunOnScreen = view.contains(0, 0);
    if (sunOnScreen) {
      this.sunArrow.pointToward(0, 0, false);
      return;
    }
    const screenX = ((0 - view.x) / view.width) * this.scale.width;
    const screenY = ((0 - view.y) / view.height) * this.scale.height;
    this.sunArrow.pointToward(screenX, screenY, true);
  }

  /**
   * Translate the current camera extent into a solar distance so the Linear
   * scene can restore an equivalent position. Called every frame while active
   * (the camera is valid), never during shutdown.
   */
  private syncNavigation(): void {
    const visibleScreenRadius =
      Math.min(this.scale.width, this.scale.height) / (2 * this.cameras.main.zoom);
    const clamped = Phaser.Math.Clamp(visibleScreenRadius, MIN_SCREEN_RADIUS, MAX_SCREEN_RADIUS);
    navigationState.setDistance(inverseLinearScale(clamped));
  }

  private onShutdown(): void {
    // Do NOT touch the camera here: during Phaser's shutdown it is already torn
    // down. The solar distance is saved every frame in update() instead.
    this.game.events.off(EVENT_ELLIPSE_SPEED, this.setSpeed, this);
    this.game.events.off(EVENT_ELLIPSE_LINES, this.setOrbitLines, this);
  }

  update(_time: number, delta: number): void {
    for (const entry of this.entries) {
      entry.angle += (delta / entry.periodMs) * FULL_CIRCLE_RAD * this.speedMultiplier;
      const center = entry.center();
      entry.obj.setPosition(
        center.x + Math.cos(entry.angle) * entry.radiusX,
        center.y + Math.sin(entry.angle) * entry.radiusY,
      );
    }

    const zoom = this.cameras.main.zoom;
    if (zoom !== this.lastZoom) {
      this.lastZoom = zoom;
      for (const line of this.orbitLines) line.updateZoom(zoom);
    }

    this.updateSunArrow();
    this.syncNavigation();
  }
}
