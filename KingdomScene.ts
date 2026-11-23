import Phaser from 'phaser';
import { buildingIds, isLand, mapSize, sameTile, type BuildingId, type Tile } from './catalog';
import { diamond, drawBuilding, drawMiette, drawTerrain, drawTree, polygon, project, unproject } from './art';
import type { Realm } from './realm';

interface Options {
  realm: Realm;
  onSelect(id: BuildingId): void;
  onPlace(tile: Tile): void;
}

const forest: Tile[] = [
  { x: 1, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 3 }, { x: 0, y: 5 },
  { x: 2, y: 5 }, { x: 4, y: 6 }, { x: 6, y: 3 }, { x: 6, y: 1 }, { x: 6, y: 4 },
];
const textStyle: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', fontSize: '13px', color: '#ffe8b5',
};

export class KingdomScene extends Phaser.Scene {
  private effects!: Phaser.GameObjects.Graphics;
  private villager!: Phaser.GameObjects.Graphics;
  private objects = new Map<BuildingId, Phaser.GameObjects.Container>();
  private trees: Phaser.GameObjects.Graphics[] = [];
  private press?: { x: number; y: number; lastX: number; lastY: number; moved: boolean };
  private magnification = 1;
  private editMode = false;

  constructor(private options: Options) { super('kingdom'); }

