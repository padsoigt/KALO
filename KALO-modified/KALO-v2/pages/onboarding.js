/**
 * KALO — onboarding.js
 */

function renderStats(){
  updateTDEE();
  const days=getDays(curPeriod);
  const n=days.length;
  const total=days.reduce((s,d)=>s+kcalForDate(d),0);
  const active=days.filter(d=>kcalForDate(d)>0);
  const avg=active.length?Math.round(total/active.length):0;
  const deficit=Math.max(0,Math.round(S.tdee*n-total));
  const periodLbl={today:'ce jour',week:'sur 7 jours',month:'sur 30 jours','3month':'sur 90 jours'}[curPeriod];
  document.getElementById('stats-grid').innerHTML=`
    <div class="stat-card"><div class="sicon">🟠</div><div class="sval">${avg}<span class="sunit"> kcal</span></div><div class="slbl">Moyenne / jour<br><small>TDEE: ${S.tdee} kcal</small></div></div>
    <div class="stat-card"><div class="sicon">🟢</div><div class="sval">${total}<span class="sunit"> kcal</span></div><div class="slbl">Consommé total<br><small>${periodLbl}</small></div></div>
    <div class="stat-card" style="grid-column:span 2"><div class="sicon">📉</div><div class="sval">${deficit}<span class="sunit"> kcal</span></div><div class="slbl">Déficit calorique total <small>${periodLbl}</small></div></div>`;
  renderBarChart(days);
  renderMacroBars(days, periodLbl);
}

function renderMacroBars(days, periodLbl){
  const totalKcal=days.reduce((s,d)=>s+kcalForDate(d),0);
  if(!totalKcal){
    document.getElementById('macro-period-lbl').textContent=`${periodLbl} — aucune donnée`;
    document.getElementById('macro-bars').innerHTML='<p style="font-size:13px;color:var(--text-muted);text-align:center;padding:10px 0">Aucun repas enregistré sur cette période</p>';
    return;
  }
  const hasEggs=allIng().some(i=>i.toLowerCase().includes('oeuf'));
  const hasCereals=S.ingredients.céréales&&S.ingredients.céréales.length>0;
  const pctG=hasCereals?48:40; const pctP=hasEggs?28:22; const pctL=100-pctG-pctP;
  const gramG=Math.round((totalKcal*pctG/100)/4);
  const gramP=Math.round((totalKcal*pctP/100)/4);
  const gramL=Math.round((totalKcal*pctL/100)/9);
  document.getElementById('macro-period-lbl').textContent=`Estimé ${periodLbl} · ${totalKcal} kcal total`;
  document.getElementById('macro-bars').innerHTML=`
    <div class="macro-bar-item"><div class="macro-bar-row"><span class="mname">🍞 Glucides</span><span class="mval">${gramG}g · ${pctG}%</span></div><div class="macro-prog"><div class="macro-fill" style="width:${pctG}%;background:#F4A261"></div></div></div>
    <div class="macro-bar-item"><div class="macro-bar-row"><span class="mname">🥩 Protéines</span><span class="mval">${gramP}g · ${pctP}%</span></div><div class="macro-prog"><div class="macro-fill" style="width:${pctP}%;background:var(--green-dark)"></div></div></div>
    <div class="macro-bar-item"><div class="macro-bar-row"><span class="mname">🥑 Lipides</span><span class="mval">${gramL}g · ${pctL}%</span></div><div class="macro-prog"><div class="macro-fill" style="width:${pctL}%;background:#457B9D"></div></div></div>`;
}

function renderBarChart(days){
  const chart=document.getElementById('bar-chart'); if(!chart) return;
  const dn=['D','L','M','M','J','V','S'];
  const mNames=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  let bars=[];
  if(curPeriod==='today'||curPeriod==='week'){
    bars=days.map(d=>({label:dn[d.getDay()],kcal:kcalForDate(d)}));
  } else if(curPeriod==='month'){
    // Group by real calendar weeks of the current month
    const weeks=[]; let week=[];
    days.forEach(d=>{
      if(d.getDay()===1&&week.length){weeks.push(week);week=[];}
      week.push(d);
    });
    if(week.length) weeks.push(week);
    bars=weeks.map((w,i)=>({label:`S${i+1}`,kcal:w.reduce((s,d)=>s+kcalForDate(d),0)}));
  } else {
    // 3 months: group by month
    const byMonth={};
    days.forEach(d=>{
      const k=`${d.getFullYear()}-${d.getMonth()}`;
      if(!byMonth[k]) byMonth[k]={label:mNames[d.getMonth()],kcal:0};
      byMonth[k].kcal+=kcalForDate(d);
    });
    bars=Object.values(byMonth);
  }
  const tdeePerBar=curPeriod==='week'?S.tdee:curPeriod==='month'?S.tdee*7:S.tdee*30;
  const max=Math.max(...bars.map(b=>b.kcal),tdeePerBar,1);
  chart.innerHTML=bars.map(b=>`<div class="bar-group">
    <div class="bar ${b.kcal===0?'empty':''}" style="height:${b.kcal===0?4:Math.max((b.kcal/max)*78,4)}px"></div>
    <span class="bar-lbl">${b.label}</span>
  </div>`).join('');
}

