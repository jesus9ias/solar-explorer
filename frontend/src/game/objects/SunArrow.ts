/**
 * Solar Explorer — SunArrow.
 *
 * A compass arrow fixed to the viewport (scroll factor 0) that always points
 * toward the Sun's current screen position. Hidden when the Sun is on screen.
 */
import Phaser from 'phaser';
import { COLOR_ACCENT_AMBER } from '../../constants/constants';

const ARROW_SIZE = 18;
const SCREEN_MARGIN = 56;

export class SunArrow extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, SCREEN_MARGIN, SCREEN_MARGIN);
    scene.add.existing(this);
    this.setScrollFactor(0);
    this.setDepth(1000);

    const triangle = scene.add.triangle(
      0,
      0,
      ARROW_SIZE,
      0,
      -ARROW_SIZE * 0.6,
      -ARROW_SIZE * 0.6,
      -ARROW_SIZE * 0.6,
      ARROW_SIZE * 0.6,
      Phaser.Display.Color.HexStringToColor(COLOR_ACCENT_AMBER).color,
    );
    this.label = scene.add.text(0, ARROW_SIZE, '☀', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: COLOR_ACCENT_AMBER,
    });
    this.label.setOrigin(0.5, 0);
    this.add([triangle, this.label]);
  }

  /** Point the arrow toward a screen-space target and toggle visibility. */
  pointToward(screenX: number, screenY: number, visible: boolean): void {
    this.setVisible(visible);
    if (!visible) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, screenX, screenY);
    this.setRotation(angle);
  }
}
