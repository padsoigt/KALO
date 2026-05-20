/**
 * KALO — Database Module
 * Architecture: IndexedDB (primary) + localStorage (fallback/sync)
 * Stores: profile, meals, weightLog, waterLog, ingredients, settings
 */

const DB_NAME = 'KaloDB';
const DB_VERSION = 2;

let _db = null;

const STORES = {
  profile:     'profile',
  meals:       'meals',
  weightLog:   'weightLog',
  waterLog:    'waterLog',
  ingredients: 'ingredients',
  settings:    'settings',
};

// ── Open / Migrate ────────────────────────────────────────────
export function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      // profile: single-row key-value
      if (!db.objectStoreNames.contains(STORES.profile)) {
        db.createObjectStore(STORES.profile, { keyPath: 'key' });
      }
      // meals: keyed by date string "YYYY-MM-DD"
      if (!db.objectStoreNames.contains(STORES.meals)) {
        db.createObjectStore(STORES.meals, { keyPath: 'date' });
      }
      // weightLog: keyed by date
      if (!db.objectStoreNames.contains(STORES.weightLog)) {
        const ws = db.createObjectStore(STORES.weightLog, { keyPath: 'date' });
        ws.createIndex('date', 'date', { unique: true });
      }
      // waterLog: keyed by date
      if (!db.objectStoreNames.contains(STORES.waterLog)) {
        db.createObjectStore(STORES.waterLog, { keyPath: 'date' });
      }
      // ingredients: keyed by category
      if (!db.objectStoreNames.contains(STORES.ingredients)) {
        db.createObjectStore(STORES.ingredients, { keyPath: 'category' });
      }
      // settings: general key-value
      if (!db.objectStoreNames.contains(STORES.settings)) {
        db.createObjectStore(STORES.settings, { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror   = (e) => { console.error('IndexedDB error', e); reject(e); };
  });
}

// ── Generic helpers ───────────────────────────────────────────
function tx(storeName, mode = 'readonly') {
  return _db.transaction(storeName, mode).objectStore(storeName);
}

function idbGet(store, key) {
  return new Promise((res, rej) => {
    const r = tx(store).get(key);
    r.onsuccess = () => res(r.result ?? null);
    r.onerror   = () => rej(r.error);
  });
}

function idbPut(store, value) {
  return new Promise((res, rej) => {
    const r = tx(store, 'readwrite').put(value);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej(r.error);
  });
}

function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const r = tx(store, 'readwrite').delete(key);
    r.onsuccess = () => res();
    r.onerror   = () => rej(r.error);
  });
}

function idbGetAll(store) {
  return new Promise((res, rej) => {
    const r = tx(store).getAll();
    r.onsuccess = () => res(r.result ?? []);
    r.onerror   = () => rej(r.error);
  });
}

// ── Profile ───────────────────────────────────────────────────
export async function getProfile() {
  const row = await idbGet(STORES.profile, 'main');
  return row ? row.data : getDefaultProfile();
}

export async function saveProfile(data) {
  await idbPut(STORES.profile, { key: 'main', data });
  lsSync('profile', data);
}

function getDefaultProfile() {
  return {
    name: '', age: '', weight: '', height: '', targetWeight: '',
    gender: 'homme', activity: 'sedentaire', goal: 'deficit_modere',
    customDeficit: 600, cookModes: ['Vapeur','Grill','Cru'],
    dietRestrictions: [], preferences: { aimé: [], évité: [] },
    tdee: 0, budget: 0, onboardingDone: false,
    waterGoal: 2000, lightMode: true,
  };
}

// ── Settings ──────────────────────────────────────────────────
export async function getSetting(key) {
  const row = await idbGet(STORES.settings, key);
  return row ? row.value : null;
}

export async function setSetting(key, value) {
  await idbPut(STORES.settings, { key, value });
}

// ── Meals ─────────────────────────────────────────────────────
export async function getMealsForDate(dateKey) {
  const row = await idbGet(STORES.meals, dateKey);
  return row ? row.meals : [];
}

export async function saveMealsForDate(dateKey, meals) {
  await idbPut(STORES.meals, { date: dateKey, meals });
  lsSync('meals_' + dateKey, meals);
}

export async function deleteMeal(dateKey, idx) {
  const meals = await getMealsForDate(dateKey);
  meals.splice(idx, 1);
  await saveMealsForDate(dateKey, meals);
}

export async function addMeal(dateKey, meal) {
  const meals = await getMealsForDate(dateKey);
  meals.push(meal);
  await saveMealsForDate(dateKey, meals);
}