// ============================================================

// ONBOARDING
// ============================================================
let obGender='homme', obActivity='sedentaire', obGoal='deficit_modere';

function obSetGender(g){
  obGender=g;
  document.getElementById('ob-btn-homme').classList.toggle('active',g==='homme');
  document.getElementById('ob-btn-femme').classList.toggle('active',g==='femme');
}
function obSetActivity(el,val){
  obActivity=val;
  document.querySelectorAll('#ob-activity .ob-act-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
}
function obSetGoal(el,val){
  obGoal=val;
  document.querySelectorAll('#ob-goal .ob-goal-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  // Show/focus custom input if custom selected
  if(val==='custom'){
    setTimeout(()=>document.getElementById('ob-custom-deficit')?.focus(),50);
  }
  obUpdateCustomDeficit();
}
function obUpdateCustomDeficit(){
  const val=parseInt(document.getElementById('ob-custom-deficit')?.value)||600;
  const kgWeek=Math.round(val/7000*7*100)/100;
  const el=document.getElementById('ob-custom-kgweek');
  if(el) el.textContent=`~${kgWeek} kg/sem`;
  if(obGoal==='custom') S.customDeficit=val;
}

function obCalc(){
  const age=parseInt(document.getElementById('ob-age')?.value)||26;
  const w=parseFloat(document.getElementById('ob-weight')?.value)||70;
  const h=parseInt(document.getElementById('ob-height')?.value)||170;
  let bmr=obGender==='homme'?10*w+6.25*h-5*age+5:10*w+6.25*h-5*age-161;
  const actMap={sedentaire:1.2,leger:1.375,modere:1.55,actif:1.725};
  const tdee=Math.round(bmr*(actMap[obActivity]||1.2));
  bmr=Math.round(bmr);
  // Deficit: preset or custom
  const customVal=parseInt(document.getElementById('ob-custom-deficit')?.value)||600;
  const defMap={deficit_doux:250,deficit_modere:500,deficit_fort:750,maintien:0,custom:customVal};
  const deficit=defMap[obGoal]||500;
  const budget=Math.max(1200,tdee-deficit); // safety floor 1200 kcal
  return {bmr,tdee,deficit,budget};
}

function obNext(step){
  if(step===0){
    const name=document.getElementById('ob-name').value.trim();
    const age=document.getElementById('ob-age').value;
    const w=document.getElementById('ob-weight').value;
    const h=document.getElementById('ob-height').value;
    if(!name||!age||!w||!h){alert('Veuillez remplir tous les champs.');return;}
    document.getElementById('ob-step-0').classList.remove('active');
    document.getElementById('ob-step-1').classList.add('active');
    document.getElementById('ob-dot-0').classList.remove('active');
    document.getElementById('ob-dot-1').classList.add('active');
  } else if(step===1){
    const {bmr,tdee,deficit,budget}=obCalc();
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('ob-bmr-val',`${bmr} kcal`);
    set('ob-tdee-val',`${tdee} kcal`);
    set('ob-deficit-val',`−${deficit} kcal`);
    set('ob-budget-val',`${budget} kcal/jour`);
    document.getElementById('ob-step-1').classList.remove('active');
    document.getElementById('ob-step-2').classList.add('active');
    document.getElementById('ob-dot-1').classList.remove('active');
    document.getElementById('ob-dot-2').classList.add('active');
  }
}
function obBack(step){
  if(step===1){
    document.getElementById('ob-step-1').classList.remove('active');
    document.getElementById('ob-step-0').classList.add('active');
    document.getElementById('ob-dot-1').classList.remove('active');
    document.getElementById('ob-dot-0').classList.add('active');
  } else if(step===2){
    document.getElementById('ob-step-2').classList.remove('active');
    document.getElementById('ob-step-1').classList.add('active');
    document.getElementById('ob-dot-2').classList.remove('active');
    document.getElementById('ob-dot-1').classList.add('active');
  }
}
function obFinish(){
  const name=document.getElementById('ob-name').value.trim();
  const age=parseInt(document.getElementById('ob-age').value)||26;
  const weight=parseFloat(document.getElementById('ob-weight').value)||70;
  const height=parseInt(document.getElementById('ob-height').value)||170;
  const {bmr,tdee,deficit,budget}=obCalc();
  S.profileName=name; S.profileAge=age; S.profileWeight=weight;
  S.profileHeight=height; S.profileTargetWeight='';
  S.gender=obGender; S.activity=obActivity; S.goal=obGoal;
  S.tdee=tdee; S.budget=budget; S.onboardingDone=true;
  if(obGoal==='custom') S.customDeficit=parseInt(document.getElementById('ob-custom-deficit')?.value)||600;
  save();
  document.getElementById('onboarding-screen').style.display='none';
  initApp();
}

function syncProfileForm(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!==undefined&&v!==''&&v!==0)el.value=v;};
  set('profile-name',S.profileName);
  // Steps goal
  if(S.stepsGoal){ const sg=document.getElementById('steps-goal-input'); if(sg&&!sg.value) sg.value=S.stepsGoal; }
  set('profile-age',S.profileAge);
  set('profile-weight',S.profileWeight);
  set('profile-height',S.profileHeight);
  set('profile-target-weight',S.profileTargetWeight);
  // Custom deficit
  if(S.customDeficit) set('profile-custom-deficit',S.customDeficit);
  // Water goal
  const wg=document.getElementById('water-goal-input');
  if(wg) wg.value=S.waterGoal||2000;
  document.getElementById('btn-homme')?.classList.toggle('active',S.gender==='homme');
  document.getElementById('btn-femme')?.classList.toggle('active',S.gender==='femme');
  // Activity
  document.querySelectorAll('.activity-opt').forEach(o=>{
    o.classList.toggle('selected',(o.getAttribute('onclick')||'').includes(`'${S.activity}'`));
  });
  // Goal
  document.querySelectorAll('#goal-options .activity-opt').forEach(o=>{
    o.classList.toggle('selected',(o.getAttribute('onclick')||'').includes(`'${S.goal}'`));
  });
  // Update kg/week display for custom
  if(S.customDeficit){
    const kgWeek=Math.round(S.customDeficit/7000*7*100)/100;
    const el=document.getElementById('profile-custom-kgweek');
    if(el) el.textContent=`~${kgWeek} kg/sem`;
  }
  updateIMC();
}

