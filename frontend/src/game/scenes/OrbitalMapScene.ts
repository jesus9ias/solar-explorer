/**
 * Solar Explorer — OrbitalMapScene (abstract base).
 *
 * The shared heliocentric map used by both Ellipse mode and Mission mode: the
 * Sun at the origin, planets on linearly scaled orbits, moons stacked on
 * concentric rings that clear their host, a compass arrow to the Sun, and
 * pan/zoom camera input. Subclasses add what differs — Ellipse adds every
 * spacecraft and element focusing; Mission adds a single craft running a timed
 * itinerary. Position is synced to {@link navigationState} every frame so a
 * mode switch lands at an equivalent solar distance.
 */
import Phaser from 'phaser';
import {
  REGISTRY_ON_SELECT,
  DEFAULT_ORBIT_SPEED,
  ELLIPSE_DEFAULT_ZOOM,
  ELLIPSE_MIN_ZOOM,
  ELLIPSE_MAX_ZOOM,
  SUN_ELLIPSE_SCALE,
  MIN_SCREEN_RADIUS,
  MAX_SCREEN_RADIUS,
  MIN_REAL_RADIUS_MKM,
  FULL_CIRCLE_RAD,
  ELLIPSE_ORBIT_GAP_PX,
  ELLIPSE_ORBITER_PERIOD_YEARS,
  SPACECRAFT_RADIUS_PX,
  BodyType,
  COLOR_BG,
  ORBIT_LINE_COLORS,
  COLOR_ORBIT_LINE,
} from '../../constants/constants';
import { bodies, spacecraft, sun } from '../../logic/catalog';
import type { BodyData, SpacecraftData } from '../../logic/library';
import { linearScale, inverseLinearScale, bodyRadiusPx } from '../../logic/scale';
import { computeOrbitRingRadii } from '../../logic/orbitRings';
import { resolveOrbiterSpeedFactor } from '../../logic/orbiterSpeed';
import { yearsToOrbitMs, isOrbiting } from '../../logic/orbit';
import { navigationState } from '../../state/NavigationState';
import { CelestialBody, type SelectHandler } from '../objects/CelestialBody';
import { Spacecraft } from '../objects/Spacecraft';
import { OrbitLine } from '../objects/OrbitLine';
import { SunArrow } from '../objects/SunArrow';

/** A body/craft orbiting an (possibly moving) center on an elliptical path. */
export interface OrbitEntry {
  readonly obj: Phaser.GameObjects.Image;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly periodMs: number;
  readonly center: () => { x: number; y: number };
  angle: number;
}

/** Closed-form parameters of a solar-orbiting body, for predicting its position. */
export interface SolarOrbitParams {
  readonly radiusX: number;
  readonly radiusY: number;
  readonly periodMs: number;
  readonly initialAngle: number;
}

const ZOOM_IN_FACTOR = 1.1;
const ZOOM_OUT_FACTOR = 0.9;
const VIEW_FILL_FRACTION = 0.4;
/** Fraction of the viewport the focused element's rendered radius should fill. */
const FOCUS_BODY_FILL_FRACTION = 0.12;
/** Smooth pan/zoom duration (ms) when focusing on an element. */
const FOCUS_DURATION_MS = 600;
/** Camera follow lerp while focusing — eases toward the (moving) element. */
const FOCUS_FOLLOW_LERP = 0.08;

/** Deterministic starting angle so bodies are spread around their orbits. */
export function seedAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

export abstract class OrbitalMapScene extends Phaser.Scene {
  protected readonly entries: OrbitEntry[] = [];
  protected readonly orbitLines: OrbitLine[] = [];
  /**
   * Closed-form orbit parameters per solar-orbiting body id, populated by
   * {@link buildSunAndPlanets}. Mission mode reads these to predict an anchor's
   * future position; the same `initialAngle` seeds the live orbit entry, so the
   * prediction and the visible body always agree.
   */
  protected readonly solarOrbitParams = new Map<string, SolarOrbitParams>();
  /**
   * The selected sim speed (0 = paused) is shared across scenes so it survives a
   * mode switch and a mission restart — the HUD keeps showing the same choice, so
   * the two must agree. Static, not per-instance/per-create, for that reason.
   */
  private static selectedSpeed = DEFAULT_ORBIT_SPEED;
  protected sunArrow!: SunArrow;
  private isDragging = false;
  private lastPinchDist = -1;
  private lastZoom = -1;

  protected get speedMultiplier(): number {
    return OrbitalMapScene.selectedSpeed;
  }

  protected get onSelect(): SelectHandler {
    return (this.registry.get(REGISTRY_ON_SELECT) as SelectHandler | undefined) ?? (() => {});
  }

  /** Reset shared collections — call at the top of a subclass `create`. */
  protected resetMap(): void {
    this.cameras.main.setBackgroundColor(COLOR_BG);
    this.entries.length = 0;
    this.orbitLines.length = 0;
    this.solarOrbitParams.clear();
    this.lastZoom = -1;
  }

