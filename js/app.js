/**
 * KALO — app.js
 */

// MODULE: App Initialisation
// ============================================================
function initApp(){
  // 1. Theme first
  if(!S.displayMode) S.displayMode = S.lightMode ? 'light' : 'dark';
  applyTheme();

  // 2. Activate accueil screen BEFORE any render (elements must be visible)
  document.querySelectorAll('.screen').forEach(sc=>sc.classList.remove('active'));
  const homeEl = document.getElementById('screen-analyse');
  if(homeEl) homeEl.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  const firstNavEl = document.querySelectorAll('.nav-item')[0];
  if(firstNavEl) firstNavEl.classList.add('active');

  // 3. Profile sync
  syncProfileForm();
  applyDietChips();
  updateTDEE();

  // 4. Render home (screen visible now, getElementById will find elements)
  try{ renderWeightChart();   }catch(e){ console.warn('[init]',e); }
  try{ renderCalorieRing();   }catch(e){ console.warn('[init]',e); }
  try{ renderStepsWidget();   }catch(e){ console.warn('[init]',e); }
  try{ renderHomeHeader();    }catch(e){ console.warn('[init]',e); }
  homePeriod = 'week';
  ['hbtn-week','hbtn-month','hbtn-3month'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.classList.toggle('active', id==='hbtn-week');
  });
  try{ renderHomeAnalytics(); }catch(e){ console.warn('[init]',e); }

  // 5. Water async
  initWaterForToday().then(()=>{
    try{ renderWaterWidget(); }catch(e){ console.warn('[init]',e); }
  });

  // 6. Background: frigo+agenda cache
  setTimeout(()=>{ try{renderFrigo();}catch(e){} try{renderAgenda();}catch(e){} }, 80);

  // 7. Misc listeners
  const fp = document.getElementById('frigo-popup-btn');
  if(fp) fp.onclick = openFrigoPopup;
}



// ============================================================

document.addEventListener('DOMContentLoaded',()=>{
  const btn=document.getElementById('estimation-send-btn');
  const inp=document.getElementById('estimation-input');
  if(btn) btn.addEventListener('click', runEstimation);
  if(inp){
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();runEstimation();} });
    inp.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,90)+'px'; });
  }
});
function bindEstimationInput(){
  const btn=document.getElementById('estimation-send-btn');
  const inp=document.getElementById('estimation-input');
  if(btn&&!btn._bound){ btn.addEventListener('click', runEstimation); btn._bound=true; }
  if(inp&&!inp._bound){
    inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();runEstimation();} });
    inp.addEventListener('input',function(){ this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,90)+'px'; });
    inp._bound=true;
  }
}
function applyTheme(){
  const mode = S.displayMode || (S.lightMode ? 'light' : 'dark');
  S.displayMode = mode;
  document.body.classList.remove('dark-mode','mao-mode');
  if(mode === 'dark') document.body.classList.add('dark-mode');
  if(mode === 'mao')  document.body.classList.add('mao-mode');
  // Update mode selector UI
  ['light','dark','mao'].forEach(m => {
    const opt   = document.getElementById('mode-opt-'+m);
    const check = document.getElementById('mode-check-'+m);
    if(opt){
      opt.style.borderColor = mode===m ? 'var(--green-dark)' : '';
      opt.style.background  = mode===m ? 'var(--green-pale)' : '';
    }
    if(check){
      check.style.background = mode===m ? 'var(--green-dark)' : 'var(--border)';
      check.style.opacity    = mode===m ? '1' : '.3';
    }
  });
  // Legacy checkbox
  const inp = document.getElementById('theme-checkbox');
  if(inp) inp.checked = mode==='dark';
  // Mao: change KALO to 卡洛
  const logoTxt = document.getElementById('header-logo-text');
  if(logoTxt){
    logoTxt.textContent = mode==='mao' ? '卡洛' : 'KALO';
    logoTxt.style.color = mode==='mao' ? '#C62828' : '';
  }
}
function setDisplayMode(mode){
  S.displayMode = mode;
  S.lightMode   = mode !== 'dark';
  save();
  applyTheme();
}
// ============================================================
// TOAST
// ============================================================
function showToast(msg, primaryLabel, primaryAction, duration=0){
  const t=document.getElementById('toast');
  document.getElementById('toast-msg').textContent=msg;
  const btn=document.getElementById('toast-primary-btn');
  btn.textContent=primaryLabel||'OK';
  btn.onclick=()=>{ hideToast(); if(primaryAction) primaryAction(); };
  t.classList.add('show');
  if(duration>0) setTimeout(hideToast, duration);
}
function hideToast(){
  document.getElementById('toast').classList.remove('show');
}