// ============================================================
// CSV EXPORT
// ============================================================
function generateCSVData(){
  const days = getDays(curPeriod);
  const budget = S.budget||S.tdee;
  const periodLabels = {today:"Aujourd'hui", week:'1 semaine', month:'1 mois', '3month':'3 mois'};
  const userName = S.profileName||'Utilisateur';
  const mealTypeLabels = {'petit-déjeuner':'Petit-déjeuner','déjeuner':'Déjeuner','dîner':'Dîner','snack':'Snack','':`Sans type`};

  // BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';

  // Header block
  const headerLines = [
    `KALO — Export nutritionnel`,
    `Utilisateur;${userName}`,
    `Période;${periodLabels[curPeriod]||curPeriod}`,
    `Budget journalier;${budget} kcal`,
    `TDEE;${S.tdee} kcal`,
    `Exporté le;${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,
    ``
  ];

  // Column headers
  const cols = [
    'Date','Jour','Type de repas','Nom du repas',
    'Calories (kcal)','Protéines (g)','Glucides (g)','Lipides (g)',
    'Ingrédients','Budget jour (kcal)','Consommé jour (kcal)','Solde jour (kcal)'
  ];

  const rows = [cols.join(';')];

  // Day-by-day data
  const monthNames = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  const dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

  for(const date of days){
    const key = fullDateKey(date);
    const meals = S.meals[key]||[];
    const dayKcalTotal = meals.reduce((s,m)=>s+m.kcal,0);
    const solde = budget - dayKcalTotal;
    const dateStr = `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    const jourStr = dayNames[date.getDay()];

    if(meals.length === 0){
      // Day with no meals
      rows.push([
        dateStr, jourStr, '', 'Aucun repas enregistré',
        '0','','','',
        '', budget, 0, budget
      ].map(v=>String(v).replace(/;/g,' ')).join(';'));
    } else {
      const mealOrder = ['petit-déjeuner','déjeuner','dîner','snack'];
      const sorted = [...meals].sort((a,b)=>mealOrder.indexOf(a.type)-mealOrder.indexOf(b.type));

      sorted.forEach((meal, idx) => {
        // Estimate macros from ingredients if available
        let prot=0, gluc=0, lip=0;
        const ings = meal.ingredients||[];
        if(ings.length){
          ings.forEach(ing=>{
            const r = estimateKcalVal(ing.name, String(ing.qty||100), ing.unit||'g');
            prot += r.p||0; gluc += r.g||0; lip += r.l||0;
          });
        } else {
          // Estimate from kcal using average ratios
          gluc = Math.round(meal.kcal*0.45/4);
          prot = Math.round(meal.kcal*0.28/4);
          lip  = Math.round(meal.kcal*0.27/9);
        }
        const ingsStr = ings.length
          ? ings.map(i=>`${i.name} ${i.qty||''}${i.unit||'g'}`).join(' | ')
          : '';

        // Only show day total on first meal of the day
        const isFirst = idx === 0;
        rows.push([
          isFirst ? dateStr : '',
          isFirst ? jourStr : '',
          mealTypeLabels[meal.type]||meal.type||'',
          meal.name||'',
          meal.kcal,
          prot, gluc, lip,
          ingsStr,
          isFirst ? budget : '',
          isFirst ? dayKcalTotal : '',
          isFirst ? solde : ''
        ].map(v=>String(v).replace(/;/g,' ').replace(/\n/g,' ')).join(';'));
      });

      // Day subtotal separator
      rows.push([
        '', '', 'TOTAL JOUR', '',
        dayKcalTotal, '', '', '',
        '', '', '', solde > 0 ? `Déficit: ${solde} kcal` : `Excédent: ${Math.abs(solde)} kcal`
      ].map(v=>String(v)).join(';'));
      rows.push(''); // blank line between days
    }
  }

  // Summary block at the end
  const allMeals = days.flatMap(d=>S.meals[fullDateKey(d)]||[]);
  const totalKcal = allMeals.reduce((s,m)=>s+m.kcal,0);
  const activeDays = days.filter(d=>(S.meals[fullDateKey(d)]||[]).length>0).length;
  const avgKcal = activeDays ? Math.round(totalKcal/activeDays) : 0;
  const deficitTotal = Math.max(0, budget*days.length - totalKcal);

  rows.push('');
  rows.push(`RÉCAPITULATIF PÉRIODE;;;;;;;;;;`);
  rows.push(`Total calories consommées;${totalKcal} kcal;;;;;;;;;`);
  rows.push(`Moyenne / jour actif;${avgKcal} kcal;;;;;;;;;`);
  rows.push(`Jours actifs;${activeDays} / ${days.length};;;;;;;;;`);
  rows.push(`Déficit calorique total;${deficitTotal} kcal;;;;;;;;;`);
  rows.push(`Budget journalier;${budget} kcal;;;;;;;;;`);

  return BOM + headerLines.join('\n') + rows.join('\n');
}

