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
import { phaseProgressAt, phasePoint, type Phase, type Point } from '../../logic/phases';
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

/** Live world position and rendered size of a phase anchor body. */
interface Anchor extends Point {
  /** Rendered disc radius (px), so an orbiting craft can clear it. */
  readonly radius: number;
}

/** A craft following a multi-phase itinerary anchored to moving bodies. */
interface PhaseEntry {
  readonly obj: Phaser.GameObjects.Image;
  readonly phases: readonly Phase[];
  /** Live anchor (position + rendered radius) by id; anchors orbit, so this moves. */
  readonly anchor: (id: string) => Anchor;
  /** Trajectory overlay; redrawn each frame because the anchors move. */
  readonly trajectory: Phaser.GameObjects.Graphics;
  /** Deterministic phase offset for the station-keeping orbit around an anchor. */
  readonly seedAngle: number;
  elapsedMs: number;
}

const ZOOM_IN_FACTOR = 1.1;
const ZOOM_OUT_FACTOR = 0.9;
const VIEW_FILL_FRACTION = 0.4;
/** Sample count per transfer arc when redrawing a phased trajectory. */
const PHASE_TRAJECTORY_SAMPLES = 32;
/** Line width (px, world space) of a phased trajectory at base zoom. */
const PHASE_TRAJECTORY_WIDTH_PX = 2;
/** Orbital period (ms) of a phased craft while station-keeping around an anchor. */
const STATION_ORBIT_PERIOD_MS = yearsToOrbitMs(ELLIPSE_ORBITER_PERIOD_YEARS);

/** Deterministic starting angle so bodies are spread around their orbits. */
function seedAngle(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 360) * (Math.PI / 180);
}

export class EllipseScene extends Phaser.Scene {
  private readonly entries: OrbitEntry[] = [];
  private readonly phaseEntries: PhaseEntry[] = [];
  private readonly orbitLines: OrbitLine[] = [];
  private orbitLinesVisible = true;
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
    this.phaseEntries.length = 0;
    this.orbitLines.length = 0;
    this.orbitLinesVisible = true;
    this.speedMultiplier = DEFAULT_ORBIT_SPEED;

    const origin = () => ({ x: 0, y: 0 });

    // The Sun at the origin, enlarged so it dominates the map (Ellipse only).
    const sunBody = sun();
    if (sunBody) {
      const sunObj = new CelestialBody(this, sunBody, this.onSelect);
      sunObj.setPosition(0, 0);
      sunObj.setScale(SUN_ELLIPSE_SCALE);
    }

    // Planets, dwarf planets, asteroids, comets (solar-orbiting).
    const hostObjects = new Map<string, CelestialBody>();
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

    // Moons and host-orbiting spacecraft, stacked as concentric rings that clear
    // the host disc (and each other).
    this.placeOrbiters(hostObjects);

    // Solar-orbiting and interstellar spacecraft. Phased craft (e.g. OSIRIS-REx)
    // follow a multi-body itinerary instead of a single orbit.
    for (const craft of spacecraft) {
      if (craft.phases && craft.phases.length > 0) {
        this.placePhasedCraft(craft, hostObjects);
      } else {
        this.placeSpacecraft(craft);
      }
    }

    this.sunArrow = new SunArrow(this);
    this.setupCamera();
    this.setupInput();

