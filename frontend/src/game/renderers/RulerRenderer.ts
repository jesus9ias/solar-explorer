/**
 * Solar Explorer — RulerRenderer.
 *
 * A fixed ruler on the left edge of the Linear viewport showing the distance
 * from the Sun. Tick marks sit at regular distance intervals and are relabeled
 * every frame as the camera scrolls. Distances honor the active unit.
 */
import Phaser from 'phaser';
import {
  Unit,
  RULER_TICK_INTERVAL_MKM,
  RULER_WIDTH_PX,
  COLOR_PANEL,
  COLOR_BORDER,
  COLOR_TEXT,
  COLOR_ACCENT_GREEN,
} from '../../constants/constants';
import { convertMkmToAU } from '../../logic/scale';

const TICK_LENGTH = 10;
const LABEL_FONT = { fontFamily: 'monospace', fontSize: '10px', color: COLOR_TEXT };
const MAX_TICKS = 64;

export class RulerRenderer {
  private readonly scene: Phaser.Scene;
  private readonly panel: Phaser.GameObjects.Graphics;
  private readonly ticks: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Text[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.panel = scene.add.graphics().setScrollFactor(0).setDepth(900);
    this.ticks = scene.add.graphics().setScrollFactor(0).setDepth(901);
    for (let i = 0; i < MAX_TICKS; i++) {
      const label = scene.add
        .text(0, 0, '', LABEL_FONT)
        .setScrollFactor(0)
        .setDepth(902)
        .setVisible(false);
      this.labels.push(label);
    }
    this.drawPanel();
  }

  private drawPanel(): void {
    const height = this.scene.scale.height;
    this.panel.clear();
    this.panel.fillStyle(Phaser.Display.Color.HexStringToColor(COLOR_PANEL).color, 0.85);
    this.panel.fillRect(0, 0, RULER_WIDTH_PX, height);
    this.panel.lineStyle(1, Phaser.Display.Color.HexStringToColor(COLOR_BORDER).color, 1);
    this.panel.lineBetween(RULER_WIDTH_PX, 0, RULER_WIDTH_PX, height);
  }

  private format(distanceMkm: number, unit: Unit): string {
    if (unit === Unit.AU) return `${convertMkmToAU(distanceMkm).toFixed(1)}`;
    return `${Math.round(distanceMkm)}`;
  }

  /** Redraw tick labels for the current scroll position. */
  update(
    pxPerMkm: number,
    topPadPx: number,
    unit: Unit,
  ): void {
    const camera = this.scene.cameras.main;
    const height = this.scene.scale.height;
    this.drawPanel();
    this.ticks.clear();
    this.ticks.lineStyle(1, Phaser.Display.Color.HexStringToColor(COLOR_ACCENT_GREEN).color, 0.8);

    const topDistance = Math.max(0, (camera.scrollY - topPadPx) / pxPerMkm);
    const firstTickIndex = Math.floor(topDistance / RULER_TICK_INTERVAL_MKM);

    for (let i = 0; i < MAX_TICKS; i++) {
      const distance = (firstTickIndex + i) * RULER_TICK_INTERVAL_MKM;
      const worldY = topPadPx + distance * pxPerMkm;
      const screenY = worldY - camera.scrollY;
      const label = this.labels[i];
      if (screenY < 0 || screenY > height) {
        label.setVisible(false);
        continue;
      }
      this.ticks.lineBetween(RULER_WIDTH_PX - TICK_LENGTH, screenY, RULER_WIDTH_PX, screenY);
      label.setText(this.format(distance, unit));
      label.setPosition(6, screenY - 6);
      label.setVisible(true);
    }
  }
}