function previewCSV(){
  const csv = generateCSVData();
  const preview = document.getElementById('export-preview');
  const lines = csv.split('\n').slice(0,20); // first 20 lines
  preview.textContent = lines.join('\n') + (csv.split('\n').length>20?'\n[...]':'');
  preview.style.display = 'block';
}

function exportCSV(){
  const csv = generateCSVData();
  const periodLabels = {today:'aujourd_hui', week:'7_jours', month:'30_jours', '3month':'3_mois'};
  const filename = `KALO_export_${periodLabels[curPeriod]||curPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// ============================================================
// CHAT SUB-TABS
// ============================================================
function switchChatTab(tab){
  const isConseil = tab==='conseil';
  document.getElementById('chat-tab-conseil').style.display = isConseil?'flex':'none';
  document.getElementById('chat-tab-estimation').style.display = isConseil?'none':'flex';
  const sc=document.getElementById('subtab-conseil');
  const se=document.getElementById('subtab-estimation');
  sc.style.background=isConseil?'var(--green-dark)':'transparent';
  sc.style.color=isConseil?'var(--text)':'var(--text-muted)';
  sc.style.fontWeight=isConseil?'700':'600';
  se.style.background=isConseil?'transparent':'var(--green-dark)';
  se.style.color=isConseil?'var(--text-muted)':'var(--text)';
  se.style.fontWeight=isConseil?'600':'700';
  if(!isConseil){
    setTimeout(()=>{ bindEstimationInput(); document.getElementById('estimation-input')?.focus(); },100);
  }
}

// ============================================================
// ESTIMATION ENGINE — natural language food calorie calculator
// ============================================================

// Portion keywords and their gram equivalents
const PORTION_MAP = {
  // Pieces
  'maki':18, 'sushi':25, 'california':30, 'nigiri':30, 'temaki':100,
  'biscuit':10, 'cookie':15, 'gâteau':80, 'part':120, 'tranche':30,
  'carré':5, 'cube':15, 'boule':60, 'part de pizza':120, 'pizza':350,
  'burger':200, 'sandwich':180, 'wrap':180, 'crêpe':60, 'pancake':50,
  'omelette':150, 'œuf':60, 'oeuf':60, 'banane':120, 'pomme':150,
  'orange':160, 'kiwi':80, 'datte':8, 'noix':5, 'amande':1.2,
  // Containers
  'bol':250, 'assiette':300, 'verre':200, 'tasse':240,
  'cuillère à soupe':15, 'cuillère à café':5, 'cs':15, 'cc':5,
  // Standard portions
  'portion':100, 'part':120,
};

// Quantity words
const QUANTITY_WORDS = {
  'un':1,'une':1,'deux':2,'trois':3,'quatre':4,'cinq':5,
  'six':6,'sept':7,'huit':8,'neuf':9,'dix':10,
  'une dizaine':10,'une douzaine':12,'une vingtaine':20,
  'demi':0.5,'moitié':0.5,
};

// Parse a food description and return estimated nutrition
function parseAndEstimateFood(text){
  const low = text.toLowerCase().trim();
  const lines = [];
  let totalKcal=0, totalP=0, totalG=0, totalL=0;

  // Split by common separators: et, +, virgule, point-virgule
  const parts = low.split(/\bet\b|[,;+]|\bavec\b/).map(p=>p.trim()).filter(Boolean);

  for(const part of parts){
    const result = parseFoodPart(part);
    if(result){
      lines.push(result);
      totalKcal += result.kcal;
      totalP += result.p;
      totalG += result.g;
      totalL += result.l;
    }
  }

  return {lines, totalKcal:Math.round(totalKcal), totalP:Math.round(totalP), totalG:Math.round(totalG), totalL:Math.round(totalL)};
}

function parseFoodPartBase(text){
  let qty = 1;
  let grams = null;
  let foodName = text.trim();

  // 1. Extract explicit weight: "300g", "150 g", "0.5kg", "200ml"
  const weightMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammes?|kg|ml|cl|l)\b/i);
  if(weightMatch){
    let val = parseFloat(weightMatch[1].replace(',','.'));
    const unit = weightMatch[2].toLowerCase();
    if(unit==='kg') val*=1000;
    else if(unit==='cl') val*=10;
    else if(unit==='l') val*=1000;
    grams = val;
    foodName = text.replace(weightMatch[0],'').trim();
  }

  // 2. Extract quantity number: "20 makis", "3 œufs"
  const numMatch = foodName.match(/^(\d+(?:[.,]\d+)?)\s+/);
  if(numMatch && !grams){
    qty = parseFloat(numMatch[1].replace(',','.'));
    foodName = foodName.slice(numMatch[0].length).trim();
  }

  // 3. Extract quantity word: "deux biscuits", "une pomme"
  if(!numMatch && !grams){
    for(const [word, val] of Object.entries(QUANTITY_WORDS)){
      if(foodName.startsWith(word+' ') || foodName===word){
        qty = val;
        foodName = foodName.slice(word.length).trim();
        break;
      }
    }
  }

  // 4. Check portion map for known units
  if(!grams){
    for(const [portion, portionGrams] of Object.entries(PORTION_MAP)){
      if(foodName.includes(portion)){
        grams = portionGrams * qty;
        break;
      }
    }
  }

  // 5. Default grams if still unknown
  if(!grams) grams = 100 * qty;

  // 6. Find nutritional data for the food
  // Clean food name: remove preparation words
  const cleanName = foodName
    .replace(/\b(au|à la|avec|sans|de|du|des|le|la|les|un|une|cuit[es]?|cru[es]?|grillé[es]?|poché[es]?|frit[es]?)\b/g,'')
    .replace(/\s+/g,' ').trim();

  const data = ingNutrition(cleanName) || ingNutrition(foodName);
  if(!data || data.key==='?'){
    // Try sub-words
    const words = cleanName.split(' ').filter(w=>w.length>3);
    let found = null;
    for(const w of words){
      const d = ingNutrition(w);
      if(d && d.key!=='?'){ found=d; break; }
    }
    if(!found) return {name:foodName, qty, grams, kcal:Math.round(80*grams/100), p:Math.round(4*grams/100), g:Math.round(10*grams/100), l:Math.round(2*grams/100), estimated:true};
    const f = grams/100;
    return {name:foodName, qty, grams, kcal:Math.round(found.kcal*f), p:Math.round((found.p||0)*f), g:Math.round((found.g||0)*f), l:Math.round((found.l||0)*f), estimated:false};
  }

  const f = grams/100;
  return {
    name: foodName, qty, grams,
    kcal: Math.round(data.kcal*f),
    p: Math.round((data.p||0)*f),
    g: Math.round((data.g||0)*f),
    l: Math.round((data.l||0)*f),
    estimated: data.key==='?'
  };
}

// Specialized DB for composite/restaurant foods not well covered by per-100g DB
let COMPOSITE_FOODS = {}; // chargé par loadNutritionFiles()

// Extend parseFoodPart to check COMPOSITE_FOODS first
function parseFoodPart(text){
  const low = text.toLowerCase().trim();
  let qty=1, foodKey=null, match=null;

  // Extract leading number
  const numM = low.match(/^(\d+(?:[.,]\d+)?)\s+/);
  if(numM){ qty=parseFloat(numM[1].replace(',','.')); }
  const textNoQty = numM ? low.slice(numM[0].length).trim() : low;

  // Check COMPOSITE_FOODS (longest match wins)
  let bestKey=null, bestLen=0;
  for(const key of Object.keys(COMPOSITE_FOODS)){
    if(textNoQty.includes(key) && key.length>bestLen){ bestKey=key; bestLen=key.length; }
  }

  if(bestKey){
    const cf = COMPOSITE_FOODS[bestKey];
    // Respect explicit weight if provided
    const wM = text.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|kg)\b/i);
    let grams;
    if(wM){
      let v=parseFloat(wM[1].replace(',','.'));
      if(wM[2].toLowerCase()==='kg') v*=1000;
      grams=v;
      qty=1;
    } else {
      grams = cf.grams * qty;
    }
    const f = cf.unit==='pièce' ? qty : grams/100;
    const perF = cf.unit==='pièce' ? 1 : 1/100;
    return {
      name: bestKey, qty, grams,
      kcal: Math.round(cf.kcal * (cf.unit==='pièce' ? qty : grams/100)),
      p: Math.round(cf.p * (cf.unit==='pièce' ? qty : grams/100)),
      g: Math.round(cf.g * (cf.unit==='pièce' ? qty : grams/100)),
      l: Math.round(cf.l * (cf.unit==='pièce' ? qty : grams/100)),
      estimated: false,
      unitLabel: cf.unit
    };
  }

  // Fall back to original
  return parseFoodPartBase(text);
}

function addEstimationMsg(html, from='bot'){
  const c=document.getElementById('estimation-messages');
  const d=document.createElement('div');
  d.className='msg'+(from==='user'?' user':'');
  if(from==='user') d.innerHTML=`<div class="msg-bubble">${html}</div>`;
  else d.innerHTML=`<div class="msg-avatar">${LOGO_SVG}</div><div class="msg-bubble" style="max-width:90%">${html}</div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}

