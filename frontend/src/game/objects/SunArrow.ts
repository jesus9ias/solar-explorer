/**
 * Solar Explorer — SunArrow.
 *
 * A compass arrow that always points toward the Sun. Hidden when the Sun is on
 * screen. Its world position is updated every frame by placeAtCamera() so it
 * stays at a fixed pixel offset from the viewport corner without relying on
 * scrollFactor — scrollFactor-0 objects are still subject to Phaser's camera
 * culling, which drops them when they fall outside the worldView at high zoom.
 */
import Phaser from 'phaser';
import { COLOR_ACCENT_AMBER } from '../../constants/constants';

const ARROW_SIZE = 18;
const MARGIN_X = 56;
const MARGIN_Y = 100;

export class SunArrow extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);
    this.setDepth(1000);
    this.setVisible(false);

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

  /**
   * Move the container to the world position that maps to screen pixel
   * (SCREEN_MARGIN, SCREEN_MARGIN). Calling this every frame keeps the arrow
   * inside the camera worldView so Phaser never culls it.
   */
  placeAtCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    // worldView.x/y is the top-left world coordinate visible to the camera.
    // Adding SCREEN_MARGIN/zoom converts the fixed pixel offset to world units.
    const view = camera.worldView;
    this.setPosition(
      view.x + MARGIN_X / camera.zoom,
      view.y + MARGIN_Y / camera.zoom,
    );
    this.setScale(1 / camera.zoom);
  }

  /**
   * Point the arrow toward a world-space target and toggle visibility.
   * Call placeAtCamera() first so this.x / this.y are current.
   */
  pointToward(worldX: number, worldY: number, visible: boolean): void {
    this.setVisible(visible);
    if (!visible) return;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, worldX, worldY);
    this.setRotation(angle);
  }
}
