/**
 * Solar Explorer — OrbitLine.
 *
 * A thin elliptical orbit line centered on the Sun, drawn in world space so it
 * scales with the camera. Eccentricity squashes the ellipse slightly.
 */
import Phaser from 'phaser';
import { COLOR_ORBIT_LINE } from '../../constants/constants';

const LINE_WIDTH = 1;
const LINE_ALPHA = 0.6;

export class OrbitLine extends Phaser.GameObjects.Graphics {
  constructor(scene: Phaser.Scene, screenRadius: number, eccentricity: number) {
    super(scene);
    scene.add.existing(this);
    this.setPosition(0, 0);
    const color = Phaser.Display.Color.HexStringToColor(COLOR_ORBIT_LINE).color;
    this.lineStyle(LINE_WIDTH, color, LINE_ALPHA);
    const minorRadius = screenRadius * Math.sqrt(1 - Math.min(eccentricity, 0.9) ** 2);
    this.strokeEllipse(0, 0, screenRadius * 2, minorRadius * 2);
  }
}
