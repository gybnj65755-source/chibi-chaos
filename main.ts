import Phaser from 'phaser';
import {
  balance, buildingIds, buildingType, capacityAt, productionAt, resourceIds, resources,
  type BuildingId, type Tile,
} from './catalog';
import {
  advanceRealm, capacity, harvest, moveBuilding, restoreRealm, storageKey, upgrade,
  upgradeStatus,
} from './realm';
import { KingdomScene } from './KingdomScene';
import './style.css';

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const target = document.getElementById(id);
  if (!target) throw new Error(`Élément introuvable : ${id}`);
  return target as T;
}

function readSave(): string | null {
  try { return localStorage.getItem(storageKey); }
  catch { return null; }
}

const realm = restoreRealm(readSave(), Date.now());
let moving = false;
let feedbackTimer: number | undefined;
let saveAvailable = true;
let mapRevision = '';

const wallet = element('wallet');
const walletValues = new Map(resourceIds.map(id => {
  const item = document.createElement('li');
  item.innerHTML = `<span class="resource-icon" aria-hidden="true">${resources[id].icon}</span>
    <span class="resource-name">${resources[id].name}</span><strong></strong>`;
  wallet.append(item);
  return [id, item.querySelector('strong')!] as const;
}));

const buildingButtons = new Map(buildingIds.map(id => {
  const type = buildingType(id);
  const button = document.createElement('button');
  button.className = 'building-tab';
  button.type = 'button';
  button.innerHTML = `<span aria-hidden="true" class="tab-icon">${type.icon}</span>
    <span class="tab-name">${type.name}</span><small></small>`;
  element('buildings').append(button);
  button.addEventListener('click', () => select(id));
  return [id, { button, badge: button.querySelector('small')! }] as const;
}));

const moveButton = element<HTMLButtonElement>('move');
const upgradeButton = element<HTMLButtonElement>('upgrade');
const harvestButton = element<HTMLButtonElement>('harvest');

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(realm)); }
  catch {
    saveAvailable = false;
    message('Safari ne peut pas enregistrer la partie.');
  }
}

function message(text: string) {
  window.clearTimeout(feedbackTimer);
  element('feedback').textContent = text;
  if (saveAvailable) {
    feedbackTimer = window.setTimeout(() => { element('feedback').textContent = ''; }, 3600);
  }
}

