/**
 * KALO — database.js
 */

// STATE
// ============================================================
const DEFAULTS = {
  // No personal data — profile is blank until user fills it in
  tdee: 0, budget: 0, goal: 'deficit_modere',
  gender: 'homme', activity: 'sedentaire',
  selCat: 'légumes', selMealType: 'petit-déjeuner',
  selDay: new Date().getDate(), period: 'week',
  cookModes: ['Vapeur','Grill','Cru'],
  ingredients: { légumes:[], protéines:[], céréales:[], laitiers:[], fruits:[], condiments:[] },
  archive:[], meals:{},
  customNutrition:{},
  preferences:{aimé:[],évité:[]},
  dietRestrictions:[],
  recipeHistory:[],
  weightLog:[],
  waterLog:{},
  waterGoal:2000,
  lightMode:true,
  displayMode:'light',
  _waterEntries:[],
  stepsLog:{},
  stepsGoal:10000,
  customBudgetKcal: 0,  // 0 = calculé depuis TDEE-déficit ; >0 = budget manuel
  // Profile — empty by default, onboarding fills these
  profileName: '', profileAge: '', profileWeight: '', profileHeight: '',
  profileTargetWeight: '', onboardingDone: false
};

const S = JSON.parse(JSON.stringify(DEFAULTS)); // deep clone defaults
S.selDate = new Date(); // never persisted, always resets to today

// Stable storage key — never change this
const STORAGE_KEY = 'kalo_data';

// ============================================================

// MODULE: Database — IndexedDB primary, localStorage fallback
// ============================================================
const DB_NAME='KaloDB', DB_VERSION=2;
let _idb=null;
function openIDB(){
  return new Promise((res,rej)=>{
    if(_idb){res(_idb);return;}
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains('profile'))    db.createObjectStore('profile',{keyPath:'key'});
      if(!db.objectStoreNames.contains('meals'))      db.createObjectStore('meals',{keyPath:'date'});
      if(!db.objectStoreNames.contains('weightLog'))  db.createObjectStore('weightLog',{keyPath:'date'});
      if(!db.objectStoreNames.contains('waterLog'))   db.createObjectStore('waterLog',{keyPath:'date'});
      if(!db.objectStoreNames.contains('ingredients'))db.createObjectStore('ingredients',{keyPath:'category'});
      if(!db.objectStoreNames.contains('settings'))   db.createObjectStore('settings',{keyPath:'key'});
    };
    req.onsuccess=e=>{_idb=e.target.result;res(_idb);};
    req.onerror=e=>{console.warn('IDB error',e);rej(e);};
  });
}
function idbGet(store,key){return new Promise((res,rej)=>{if(!_idb)return rej('no db');const r=_idb.transaction(store).objectStore(store).get(key);r.onsuccess=()=>res(r.result??null);r.onerror=()=>rej(r.error);});}
function idbPut(store,val){return new Promise((res,rej)=>{if(!_idb)return rej('no db');const r=_idb.transaction(store,'readwrite').objectStore(store).put(val);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});}
function idbDel(store,key){return new Promise((res,rej)=>{if(!_idb)return rej('no db');const r=_idb.transaction(store,'readwrite').objectStore(store).delete(key);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});}
function idbAll(store){return new Promise((res,rej)=>{if(!_idb)return rej('no db');const r=_idb.transaction(store).objectStore(store).getAll();r.onsuccess=()=>res(r.result??[]);r.onerror=()=>rej(r.error);});}

