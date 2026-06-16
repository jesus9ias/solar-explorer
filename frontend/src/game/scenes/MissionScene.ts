/**
 * Solar Explorer — MissionScene.
 *
 * Mission mode plays one spacecraft's itinerary across the shared heliocentric
 * map (see {@link OrbitalMapScene}). The craft cruises along heliocentric
 * transfer arcs between anchors, orbits an anchor during station-keeping phases,
 * and ends at its final anchor — a planet (BepiColombo at Mercury), Earth
 * (OSIRIS-REx) or its current known position (escape probes, the `self` anchor).
 *
 * Unlike Ellipse mode the timeline does NOT loop: when it ends the scene freezes
 * (manual restart) or snaps everything back to base and replays (auto restart).
 * Other spacecraft are hidden so the mission reads clearly.
 */
import Phaser from 'phaser';
import {
  SCENE_MISSION,
  EVENT_MISSION_SPEED,
  EVENT_MISSION_LINES,
  EVENT_MISSION_RESTART,
  EVENT_MISSION_START,
  EVENT_FOCUS_ELEMENT,
  FULL_CIRCLE_RAD,
  ELLIPSE_ORBIT_GAP_PX,
  ELLIPSE_ORBITER_PERIOD_YEARS,
  SPACECRAFT_RADIUS_PX,
  MISSION_SELF_ANCHOR,
  MissionRestartMode,
  MissionRunState,
  COLOR_MISSION_LINE,
  BODY_MEAN_LONGITUDE_J2000_DEG,
} from '../../constants/constants';
import { findEntry } from '../../logic/catalog';
import { findMission } from '../../logic/missions';
import type { BodyData, MissionData, SpacecraftData } from '../../logic/library';
import type { Phase, Point } from '../../logic/phases';
import { phasePoint } from '../../logic/phases';
import { missionProgressAt, phaseWindowMs, isMissionActive } from '../../logic/mission';
import { yearsToOrbitMs, orbitPositionAt } from '../../logic/orbit';
import { heliocentricAngleAt, escapeAngleRad } from '../../logic/ephemeris';
import { linearScale } from '../../logic/scale';
import { missionState } from '../../state/MissionState';
import { CelestialBody } from '../objects/CelestialBody';
import { Spacecraft } from '../objects/Spacecraft';
import { SunArrow } from '../objects/SunArrow';
import { OrbitalMapScene, seedAngle } from './OrbitalMapScene';

/** Live world position and rendered size of a mission anchor. */
interface Anchor extends Point {
  /** Rendered disc radius (px), so an orbiting craft can clear it. */
  readonly radius: number;
}

/** Sample count per transfer arc when redrawing the trajectory overlay. */
const TRAJECTORY_SAMPLES = 32;
/** Line width (px, world space) of the mission trajectory at base zoom. */
const TRAJECTORY_WIDTH_PX = 2;
/** Orbital period (ms) of the craft while station-keeping around an anchor. */
const STATION_ORBIT_PERIOD_MS = yearsToOrbitMs(ELLIPSE_ORBITER_PERIOD_YEARS);

export class MissionScene extends OrbitalMapScene {
  private mission: MissionData | null = null;
  private phases: readonly Phase[] = [];
  /** Launch epoch (ms) of the active mission, for seeding historical positions. */
  private launchEpochMs: number | null = null;
  private probe?: Spacecraft;
  private trajectory?: Phaser.GameObjects.Graphics;
  private missionLinesVisible = true;
  private craftSeed = 0;
  /** The craft's current known position — the `self` anchor (static). */
  private selfPoint: Anchor = { x: 0, y: 0, radius: SPACECRAFT_RADIUS_PX };
  /** Resolves an anchor id (body id or `self`) to a live world position. */
  private anchorFor: (id: string) => Anchor = () => ({ x: 0, y: 0, radius: SPACECRAFT_RADIUS_PX });

  constructor() {
    super(SCENE_MISSION);
  }

  /**
   * Seed each planet at the real position it held on the mission's launch date
   * (mean-longitude model), so the craft's transfer arcs resemble the real
   * trajectory diagrams. Bodies without a known mean longitude (dwarf planets
   * other than Pluto, asteroids, comets) keep the deterministic base spread.
   */
  protected override initialOrbitAngle(body: BodyData): number {
    const l0 = BODY_MEAN_LONGITUDE_J2000_DEG[body.id];
    if (this.launchEpochMs === null || l0 === undefined) {
      return super.initialOrbitAngle(body);
    }
    return heliocentricAngleAt(this.launchEpochMs, body.orbitalPeriod_years, l0);
  }

