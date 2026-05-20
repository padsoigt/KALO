/**
 * KALO — database.js
 * Base de données locale : IndexedDB (primary) + localStorage (backup)
 *
 * Stores IndexedDB :
 *   profile      → { key:'main', data:{...} }
 *   meals        → { date:'YYYY-MM-DD', items:[...] }
 *   weightLog    → { date:'YYYY-MM-DD', weight:float }
 *   waterLog     → { date:'YYYY-MM-DD', entries:[{ml,label,time}] }
 *   ingredients  → { category:'légumes', items:[string,...] }
 *   customFoods  → { id:int, nom, kcal, p, g, l, f, categorie }
 *   settings     → { key:string, value:any }
 */

const DB_NAME    = 'KaloDB';
const DB_VERSION = 3;
const STORES     = ['profile','meals','weightLog','waterLog','ingredients','customFoods','settings'];

let _db = null;

// ── Open / upgrade ────────────────────────────────────────────
export function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      const keyPaths = {
        profile:     'key',
        meals:       'date',
        weightLog:   'date',
        waterLog:    'date',
        ingredients: 'category',
        customFoods: 'id',
        settings:    'key',
      };
      STORES.forEach(name => {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: keyPaths[name] });
          if (name === 'customFoods') {
            store.createIndex('nom',       'nom',       { unique: false });
            store.createIndex('categorie', 'categorie', { unique: false });
          }
          if (name === 'weightLog') {
            store.createIndex('date', 'date', { unique: true });
          }
        }
      });
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => { console.error('[DB] open error', e); reject(e); };
  });
}

// ── Low-level helpers ─────────────────────────────────────────
function _tx(store, mode = 'readonly') {
  return _db.transaction(store, mode).objectStore(store);
}

function _get(store, key) {
  return new Promise((res, rej) => {
    const r = _tx(store).get(key);
    r.onsuccess = () => res(r.result ?? null);
    r.onerror   = () => rej(r.error);
  });
}