export async function updateMeal(dateKey, idx, meal) {
  const meals = await getMealsForDate(dateKey);
  meals[idx] = meal;
  await saveMealsForDate(dateKey, meals);
}

export async function getMealsRange(startDate, endDate) {
  const all = await idbGetAll(STORES.meals);
  return all.filter(r => r.date >= startDate && r.date <= endDate);
}

// ── Weight Log ────────────────────────────────────────────────
export async function getAllWeightEntries() {
  const all = await idbGetAll(STORES.weightLog);
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveWeightEntry(dateKey, weight) {
  await idbPut(STORES.weightLog, { date: dateKey, weight });
}

export async function deleteWeightEntry(dateKey) {
  await idbDelete(STORES.weightLog, dateKey);
}

// ── Water Log ─────────────────────────────────────────────────
export async function getWaterForDate(dateKey) {
  const row = await idbGet(STORES.waterLog, dateKey);
  return row ? row.entries : [];
}

export async function saveWaterForDate(dateKey, entries) {
  await idbPut(STORES.waterLog, { date: dateKey, entries });
}

export async function addWaterEntry(dateKey, entry) {
  const entries = await getWaterForDate(dateKey);
  entries.push(entry);
  await saveWaterForDate(dateKey, entries);
  return entries;
}

export async function deleteWaterEntry(dateKey, idx) {
  const entries = await getWaterForDate(dateKey);
  entries.splice(idx, 1);
  await saveWaterForDate(dateKey, entries);
  return entries;
}

export async function updateWaterEntry(dateKey, idx, ml) {
  const entries = await getWaterForDate(dateKey);
  entries[idx].ml = ml;
  await saveWaterForDate(dateKey, entries);
  return entries;
}

// ── Ingredients / Frigo ───────────────────────────────────────
export async function getIngredients() {
  const cats = await idbGetAll(STORES.ingredients);
  const result = { légumes:[], protéines:[], céréales:[], laitiers:[], fruits:[], condiments:[] };
  cats.forEach(r => { result[r.category] = r.items; });
  return result;
}

export async function saveIngredients(categoryMap) {
  const ops = Object.entries(categoryMap).map(([category, items]) =>
    idbPut(STORES.ingredients, { category, items })
  );
  await Promise.all(ops);
}

// ── Migration from old localStorage ──────────────────────────
export async function migrateFromLocalStorage() {
  const STORAGE_KEY = 'kalo_data';
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const old = JSON.parse(raw);
    const profile = getDefaultProfile();
    const fieldMap = {
      name: old.profileName, age: old.profileAge,
      weight: old.profileWeight, height: old.profileHeight,
      targetWeight: old.profileTargetWeight, gender: old.gender,
      activity: old.activity, goal: old.goal,
      customDeficit: old.customDeficit, cookModes: old.cookModes,
      dietRestrictions: old.dietRestrictions, preferences: old.preferences,
      tdee: old.tdee, budget: old.budget, onboardingDone: old.onboardingDone,
      waterGoal: old.waterGoal || 2000, lightMode: old.lightMode ?? true,
    };
    Object.assign(profile, Object.fromEntries(
      Object.entries(fieldMap).filter(([, v]) => v !== undefined && v !== null)
    ));
    await saveProfile(profile);

    // Meals
    if (old.meals) {
      await Promise.all(Object.entries(old.meals).map(([date, meals]) =>
        saveMealsForDate(date, meals)
      ));
    }
    // Weight log
    if (Array.isArray(old.weightLog)) {
      await Promise.all(old.weightLog.map(e => saveWeightEntry(e.date, e.weight)));
    }
    // Water log (old format: {date: ml})
    if (old.waterLog) {
      await Promise.all(Object.entries(old.waterLog).map(([date, ml]) =>
        saveWaterForDate(date, [{ ml, label: 'Import', time: '00:00' }])
      ));
    }
    // Ingredients
    if (old.ingredients) await saveIngredients(old.ingredients);

    console.log('✅ Migration localStorage → IndexedDB terminée');
    return true;
  } catch (e) {
    console.warn('Migration failed', e);
    return false;
  }
}

// ── localStorage sync (backup) ────────────────────────────────
function lsSync(key, data) {
  try { localStorage.setItem('kalo_' + key, JSON.stringify(data)); }
  catch (e) { /* quota exceeded, ignore */ }
}

// ── Initialise DB ─────────────────────────────────────────────
export async function initDB() {
  await openDB();
  const profile = await getProfile();
  if (!profile.onboardingDone) {
    // Try migration
    await migrateFromLocalStorage();
  }
  return true;
}