  create() {
    const sky = this.add.graphics().setDepth(-4);
    for (let i = 0; i < 175; i++) {
      const x = (i * 131 + 37) % 1471 - 735;
      const y = (i * 83 + 97) % 659 - 330;
      sky.fillStyle(i % 4 === 0 ? 0xffd6ab : 0xa9a4f3, .13 + i % 5 * .08)
        .fillCircle(x, y, i % 11 === 0 ? 2.3 : 1.1);
    }
    for (const [x, y, size] of [[-308, -37, 30], [299, -64, 25], [314, 131, 22], [-269, 137, 18]]) {
      polygon(sky, 0x56426c, [[x - size, y], [x + size, y], [x + 7, y + 19], [x - 8, y + 23]]);
      diamond(sky, x, y, size, size * .43, 0x668d7d);
      drawTree(sky, x, y - 3, Math.floor(size));
    }
    const terrain = this.add.graphics().setDepth(-3);
    for (let depth = 1; depth < 12; depth++) {
      for (let x = 0; x < mapSize; x++) {
        const tile = { x, y: depth - x };
        if (isLand(tile)) drawTerrain(terrain, tile, !isLand({ ...tile, x: x + 1 }),
          !isLand({ ...tile, y: tile.y + 1 }));
      }
    }
    this.effects = this.add.graphics().setDepth(-2);
    this.villager = this.add.graphics();
    drawMiette(this.villager);
    this.refresh();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.press = { x: pointer.x, y: pointer.y, lastX: pointer.x, lastY: pointer.y, moved: false };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const drag = this.press;
      if (!drag || !pointer.isDown) return;
      drag.moved ||= Phaser.Math.Distance.Between(drag.x, drag.y, pointer.x, pointer.y) >= 7;
      if (drag.moved) {
        const camera = this.cameras.main;
        camera.scrollX = Phaser.Math.Clamp(camera.scrollX - (pointer.x - drag.lastX) / camera.zoom,
          -camera.width / 2 - 260, -camera.width / 2 + 260);
        camera.scrollY = Phaser.Math.Clamp(camera.scrollY - (pointer.y - drag.lastY) / camera.zoom,
          -camera.height / 2 - 160, -camera.height / 2 + 170);
      }
      drag.lastX = pointer.x;
      drag.lastY = pointer.y;
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const tap = this.press && !this.press.moved;
      this.press = undefined;
      if (!tap) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tile = unproject(world.x, world.y);
      if (this.editMode) {
        this.options.onPlace(tile);
        return;
      }
      const byDepth = [...this.objects.entries()].sort((a, b) => b[1].depth - a[1].depth);
      const hit = byDepth.find(([, view]) =>
        Math.abs(view.x - world.x) < 42 && world.y > view.y - 81 && world.y < view.y + 21);
      if (hit) this.options.onSelect(hit[0]);
    });
    this.input.on('pointerupoutside', () => { this.press = undefined; });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _over: unknown, _x: number, y: number) =>
      this.zoomBy(y < 0 ? 1.12 : 1 / 1.12));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.resize, this);
    this.resize();
  }

  private resize() {
    const camera = this.cameras.main;
    this.setZoom();
    camera.centerOn(0, 0);
  }

  private setZoom() {
    const { main } = this.cameras;
    const fit = Math.min(main.width / 676, main.height / 385);
    main.setZoom(Math.max(.2, fit) * this.magnification);
  }

  zoomBy(factor: number) {
    this.magnification = Phaser.Math.Clamp(this.magnification * factor, .78, 2);
    this.setZoom();
  }

  resetCamera() {
    this.magnification = 1;
    this.resize();
  }

  setMoveMode(active: boolean) {
    this.editMode = active;
    this.refresh();
  }

  refresh() {
    if (!this.effects) return;
    const { buildings, selected } = this.options.realm;
    this.effects.clear();
    if (this.editMode) {
      for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
          const tile = { x, y };
          if (!isLand(tile) || buildingIds.some(id => sameTile(buildings[id].tile, tile))) continue;
          const p = project(tile);
          diamond(this.effects, p.x, p.y, 49, 24, 0x417c60, .48);
          diamond(this.effects, p.x, p.y, 42, 20, 0xefdc9f, .45);
          this.effects.fillStyle(0xfff0bf, .9).fillRect(p.x - 5, p.y - 1, 10, 2).fillRect(p.x - 1, p.y - 5, 2, 10);
        }
      }
    }
    const selectedPoint = project(buildings[selected].tile);
    diamond(this.effects, selectedPoint.x, selectedPoint.y + 4, 55, 29, 0xffe39a);
    diamond(this.effects, selectedPoint.x, selectedPoint.y + 4, 49, 25, 0xc49a67);

    for (const tree of this.trees) tree.destroy();
    this.trees = [];
    for (const [variation, tile] of forest.entries()) {
      if (buildingIds.some(id => sameTile(buildings[id].tile, tile))) continue;
      const p = project(tile);
      const tree = this.add.graphics().setDepth(p.y);
      drawTree(tree, p.x, p.y, variation);
      this.trees.push(tree);
    }
    for (const id of buildingIds) {
      this.objects.get(id)?.destroy(true);
      const building = buildings[id];
      const p = project(building.tile);
      const view = this.add.container(p.x, p.y).setDepth(p.y + .5);
      const body = this.add.graphics();
      drawBuilding(body, id, building.level);
      view.add(body);
      const plaque = this.add.graphics();
      plaque.fillStyle(0x302347).fillRoundedRect(-23, 20, 46, 20, 8);
      plaque.lineStyle(1, id === selected ? 0xffd37d : 0x866fa3).strokeRoundedRect(-23, 20, 46, 20, 8);
      view.add([plaque, this.add.text(0, 30, 'Niv. ' + building.level, textStyle).setOrigin(.5)]);
      if (building.pendingUntil !== null || building.ready > 0) {
        const mark = this.add.graphics();
        mark.fillStyle(0x393052).fillCircle(0, 0, 12);
        diamond(mark, 0, 0, 6, 8, building.pendingUntil !== null ? 0xcfa7ff : 0xffd479);
        mark.setPosition(21, id === 'castle' ? -105 : -74);
        view.add(mark);
        this.tweens.add({ targets: mark, y: mark.y - 5, duration: 720, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        mark.once(Phaser.GameObjects.Events.DESTROY, () => this.tweens.killTweensOf(mark));
      }
      this.objects.set(id, view);
    }
  }

  update(time: number) {
    if (!this.villager) return;
    const walk = project({ x: 3, y: 2.5 + 1.15 * Math.sin(time / 1950) });
    this.villager.setPosition(walk.x, walk.y - Math.abs(Math.sin(time / 102)) * 4).setDepth(walk.y + 1);
  }
}
