/**
 * KALO — onboarding.js
 */

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
  S.meals[k].push({
    name: lastEstimation.text.length>40 ? lastEstimation.text.slice(0,40)+'…' : lastEstimation.text,
    kcal: lastEstimation.kcal,
    type: S.selMealType||'snack',
    ingredients: lastEstimation.lines.map(l=>({name:l.name, qty:Math.round(l.grams), unit:'g'}))
  });
  save(); updateChatKcal();
  document.getElementById('estimation-add-bar').style.display='none';
  addEstimationMsg(`✅ Ajouté à l'agenda du ${dayLabel(S.selDate)} — ${lastEstimation.kcal} kcal enregistrées.`);
}

// Wire up estimation input
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

