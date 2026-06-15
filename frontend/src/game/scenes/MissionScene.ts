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
} from '../../constants/constants';
import { findEntry } from '../../logic/catalog';
import { findMission } from '../../logic/missions';
import type { MissionData, SpacecraftData } from '../../logic/library';
import type { Phase, Point } from '../../logic/phases';
import { phasePoint } from '../../logic/phases';
import { missionProgressAt } from '../../logic/mission';
import { yearsToOrbitMs } from '../../logic/orbit';
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
  private probe?: Spacecraft;
  private trajectory?: Phaser.GameObjects.Graphics;
  private missionLinesVisible = true;
  private craftSeed = 0;
  /** Resolves an anchor id (body id or `self`) to a live world position. */
  private anchorFor: (id: string) => Anchor = () => ({ x: 0, y: 0, radius: SPACECRAFT_RADIUS_PX });

  constructor() {
    super(SCENE_MISSION);
  }

  create(): void {
    this.resetMap();

    const hostObjects = this.buildSunAndPlanets();
    // Moons orbit normally; other spacecraft are hidden to focus on the mission.
    this.placeOrbiterRings(hostObjects, false);

    const id = missionState.getSelectedId();
    this.mission = id ? findMission(id) : null;
    this.phases = this.mission?.phases ?? [];

    if (this.mission) {
      const entry = findEntry(this.mission.spacecraftId);
      const craft = entry?.kind === 'spacecraft' ? entry.craft : null;
      if (craft) this.spawnProbe(craft, hostObjects);
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

    // The `self` anchor is the craft's current known position — the same static
    // spot Ellipse mode parks an interstellar probe at (so the two modes agree).
    const selfRadius = linearScale(craft.orbitalRadius_mkm);
    const selfPoint: Anchor = {
      x: Math.cos(this.craftSeed) * selfRadius,
      y: Math.sin(this.craftSeed) * selfRadius,
      radius: SPACECRAFT_RADIUS_PX,
    };
    this.anchorFor = (anchorId: string): Anchor => {
      if (anchorId === MISSION_SELF_ANCHOR) return selfPoint;
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

  /** Position the craft for the given elapsed time along its itinerary. */
  private placeProbe(elapsedMs: number): void {
    if (!this.probe || this.phases.length === 0) return;
    const prog = missionProgressAt(elapsedMs, this.phases);
    if (prog.from === prog.to) {
      const a = this.anchorFor(prog.from);
      const orbitR = this.stationOrbitRadius(a);
      const ang = this.craftSeed + (elapsedMs / STATION_ORBIT_PERIOD_MS) * FULL_CIRCLE_RAD;
      this.probe.setPosition(a.x + Math.cos(ang) * orbitR, a.y + Math.sin(ang) * orbitR);
    } else {
      const p = phasePoint(this.anchorFor(prog.from), this.anchorFor(prog.to), prog.t);
      this.probe.setPosition(p.x, p.y);
    }
  }

  /**
   * Redraw the mission trajectory. Anchors move every frame, so the whole
   * itinerary is re-sampled: each transfer phase becomes a heliocentric arc;
   * each station-keeping phase becomes the small orbit ring around its anchor.
   */
  private drawTrajectory(): void {
    const g = this.trajectory;
    if (!g) return;
    g.clear();
    if (!this.missionLinesVisible) return;
    const color = Phaser.Display.Color.HexStringToColor(COLOR_MISSION_LINE).color;
    g.lineStyle(TRAJECTORY_WIDTH_PX / this.cameras.main.zoom, color, 0.85);
    for (const phase of this.phases) {
      if (phase.from === phase.to) {
        const a = this.anchorFor(phase.from);
        g.strokeCircle(a.x, a.y, this.stationOrbitRadius(a));
        continue;
      }
      const from = this.anchorFor(phase.from);
      const to = this.anchorFor(phase.to);
      g.beginPath();
      for (let i = 0; i <= TRAJECTORY_SAMPLES; i++) {
        const p = phasePoint(from, to, i / TRAJECTORY_SAMPLES);
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.strokePath();
    }
  }

  private setMissionLines(visible: boolean): void {
    this.missionLinesVisible = visible;
    this.trajectory?.setVisible(visible);
    this.drawTrajectory();
  }

  /** Restart the current mission: snap everything to base, then replay. */
  private onRestart(): void {
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
    const status = missionState.getStatus();
    const playing = this.mission !== null && status === MissionRunState.RUNNING;

    if (this.mission === null) {
      // No mission chosen yet (modal open): let the map drift gently.
      this.advanceOrbits(delta);
    } else if (playing) {
      this.advanceOrbits(delta);
      const elapsed = missionState.getElapsedMs() + delta * this.speedMultiplier;
      missionState.setElapsedMs(elapsed);
      this.placeProbe(elapsed);
      this.drawTrajectory();
      if (missionProgressAt(elapsed, this.phases).done) this.handleComplete();
    }
    // When COMPLETE (manual restart) nothing advances — the scene is frozen.

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