function duration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${String(seconds % 60).padStart(2, '0')} s` : `${seconds} s`;
}

function setMoving(active: boolean) {
  moving = active;
  scene.setMoveMode(active);
}

function select(id: BuildingId) {
  realm.selected = id;
  if (moving) setMoving(false);
  save();
  render();
}

function place(tile: Tile) {
  if (!moveBuilding(realm, realm.selected, tile)) {
    message('Choisis une case libre marquée d’un +.');
    return;
  }
  setMoving(false);
  save();
  message('Bâtiment déplacé.');
  render();
}

function render() {
  const id = realm.selected;
  const building = realm.buildings[id];
  const type = buildingType(id);
  const quote = upgradeStatus(realm, id);
  const storage = capacity(realm);
  const resource = type.resource;

  for (const [r, label] of walletValues) {
    label.textContent = String(realm.wallet[r]);
    label.parentElement!.title = `${resources[r].name} stocké · ${realm.wallet[r]} sur ${storage}`;
  }
  for (const [key, tab] of buildingButtons) {
    tab.button.setAttribute('aria-pressed', String(key === id));
    tab.badge.textContent = 'N' + realm.buildings[key].level;
  }

  element('building-icon').textContent = type.icon;
  element('name').textContent = type.name;
  element('role').textContent = type.role;
  element('level').textContent = 'Niv. ' + building.level;
  element('map-hint').textContent = moving ? 'Touche une case dorée libre' : 'Glisse pour explorer';
  moveButton.textContent = moving ? 'Annuler' : 'Déplacer';
  moveButton.setAttribute('aria-pressed', String(moving));

  harvestButton.hidden = !resource;
  if (resource) {
    const full = realm.wallet[resource] >= storage;
    harvestButton.textContent = full ? 'Stock plein' : `Récolter · ${building.ready}`;
    harvestButton.disabled = full || building.ready <= 0;
    const rate = productionAt(id, building.level);
    const next = quote.maximum ? '' : ' → ' + productionAt(id, building.level + 1);
    const percentage = Math.min(100, building.progress * 100 / balance.cycleMs);
    element('stats').innerHTML = `<div class="stat-line"><span>Production par min.</span><strong>${rate}${next}</strong></div>
      <div class="stat-line"><span>Stock ${resources[resource].name.toLowerCase()}</span><strong>${realm.wallet[resource]}/${storage}</strong></div>
      <div class="progress" aria-hidden="true"><span style="width:${percentage}%"></span></div>`;
  } else {
    const next = quote.maximum ? '' : ' → ' + capacityAt(building.level + 1);
    element('stats').innerHTML = `<div class="stat-line"><span>Capacité par ressource</span><strong>${storage}${next}</strong></div>
      <div class="stat-line"><span>Bois, pierre, fer et or</span></div>`;
  }

  const pending = building.pendingUntil !== null;
  element('time').textContent = quote.maximum ? '' : duration(pending ? building.pendingUntil! - Date.now() : quote.time);
  const cost = element('cost');
  cost.hidden = quote.maximum || pending;
  if (!cost.hidden) {
    cost.innerHTML = resourceIds.map(r => `<li class="${quote.missing.includes(r) ? 'missing' : ''}">${quote.cost[r]} ${resources[r].name}</li>`).join('');
  }
  element('reason').textContent = pending ? `Niveau ${building.level + 1} en cours` : quote.maximum ? 'Niveau maximum atteint' :
    quote.blocked ? `Maison royale niveau ${quote.required} requis` :
    quote.missing.length ? 'Manque ' + quote.missing.map(r => `${quote.cost[r] - realm.wallet[r]} ${resources[r].name.toLowerCase()}`).join(', ') :
    `Niveau ${building.level + 1} disponible`;
  upgradeButton.textContent = pending ? 'Amélioration en cours' : 'Améliorer';
  upgradeButton.disabled = !quote.available;

  const revision = [id, ...buildingIds.map(key => {
    const b = realm.buildings[key];
    return [b.level, b.ready > 0, b.pendingUntil, b.tile.x, b.tile.y].join(',');
  })].join(':');
  if (revision !== mapRevision) {
    mapRevision = revision;
    scene.refresh();
  }
}

const viewport = element('viewport');
const scene = new KingdomScene({ realm, onSelect: select, onPlace: place });
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: viewport, transparent: true,
  width: Math.max(1, viewport.clientWidth), height: Math.max(1, viewport.clientHeight),
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [scene],
  render: { antialias: true },
  audio: { noAudio: true },
  fps: { target: 60 },
  banner: false,
});
const observer = new ResizeObserver(() => {
  if (game.isBooted && viewport.clientWidth && viewport.clientHeight) {
    game.scale.resize(viewport.clientWidth, viewport.clientHeight);
  }
});
observer.observe(viewport);
game.events.once(Phaser.Core.Events.READY, () => {
  game.scale.resize(viewport.clientWidth, viewport.clientHeight);
});

element('zoom-out').addEventListener('click', () => scene.zoomBy(1 / 1.19));
element('zoom-in').addEventListener('click', () => scene.zoomBy(1.19));
element('center').addEventListener('click', () => scene.resetCamera());
moveButton.addEventListener('click', () => { setMoving(!moving); render(); });
upgradeButton.addEventListener('click', () => {
  if (upgrade(realm, realm.selected, Date.now())) {
    save();
    message('Amélioration lancée.');
  }
  render();
});
harvestButton.addEventListener('click', () => {
  const type = buildingType(realm.selected);
  const amount = harvest(realm, realm.selected, Date.now());
  if (amount > 0 && type.resource) {
    save();
    message(`+${amount} ${resources[type.resource].name.toLowerCase()} en stock.`);
  }
  render();
});

function tick() {
  const completed = advanceRealm(realm, Date.now());
  if (completed.length) {
    save();
    message(`${completed.map(id => buildingType(id).name).join(', ')} · amélioration terminée.`);
  }
  render();
}

window.setInterval(() => { if (!document.hidden) tick(); }, 500);
window.setInterval(() => { if (!document.hidden) save(); }, 5000);
document.addEventListener('visibilitychange', () => { tick(); save(); });
window.addEventListener('pagehide', () => { advanceRealm(realm, Date.now()); save(); });
save();
render();
