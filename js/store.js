/**
 * KALO — store.js
 * État global de l'application + actions async
 * Toutes les écritures passent par ici → garantit la cohérence
 */

import * as DB from '../db/database.js';
import { setCustomFoods } from '../db/nutrition.js';

// ── État global ───────────────────────────────────────────────
export const state = {
  // Profil (chargé depuis IDB)
  profile: DB.defaultProfile(),

  // Navigation
  selDate:     new Date(),
  selCat:      'légumes',
  selMealType: 'déjeuner',
  period:      'week',

  // Données (chargées depuis IDB)
  ingredients: { légumes:[], protéines:[], céréales:[], laitiers:[], fruits:[], condiments:[] },
  archive:     [],

  // Cache repas (clé = 'YYYY-MM-DD')
  _meals:      {},

  // Journal poids
  _weightLog:  [],

  // Journal eau du jour
  _waterEntries: [],

  // Historique recettes (anti-répétition)
  recipeHistory: [],
};

// ── Listeners réactifs ────────────────────────────────────────
const _listeners = new Map();

export function on(event, fn) {
  if (!_listeners.has(event)) _listeners.set(event, []);
  _listeners.get(event).push(fn);
}

function emit(event, data) {
  (_listeners.get(event) || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } });
  (_listeners.get('*')   || []).forEach(fn => { try { fn(event, data); } catch (e) {} });
}

// ── Initialisation ────────────────────────────────────────────
export async function init() {
  await DB.initDB();

  // Charger profil
  state.profile = await DB.getProfile();

  // Charger ingrédients
  state.ingredients = await DB.getIngredients();

  // Charger journal poids
  state._weightLog = await DB.getAllWeights();

  // Charger eau du jour
  state._waterEntries = await DB.getWater(todayKey());

  // Charger aliments personnalisés
  const customFoods = await DB.getAllCustomFoods();
  setCustomFoods(customFoods);

  emit('init', state);
  return state;
}

// ── Helpers dates ─────────────────────────────────────────────
export function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function fullDateKey(date) {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}

export function todayKey() { return fullDateKey(new Date()); }

// ── Profil ────────────────────────────────────────────────────
export async function saveProfile(updates) {
  Object.assign(state.profile, updates);
  await DB.saveProfile(state.profile);
  emit('profile', state.profile);
}

// ── TDEE ──────────────────────────────────────────────────────
export function calcTDEE(profile = state.profile) {
  const age    = parseInt(profile.age)    || 26;
  const w      = parseFloat(profile.weight) || 70;
  const h      = parseInt(profile.height)   || 170;
  const gender = profile.gender || 'homme';
  let bmr = gender === 'homme'
    ? 10 * w + 6.25 * h - 5 * age + 5
    : 10 * w + 6.25 * h - 5 * age - 161;
  const actMap = { sedentaire: 1.2, leger: 1.375, modere: 1.55, actif: 1.725 };
  const tdee   = Math.round(bmr * (actMap[profile.activity] || 1.2));
  bmr = Math.round(bmr);
  const defMap = { deficit_doux: 250, deficit_modere: 500, deficit_fort: 750, maintien: 0, custom: profile.customDeficit || 600 };
  const deficit = defMap[profile.goal] || 500;
  const budget  = Math.max(1200, tdee - deficit);
  return { tdee, bmr, deficit, budget };
}

// ── Repas ─────────────────────────────────────────────────────
export async function loadMeals(dateKey) {
  if (!state._meals[dateKey]) {
    state._meals[dateKey] = await DB.getMeals(dateKey);
  }
  return state._meals[dateKey];
}

export function getMealsCached(dateKey) {
  return state._meals[dateKey] || [];
}

export async function addMeal(dateKey, meal) {
  state._meals[dateKey] = await DB.addMeal(dateKey, meal);
  emit('meals', { dateKey });
  return state._meals[dateKey];
}