  create(): void {
    this.resetMap();

    // Resolve the mission first: its launch date seeds the planets at their
    // historical positions, so it must be known before the map is built. Only an
    // active run counts — after a reload the selection persists but the run
    // status is IDLE, so the scene must not pre-draw the old trajectory.
    const id = missionState.getSelectedId();
    this.mission =
      id !== null && isMissionActive(missionState.getStatus(), id) ? findMission(id) : null;
    this.phases = this.mission?.phases ?? [];
    this.launchEpochMs = this.mission ? Date.parse(this.mission.launchDate) : null;

    const hostObjects = this.buildSunAndPlanets();
    // Moons orbit normally; other spacecraft are hidden to focus on the mission.
    this.placeOrbiterRings(hostObjects, false);

    if (this.mission) {
      const entry = findEntry(this.mission.spacecraftId);
      const craft = entry?.kind === 'spacecraft' ? entry.craft : null;
      if (craft) this.spawnProbe(craft, hostObjects);
      // Resume in sync: when rebuilt mid-run (returning from another mode), the
      // craft is placed by elapsed time, so the planets must be too — otherwise
      // they snap back to launch while the craft sits at its elapsed position.
      this.seedOrbitsToElapsed(missionState.getElapsedMs());
    }

    this.sunArrow = new SunArrow(this);
    this.setupCamera();
    this.setupInput();

    this.game.events.on(EVENT_MISSION_SPEED, this.setSpeed, this);
    this.game.events.on(EVENT_MISSION_LINES, this.setMissionLines, this);
    this.game.events.on(EVENT_MISSION_RESTART, this.onRestart, this);
    this.game.events.on(EVENT_MISSION_START, this.onStart, this);
    this.game.events.on(EVENT_FOCUS_ELEMENT, this.focusElement, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  /** Build the mission craft and its trajectory overlay, and the anchor resolver. */
  private spawnProbe(craft: SpacecraftData, hostObjects: Map<string, CelestialBody>): void {
    this.probe = new Spacecraft(this, craft, this.onSelect);
    this.craftSeed = seedAngle(craft.id);

    // The `self` anchor is the craft's current known position. Point it the real
    // way out of the system (its escape direction projected onto the ecliptic);
    // fall back to the deterministic seed for craft without a known heading.
    const selfAngle = escapeAngleRad(craft.id) ?? this.craftSeed;
    const selfRadius = linearScale(craft.orbitalRadius_mkm);
    this.selfPoint = {
      x: Math.cos(selfAngle) * selfRadius,
      y: -Math.sin(selfAngle) * selfRadius,
      radius: SPACECRAFT_RADIUS_PX,
    };
    this.anchorFor = (anchorId: string): Anchor => {
      if (anchorId === MISSION_SELF_ANCHOR) return this.selfPoint;
      const host = hostObjects.get(anchorId);
      return host
        ? { x: host.x, y: host.y, radius: host.renderedRadius }
        : { x: 0, y: 0, radius: SPACECRAFT_RADIUS_PX };
    };

    this.trajectory = this.add.graphics();
    this.trajectory.setVisible(this.missionLinesVisible);
    this.placeProbe(missionState.getElapsedMs());
    this.drawTrajectory();
  }

  /** Radius (px) at which the craft orbits an anchor while station-keeping. */
  private stationOrbitRadius(anchor: Anchor): number {
    return anchor.radius + ELLIPSE_ORBIT_GAP_PX + SPACECRAFT_RADIUS_PX;
  }

  /**
   * Where an anchor (a solar body or the `self` point) sits at a *given* elapsed
   * time — including the future. A transfer arc is frozen by sampling its `from`
   * anchor at the phase start and its `to` anchor at the phase end, so the craft
   * aims at the rendezvous point instead of chasing the anchor's live position
   * (which made the arc swing around and jump as the target wrapped).
   */
  private anchorPointAt(anchorId: string, elapsedMs: number): Point {
    if (anchorId === MISSION_SELF_ANCHOR) return this.selfPoint;
    const p = this.solarOrbitParams.get(anchorId);
    if (!p) return { x: 0, y: 0 };
    return orbitPositionAt(elapsedMs, p.periodMs, p.radiusX, p.radiusY, p.initialAngle);
  }

  /** Position the craft for the given elapsed time along its itinerary. */
  private placeProbe(elapsedMs: number): void {
    if (!this.probe || this.phases.length === 0) return;
    const prog = missionProgressAt(elapsedMs, this.phases);
    if (prog.from === prog.to) {
      const a = this.anchorFor(prog.from);
      const orbitR = this.stationOrbitRadius(a);
      const ang = this.craftSeed + (elapsedMs / STATION_ORBIT_PERIOD_MS) * FULL_CIRCLE_RAD;
      this.probe.setPosition(a.x + Math.cos(ang) * orbitR, a.y - Math.sin(ang) * orbitR);
    } else {
      const w = phaseWindowMs(prog.index, this.phases);
      const from = this.anchorPointAt(prog.from, w.startMs);
      const to = this.anchorPointAt(prog.to, w.endMs);
      const p = phasePoint(from, to, prog.t);
      this.probe.setPosition(p.x, p.y);
    }
  }

  /**
   * Redraw the mission trajectory. Each transfer phase is a fixed heliocentric
   * arc from where its `from` anchor sits at the phase start to where its `to`
   * anchor will be at the phase end — so the overlay is stable and the bodies
   * glide along it to meet the craft. Each station-keeping phase is the small
   * orbit ring around its (live) anchor.
   */
  private drawTrajectory(): void {
    const g = this.trajectory;
    if (!g) return;
    g.clear();
    if (!this.missionLinesVisible) return;
    const color = Phaser.Display.Color.HexStringToColor(COLOR_MISSION_LINE).color;
    g.lineStyle(TRAJECTORY_WIDTH_PX / this.cameras.main.zoom, color, 0.85);
    this.phases.forEach((phase, index) => {
      if (phase.from === phase.to) {
        const a = this.anchorFor(phase.from);
        g.strokeCircle(a.x, a.y, this.stationOrbitRadius(a));
        return;
      }
      const w = phaseWindowMs(index, this.phases);
      const from = this.anchorPointAt(phase.from, w.startMs);
      const to = this.anchorPointAt(phase.to, w.endMs);
      g.beginPath();
      for (let i = 0; i <= TRAJECTORY_SAMPLES; i++) {
        const p = phasePoint(from, to, i / TRAJECTORY_SAMPLES);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    });
  }

  private setMissionLines(visible: boolean): void {
    this.missionLinesVisible = visible;
    this.trajectory?.setVisible(visible);
    this.drawTrajectory();
  }

  /** Restart the current mission: snap everything to base, then replay. */
  private onRestart(): void {
    // Nothing to restart when no mission is active (e.g. the picker was
    // dismissed): restarting must not resurrect the persisted selection.
    if (!isMissionActive(missionState.getStatus(), missionState.getSelectedId())) return;
    missionState.restart();
    this.scene.restart();
  }

  /** Begin a freshly selected mission (the modal already called start()). */
  private onStart(): void {
    this.scene.restart();
  }

  private onShutdown(): void {
    this.game.events.off(EVENT_MISSION_SPEED, this.setSpeed, this);
    this.game.events.off(EVENT_MISSION_LINES, this.setMissionLines, this);
    this.game.events.off(EVENT_MISSION_RESTART, this.onRestart, this);
    this.game.events.off(EVENT_MISSION_START, this.onStart, this);
    this.game.events.off(EVENT_FOCUS_ELEMENT, this.focusElement, this);
  }

  update(_time: number, delta: number): void {
    this.handleKeyboardCamera(delta);
    const status = missionState.getStatus();
    const playing = this.mission !== null && status === MissionRunState.RUNNING;

    if (playing) {
      this.advanceOrbits(delta);
      const elapsed = missionState.getElapsedMs() + delta * this.speedMultiplier;
      missionState.setElapsedMs(elapsed);
      this.placeProbe(elapsed);
      this.drawTrajectory();
      if (missionProgressAt(elapsed, this.phases).done) this.handleComplete();
    } else {
      // Not playing — either no mission chosen yet (picker dismissed) or a
      // completed mission with manual restart. Lay the bodies out once at their
      // base positions and hold; the scene reads as a frozen solar system until
      // the user picks a mission. advanceOrbits(0) places without advancing.
      this.advanceOrbits(0);
    }

    this.refreshOrbitLineZoom();
    this.updateSunArrow();
    this.syncNavigation();
  }

  private handleComplete(): void {
    if (missionState.getRestartMode() === MissionRestartMode.AUTO) {
      this.onRestart();
    } else {
      missionState.complete();
    }
  }
}