function _put(store, value) {
  return new Promise((res, rej) => {
    const r = _tx(store, 'readwrite').put(value);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

function _delete(store, key) {
  return new Promise((res, rej) => {
    const r = _tx(store, 'readwrite').delete(key);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

function _getAll(store) {
  return new Promise((res, rej) => {
    const r = _tx(store).getAll();
    r.onsuccess = () => res(r.result ?? []);
    r.onerror   = () => rej(r.error);
  });
}

function _getByIndex(store, indexName, value) {
  return new Promise((res, rej) => {
    const r = _tx(store).index(indexName).getAll(value);
    r.onsuccess = () => res(r.result ?? []);
    r.onerror   = () => rej(r.error);
  });
}

// ── Profile ───────────────────────────────────────────────────
export async function getProfile() {
  const row = await _get('profile', 'main');
  return row ? row.data : defaultProfile();
}

export async function saveProfile(data) {
  await _put('profile', { key: 'main', data });
  _lsSet('profile', data);
}

export function defaultProfile() {
  return {
    name: '', age: null, weight: null, height: null, targetWeight: null,
    gender: 'homme', activity: 'sedentaire', goal: 'deficit_modere',
    customDeficit: 600,
    cookModes: ['Vapeur', 'Grill', 'Cru'],
    dietRestrictions: [],
    preferences: { aimé: [], évité: [] },
    customNutrition: {},
    tdee: 0, budget: 0,
    waterGoal: 2000,
    lightMode: true,
    onboardingDone: false,
  };
}

// ── Meals ─────────────────────────────────────────────────────
export async function getMeals(dateKey) {
  const row = await _get('meals', dateKey);
  return row ? row.items : [];
}

export async function saveMeals(dateKey, items) {
  await _put('meals', { date: dateKey, items });
  _lsSet('meals_' + dateKey, items);
}

export async function addMeal(dateKey, meal) {
  const items = await getMeals(dateKey);
  items.push(meal);
  await saveMeals(dateKey, items);
  return items;
}

export async function updateMeal(dateKey, idx, meal) {
  const items = await getMeals(dateKey);
  items[idx] = meal;
  await saveMeals(dateKey, items);
  return items;
}

export async function deleteMeal(dateKey, idx) {
  const items = await getMeals(dateKey);
  items.splice(idx, 1);
  await saveMeals(dateKey, items);
  return items;
}

export async function getMealsInRange(from, to) {
  const all = await _getAll('meals');
  return all
    .filter(r => r.date >= from && r.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Weight log ────────────────────────────────────────────────
export async function getAllWeights() {
  const all = await _getAll('weightLog');
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveWeight(dateKey, weight) {
  await _put('weightLog', { date: dateKey, weight });
  _lsSet('weight_' + dateKey, weight);
}

export async function deleteWeight(dateKey) {
  await _delete('weightLog', dateKey);
}

// ── Water log ─────────────────────────────────────────────────
export async function getWater(dateKey) {
  const row = await _get('waterLog', dateKey);
  return row ? row.entries : [];
}

export async function saveWater(dateKey, entries) {
  await _put('waterLog', { date: dateKey, entries });
  _lsSet('water_' + dateKey, entries);
}

export async function addWaterEntry(dateKey, entry) {
  const entries = await getWater(dateKey);
  entries.push(entry);
  await saveWater(dateKey, entries);
  return entries;
}

export async function updateWaterEntry(dateKey, idx, ml) {
  const entries = await getWater(dateKey);
  entries[idx] = { ...entries[idx], ml };
  await saveWater(dateKey, entries);
  return entries;
}

export async function deleteWaterEntry(dateKey, idx) {
  const entries = await getWater(dateKey);
  entries.splice(idx, 1);
  await saveWater(dateKey, entries);
  return entries;
}

// ── Ingredients (frigo) ───────────────────────────────────────
const DEFAULT_CATS = ['légumes','protéines','céréales','laitiers','fruits','condiments'];

export async function getIngredients() {
  const rows = await _getAll('ingredients');
  const result = Object.fromEntries(DEFAULT_CATS.map(c => [c, []]));
  rows.forEach(r => { result[r.category] = r.items; });
  return result;
}

export async function saveIngredientCategory(category, items) {
  await _put('ingredients', { category, items });
}

export async function saveAllIngredients(map) {
  await Promise.all(
    Object.entries(map).map(([category, items]) =>
      _put('ingredients', { category, items })
    )
  );
}

// ── Custom foods (user-added nutrition) ───────────────────────
export async function getAllCustomFoods() {
  return _getAll('customFoods');
}

export async function saveCustomFood(food) {
  // Auto-increment id if not set
  if (!food.id) {
    const all = await getAllCustomFoods();
    food.id = all.length > 0 ? Math.max(...all.map(f => f.id)) + 1 : 1;
  }
  await _put('customFoods', food);
  return food;
}

export async function deleteCustomFood(id) {
  await _delete('customFoods', id);
}

// ── Settings ──────────────────────────────────────────────────
export async function getSetting(key) {
  const row = await _get('settings', key);
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  await _put('settings', { key, value });
}

// ── localStorage helpers (backup) ────────────────────────────
function _lsSet(key, value) {
  try {
    localStorage.setItem('kalo_' + key, JSON.stringify(value));
  } catch (_) { /* quota exceeded */ }
}

function _lsGet(key) {
  try {
    const v = localStorage.getItem('kalo_' + key);
    return v ? JSON.parse(v) : null;
  } catch (_) { return null; }
}

// ── Migration from old flat localStorage ─────────────────────
export async function migrateFromLegacy() {
  const LEGACY_KEYS = ['kalo_data', 'kalo3', 'kalo2', 'kalo_state', 'kalo'];
  let raw = null;
  for (const k of LEGACY_KEYS) {
    raw = localStorage.getItem(k);
    if (raw) { console.log(`[DB] migrating from legacy key: ${k}`); break; }
  }
  if (!raw) return false;

  try {
    const old = JSON.parse(raw);

    // Profile
    const profile = defaultProfile();
    const fieldMap = {
      name:           old.profileName,
      age:            old.profileAge,
      weight:         old.profileWeight,
      height:         old.profileHeight,
      targetWeight:   old.profileTargetWeight,
      gender:         old.gender,
      activity:       old.activity,
      goal:           old.goal,
      customDeficit:  old.customDeficit,
      cookModes:      old.cookModes,
      dietRestrictions: old.dietRestrictions,
      preferences:    old.preferences,
      customNutrition:old.customNutrition,
      tdee:           old.tdee,
      budget:         old.budget,
      waterGoal:      old.waterGoal,
      lightMode:      old.lightMode ?? true,
      onboardingDone: old.onboardingDone,
    };
    Object.entries(fieldMap).forEach(([k, v]) => {
      if (v !== undefined && v !== null) profile[k] = v;
    });
    await saveProfile(profile);

    // Meals
    if (old.meals && typeof old.meals === 'object') {
      await Promise.all(
        Object.entries(old.meals).map(([date, items]) =>
          saveMeals(date, items)
        )
      );
    }

    // Weight log (old format: array of {date, weight})
    if (Array.isArray(old.weightLog)) {
      await Promise.all(old.weightLog.map(e => saveWeight(e.date, e.weight)));
    }

    // Water log (old format: object {date: total_ml})
    if (old.waterLog && typeof old.waterLog === 'object') {
      await Promise.all(
        Object.entries(old.waterLog).map(([date, ml]) =>
          saveWater(date, [{ ml: parseInt(ml) || 0, label: 'Import', time: '00:00' }])
        )
      );
    }

    // Ingredients
    if (old.ingredients) {
      await saveAllIngredients(old.ingredients);
    }

    // Custom nutrition → custom foods store
    if (old.customNutrition) {
      const existing = await getAllCustomFoods();
      const existingNames = existing.map(f => f.nom.toLowerCase());
      const ops = Object.entries(old.customNutrition)
        .filter(([nom]) => !existingNames.includes(nom))
        .map(([nom, vals]) => saveCustomFood({
          nom, categorie: 'custom',
          kcal: vals.kcal, proteines: vals.p,
          glucides: vals.g, lipides: vals.l,
          fibres: vals.f || 0,
          source: 'custom',
        }));
      await Promise.all(ops);
    }

    console.log('[DB] Migration from legacy localStorage complete');
    return true;
  } catch (e) {
    console.warn('[DB] Migration failed:', e);
    return false;
  }
}

// ── Init ──────────────────────────────────────────────────────
export async function initDB() {
  await openDB();
  const profile = await getProfile();
  if (!profile.onboardingDone) {
    await migrateFromLegacy();
  }
  return true;
}
