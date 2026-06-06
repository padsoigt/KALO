/**
 * KALO — utils.js
 */

// HELPERS
// ============================================================
const Q = s => s.replace(/'/g,"\\'");
const CAT_E = {légumes:'🥦',protéines:'🥩',céréales:'🌾',laitiers:'🧀',fruits:'🍎',condiments:'🧴'};
const CAT_N = {légumes:'Légumes',protéines:'Protéines',céréales:'Céréales',laitiers:'Laitiers',fruits:'Fruits',condiments:'Condiments'};
const LOGO_SVG = `<svg viewBox="0 0 100 100"><path d="M50 8 C24 8, 4 28, 4 52 C4 76, 24 96, 50 96 C64 96, 77 90, 85 79 L85 58 C79 70, 66 79, 52 79 C35 79, 21 65, 21 48 C21 31, 35 17, 52 17 C60 17, 67 20, 72 25 L72 8 C65 8, 57 8, 50 8Z" fill="#6BBF6A"/><circle cx="73" cy="31" r="10" fill="#6BBF6A"/><circle cx="84" cy="50" r="7" fill="#6BBF6A"/></svg>`;
function allIng(){return Object.values(S.ingredients).flat();}

// Date helpers — always use real dates, never hardcoded year/month
function toDateKey(year,month,day){
  return `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function dateKey(day){ // backward compat: use selDate's year/month
  return toDateKey(S.selDate.getFullYear(), S.selDate.getMonth(), day);
}
function fullDateKey(date){
  return toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
}
function dayMealsFromKey(key){return S.meals[key]||[];}
function dayMeals(day){return S.meals[dateKey(day)]||[];}
function dayKcalFromKey(key){return dayMealsFromKey(key).reduce((s,m)=>s+m.kcal,0);}
function dayKcal(day){return dayMeals(day).reduce((s,m)=>s+m.kcal,0);}
function dayKcalDate(date){return dayMealsFromKey(fullDateKey(date)).reduce((s,m)=>s+m.kcal,0);}

// ============================================================
// NAVIGATION
// ============================================================
function showScreen(name){
  // Hide all + deactivate nav
  document.querySelectorAll('.screen').forEach(sc=>sc.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  // Show target screen FIRST so DOM elements are accessible
  const screenEl=document.getElementById('screen-'+name);
  if(screenEl) screenEl.classList.add('active');
  const navIdx={analyse:0,frigo:1,agenda:2,profil:3};
  if(navIdx[name]!==undefined)
    document.querySelectorAll('.nav-item')[navIdx[name]].classList.add('active');
  // Render after screen is visible
  const safe=fn=>{try{fn();}catch(e){console.warn('[showScreen]',name,e);}};
  if(name==='analyse'){
    safe(renderCalorieRing); safe(renderStepsWidget);
    safe(()=>renderStepsStats(currentStepsPeriod||'week'));
    safe(renderHomeHeader);  safe(renderWaterWidget);
    safe(renderWeightChart); safe(renderHomeAnalytics);
    safe(updateTDEE);
  }
  if(name==='profil')  safe(syncProfilScreen);
  if(name==='frigo')   safe(renderFrigo);
  if(name==='agenda'){
    safe(renderAgenda);
    // Re-attach agenda add button listener each time
    const addBtn=document.getElementById('agenda-add-btn');
    if(addBtn){ addBtn.onclick=openMealModal; }
  }
}

// ============================================================
// CALENDAR
// ============================================================
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth();
