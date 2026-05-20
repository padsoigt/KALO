/**
 * KALO — utils.js
 * Fonctions utilitaires partagées (dates, formatage, DOM)
 */

// ── Dates ─────────────────────────────────────────────────────
export function toDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function fullDateKey(date) {
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}
export function todayKey() { return fullDateKey(new Date()); }

export function formatDateFR(dateKey) {
  const d = new Date(dateKey + 'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

export function dayLabelFR(date) {
  const days   = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ── Formatage eau ─────────────────────────────────────────────
export function formatWater(ml) {
  if (ml >= 1000) return `${(ml / 1000).toFixed(2).replace(/\.?0+$/, '')} L`;
  return `${ml} ml`;
}
export function formatWaterGoal(ml) {
  return ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`;
}

// ── Strings ───────────────────────────────────────────────────
export const escQ = s => String(s).replace(/'/g, "\\'");
export const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

// ── DOM helpers ───────────────────────────────────────────────
export function $(id) { return document.getElementById(id); }
export function setVal(id, v) { const el = $(id); if (el && v !== undefined && v !== null && v !== '') el.value = v; }
export function setText(id, v) { const el = $(id); if (el) el.textContent = v; }
export function setStyle(id, prop, val) { const el = $(id); if (el) el.style[prop] = val; }

// ── Color helpers ─────────────────────────────────────────────
export function kcalColor(pct) {
  if (pct >= 100) return 'var(--danger)';
  if (pct >= 85)  return 'var(--orange)';
  return 'var(--green-glow)';
}
export function waterColor(pct) {
  if (pct >= 100) return '#27ae60';
  if (pct >= 70)  return '#2980b9';
  return '#5dade2';
}
