/**
 * Solar Explorer — RulerRenderer.
 *
 * The Linear-mode distance readout. A small box fixed at the viewport's vertical
 * center on the left edge reports the distance at the viewport center, quantized
 * so it ticks over like an odometer. Inside the box, fine lines scroll past like
 * a turning knob to convey motion — nothing is drawn down the rest of the left
 * edge. The readout recolors as the journey leaves the planetary system for the
 * Kuiper belt and beyond, and the asteroid-belt seam is flagged inside the box
 * (in amber) only while it passes through.
 */
import Phaser from 'phaser';
import {
  Unit,
  LINEAR_SCALE_SEAM_MKM,
  COUNTER_BOX_W,
  COUNTER_BOX_H,
  COUNTER_BOX_RADIUS,
  COUNTER_KNOB_SPACING_PX,
  COLOR_PANEL,
  COLOR_BORDER,
  COLOR_ACCENT_AMBER,
  COLOR_ZONE_INNER,
} from '../../constants/constants';
import { distanceZone, zoneColor, formatCounter } from '../../logic/distanceCounter';
import { linearDistanceToY } from '../../logic/linearScale';

/** Per-frame easing factor for the counter's color transition between zones. */
const COLOR_LERP = 0.12;
const READOUT_FONT = { fontFamily: 'monospace', fontSize: '17px', fontStyle: 'bold' };
const UNIT_FONT = { fontFamily: 'monospace', fontSize: '10px' };

export class RulerRenderer {
  private readonly scene: Phaser.Scene;
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private readonly readout: Phaser.GameObjects.Text;
  private readonly unitLabel: Phaser.GameObjects.Text;
  /** Smoothly-eased current zone color, lerped toward the target each frame. */
  private readonly color: Phaser.Display.Color;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.box = scene.add.graphics().setScrollFactor(0).setDepth(900);
    this.knob = scene.add.graphics().setScrollFactor(0).setDepth(901);
    const centerX = COUNTER_BOX_W / 2;
    this.readout = scene.add
      .text(centerX, 0, '', READOUT_FONT)
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(902);
    this.unitLabel = scene.add
      .text(centerX, 0, '', UNIT_FONT)
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(902);
    this.color = Phaser.Display.Color.HexStringToColor(COLOR_ZONE_INNER);
  }

  /** Lerp the eased color toward `targetHex` and return it as a CSS string. */
  private easeColor(targetHex: string): string {
    const target = Phaser.Display.Color.HexStringToColor(targetHex);
    this.color.setTo(
      Math.round(Phaser.Math.Linear(this.color.red, target.red, COLOR_LERP)),
      Math.round(Phaser.Math.Linear(this.color.green, target.green, COLOR_LERP)),
      Math.round(Phaser.Math.Linear(this.color.blue, target.blue, COLOR_LERP)),
    );
    return this.color.rgba;
  }

  /**
   * Redraw the counter for the current scroll position.
   *
   * @param zoom              inner-zone scale (pixels per Mkm); the outer zone is
   *                          compressed by the piecewise scale in linearScale.
   * @param centerDistanceMkm distance at the viewport center — what the counter reads.
   */
  update(
    zoom: number,
    topPadPx: number,
    unit: Unit,
    centerDistanceMkm: number,
  ): void {
    const camera = this.scene.cameras.main;
    const boxY = this.scene.scale.height / 2 - COUNTER_BOX_H / 2;
    const boxCenterY = boxY + COUNTER_BOX_H / 2;

    const cssColor = this.easeColor(zoneColor(distanceZone(centerDistanceMkm)));
    const colorNum = this.color.color;

    // The box: a tab flush to the left screen edge. Only the right corners are
    // rounded; the left side runs off-screen (negative x) so no border shows
    // there and the box hugs the edge.
    const r = COUNTER_BOX_RADIUS;
    const corners = { tl: 0, tr: r, bl: 0, br: r };
    const x = -r;
    const w = COUNTER_BOX_W + r;
    this.box.clear();
    this.box.fillStyle(Phaser.Display.Color.HexStringToColor(COLOR_PANEL).color, 0.92);
    this.box.fillRoundedRect(x, boxY, w, COUNTER_BOX_H, corners);
    this.box.lineStyle(1.5, colorNum, 0.7);
    this.box.strokeRoundedRect(x, boxY, w, COUNTER_BOX_H, corners);

    this.knob.clear();
    this.drawKnob(camera.scrollY, zoom, topPadPx, boxY);

    this.readout.setText(formatCounter(centerDistanceMkm, unit)).setColor(cssColor);
    this.readout.setPosition(this.readout.x, boxCenterY - 2);
    this.unitLabel.setText(unit === Unit.AU ? 'AU' : 'MKm').setColor(cssColor).setAlpha(0.75);
    this.unitLabel.setPosition(this.unitLabel.x, boxCenterY + 4);
  }

  /**
   * Knob lines: fine horizontal lines sliding with the scroll (so they turn like
   * a dial), spanning the box and running continuously under the readout (which
   * is drawn on top). The asteroid-belt seam, if it currently sits inside the
   * box, is flagged in amber the same way.
   */
  private drawKnob(
    scrollY: number,
    zoom: number,
    topPadPx: number,
    boxY: number,
  ): void {
    const boxTop = boxY + COUNTER_BOX_RADIUS;
    const boxBottom = boxY + COUNTER_BOX_H - COUNTER_BOX_RADIUS;
    const right = COUNTER_BOX_W - 8;
    const spacing = COUNTER_KNOB_SPACING_PX;

    this.knob.lineStyle(1, Phaser.Display.Color.HexStringToColor(COLOR_BORDER).color, 0.9);
    const offset = ((scrollY % spacing) + spacing) % spacing;
    for (let y = boxTop - offset; y <= boxBottom; y += spacing) {
      if (y < boxTop) continue;
      this.knob.lineBetween(0, y, right, y);
    }

    // Asteroid-belt seam: amber line, shown only while it sits within the box.
    const seamY = linearDistanceToY(LINEAR_SCALE_SEAM_MKM, zoom, topPadPx) - scrollY;
    if (seamY >= boxTop && seamY <= boxBottom) {
      this.knob.lineStyle(2, Phaser.Display.Color.HexStringToColor(COLOR_ACCENT_AMBER).color, 0.95);
      this.knob.lineBetween(0, seamY, COUNTER_BOX_W, seamY);
    }
  }
}