// ============================================================
// WEIGHT TRACKING
// ============================================================
function saveWeight(){
  const val=parseFloat(document.getElementById('weight-input')?.value);
  if(!val||val<30||val>300){alert('Veuillez saisir un poids valide (30–300 kg).');return;}
  const dateInput=document.getElementById('weight-popup-date');
  const selectedDate=(dateInput&&dateInput.value)||fullDateKey(new Date());
  if(!S.weightLog)S.weightLog=[];
  const ex=S.weightLog.findIndex(e=>e.date===selectedDate);
  if(ex!==-1){S.weightLog[ex].weight=val;}
  else{S.weightLog.push({date:selectedDate,weight:val});S.weightLog.sort((a,b)=>a.date.localeCompare(b.date));}
  if(S.weightLog.length>365)S.weightLog=S.weightLog.slice(-365);
  const prevWeight=parseFloat(S.profileWeight)||0;
  if(prevWeight&&selectedDate===fullDateKey(new Date())&&Math.abs(val-prevWeight)>=1){
    setTimeout(()=>showToast(`⚖️ Poids changé (${prevWeight}→${val}kg). Recalculer TDEE ?`,'Recalculer',()=>switchTab('profil')),500);
  }
  save(); saveWeightIDB(selectedDate,val);
  document.getElementById('weight-input').value='';
  renderWeightChart();
}