    this.game.events.on(EVENT_ELLIPSE_SPEED, this.setSpeed, this);
    this.game.events.on(EVENT_ELLIPSE_LINES, this.setOrbitLines, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  /** Rendered radius (px) of a body — mirrors CelestialBody's texture sizing. */
  private bodyRadius(body: BodyData): number {
    const small = body.type === BodyType.ASTEROID || body.type === BodyType.COMET;
    return small ? SPACECRAFT_RADIUS_PX : bodyRadiusPx(body.radius_km);
  }

  /**
   * Place every moon and host-orbiting spacecraft on its own concentric ring so
   * none falls inside the host's exaggerated disc and none overlaps another.
   */
  private placeOrbiters(hostObjects: Map<string, CelestialBody>): void {
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

    for (const craft of spacecraft) {
      if (craft.phases && craft.phases.length > 0) continue;
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
   * Place a craft that follows a multi-phase itinerary (e.g. OSIRIS-REx hopping
   * Earth → Bennu → Earth). Its anchors are solar-orbiting bodies, so they keep
   * moving; the craft's position and trajectory overlay are recomputed each frame
   * in {@link update}. Falls back to the world origin for any unknown anchor id.
   */
  private placePhasedCraft(
    craft: SpacecraftData,
    hostObjects: Map<string, CelestialBody>,
  ): void {
    const obj = new Spacecraft(this, craft, this.onSelect);
    const anchor = (id: string): Anchor => {
      const host = hostObjects.get(id);
      return host
        ? { x: host.x, y: host.y, radius: host.renderedRadius }
        : { x: 0, y: 0, radius: SPACECRAFT_RADIUS_PX };
    };
    const trajectory = this.add.graphics();
    trajectory.setVisible(this.orbitLinesVisible);
    this.phaseEntries.push({
      obj,
      phases: craft.phases!,
      anchor,
      trajectory,
      seedAngle: seedAngle(craft.id),
      elapsedMs: 0,
    });
  }

  /** Radius (px) at which a phased craft orbits an anchor during station-keeping. */
  private stationOrbitRadius(anchor: Anchor): number {
    return anchor.radius + ELLIPSE_ORBIT_GAP_PX + SPACECRAFT_RADIUS_PX;
  }

  /**
   * Place solar-orbiting and interstellar spacecraft. Host-orbiting craft are
   * handled by {@link placeOrbiters} so they share their host's ring stack.
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
    this.orbitLinesVisible = visible;
    for (const line of this.orbitLines) line.setVisible(visible);
    for (const entry of this.phaseEntries) entry.trajectory.setVisible(visible);
  }

  /**
   * Redraw a phased craft's trajectory overlay. The anchors move every frame, so
   * the whole itinerary is re-sampled: each transfer phase becomes a heliocentric
   * arc; each station-keeping phase becomes the small orbit ring around its anchor.
   */
  private drawPhaseTrajectory(entry: PhaseEntry): void {
    const g = entry.trajectory;
    g.clear();
    if (!this.orbitLinesVisible) return;
    const color = Phaser.Display.Color.HexStringToColor(
      ORBIT_LINE_COLORS[BodyType.ASTEROID] ?? COLOR_ORBIT_LINE,
    ).color;
    g.lineStyle(PHASE_TRAJECTORY_WIDTH_PX / this.cameras.main.zoom, color, 0.8);
    for (const phase of entry.phases) {
      if (phase.from === phase.to) {
        const a = entry.anchor(phase.from);
        g.strokeCircle(a.x, a.y, this.stationOrbitRadius(a));
        continue;
      }
      const from = entry.anchor(phase.from);
      const to = entry.anchor(phase.to);
      g.beginPath();
      for (let i = 0; i <= PHASE_TRAJECTORY_SAMPLES; i++) {
        const p = phasePoint(from, to, i / PHASE_TRAJECTORY_SAMPLES);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
  }

  private updateSunArrow(): void {
    const cam = this.cameras.main;
    this.sunArrow.placeAtCamera(cam);
    const sunOnScreen = cam.worldView.contains(0, 0);
    // Sun is always at world origin (0, 0).
    this.sunArrow.pointToward(0, 0, !sunOnScreen);
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

    // Phased craft: advance simulation time (paused when speed is 0), then place
    // the craft either along a heliocentric transfer arc or, during a station-
    // keeping phase, on a small orbit around the anchor (rather than on top of it).
    for (const entry of this.phaseEntries) {
      entry.elapsedMs += delta * this.speedMultiplier;
      const prog = phaseProgressAt(entry.elapsedMs, entry.phases);
      if (prog.from === prog.to) {
        const a = entry.anchor(prog.from);
        const orbitR = this.stationOrbitRadius(a);
        const ang = entry.seedAngle + (entry.elapsedMs / STATION_ORBIT_PERIOD_MS) * FULL_CIRCLE_RAD;
        entry.obj.setPosition(a.x + Math.cos(ang) * orbitR, a.y + Math.sin(ang) * orbitR);
      } else {
        const p = phasePoint(entry.anchor(prog.from), entry.anchor(prog.to), prog.t);
        entry.obj.setPosition(p.x, p.y);
      }
      this.drawPhaseTrajectory(entry);
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
