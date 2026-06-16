/**
 * Solar Explorer — Spacecraft game object.
 *
 * A Phaser image showing a schematic spacecraft icon at a fixed illustrative
 * size, regardless of zoom. Reports selection by id.
 */
import Phaser from 'phaser';
import type { SpacecraftData } from '../../logic/library';
import { SPACECRAFT_RADIUS_PX, COLOR_ACCENT_GREEN } from '../../constants/constants';
import { drawSpacecraftIcon } from '../renderers/BodyRenderer';
import { isTapGesture } from '../../logic/pointerInput';
import type { SelectHandler } from './CelestialBody';

const TEXTURE_PAD = 8;
const HIT_RADIUS = SPACECRAFT_RADIUS_PX * 3;

/** Build (once) and return the procedural texture key for a spacecraft. */
export function ensureSpacecraftTexture(
  scene: Phaser.Scene,
  craft: SpacecraftData,
): string {
  const key = `craft:${craft.id}`;
  if (!scene.textures.exists(key)) {
    const size = Math.ceil(SPACECRAFT_RADIUS_PX * TEXTURE_PAD);
    const texture = scene.textures.createCanvas(key, size, size);
    if (texture) {
      const ctx = texture.getContext();
      drawSpacecraftIcon(ctx, size / 2, size / 2, COLOR_ACCENT_GREEN, SPACECRAFT_RADIUS_PX, craft.id);
      texture.refresh();
    }
  }
  return key;
}

export class Spacecraft extends Phaser.GameObjects.Image {
  readonly craftId: string;

  constructor(scene: Phaser.Scene, craft: SpacecraftData, onSelect: SelectHandler) {
    const key = ensureSpacecraftTexture(scene, craft);
    super(scene, 0, 0, key);
    this.craftId = craft.id;
    scene.add.existing(this);

    const hit = new Phaser.Geom.Circle(this.width / 2, this.height / 2, HIT_RADIUS);
    this.setInteractive(hit, Phaser.Geom.Circle.Contains);
    // Select on release and only for a tap — a traveling press is a pan/pinch.
    this.on('pointerup', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      if (!isTapGesture(pointer.getDistance())) return;
      event.stopPropagation();
      onSelect(craft.id);
    });
  }
}