  /** Rendered radius (px) of a body — mirrors CelestialBody's texture sizing. */
  protected bodyRadius(body: BodyData): number {
    const small = body.type === BodyType.ASTEROID || body.type === BodyType.COMET;
    return small ? SPACECRAFT_RADIUS_PX : bodyRadiusPx(body.radius_km);
  }

  /**
   * Draw the Sun and every solar-orbiting body (planets, dwarf planets,
   * asteroids, comets) with its orbit line, and register them as orbit entries.
   * Returns the map of host body objects so callers can attach moons/craft.
   */
  protected buildSunAndPlanets(): Map<string, CelestialBody> {
    const origin = () => ({ x: 0, y: 0 });

    const sunBody = sun();
    if (sunBody) {
      const sunObj = new CelestialBody(this, sunBody, this.onSelect);
      sunObj.setPosition(0, 0);
      sunObj.setScale(SUN_ELLIPSE_SCALE);
    }

    const hostObjects = new Map<string, CelestialBody>();
    for (const body of bodies) {
      if (body.host !== null || body.orbitalRadius_mkm <= 0) continue;
      const radius = linearScale(body.orbitalRadius_mkm);
      const orbitColor = ORBIT_LINE_COLORS[body.type] ?? COLOR_ORBIT_LINE;
      this.orbitLines.push(new OrbitLine(this, radius, body.eccentricity, orbitColor));
      const obj = new CelestialBody(this, body, this.onSelect);
      hostObjects.set(body.id, obj);
      const minor = radius * Math.sqrt(1 - Math.min(body.eccentricity, 0.9) ** 2);
      const periodMs = yearsToOrbitMs(body.orbitalPeriod_years);
      const initialAngle = this.initialOrbitAngle(body);
      this.solarOrbitParams.set(body.id, {
        radiusX: radius,
        radiusY: minor,
        periodMs,
        initialAngle,
      });
      this.entries.push({
        obj,
        radiusX: radius,
        radiusY: minor,
        periodMs,
        center: origin,
        angle: initialAngle,
      });
    }
    return hostObjects;
  }

  /**
   * Starting angle of a solar-orbiting body. The base spread is deterministic
   * but arbitrary (a hash of the id); Mission mode overrides this to seed the
   * planets at their real positions for the active mission's launch date.
   */
  protected initialOrbitAngle(body: BodyData): number {
    return seedAngle(body.id);
  }

  /**
   * Place every moon (and, when `includeCraft`, host-orbiting spacecraft) on its
   * own concentric ring so none falls inside the host's exaggerated disc and no
   * two share a ring. Mission mode passes `includeCraft = false` to keep the
   * focus on the active mission's craft.
   */
  protected placeOrbiterRings(
    hostObjects: Map<string, CelestialBody>,
    includeCraft: boolean,
  ): void {
    interface Orbiter {
      readonly distanceMkm: number;
      readonly radiusPx: number;
      readonly speedFactor?: number;
      readonly place: (orbitRadiusPx: number, speedFactor: number) => void;
    }
    const byHost = new Map<string, Orbiter[]>();
    const add = (hostId: string, orbiter: Orbiter): void => {
      const list = byHost.get(hostId);
      if (list) list.push(orbiter);
      else byHost.set(hostId, [orbiter]);
    };

    for (const body of bodies) {
      if (body.type !== BodyType.MOON || !body.host) continue;
      const hostObj = hostObjects.get(body.host);
      if (!hostObj) continue;
      add(body.host, {
        distanceMkm: body.orbitalRadius_mkm,
        radiusPx: this.bodyRadius(body),
        speedFactor: body.speedFactor,
        place: (r, speed) => this.addOrbiterAround(body, hostObj, r, speed),
      });
    }

    if (includeCraft) {
      for (const craft of spacecraft) {
        if (!isOrbiting(craft.id) || craft.host === null || craft.host === 'sun') continue;
        const hostObj = hostObjects.get(craft.host);
        if (!hostObj) continue;
        add(craft.host, {
          distanceMkm: craft.orbitalRadius_mkm,
          radiusPx: SPACECRAFT_RADIUS_PX,
          speedFactor: craft.speedFactor,
          place: (r, speed) => this.addCraftOrbiterAround(craft, hostObj, r, speed),
        });
      }
    }

    for (const [hostId, orbiters] of byHost) {
      const host = hostObjects.get(hostId);
      if (!host) continue;
      orbiters.sort((a, b) => a.distanceMkm - b.distanceMkm);
      const radii = computeOrbitRingRadii(
        host.renderedRadius,
        orbiters.map((o) => o.radiusPx),
        ELLIPSE_ORBIT_GAP_PX,
      );
      orbiters.forEach((orbiter, i) => {
        const speed = resolveOrbiterSpeedFactor(orbiter.speedFactor, i, orbiters.length);
        orbiter.place(radii[i], speed);
      });
    }
  }

