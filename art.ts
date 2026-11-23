import Phaser from 'phaser';
import { buildingType, type BuildingId, type Tile } from './catalog';

type Point = readonly [number, number];
export const halfWidth = 52;
export const halfHeight = 26;
const outline = 0x262144;

export function project(tile: Tile): Phaser.Math.Vector2 {
  return new Phaser.Math.Vector2((tile.x - tile.y) * halfWidth, (tile.x + tile.y - 6) * halfHeight);
}

export function unproject(x: number, y: number): Tile {
  return { x: Math.round((y / halfHeight + 6 + x / halfWidth) / 2),
    y: Math.round((y / halfHeight + 6 - x / halfWidth) / 2) };
}

function shade(color: number, amount: number): number {
  const mod = (channel: number) => Phaser.Math.Clamp(channel + amount, 0, 255);
  return (mod(color >> 16) << 16) | (mod((color >> 8) & 255) << 8) | mod(color & 255);
}

export function polygon(g: Phaser.GameObjects.Graphics, color: number, vertices: Point[], stroke = 0, alpha = 1) {
  const points = vertices.map(([x, y]) => ({ x, y }));
  g.fillStyle(color, alpha).fillPoints(points, true);
  if (stroke) g.lineStyle(stroke, outline, 1).strokePoints(points, true);
}

function line(g: Phaser.GameObjects.Graphics, color: number, width: number, points: Point[], alpha = 1) {
  g.lineStyle(width, color, alpha).strokePoints(points.map(([x, y]) => ({ x, y })));
}

export function diamond(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, alpha = 1) {
  polygon(g, fill, [[x, y - h], [x + w, y], [x, y + h], [x - w, y]], 0, alpha);
}

export function drawTerrain(g: Phaser.GameObjects.Graphics, tile: Tile, eastEdge: boolean, southEdge: boolean) {
  const { x, y } = project(tile);
  const seed = tile.x * 42 + tile.y * 67;
  const bottom = y + halfHeight;
  const drop = 31 + seed % 11;
  const rockySide = (sx: number, color: number) => {
    polygon(g, color, [[x, bottom], [x + sx * halfWidth, y], [x + sx * (halfWidth - 5), y + drop], [x, bottom + drop]], 2);
    polygon(g, shade(color, -18), [[x, bottom + 11], [x + sx * (halfWidth - 2), y + 12],
      [x + sx * (halfWidth - 5), y + drop], [x, bottom + drop]]);
    line(g, 0xad71a4, 1.5, [[x + sx * 4, bottom + 8], [x + sx * 24, bottom - 2], [x + sx * 39, y + 13]], .43);
    line(g, 0x251f40, 2, [[x + sx * 11, bottom + 12], [x + sx * 18, bottom + 18], [x + sx * 16, bottom + 26]]);
  };
  if (eastEdge) rockySide(1, 0x54517b);
  if (southEdge) rockySide(-1, 0x765685);
  diamond(g, x, y, 52.3, 26.3, [0x68ba82, 0x70c58b, 0x82cd8a, 0x75c78a][seed % 4]);
  if (eastEdge) line(g, 0xa4dda0, 2, [[x, bottom], [x + halfWidth, y]]);
  if (southEdge) line(g, 0xa4dda0, 2, [[x, bottom], [x - halfWidth, y]]);
  const path = tile.x === 3 && tile.y >= 1 && tile.y <= 5 || tile.y === 2 && tile.x >= 1 && tile.x <= 5 ||
    tile.y === 4 && tile.x >= 2 && tile.x <= 4;
  if (path) {
    diamond(g, x, y, 47, 17, 0xd2bd82);
    diamond(g, x, y - 2, 40, 13, 0xe1cb8e);
    for (let i = 0; i < 7; i++) {
      g.fillStyle(i % 2 ? 0xbca774 : 0xead89f).fillEllipse(x + (i * 29 + seed) % 66 - 33, y + i % 5 - 3, 3 + i % 3, 2);
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const ax = x + (i * 22 + seed) % 60 - 30;
      const ay = y + (i * 9 + seed) % 18 - 9;
      line(g, 0x499d70, 1.4, [[ax - 3, ay - 3], [ax, ay], [ax + 3, ay - 4]], .65);
      if ((i + seed) % 7 === 0) g.fillStyle(0xffe0ad).fillCircle(ax + 2, ay - 3, 1.9);
    }
  }
}

