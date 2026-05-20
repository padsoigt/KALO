/**
 * KALO — State Store
 * Central reactive state with async DB persistence
 */

import { initDB, getProfile, saveProfile as dbSaveProfile,
  getMealsForDate, saveMealsForDate, deleteMeal as dbDeleteMeal, addMeal as dbAddMeal, updateMeal as dbUpdateMeal,
  getAllWeightEntries, saveWeightEntry, deleteWeightEntry as dbDeleteWeight,
  getWaterForDate, addWaterEntry, deleteWaterEntry as dbDeleteWater, updateWaterEntry,
  getIngredients, saveIngredients } from '../db/database.js';

// ── Reactive state ─────────────────────────────────────────────
export const S = {
  // Profile (loaded async)
  profile: {
    name:'', age:'', weight:'', height:'', targetWeight:'',
    gender:'homme', activity:'sedentaire', goal:'deficit_modere',
    customDeficit:600, cookModes:['Vapeur','Grill','Cru'],
    dietRestrictions:[], preferences:{ aimé:[], évité:[] },
    tdee:0, budget:0, onboardingDone:false,
    waterGoal:2000, lightMode:true, customNutrition:{},
  },
  // Runtime state (not persisted)
  selDate: new Date(),
  selCat: 'légumes',
  selMealType: 'petit-déjeuner',
  period: 'week',
  ingredients: { légumes:[], protéines:[], céréales:[], laitiers:[], fruits:[], condiments:[] },
  // Loaded on demand
  _mealCache: {},
  _weightLog: [],
  _waterCache: {},
};

let _listeners = [];

export function onStateChange(fn) { _listeners.push(fn); }
function emit(key) { _listeners.forEach(fn => { try { fn(key); } catch(e){} }); }

// ── Init ───────────────────────────────────────────────────────
export async function initStore() {
  await initDB();
  S.profile = await getProfile();
  S._weightLog = await getAllWeightEntries();
  S.ingredients = await getIngredients();
  return true;
}

// ── Profile ────────────────────────────────────────────────────
export async function saveProfile(data = null) {
  if (data) Object.assign(S.profile, data);
  await dbSaveProfile(S.profile);
  emit('profile');
}

// ── Meals ──────────────────────────────────────────────────────
export async function loadMealsForDate(dateKey) {
  if (!S._mealCache[dateKey]) {
    S._mealCache[dateKey] = await getMealsForDate(dateKey);
  }
  return S._mealCache[dateKey];
}

export async function getMeals(dateKey) {
  return loadMealsForDate(dateKey);
}

export async function addMeal(dateKey, meal) {
  await dbAddMeal(dateKey, meal);
  S._mealCache[dateKey] = await getMealsForDate(dateKey);
  emit('meals');
}

export async function deleteMeal(dateKey, idx) {
  await dbDeleteMeal(dateKey, idx);
  S._mealCache[dateKey] = await getMealsForDate(dateKey);
  emit('meals');
}

export async function updateMeal(dateKey, idx, meal) {
  await dbUpdateMeal(dateKey, idx, meal);
  S._mealCache[dateKey] = await getMealsForDate(dateKey);
  emit('meals');
}

export function getCachedMeals(dateKey) {
  return S._mealCache[dateKey] || [];
}

// ── Weight ─────────────────────────────────────────────────────
export function getWeightLog() { return S._weightLog; }

export async function saveWeightLog(dateKey, weight) {
  await saveWeightEntry(dateKey, weight);
  S._weightLog = await getAllWeightEntries();
  emit('weight');
}

export async function deleteWeight(dateKey) {
  await dbDeleteWeight(dateKey);
  S._weightLog = await getAllWeightEntries();
  emit('weight');
}

// ── Water ──────────────────────────────────────────────────────
export async function getWater(dateKey) {
  if (!S._waterCache[dateKey]) {
    S._waterCache[dateKey] = await getWaterForDate(dateKey);
  }
  return S._waterCache[dateKey];
}

export async function addWater(dateKey, entry) {
  const entries = await addWaterEntry(dateKey, entry);
  S._waterCache[dateKey] = entries;
  emit('water');
  return entries;
}

export async function deleteWater(dateKey, idx) {
  const entries = await dbDeleteWater(dateKey, idx);
  S._waterCache[dateKey] = entries;
  emit('water');
  return entries;
}

export async function editWater(dateKey, idx, ml) {
  const entries = await updateWaterEntry(dateKey, idx, ml);
  S._waterCache[dateKey] = entries;
  emit('water');
  return entries;
}

export function getWaterTotal(entries) {
  return (entries || []).reduce((s, e) => s + (e.ml || 0), 0);
}

// ── Ingredients ────────────────────────────────────────────────
export async function saveIngs() {
  await saveIngredients(S.ingredients);
  emit('ingredients');
}

export function allIng() {
  return Object.values(S.ingredients).flat();
}

// ── Date helpers ───────────────────────────────────────────────
export function toDateKey(year, month, day) {
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
export function fullDateKey(date) {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}
export function todayKey() {
  return fullDateKey(new Date());
}

// ── Calorie helpers ────────────────────────────────────────────
export function dayKcal(dateKey) {
  return getCachedMeals(dateKey).reduce((s,m) => s+m.kcal, 0);
}

// ── TDEE calc ──────────────────────────────────────────────────
export function calcTDEE(profile = S.profile) {
  const age    = parseInt(profile.age) || 26;
  const w      = parseFloat(profile.weight) || 70;
  const h      = parseInt(profile.height) || 170;
  const gender = profile.gender || 'homme';
  let bmr = gender === 'homme'
    ? 10*w + 6.25*h - 5*age + 5
    : 10*w + 6.25*h - 5*age - 161;
  const actMap = { sedentaire:1.2, leger:1.375, modere:1.55, actif:1.725 };
  const tdee   = Math.round(bmr * (actMap[profile.activity] || 1.2));
  bmr = Math.round(bmr);
  const defMap = { deficit_doux:250, deficit_modere:500, deficit_fort:750, maintien:0, custom: profile.customDeficit||600 };
  const deficit = defMap[profile.goal] || 500;
  const budget  = Math.max(1200, tdee - deficit);
  return { tdee, bmr, deficit, budget };
}
