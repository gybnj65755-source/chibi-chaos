import {
  balance, buildingIds, buildingType, capacityAt, castleRequired, isLand,
  productionAt, resourceIds, sameTile, upgradeQuote,
  type BuildingId, type Tile, type Wallet,
} from './catalog';

export interface Building {
  level: number;
  tile: Tile;
  pendingUntil: number | null;
  ready: number;
  progress: number;
}

export interface Realm {
  version: 1;
  updatedAt: number;
  selected: BuildingId;
  wallet: Wallet;
  buildings: Record<BuildingId, Building>;
}

export const storageKey = 'chibi-chaos:realm:v1';

export function createRealm(now: number): Realm {
  const buildings = {} as Realm['buildings'];
  for (const id of buildingIds) {
    buildings[id] = { level: 1, tile: { ...buildingType(id).start }, pendingUntil: null, ready: 0, progress: 0 };
  }
  return { version: 1, updatedAt: now, selected: 'castle', wallet: { ...balance.firstWallet }, buildings };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function nonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function restoreRealm(serialized: string | null, now: number): Realm {
  const fresh = createRealm(now);
  if (!serialized) return fresh;
  try {
    const saved: unknown = JSON.parse(serialized);
    if (!isObject(saved) || saved.version !== 1 || !nonnegative(saved.updatedAt) ||
        !isObject(saved.wallet) || !isObject(saved.buildings)) return fresh;
    const wallet = saved.wallet;
    if (!resourceIds.every(id => nonnegative(wallet[id]))) return fresh;
    const tiles: Tile[] = [];
    for (const id of buildingIds) {
      const b = saved.buildings[id];
      if (!isObject(b) || !isObject(b.tile) || !nonnegative(b.tile.x) || !nonnegative(b.tile.y) ||
          !nonnegative(b.level) || b.level < 1 || b.level > maxLevel(id) ||
          !nonnegative(b.ready) || !nonnegative(b.progress) || b.progress >= balance.cycleMs ||
          (b.pendingUntil !== null && (!nonnegative(b.pendingUntil) || b.level >= maxLevel(id)))) return fresh;
      const tile = { x: b.tile.x, y: b.tile.y };
      if (!isLand(tile) || tiles.some(other => sameTile(tile, other))) return fresh;
      tiles.push(tile);
    }
    const state = saved as unknown as Realm;
    state.selected = buildingIds.includes(state.selected) ? state.selected : 'castle';
    advanceRealm(state, now);
    return state;
  } catch {
    return fresh;
  }
}

export const maxLevel = (id: BuildingId) => id === 'castle' ? balance.castleCaps.length : balance.castleCaps.at(-1)!;
export const capacity = (state: Realm) => capacityAt(state.buildings.warehouse.level);

function produce(id: BuildingId, building: Building, elapsed: number): void {
  if (elapsed <= 0 || !buildingType(id).resource) return;
  const rate = productionAt(id, building.level);
  const total = building.progress + elapsed;
  building.ready = Math.min(Math.floor(balance.offlineMs / balance.cycleMs) * rate,
    building.ready + Math.floor(total / balance.cycleMs) * rate);
  building.progress = total % balance.cycleMs;
}

export function advanceRealm(state: Realm, now: number): BuildingId[] {
  const start = state.updatedAt;
  if (now <= start) return [];
  const end = Math.min(now, start + balance.offlineMs);
  const finished: BuildingId[] = [];
  for (const id of buildingIds) {
    const building = state.buildings[id];
    const deadline = building.pendingUntil;
    if (deadline !== null && deadline <= now) {
      const cutoff = Math.min(end, Math.max(start, deadline));
      produce(id, building, cutoff - start);
      building.pendingUntil = null;
      building.level++;
      produce(id, building, end - cutoff);
      finished.push(id);
    } else {
      produce(id, building, end - start);
    }
  }
  state.updatedAt = now;
  return finished;
}

export function upgradeStatus(state: Realm, id: BuildingId) {
  const b = state.buildings[id];
  const quote = upgradeQuote(b.level);
  const required = id === 'castle' ? 1 : castleRequired(b.level + 1);
  const missing = resourceIds.filter(r => state.wallet[r] < quote.cost[r]);
  const maximum = b.level >= maxLevel(id);
  const blocked = state.buildings.castle.level < required;
  return { ...quote, maximum, required, missing, blocked,
    available: !maximum && !blocked && missing.length === 0 && b.pendingUntil === null };
}

export function upgrade(state: Realm, id: BuildingId, now: number): boolean {
  advanceRealm(state, now);
  const quote = upgradeStatus(state, id);
  if (!quote.available) return false;
  for (const r of resourceIds) state.wallet[r] -= quote.cost[r];
  state.buildings[id].pendingUntil = state.updatedAt + quote.time;
  return true;
}

export function harvest(state: Realm, id: BuildingId, now: number): number {
  advanceRealm(state, now);
  const resource = buildingType(id).resource;
  if (!resource) return 0;
  const b = state.buildings[id];
  const amount = Math.min(b.ready, Math.max(0, capacity(state) - state.wallet[resource]));
  state.wallet[resource] += amount;
  b.ready -= amount;
  return amount;
}

export function moveBuilding(state: Realm, id: BuildingId, tile: Tile): boolean {
  if (!isLand(tile) || buildingIds.some(other => sameTile(state.buildings[other].tile, tile))) return false;
  state.buildings[id].tile = { ...tile };
  return true;
}