export function drawTree(g: Phaser.GameObjects.Graphics, x: number, y: number, variation: number) {
  const green = [0x339574, 0x417aaa, 0x65a760][variation % 3];
  g.fillStyle(0x276356, .26).fillEllipse(x, y + 3, 37, 14);
  line(g, outline, 6, [[x, y + 2], [x - 1, y - 25]]);
  line(g, 0x9e655c, 3, [[x, y + 1], [x - 1, y - 25]]);
  for (let i = 0; i < 3; i++) {
    const w = 19 - i * 4;
    const h = y - 11 - i * 11;
    polygon(g, green, [[x - w, h], [x, h - 28], [x + w, h], [x, h + 8]], 2);
    polygon(g, shade(green, -18), [[x, h - 27], [x + w - 1, h], [x, h + 7]]);
    line(g, shade(green, 37), 2, [[x - w + 4, h - 1], [x - 4, h - 17]]);
  }
}

function windowPane(g: Phaser.GameObjects.Graphics, x: number, y: number, side: number) {
  polygon(g, 0x43304f, [[x, y], [x + side * 10, y - 4], [x + side * 10, y + 6], [x, y + 10]], 2);
  polygon(g, 0xffca80, [[x + side * 2, y + 2], [x + side * 8, y - 1], [x + side * 8, y + 5], [x + side * 2, y + 7]]);
}