function showEstimationTyping(){
  const c=document.getElementById('estimation-messages');
  const d=document.createElement('div'); d.className='msg'; d.id='est-typing';
  d.innerHTML=`<div class="msg-avatar">${LOGO_SVG}</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}
function removeEstimationTyping(){ const t=document.getElementById('est-typing'); if(t) t.remove(); }

function runEstimation(){
  const input = document.getElementById('estimation-input');
  const text = input.value.trim();
  if(!text) return;
  input.value=''; input.style.height='auto';
  addEstimationMsg(text,'user');
  showEstimationTyping();

  setTimeout(()=>{
    removeEstimationTyping();
    const result = parseAndEstimateFood(text);

    if(!result.lines.length){
      addEstimationMsg(`Je n'ai pas reconnu d'aliment. Essayez d'être plus précis, ex : "20 makis saumon", "300g de pâtes cuites".`);
      return;
    }

    // Build detail table
    const rows = result.lines.map(l=>{
      const cruEntry = getCruCuitEntry(l.name);
      const cruNote = cruEntry ? ` <span style="font-size:10px;color:var(--text-muted)">(cru → ${Math.round(l.grams*cruEntry.ratio)}g cuit)</span>` : '';
      return `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px;color:var(--text)">${l.name}${cruNote} <span style="font-size:11px;color:var(--text-muted)">${l.grams}g</span></span>
        <span style="font-size:13px;font-weight:700;color:var(--green-glow)">${l.kcal} kcal</span>
      </div>`;
    }).join('');

    const hasEstimated = result.lines.some(l=>l.estimated);
    const reliability = hasEstimated ? '🟡 Certaines valeurs sont estimées' : '🟢 Toutes les valeurs sont vérifiées';
    const budget = S.budget||S.tdee;
    const todayKey = fullDateKey(new Date());
    const consumed = (S.meals[todayKey]||[]).reduce((s,m)=>s+m.kcal,0);
    const remaining = budget - consumed;
    const pctOfBudget = Math.round(result.totalKcal/budget*100);

    lastEstimation = {text, kcal:result.totalKcal, lines:result.lines};

    const html = `
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px">Estimation pour : <strong style="color:var(--text)">${text}</strong></div>
      <div style="margin-bottom:10px">${rows}</div>
      <div style="background:var(--bg-tertiary);border-radius:10px;padding:12px 14px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-size:13px;font-weight:700;color:var(--text)">Total estimé</span>
          <span style="font-size:20px;font-weight:800;color:var(--green-glow);text-shadow:0 0 8px rgba(45,170,82,0.4)">${result.totalKcal} kcal</span>
        </div>
        <div style="display:flex;gap:8px;font-size:11px;color:var(--text-muted);margin-bottom:8px">
          <span>🍞 G: ${result.totalG}g</span>
          <span>🥩 P: ${result.totalP}g</span>
          <span>🥑 L: ${result.totalL}g</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:3px;overflow:hidden;margin-bottom:6px">
          <div style="height:100%;width:${Math.min(pctOfBudget,100)}%;background:${pctOfBudget>50?pctOfBudget>85?'var(--danger)':'var(--orange)':'var(--green-glow)'};border-radius:3px"></div>
        </div>
        <div style="font-size:11px;color:var(--text-muted)">${pctOfBudget}% de votre budget journalier · ${Math.max(0,remaining-result.totalKcal)} kcal restantes après</div>
      </div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:6px">${reliability}</div>`;

    addEstimationMsg(html);
    document.getElementById('estimation-add-bar').style.display='block';
  }, 900);
}

