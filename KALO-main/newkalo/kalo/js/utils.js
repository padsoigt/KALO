/**
 * KALO — Utility Functions
 * Date helpers, string escaping, display formatters
 */
export const Q = s => s.replace(/'/g,"\\'");
export function toDateKey(y,m,d){return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
export function fullDateKey(date){return toDateKey(date.getFullYear(),date.getMonth(),date.getDate());}
export function todayKey(){return fullDateKey(new Date());}
export function dayLabel(date){
  const n=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const m=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${n[date.getDay()]} ${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear()}`;
}
export function formatWater(ml){return ml>=1000?`${(ml/1000).toFixed(2).replace(/\.?0+$/,'')}L`:`${ml}ml`;}
export function formatDate(dateKey){
  const d=new Date(dateKey+'T12:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}