function renderWeightChart(){
  const svg=document.getElementById('weight-chart-svg');
  const stats=document.getElementById('weight-stats');
  if(!svg||!stats) return;
  const log=S.weightLog||[];
  // Update latest display
  const latestEl=document.getElementById('weight-latest-display');
  if(latestEl&&log.length>0)latestEl.textContent=log[log.length-1].weight+' kg';
  // Dummy log list ref (now in popup)
  const logList=null;
  if(logList){
    if(log.length===0){
      logList.innerHTML='';
    } else {
      const recent=[...log].reverse().slice(0,5);
      logList.innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Historique récent</div>`+
        recent.map((e,i)=>{
          const d=new Date(e.date);
          const lbl=`${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
          const h=S.profileHeight||parseInt(document.getElementById('profile-height')?.value)||170;
          const imc=h>0?Math.round((e.weight/((h/100)*(h/100)))*10)/10:null;
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--bg-tertiary);border-radius:8px;margin-bottom:4px;font-size:12px">
            <span style="color:var(--text-muted)">${lbl}</span>
            <span style="font-weight:700;color:var(--text)">${e.weight} kg${imc?` <span style="color:var(--text-muted);font-weight:400">· IMC ${imc}</span>`:''}</span>
            <div style="display:flex;gap:4px">
              <button onclick="editWeightEntry('${e.date}',${e.weight})" title="Modifier" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;color:var(--text-muted)">✏️</button>
              <button onclick="deleteWeightEntry('${e.date}')" title="Supprimer" style="background:none;border:1px solid var(--border);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:11px;color:var(--danger)">✕</button>
            </div>
          </div>`;
        }).join('');
    }
  }

  if(log.length<1){
    svg.innerHTML=`<text x="50%" y="50%" text-anchor="middle" fill="var(--text-muted)" font-size="12" font-family="DM Sans,sans-serif">Aucune donnée — enregistrez votre premier poids</text>`;
    stats.textContent='';
    return;
  }
  const W=360,H=180,padL=36,padR=36,padT=16,padB=28;
  const heights=(S.profileHeight||parseInt(document.getElementById('profile-height')?.value)||170);
  const hm=heights/100;
  const weights=log.map(e=>e.weight);
  const imcs=log.map(e=>Math.round((e.weight/(hm*hm))*10)/10);
  const minW=Math.min(...weights)-1.5, maxW=Math.max(...weights)+1.5;
  const minI=Math.min(...imcs)-0.5, maxI=Math.max(...imcs)+0.5;
  const n=log.length;
  const xScale=(i)=>padL+(i/(Math.max(n-1,1)))*(W-padL-padR);
  const yScaleW=(w)=>H-padB-((w-minW)/(maxW-minW||1))*(H-padT-padB);
  const yScaleI=(v)=>H-padB-((v-minI)/(maxI-minI||1))*(H-padT-padB);

  // Grid
  let svgStr=`
  <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${H-padB}" stroke="var(--border)" stroke-width="1"/>
  <line x1="${padL}" y1="${H-padB}" x2="${W-padR}" y2="${H-padB}" stroke="var(--border)" stroke-width="1"/>
  <line x1="${W-padR}" y1="${padT}" x2="${W-padR}" y2="${H-padB}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>`;

  // Y labels (weight left, IMC right)
  [minW,Math.round((minW+maxW)/2),maxW].forEach(w=>{
    const y=yScaleW(w);
    svgStr+=`<text x="${padL-4}" y="${y+4}" text-anchor="end" fill="var(--text-muted)" font-size="9" font-family="DM Sans,sans-serif">${w.toFixed(1)}</text>`;
  });
  if(n>=2){
    [minI,Math.round((minI+maxI)/2*10)/10,maxI].forEach(v=>{
      const y=yScaleI(v);
      svgStr+=`<text x="${W-padR+4}" y="${y+4}" text-anchor="start" fill="#2980b9" font-size="9" font-family="DM Sans,sans-serif">${v.toFixed(1)}</text>`;
    });
  }

  // Target weight line
  const target=parseFloat(S.profileTargetWeight)||0;
  if(target&&target>minW&&target<maxW){
    const ty=yScaleW(target);
    svgStr+=`<line x1="${padL}" y1="${ty}" x2="${W-padR}" y2="${ty}" stroke="var(--orange)" stroke-width="1.5" stroke-dasharray="5,4"/>
    <text x="${W-padR+2}" y="${ty+4}" fill="var(--orange)" font-size="9" font-family="DM Sans,sans-serif">🎯</text>`;
  }

  // IMC line (blue, secondary)
  if(n>=2){
    const imcPts=log.map((e,i)=>`${xScale(i)},${yScaleI(imcs[i])}`).join(' ');
    svgStr+=`<polyline points="${imcPts}" fill="none" stroke="#5dade2" stroke-width="1.5" stroke-dasharray="4,2" stroke-linejoin="round" opacity="0.8"/>`;
  }

  // Weight line (green, primary)
  if(n>=2){
    const pts=log.map((e,i)=>`${xScale(i)},${yScaleW(e.weight)}`).join(' ');
    svgStr+=`<polyline points="${pts}" fill="none" stroke="var(--green-glow)" stroke-width="2.5" stroke-linejoin="round"/>`;
  }

  // Dots for weight
  log.forEach((e,i)=>{
    const x=xScale(i),y=yScaleW(e.weight);
    svgStr+=`<circle cx="${x}" cy="${y}" r="3.5" fill="var(--green-dark)" stroke="var(--green-glow)" stroke-width="2">
      <title>${e.date}: ${e.weight}kg</title></circle>`;
    if(i===0||i===n-1||i%7===0){
      const d=new Date(e.date);
      const lbl=`${d.getDate()}/${d.getMonth()+1}`;
      svgStr+=`<text x="${x}" y="${H-padB+13}" text-anchor="middle" fill="var(--text-muted)" font-size="8" font-family="DM Sans,sans-serif">${lbl}</text>`;
    }
  });

  // Legend
  svgStr+=`<line x1="${padL+4}" y1="${padT+6}" x2="${padL+18}" y2="${padT+6}" stroke="var(--green-glow)" stroke-width="2.5"/>
  <text x="${padL+22}" y="${padT+10}" fill="var(--text-muted)" font-size="9" font-family="DM Sans,sans-serif">Poids (kg)</text>
  <line x1="${padL+80}" y1="${padT+6}" x2="${padL+94}" y2="${padT+6}" stroke="#5dade2" stroke-width="1.5" stroke-dasharray="4,2"/>
  <text x="${padL+98}" y="${padT+10}" fill="#5dade2" font-size="9" font-family="DM Sans,sans-serif">IMC</text>`;

  svg.innerHTML=svgStr;

  // Stats
  const first=log[0].weight, last=log[n-1].weight;
  const diff=Math.round((last-first)*10)/10;
  const sign=diff<=0?'':'+'
  const lastIMC=Math.round((last/(hm*hm))*10)/10;
  const toLose=target>0?Math.round((last-target)*10)/10:null;
  stats.innerHTML=`<strong>Poids :</strong> ${last} kg · <strong>IMC :</strong> ${lastIMC} · <strong>Progression :</strong> ${sign}${diff} kg${toLose!==null?` · <strong>${toLose>0?toLose+' kg restants':'Objectif atteint 🎉'}</strong>`:''}`;
}

function editWeightEntry(dateKey, currentWeight){
  const datePicker=document.getElementById('weight-date-input');
  const weightInput=document.getElementById('weight-input');
  if(datePicker) datePicker.value=dateKey;
  if(weightInput){ weightInput.value=currentWeight; weightInput.focus(); }
}
function deleteWeightEntry(dateKey){
  S.weightLog=(S.weightLog||[]).filter(e=>e.date!==dateKey);
  save(); renderWeightChart();
}

// ============================================================
// DIETARY RESTRICTIONS + FOOD PREFERENCES
// ============================================================
function toggleDiet(el, key){
  if(!S.dietRestrictions) S.dietRestrictions=[];
  el.classList.toggle('selected');
  if(el.classList.contains('selected')){
    if(!S.dietRestrictions.includes(key)) S.dietRestrictions.push(key);
  } else {
    S.dietRestrictions=S.dietRestrictions.filter(d=>d!==key);
  }
}
function applyDietChips(){
  if(!S.dietRestrictions) return;
  document.querySelectorAll('.diet-chip').forEach(c=>{
    const onclick=c.getAttribute('onclick')||'';
    const m=onclick.match(/'([^']+)'\)$/);
    if(m&&S.dietRestrictions.includes(m[1])) c.classList.add('selected');
  });
}
// Restricted ingredient keywords per diet
const DIET_RESTRICTIONS={
  gluten:['pain','pâtes','blé','boulgour','semoule','couscous','sarrasin','orge','avoine','farine'],
  vegetarien:['poulet','dinde','boeuf','porc','saumon','thon','cabillaud','crevette','viande','lard'],
  vegan:['poulet','dinde','boeuf','porc','saumon','thon','œuf','oeuf','lait','fromage','yaourt','crème','beurre'],
  lactose:['lait','fromage','yaourt','crème','beurre','lactosérum'],
  porc:['porc','lard','jambon','bacon','saucisse'],
  lowcarb:['riz','pâtes','pain','pomme de terre','maïs','sucre','miel','sirop']
};
function isIngAllowed(name){
  if(!S.dietRestrictions||!S.dietRestrictions.length) return true;
  const n=name.toLowerCase();
  for(const diet of S.dietRestrictions){
    const kws=DIET_RESTRICTIONS[diet]||[];
    if(kws.some(k=>n.includes(k))) return false;
  }
  // Check preferences
  if(S.preferences&&S.preferences.évité){
    if(S.preferences.évité.some(e=>n.includes(e.toLowerCase()))) return false;
  }
  return true;
}

// ============================================================
// RECIPE HISTORY — anti-repetition
// ============================================================
function addToRecipeHistory(name, ings){
  if(!S.recipeHistory) S.recipeHistory=[];
  const entry={name, date:fullDateKey(new Date()), ings:ings.map(i=>i.name.toLowerCase())};
  S.recipeHistory=S.recipeHistory.filter(r=>r.name!==name||r.date!==entry.date);
  S.recipeHistory.unshift(entry);
  if(S.recipeHistory.length>10) S.recipeHistory=S.recipeHistory.slice(0,10);
}
function findSimilarRecent(name, ings){
  if(!S.recipeHistory||!S.recipeHistory.length) return null;
  const ingNames=ings.map(i=>i.name.toLowerCase());
  const threeDaysAgo=new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate()-3);
  const thresholdKey=fullDateKey(threeDaysAgo);
  return S.recipeHistory.find(r=>{
    if(r.date<thresholdKey) return false;
    const overlap=r.ings.filter(i=>ingNames.includes(i)).length;
    return r.name===name||(overlap>=2&&overlap/Math.max(r.ings.length,ingNames.length,1)>0.6);
  });
}