  private addOrbiterAround(
    body: BodyData,
    hostObj: CelestialBody,
    radiusPx: number,
    speedFactor: number,
  ): void {
    const obj = new CelestialBody(this, body, this.onSelect);
    this.entries.push({
      obj,
      radiusX: radiusPx,
      radiusY: radiusPx,
      periodMs: yearsToOrbitMs(ELLIPSE_ORBITER_PERIOD_YEARS) / speedFactor,
      center: () => ({ x: hostObj.x, y: hostObj.y }),
      angle: seedAngle(body.id),
    });
  }

  private addCraftOrbiterAround(
    craft: SpacecraftData,
    hostObj: CelestialBody,
    radiusPx: number,
    speedFactor: number,
  ): void {
    const obj = new Spacecraft(this, craft, this.onSelect);
    this.entries.push({
      obj,
      radiusX: radiusPx,
      radiusY: radiusPx,
      periodMs: yearsToOrbitMs(ELLIPSE_ORBITER_PERIOD_YEARS) / speedFactor,
      center: () => ({ x: hostObj.x, y: hostObj.y }),
      angle: seedAngle(craft.id),
    });
  }

  /**
   * Zoom in on an element and keep the camera following it (shared by Ellipse and
   * Mission modes — the Library "go to element" action). The zoom frames the
   * element's own rendered disc, so a far body gets a real close-up; the camera
   * then follows it so it stays centered while it keeps moving. Elements not
   * present in the scene (e.g. non-mission spacecraft in Mission mode) are a no-op.
   */
  protected focusElement(id: string): void {
    const target = this.children.list.find(
      (c) =>
        (c instanceof CelestialBody && c.bodyId === id) ||
        (c instanceof Spacecraft && c.craftId === id),
    ) as (CelestialBody | Spacecraft) | undefined;
    if (!target) return;

    const cam = this.cameras.main;
    const radius =
      target instanceof CelestialBody ? target.renderedRadius : SPACECRAFT_RADIUS_PX;
    const desiredScreen = Math.min(this.scale.width, this.scale.height) * FOCUS_BODY_FILL_FRACTION;
    const zoom = Phaser.Math.Clamp(
      desiredScreen / Math.max(radius, 1),
      ELLIPSE_MIN_ZOOM,
      ELLIPSE_MAX_ZOOM,
    );
    cam.zoomTo(zoom, FOCUS_DURATION_MS, 'Sine.easeInOut');
    // Follow the element so it stays centered as it keeps moving — a one-shot pan
    // would leave a fast inner body drifting off frame. Manual pan/zoom calls
    // stopFollow().
    cam.startFollow(target, false, FOCUS_FOLLOW_LERP, FOCUS_FOLLOW_LERP);
  }

  protected setupCamera(): void {
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

  protected setupInput(): void {
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
      // A manual pan means the user wants to look elsewhere — release any
      // focus-follow so the drag isn't overridden each frame (no-op if not
      // following).
      camera.stopFollow();
      camera.scrollX -= (pointer.x - pointer.prevPosition.x) / camera.zoom;
      camera.scrollY -= (pointer.y - pointer.prevPosition.y) / camera.zoom;
    });
  }

  protected setSpeed(multiplier: number): void {
    OrbitalMapScene.selectedSpeed = multiplier;
  }

  protected setOrbitLines(visible: boolean): void {
    for (const line of this.orbitLines) line.setVisible(visible);
  }

  protected updateSunArrow(): void {
    const cam = this.cameras.main;
    this.sunArrow.placeAtCamera(cam);
    const sunOnScreen = cam.worldView.contains(0, 0);
    // Sun is always at world origin (0, 0).
    this.sunArrow.pointToward(0, 0, !sunOnScreen);
  }

  /**
   * Translate the current camera extent into a solar distance so the other
   * scenes can restore an equivalent position. Called every frame while active
   * (the camera is valid), never during shutdown.
   */
  protected syncNavigation(): void {
    const visibleScreenRadius =
      Math.min(this.scale.width, this.scale.height) / (2 * this.cameras.main.zoom);
    const clamped = Phaser.Math.Clamp(visibleScreenRadius, MIN_SCREEN_RADIUS, MAX_SCREEN_RADIUS);
    navigationState.setDistance(inverseLinearScale(clamped));
  }

  /** Advance every orbit entry by `delta`, honoring the speed multiplier. */
  protected advanceOrbits(delta: number): void {
    for (const entry of this.entries) {
      entry.angle += (delta / entry.periodMs) * FULL_CIRCLE_RAD * this.speedMultiplier;
      const center = entry.center();
      entry.obj.setPosition(
        center.x + Math.cos(entry.angle) * entry.radiusX,
        center.y + Math.sin(entry.angle) * entry.radiusY,
      );
    }
  }

  /** Rescale world-space orbit lines when the camera zoom changes. */
  protected refreshOrbitLineZoom(): void {
    const zoom = this.cameras.main.zoom;
    if (zoom !== this.lastZoom) {
      this.lastZoom = zoom;
      for (const line of this.orbitLines) line.updateZoom(zoom);
    }
  }
}