function addEstimationToAgenda(){
  if(!lastEstimation) return;
  const k=fullDateKey(S.selDate);
  if(!S.meals[k]) S.meals[k]=[];
  const _ep=Math.round(lastEstimation.totalP||lastEstimation.lines.reduce((s,l)=>s+(l.p||0),0));
  const _eg=Math.round(lastEstimation.totalG||lastEstimation.lines.reduce((s,l)=>s+(l.g||0),0));
  const _el=Math.round(lastEstimation.totalL||lastEstimation.lines.reduce((s,l)=>s+(l.l||0),0));
  S.meals[k].push({
    name: lastEstimation.text.length>40 ? lastEstimation.text.slice(0,40)+'…' : lastEstimation.text,
    kcal: lastEstimation.kcal,
    type: S.selMealType||'snack',
    proteines:_ep, glucides:_eg, lipides:_el,
    ingredients: lastEstimation.lines.map(l=>({name:l.name, qty:Math.round(l.grams), unit:'g'}))
  });
  save(); updateChatKcal();
  document.getElementById('estimation-add-bar').style.display='none';
  addEstimationMsg(`✅ Ajouté à l'agenda du ${dayLabel(S.selDate)} — ${lastEstimation.kcal} kcal enregistrées.`);
}

// Wire up estimation input