// ============================================================
// DAY CONTEXT ANALYSIS — adaptive meal suggestions
// ============================================================
function analyzeDayContext(){
  const todayKey=fullDateKey(new Date());
  const meals=S.meals[todayKey]||[];
  const budget=S.budget||S.tdee;
  const consumed=meals.reduce((s,m)=>s+m.kcal,0);
  const remaining=budget-consumed;
  // Estimate macros from meals
  let totalG=0,totalP=0,totalL=0;
  meals.forEach(m=>{
    (m.ingredients||[]).forEach(ing=>{
      const r=estimateKcalVal(ing.name,String(ing.qty||100),ing.unit||'g');
      totalG+=r.g||0; totalP+=r.p||0; totalL+=r.l||0;
    });
    if(!(m.ingredients||[]).length){
      totalG+=Math.round(m.kcal*0.45/4);
      totalP+=Math.round(m.kcal*0.28/4);
      totalL+=Math.round(m.kcal*0.27/9);
    }
  });
  const maxG=(budget*0.45)/4;
  const maxP=(budget*0.28)/4;
  let suggestion='', contextMsg='';
  if(remaining<300&&remaining>0){
    suggestion='light'; contextMsg=`📊 Budget serré : ${remaining} kcal restantes. Je te propose quelque chose de très léger.`;
  } else if(totalG>maxG*0.5){
    suggestion='protein'; contextMsg=`📊 Tu as déjà bien couvert tes glucides (${Math.round(totalG)}g). Je favorise les protéines et légumes.`;
  } else if(totalP<maxP*0.3&&meals.length>0){
    suggestion='protein'; contextMsg=`📊 Peu de protéines aujourd'hui (${Math.round(totalP)}g). Je t'en propose davantage.`;
  } else if(consumed>0){
    contextMsg=`📊 ${consumed} kcal consommées · ${remaining} kcal restantes.`;
  }
  return {suggestion, contextMsg, consumed, remaining, totalG, totalP, totalL};
}

