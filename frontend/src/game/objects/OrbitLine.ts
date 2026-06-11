/**
 * Solar Explorer — OrbitLine.
 *
 * A thin elliptical orbit line centered on the Sun, drawn in world space so it
 * scales with the camera. Eccentricity squashes the ellipse slightly.
 *
 * Line width is kept at a constant screen-space size by compensating for the
 * camera zoom: world-space width = SCREEN_LINE_WIDTH_PX / zoom.
 */
import Phaser from 'phaser';
import { COLOR_ORBIT_LINE } from '../../constants/constants';

const SCREEN_LINE_WIDTH_PX = 1.5;
const LINE_ALPHA = 0.6;

export class OrbitLine extends Phaser.GameObjects.Graphics {
  private readonly radiusX: number;
  private readonly radiusY: number;
  private readonly hexColor: string;

  constructor(scene: Phaser.Scene, screenRadius: number, eccentricity: number, hexColor: string = COLOR_ORBIT_LINE) {
    super(scene);
    scene.add.existing(this);
    this.setPosition(0, 0);
    this.radiusX = screenRadius;
    this.radiusY = screenRadius * Math.sqrt(1 - Math.min(eccentricity, 0.9) ** 2);
    this.hexColor = hexColor;
    this.drawWithZoom(1);
  }

  /** Call whenever the camera zoom changes to maintain constant screen-space thickness. */
  updateZoom(zoom: number): void {
    this.drawWithZoom(zoom);
  }

  private drawWithZoom(zoom: number): void {
    const color = Phaser.Display.Color.HexStringToColor(this.hexColor).color;
    // Keep each screen-space arc segment ≤ 4 px to avoid visible polygon edges.
    const screenCircumference = 2 * Math.PI * Math.max(this.radiusX, this.radiusY) * zoom;
    const smoothness = Math.min(2048, Math.max(128, Math.ceil(screenCircumference / 4)));
    this.clear();
    this.lineStyle(SCREEN_LINE_WIDTH_PX / zoom, color, LINE_ALPHA);
    this.strokeEllipse(0, 0, this.radiusX * 2, this.radiusY * 2, smoothness);
  }
}