// LS backup (always write for resilience)
function lsBackup(){
  try{
    const d={...S};delete d.selDate;delete d._waterEntries;
    localStorage.setItem('kalo_data',JSON.stringify(d));
  }catch(e){}
}
// LS load (fallback)
function loadLS(){
  try{
    const raw=localStorage.getItem('kalo_data')||localStorage.getItem('kalo3')||localStorage.getItem('kalo2')||localStorage.getItem('kalo_state');
    if(!raw)return;
    const saved=JSON.parse(raw);
    if(saved.meals&&typeof saved.meals==='object') Object.assign(S.meals,saved.meals);
    if(saved.ingredients&&typeof saved.ingredients==='object'){
      for(const cat of Object.keys(S.ingredients)){if(Array.isArray(saved.ingredients[cat]))S.ingredients[cat]=saved.ingredients[cat];}
      for(const cat of Object.keys(saved.ingredients)){if(!S.ingredients[cat])S.ingredients[cat]=saved.ingredients[cat];}
    }
    if(Array.isArray(saved.archive))S.archive=saved.archive;
    const flds=['tdee','budget','goal','gender','activity','cookModes','selMealType','selCat','period',
      'profileName','profileAge','profileWeight','profileHeight','profileTargetWeight','onboardingDone',
      'customDeficit','customNutrition','preferences','dietRestrictions','recipeHistory','weightLog',
      'waterLog','waterGoal','lightMode','stepsLog','stepsGoal','displayMode','customBudgetKcal'];
    // Add stepsLog/stepsGoal if present
  if(saved.stepsLog)  S.stepsLog  = saved.stepsLog;
  if(saved.stepsGoal) S.stepsGoal = saved.stepsGoal;
  flds.forEach(f=>{if(saved[f]!==undefined)S[f]=saved[f];});
    console.log('Loaded from localStorage');
  }catch(e){console.warn('LS load failed',e);}
}
// Unified save: IDB + LS backup
function save(){
  lsBackup();
  if(!_idb)return;
  // Profile + settings
  const profileData={...S};delete profileData.selDate;delete profileData._waterEntries;
  idbPut('profile',{key:'main',data:profileData}).catch(()=>{});
  // Meals
  Object.entries(S.meals).forEach(([date,meals])=>{
    idbPut('meals',{date,meals}).catch(()=>{});
  });
  // Ingredients
  Object.entries(S.ingredients).forEach(([category,items])=>{
    idbPut('ingredients',{category,items}).catch(()=>{});
  });
}
// IDB load with LS migration
async function loadIDB(){
  try{
    await openIDB();
    const prof=await idbGet('profile','main');
    if(prof&&prof.data){
      const d=prof.data;
      if(d.meals&&typeof d.meals==='object') Object.assign(S.meals,d.meals);
      if(d.ingredients&&typeof d.ingredients==='object'){
        for(const cat of Object.keys(S.ingredients)){if(Array.isArray(d.ingredients[cat]))S.ingredients[cat]=d.ingredients[cat];}
      }
      if(Array.isArray(d.archive)) S.archive=d.archive;
      const flds=['tdee','budget','goal','gender','activity','cookModes','selMealType','selCat','period',
        'profileName','profileAge','profileWeight','profileHeight','profileTargetWeight','onboardingDone',
        'customDeficit','customNutrition','preferences','dietRestrictions','recipeHistory','weightLog',
        'waterLog','waterGoal','lightMode','stepsLog','stepsGoal','displayMode','customBudgetKcal'];
      flds.forEach(f=>{if(d[f]!==undefined)S[f]=d[f];});
    } else {
      loadLS();
      // Persist LS data to IDB
      save();
    }
    // Load weight log from IDB
    const wAll=await idbAll('weightLog');
    if(wAll&&wAll.length>0) S.weightLog=wAll.sort((a,b)=>a.date.localeCompare(b.date));
    // Load today's water
    S._waterEntries=await loadWaterForDate(fullDateKey(new Date()));
  }catch(e){
    console.warn('IDB load failed, using LS:',e);
    loadLS();
  }
}
// ---- Water IDB helpers ----
async function loadWaterForDate(dateKey){
  try{
    const row=await idbGet('waterLog',dateKey);
    return row?row.entries:[];
  }catch(e){
    try{return JSON.parse(localStorage.getItem('kalo_water_'+dateKey)||'[]');}catch(x){return[];}
  }
}
async function saveWaterForDate(dateKey,entries){
  try{await idbPut('waterLog',{date:dateKey,entries});}catch(e){}
  try{localStorage.setItem('kalo_water_'+dateKey,JSON.stringify(entries));}catch(e){}
}
// ---- Weight IDB helpers ----
async function saveWeightIDB(dateKey,weight){
  try{await idbPut('weightLog',{date:dateKey,weight});}catch(e){}
}
async function deleteWeightIDB(dateKey){
  try{await idbDel('weightLog',dateKey);}catch(e){}
}
// Init sequence



// ============================================================