// ============================================================
// EVOCATIVE RECIPE NAMES + CONTEXT BADGES
// ============================================================
const RECIPE_NAME_TEMPLATES={
  déjeuner:{
    protein:['Bowl protéiné du marché','Assiette énergie midi','Combo force & légèreté'],
    light:['Bol léger du midi','Salade composée express','Assiette fraîcheur'],
    default:['Bowl du frigo','Assiette équilibrée midi','Combo du moment']
  },
  dîner:{
    protein:['Assiette protéinée du soir','Dîner récupération','Plat satiété nuit'],
    light:['Velouté rapide du soir','Soupe légère maison','Bol vapeur du soir'],
    default:['Dîner du frigo','Plat réconfortant soir','Bowl du soir']
  },
  'petit-déjeuner':{
    default:['Breakfast énergie','Bol du matin','Start protéiné']
  },
  snack:{
    default:['Collation équilibrée','En-cas malin','Snack satiété']
  }
};
function getEvocativeName(type, suggestion, mainIngs){
  const pool=RECIPE_NAME_TEMPLATES[type]||RECIPE_NAME_TEMPLATES['déjeuner'];
  const names=(suggestion&&pool[suggestion])||pool.default||['Repas du frigo'];
  let base=names[Math.floor(Math.random()*names.length)];
  // Add a key ingredient to personalize
  const ing=mainIngs[0];
  if(ing&&!base.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0])){
    // append ingredient to name
    const n=ing.name.split(' ')[0]; // first word
    const variants=[`${base} · ${n}`,base];
    base=variants[0];
  }
  return base;
}
function getContextBadges(kcal, macros, type){
  const badges=[];
  // Time estimate
  badges.push('⏱ 15-20 min');
  // Calorie level
  if(kcal<350) badges.push('🥗 Léger');
  else if(kcal>600) badges.push('💪 Consistant');
  else badges.push('⚖️ Équilibré');
  // Macro dominant
  const en=(macros.g||0)*4+(macros.p||0)*4+(macros.l||0)*9||1;
  if((macros.p||0)*4/en>0.35) badges.push('🏋️ Riche en protéines');
  if((macros.g||0)*4/en<0.25) badges.push('📉 Low-carb');
  if((macros.l||0)*4/en<0.2) badges.push('✨ Très allégé');
  return badges;
}

// ============================================================
// RELIABILITY BADGE
// ============================================================
function getReliabilityBadge(ings){
  if(!ings||!ings.length) return {cls:'estimated',label:'🟡 Estimé'};
  let unknown=0;
  for(const ing of ings){
    const n=ing.name.toLowerCase();
    // Check custom nutrition
    const custom=S.customNutrition&&Object.keys(S.customNutrition).find(k=>n.includes(k)||k.includes(n.split(' ')[0]));
    if(custom) continue;
    // Check DB
    const db=ingNutrition(ing.name);
    if(db.key==='?') unknown++;
  }
  if(unknown===0) return {cls:'verified',label:'🟢 Vérifié'};
  if(unknown<ings.length/2) return {cls:'estimated',label:'🟡 Estimé'};
  return {cls:'incomplete',label:'🔴 Incomplet'};
}

// ============================================================
// FRIGO PREFERENCES (liked/disliked)
// ============================================================
function togglePref(name, type){
  if(!S.preferences) S.preferences={aimé:[],évité:[]};
  const arr=S.preferences[type];
  const idx=arr.indexOf(name);
  if(idx===-1){ arr.push(name); }
  else { arr.splice(idx,1); }
  // Remove from other list if present
  const other=type==='aimé'?'évité':'aimé';
  S.preferences[other]=S.preferences[other].filter(n=>n!==name);
  save(); renderFrigo();
}

// ============================================================