export async function updateMeal(dateKey, idx, meal) {
  state._meals[dateKey] = await DB.updateMeal(dateKey, idx, meal);
  emit('meals', { dateKey });
}

export async function deleteMeal(dateKey, idx) {
  state._meals[dateKey] = await DB.deleteMeal(dateKey, idx);
  emit('meals', { dateKey });
}

export function dayKcal(dateKey) {
  return getMealsCached(dateKey).reduce((s, m) => s + m.kcal, 0);
}

// ── Poids ─────────────────────────────────────────────────────
export function getWeightLog() { return state._weightLog; }

export async function saveWeight(dateKey, weight) {
  await DB.saveWeight(dateKey, weight);
  state._weightLog = await DB.getAllWeights();
  emit('weight', state._weightLog);
}

export async function deleteWeight(dateKey) {
  await DB.deleteWeight(dateKey);
  state._weightLog = await DB.getAllWeights();
  emit('weight', state._weightLog);
}

// ── Eau ───────────────────────────────────────────────────────
export function getWaterEntries() { return state._waterEntries; }

export function getWaterTotal() {
  return state._waterEntries.reduce((s, e) => s + (e.ml || 0), 0);
}

export async function addWater(entry) {
  const dateKey = todayKey();
  state._waterEntries = await DB.addWaterEntry(dateKey, entry);
  emit('water', state._waterEntries);
  return state._waterEntries;
}

export async function updateWater(idx, ml) {
  const dateKey = todayKey();
  state._waterEntries = await DB.updateWaterEntry(dateKey, idx, ml);
  emit('water', state._waterEntries);
}

export async function deleteWater(idx) {
  const dateKey = todayKey();
  state._waterEntries = await DB.deleteWaterEntry(dateKey, idx);
  emit('water', state._waterEntries);
}

export async function loadWaterForDate(dateKey) {
  return DB.getWater(dateKey);
}

// ── Ingrédients ───────────────────────────────────────────────
export function allIngredients() {
  return Object.values(state.ingredients).flat();
}

export async function saveIngredients() {
  await DB.saveAllIngredients(state.ingredients);
  emit('ingredients', state.ingredients);
}

export async function addIngredient(category, name, customNutrition = null) {
  if (!state.ingredients[category]) state.ingredients[category] = [];
  // Remove from archive if present
  state.archive = state.archive.filter(a => a.name.toLowerCase() !== name.toLowerCase());
  state.ingredients[category].push(name);
  await DB.saveIngredientCategory(category, state.ingredients[category]);

  // Save custom nutrition if provided
  if (customNutrition && customNutrition.kcal > 0) {
    await DB.saveCustomFood({
      nom:       name.toLowerCase(),
      categorie: 'custom',
      kcal:      customNutrition.kcal,
      proteines: customNutrition.p || 0,
      glucides:  customNutrition.g || 0,
      lipides:   customNutrition.l || 0,
      fibres:    customNutrition.f || 0,
      source:    'custom',
    });
    // Refresh custom foods in nutrition engine
    const all = await DB.getAllCustomFoods();
    setCustomFoods(all);
  }

  emit('ingredients', state.ingredients);
}

export async function deleteIngredient(category, name) {
  state.ingredients[category] = state.ingredients[category].filter(i => i !== name);
  if (!state.archive.find(a => a.name === name)) {
    state.archive.push({ name, category });
  }
  await DB.saveIngredientCategory(category, state.ingredients[category]);
  emit('ingredients', state.ingredients);
}

export async function restoreIngredient(name, category) {
  if (!state.ingredients[category]) state.ingredients[category] = [];
  if (!state.ingredients[category].includes(name)) {
    state.ingredients[category].push(name);
  }
  state.archive = state.archive.filter(a => a.name !== name);
  await DB.saveIngredientCategory(category, state.ingredients[category]);
  emit('ingredients', state.ingredients);
}