export function drawBuilding(g: Phaser.GameObjects.Graphics, id: BuildingId, level: number) {
  const roof = buildingType(id).roof;
  const stage = Number(level >= 2) + Number(level >= 5) + Number(level >= 10) + Number(level >= 15) + Number(level >= 20);
  const castle = id === 'castle';
  const w = castle ? 35 : 29;
  const h = (castle ? 39 : 29) + stage * 5;
  const wall = stage === 0 ? (id === 'mine' ? 0x9c96b8 : 0xeac18d) : 0xdfd4ef;
  const roofHeight = id === 'warehouse' ? 20 : 29;
  g.fillStyle(0x24493d, .31).fillEllipse(2, 14, 87, 29);
  polygon(g, 0xefdaa0, [[-42, -1], [0, -21], [42, -1], [0, 23]], 2);

  if (castle && stage >= 1) {
    const towerHeight = h + 18;
    polygon(g, 0xb3a2c7, [[20, -9], [20, -towerHeight], [34, -towerHeight - 7],
      [45, -towerHeight], [45, -9], [32, -2]], 2);
    polygon(g, shade(roof, 12), [[18, -towerHeight], [33, -towerHeight - 25], [47, -towerHeight], [33, -towerHeight + 7]], 2);
    windowPane(g, 30, -towerHeight + 12, 1);
  }
  polygon(g, shade(wall, -27), [[-w, 0], [0, 16], [0, 16 - h], [-w, -h]], 2.5);
  polygon(g, wall, [[0, 16], [w, 0], [w, -h], [0, 16 - h]], 2.5);
  for (let layer = 0; layer < Math.floor(h / 8) - 1; layer++) {
    const y = -7 - layer * 8;
    line(g, shade(wall, -59), 1.3, [[-w + 2, y], [0, y + 16]], .58);
    line(g, shade(wall, -44), 1.2, [[0, y + 16], [w - 2, y]], .44);
    if (stage > 0) line(g, shade(wall, -44), 1.4, [[15 + layer % 2 * 5, y + 6], [15 + layer % 2 * 5, y + 11]]);
  }
  const ridge: Point = [-13, -h - roofHeight];
  const peak: Point = [10, -h - roofHeight + 5];
  const front: Point = [0, 18 - h];
  const right: Point = [w + 5, -h + 1];
  polygon(g, shade(roof, -37), [[-w - 5, -h + 1], ridge, peak, front], 2.5);
  polygon(g, roof, [ridge, peak, right, [17, -h - roofHeight - 8]], 2.5);
  polygon(g, shade(roof, 15), [peak, right, front], 2.5);
  line(g, shade(roof, 49), 2.5, [[-w - 3, -h - 1], [ridge[0], ridge[1] + 2], [peak[0] - 1, peak[1] + 2]]);
  for (let i = 0; i < 3; i++) {
    line(g, shade(roof, -23), 1.4, [[-31 + i * 6, -h - 5 - i * 5], [-7 + i * 5, -h + 7 - i * 7]], .7);
  }
  const doorWidth = id === 'mine' ? 20 : 12;
  polygon(g, 0x493654, [[4, 12], [4, -5], [9, -14], [4 + doorWidth, -13], [4 + doorWidth, 7]], 2);
  if (id !== 'mine') g.fillStyle(0xffca75).fillCircle(12, 2, 1.5);
  windowPane(g, -9, -13, -1);
  if (id !== 'mine') windowPane(g, 20, -17, 1);

  if (castle) {
    const top = -h - roofHeight - 24;
    line(g, outline, 3, [[2, -h - 20], [2, top]]);
    polygon(g, 0xffcb66, [[3, top + 1], [25, top + 6], [18, top + 9], [25, top + 14], [3, top + 11]], 1.5);
    g.fillStyle(0xffebad).fillCircle(2, top, 3);
  } else if (id === 'sawmill') {
    for (let i = 0; i < 3; i++) {
      const x = -35 + i * 8;
      const y = 8 + i * 3;
      line(g, outline, 8, [[x, y], [x + 11, y - 7]]);
      line(g, 0x945660, 5, [[x, y], [x + 11, y - 7]]);
      g.fillStyle(0xf5b879).fillCircle(x, y, 3.4);
    }
    g.fillStyle(0xe2d5ef).fillCircle(-19, -18, 7);
    g.fillStyle(0xa3859e).fillCircle(-19, -18, 3);
  } else if (id === 'quarry' || id === 'mine') {
    for (let i = 0; i < 3; i++) {
      const x = -36 + i * 10;
      const y = 8 + i * 4;
      polygon(g, shade(roof, 20 + i * 10), [[x - 5, y], [x - 3, y - 7], [x + 2, y - 11], [x + 7, y - 3], [x + 6, y + 3]], 1.7);
      line(g, shade(roof, 66), 1.7, [[x - 1, y - 7], [x + 2, y - 9], [x + 5, y - 4]]);
    }
    if (id === 'mine') {
      line(g, outline, 2, [[9, 10], [18, 20]]);
      line(g, outline, 2, [[16, 7], [26, 17]]);
      for (let i = 0; i < 3; i++) line(g, 0x966a65, 2, [[9 + i * 4, 11 + i * 3], [19 + i * 4, 7 + i * 3]]);
    }
  } else {
    for (let i = 0; i < 2; i++) {
      const x = -34 + i * 13;
      const y = 2 + i * 5;
      polygon(g, 0xa86b5d, [[x, y - 4], [x + 11, y], [x + 11, y + 13], [x, y + 9]], 1.5);
      polygon(g, 0xffcc88, [[x, y - 4], [x + 10, y - 9], [x + 20, y - 5], [x + 11, y]], 1.5);
      polygon(g, 0xc48762, [[x + 11, y], [x + 20, y - 5], [x + 20, y + 8], [x + 11, y + 13]], 1.5);
    }
  }
  for (let i = 0; i < stage; i++) diamond(g, 10 + i * 6, -h + 8 - i * 3, 2.5, 4, 0xffe0a0);
}

export function drawMiette(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0x443556).fillEllipse(0, 9, 15, 8);
  g.fillStyle(outline).fillCircle(0, -2, 11);
  g.fillStyle(0xffbd78).fillCircle(0, -2, 9);
  polygon(g, 0xba79ee, [[-10, -6], [1, -22], [7, -10], [11, -7]], 2);
  g.fillStyle(outline).fillCircle(-3, -1, 1.6).fillCircle(4, -1, 1.6);
  g.fillStyle(0x8d4b59).fillEllipse(1, 4, 4, 2);
}
