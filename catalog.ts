export const resources = {
  wood: { name: 'Bois', icon: '🪵' },
  stone: { name: 'Pierre', icon: '🪨' },
  iron: { name: 'Fer', icon: '⛏' },
  gold: { name: 'Or', icon: '✦' },
} as const;

export type Resource = keyof typeof resources;
export type Wallet = Record<Resource, number>;
export const resourceIds = Object.keys(resources) as Resource[];

export interface Tile { x: number; y: number }
interface BuildingType {
  name: string;
  role: string;
  icon: string;
  roof: number;
  cycleYield?: number;
  resource?: Resource;
  start: Tile;
}

export const catalog = {
  castle: { name: 'Maison royale', role: 'Centre du royaume', icon: '♛', roof: 0xb36af4, cycleYield: 12, resource: 'gold', start: { x: 3, y: 1 } },
  sawmill: { name: 'Scierie', role: 'Production de bois', icon: '🪵', roof: 0xed8168, cycleYield: 20, resource: 'wood', start: { x: 1, y: 2 } },
  quarry: { name: 'Carrière', role: 'Production de pierre', icon: '💎', roof: 0x65badb, cycleYield: 16, resource: 'stone', start: { x: 5, y: 2 } },
  mine: { name: 'Mine', role: 'Production de fer', icon: '⛏', roof: 0x8779d6, cycleYield: 10, resource: 'iron', start: { x: 4, y: 4 } },
  warehouse: { name: 'Entrepôt', role: 'Stockage', icon: '▣', roof: 0xeda958, start: { x: 2, y: 4 } },
} satisfies Record<string, BuildingType>;

export type BuildingId = keyof typeof catalog;
export const buildingIds = Object.keys(catalog) as BuildingId[];
export const buildingType = (id: BuildingId): BuildingType => catalog[id];

export const balance = {
  cycleMs: 60_000,
  offlineMs: 8 * 60 * 60_000,
  castleCaps: [3, 5, 6, 8, 10, 12, 14, 16, 18, 20],
  firstWallet: { wood: 120, stone: 100, iron: 65, gold: 150 },
};

export const mapSize = 7;
export function isLand({ x, y }: Tile): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
    x < mapSize && y < mapSize && x + y >= 1 && x + y < 12;
}

export function castleRequired(level: number): number {
  return balance.castleCaps.findIndex(cap => cap >= level) + 1;
}

export const sameTile = (a: Tile, b: Tile) => a.x === b.x && a.y === b.y;
export const capacityAt = (level: number) => 250 + 50 * level ** 2;

export function productionAt(id: BuildingId, level: number): number {
  const base = buildingType(id).cycleYield ?? 0;
  return Math.round(base * (level <= 5 ? level : 5 + (level - 5) * 1.5));
}

export function upgradeQuote(level: number): { cost: Wallet; time: number } {
  const factor = level ** 2;
  return {
    cost: { wood: 30 * factor, stone: 25 * factor, iron: 10 * factor, gold: 35 * factor },
    time: 12_000 * factor,
  };
}
