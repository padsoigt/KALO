/**
 * KALO — nutrition.js
 */

// MODULE: Nutrition — données depuis data/*.json (pas dans le code)
// ============================================================
let NUTRITION_DB = [];
const KCAL_MAP   = {};

async function loadNutritionFiles(){
  // Detect file:// protocol — fetch won't work
  const isFileProtocol = window.location.protocol === 'file:';
  if(isFileProtocol){
    console.warn('[Nutrition] Mode local (file://) — données nutritionnelles non disponibles via fetch. Utilisez un serveur HTTP (npx serve . ou VS Code Live Server).');
    // App stays functional without nutrition data
    return false;
  }
  try{
    const base = window._KALO_BASE || '.';
    const [fRes,cRes,convRes] = await Promise.all([
      fetch(`${base}/data/nutrition.json`),
      fetch(`${base}/data/composite_foods.json`),
      fetch(`${base}/data/conversions_cuisson.json`),
    ]);
    const foods = await fRes.json();
    const comps = await cRes.json();
    const convs = await convRes.json();

    // Build NUTRITION_DB legacy format
    NUTRITION_DB.length = 0;
    foods.forEach(f => {
      NUTRITION_DB.push({n:f.nom, kcal:f.kcal, p:f.proteines, g:f.glucides, l:f.lipides, f:f.fibres||0});
      KCAL_MAP[f.nom.toLowerCase()] = {kcal:f.kcal, g:f.glucides, p:f.proteines, l:f.lipides, f:f.fibres||0};
    });

    // Build CRU_CUIT
    convs.forEach(c => {
      CRU_CUIT[c.aliment] = {
        kcal_cru:c.kcal_cru_100g, p_cru:c.proteines_cru,
        g_cru:c.glucides_cru, l_cru:c.lipides_cru, ratio:c.ratio_cuisson,
      };
    });

    // Build COMPOSITE_FOODS
    comps.forEach(c => {
      COMPOSITE_FOODS[c.nom] = {
        kcal:c.kcal, p:c.proteines, g:c.glucides, l:c.lipides,
        unit:c.unite, grams:c.poids_unite_g,
      };
    });

    // Load custom user foods into KCAL_MAP
    if(_idb){
      try{
        const customs = await idbAll('customFoods');
        customs.forEach(cf => {
          if(cf.nom) KCAL_MAP[cf.nom.toLowerCase()] = {
            kcal:cf.kcal, g:cf.glucides||0, p:cf.proteines||0,
            l:cf.lipides||0, f:cf.fibres||0
          };
        });
      }catch(e){}
    }

    console.log(`[Nutrition] ${NUTRITION_DB.length} aliments + ${comps.length} plats + ${convs.length} conversions`);
    return true;
  }catch(e){
    console.warn('[Nutrition] Chargement JSON échoué (mode local sans serveur) :', e.message);
    console.warn('→ Ouvrez index.html via un serveur HTTP (ex: npx serve . ou VS Code Live Server)');
    return false;
  }
}



// Cas spéciaux : œuf compté par unité
// Œuf moyen ~55g = 78 kcal | grand ~60g = 86 kcal
const UNIT_OVERRIDE = {
  'oeuf': {kcalPerUnit:78, gramsPerUnit:55, p:6.5, g:0.4, l:5.3},
  'œuf':  {kcalPerUnit:78, gramsPerUnit:55, p:6.5, g:0.4, l:5.3},
};

function toGrams(qty, unit){
  if(unit==='kg') return qty*1000;
  if(unit==='L')  return qty*1000;
  if(unit==='ml') return qty;
  if(unit==='u')  return qty; // handled via UNIT_OVERRIDE
  return qty; // grams
}

function ingNutrition(name){
  const n = name.toLowerCase().trim()
    .replace(/[éèêë]/g,'e').replace(/[àâ]/g,'a')
    .replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u');

  // 0. User-defined custom nutrition takes priority (packaged products)
  if(S.customNutrition){
    const customKey=Object.keys(S.customNutrition).find(k=>n.includes(k)||k.includes(n.split(' ')[0]));
    if(customKey) return {key:customKey, ...S.customNutrition[customKey]};
  }

  // 1. Exact match (normalized)
  const normMap = {};
  for(const [k,v] of Object.entries(KCAL_MAP)){
    const kn=k.replace(/[éèêë]/g,'e').replace(/[àâ]/g,'a').replace(/[îï]/g,'i').replace(/[ôö]/g,'o').replace(/[ùûü]/g,'u');
    normMap[kn] = v;
  }
  if(normMap[n]) return {key:n, ...normMap[n]};

  // 2. Longest matching key (prevents short keys over-matching)
  let best=null, bestLen=0;
  for(const [k,v] of Object.entries(normMap)){
    if(n.includes(k) && k.length>bestLen){ best={key:k,...v}; bestLen=k.length; }
  }
  if(best) return best;

  // 3. Partial word match (first significant word)
  const firstWord = n.split(' ')[0];
  if(firstWord.length>=4){
    for(const [k,v] of Object.entries(normMap)){
      if(k.includes(firstWord)){ return {key:k,...v}; }
    }
  }

  // 4. Category fallback
  if(['legume','chou','salade','verdure','poireau'].some(v=>n.includes(v))) return {key:'légume',kcal:25,g:5,p:2,l:0.2,f:2};
  if(['fruit','baie'].some(v=>n.includes(v))) return {key:'fruit',kcal:50,g:12,p:0.5,l:0.2,f:2};
  if(['viande','steak','filet'].some(v=>n.includes(v))) return {key:'viande',kcal:165,g:0,p:25,l:5,f:0};
  if(['poisson','filet'].some(v=>n.includes(v))) return {key:'poisson',kcal:100,g:0,p:20,l:2,f:0};
  if(['legumineuse','haricot','pois','lentille'].some(v=>n.includes(v))) return {key:'légumineuse',kcal:130,g:22,p:9,l:0.5,f:7};
  return {key:'?', kcal:80, g:10, p:4, l:2, f:1};
}

// ============================================================
// CONVERSIONS CRU ↔ CUIT
// Règle : calories calculées sur poids CRU, toujours.
// Si "cuit" dans le nom → back-calculer le poids cru équivalent.
// Si "cru" (ou rien) → utiliser directement le poids saisi.
// Aucune double conversion possible.
// ============================================================
let CRU_CUIT = {}; // chargé par loadNutritionFiles()

function normStr(s){ return s.toLowerCase().replace(/[\u00e9\u00e8\u00ea\u00eb]/g,'e').replace(/[\u00e0\u00e2]/g,'a').replace(/[\u00ee\u00ef]/g,'i').replace(/[\u00f4\u00f6]/g,'o').replace(/[\u00f9\u00fb\u00fc]/g,'u'); }

function getCruCuitEntry(name){
  const n=normStr(name);
  let best=null, bestLen=0;
  for(const [k,v] of Object.entries(CRU_CUIT)){
    const kn=normStr(k);
    if(n.includes(kn)&&kn.length>bestLen){best={key:k,...v};bestLen=kn.length;}
  }
  return best;
}

function isExplicitlyCooked(name){
  const n=name.toLowerCase();
  return n.includes('cuit')||n.includes('boite')||n.includes('bo\u00eete')||n.includes('conserve')||n.includes('egoutte');
}

const PROTEIN_LOSS={poulet:0.75,dinde:0.75,boeuf:0.70,steak:0.72,porc:0.75,saumon:0.80,cabillaud:0.78,crevette:0.80,thon:0.75};
function getProteinLoss(name){const n=name.toLowerCase();for(const [k,v] of Object.entries(PROTEIN_LOSS)){if(n.includes(k))return v;}return null;}

function getCookingRatio(name){return null;} // compat stub

function checkMacroCoherence(kcal,g,p,l){
  if(!kcal)return{ok:true,warning:null};
  const theoretical=(g*4)+(p*4)+(l*9);
  const ratio=Math.abs(theoretical-kcal)/kcal;
  if(ratio>0.15)return{ok:false,warning:`V\u00e9rification : ${g}g G\u00d74 + ${p}g P\u00d74 + ${l}g L\u00d79 = ${theoretical} kcal th\u00e9oriques vs ${kcal} kcal (\u00e9cart ${Math.round(ratio*100)}%)`,theoretical};
  return{ok:true,warning:null,theoretical};
}

function estimateKcalVal(name,qty,unit){
  const n=name.toLowerCase().trim();
  const numQty=parseFloat(qty)||100;
  // 1. Oeufs par unit\u00e9
  const eggKey=Object.keys(UNIT_OVERRIDE).find(k=>n.includes(k));
  if(eggKey&&unit==='u'){
    const ov=UNIT_OVERRIDE[eggKey];const count=numQty;
    return{kcal:Math.round(ov.kcalPerUnit*count),g:Math.round(ov.g*count),p:Math.round(ov.p*count),l:Math.round(ov.l*count),f:0,detail:`${count} \u0153uf(s) \u00d7 ${ov.kcalPerUnit} kcal/unit\u00e9 = ${Math.round(ov.kcalPerUnit*count)} kcal`,rawNote:null,coherenceWarning:null};
  }
  const grams=toGrams(numQty,unit||'g');
  const cruEntry=getCruCuitEntry(name);
  const cooked=isExplicitlyCooked(name);
  if(cruEntry&&!cooked){
    // Poids CRU saisi
    const factor=grams/100;
    const kcal=Math.round(cruEntry.kcal_cru*factor);
    const gM=Math.round(cruEntry.g_cru*factor),pM=Math.round(cruEntry.p_cru*factor),lM=Math.round(cruEntry.l_cru*factor);
    const cuitG=Math.round(grams*cruEntry.ratio);
    const rawNote=`Cru \u2192 ${cuitG}g cuit \u00b7 calories calcul\u00e9es sur ${grams}g cru`;
    const detail=`${grams}g cru \u00d7 ${cruEntry.kcal_cru} kcal/100g = ${kcal} kcal (\u2248${cuitG}g cuit)`;
    const coherence=checkMacroCoherence(kcal,gM,pM,lM);
    return{kcal,g:gM,p:pM,l:lM,f:0,detail,rawNote,coherenceWarning:coherence.ok?null:coherence.warning};
  } else if(cruEntry&&cooked){
    // Poids CUIT saisi \u2192 back-calculer le poids cru
    const rawG=grams/cruEntry.ratio;
    const factor=rawG/100;
    const kcal=Math.round(cruEntry.kcal_cru*factor);
    const gM=Math.round(cruEntry.g_cru*factor),pM=Math.round(cruEntry.p_cru*factor),lM=Math.round(cruEntry.l_cru*factor);
    const rawNote=`Cuit \u2192 ${Math.round(rawG)}g cru \u00e9quivalent`;
    const detail=`${grams}g cuit = ${Math.round(rawG)}g cru \u00d7 ${cruEntry.kcal_cru} kcal/100g = ${kcal} kcal`;
    const coherence=checkMacroCoherence(kcal,gM,pM,lM);
    return{kcal,g:gM,p:pM,l:lM,f:0,detail,rawNote,coherenceWarning:coherence.ok?null:coherence.warning};
  } else {
    // Standard
    const data=ingNutrition(name);
    const factor=grams/100;
    const kcal=Math.round(data.kcal*factor);
    const gM=Math.round((data.g||0)*factor),pM=Math.round((data.p||0)*factor),lM=Math.round((data.l||0)*factor),fM=Math.round((data.f||0)*factor);
    const loss=getProteinLoss(name);
    const rawNote=loss?`Peser cru \u2014 cuit \u2248 ${Math.round(grams*loss)}g`:null;
    const detail=`${grams}g \u00d7 ${data.kcal} kcal/100g = ${kcal} kcal${rawNote?' ('+rawNote+')':''}`;
    const coherence=checkMacroCoherence(kcal,gM,pM,lM);
    const finalKcal=coherence.ok?kcal:Math.round(coherence.theoretical||kcal);
    return{kcal:finalKcal,g:gM,p:pM,l:lM,f:fM,detail,rawNote,coherenceWarning:coherence.ok?null:coherence.warning};
  }
}
// Build detailed breakdown — now shows cru/cuit note + coherence warnings
function buildBreakdown(rows){
  let totalKcal=0, totalG=0, totalP=0, totalL=0, totalF=0;
  const lines=[];
  rows.forEach(row=>{
    const isEdit = row.id.includes('eir');
    const id = isEdit ? row.id.replace('eir-','') : row.id.replace('ir-','');
    const pre = isEdit ? 'e' : '';
    const name = document.getElementById(pre+'ii-'+id)?.value?.trim();
    const qty  = document.getElementById(pre+'iq-'+id)?.value?.trim();
    const unit = document.getElementById(pre+'iu-'+id)?.value||'g';
    if(!name) return;
    const r = estimateKcalVal(name, qty, unit);
    totalKcal+=r.kcal; totalG+=r.g; totalP+=r.p; totalL+=r.l; totalF+=(r.f||0);
    lines.push({name, detail:r.detail, kcal:r.kcal, warn:r.coherenceWarning, rawNote:r.rawNote});
  });
  // Final coherence check on totals
  const totalCoherence = checkMacroCoherence(totalKcal, totalG, totalP, totalL);
  return {totalKcal, totalG, totalP, totalL, totalF, lines, totalCoherence};
}

function estimateKcal(){
  const rows=[...document.querySelectorAll('#ing-list .ing-row')];
  const {totalKcal,totalG,totalP,totalL,totalF,lines,totalCoherence}=buildBreakdown(rows);

  const detailHtml = lines.map(l=>`
    <div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:600;color:var(--text)">${l.name}</span>
        <span style="color:var(--green-glow);font-weight:700">${l.kcal} kcal</span>
      </div>
      <div style="color:var(--text-muted);font-size:10.5px">${l.detail}</div>
      ${l.warn?`<div style="color:#e67e22;font-size:10px;margin-top:1px">⚠️ ${l.warn}</div>`:''}
    </div>`).join('');

  const coherenceHtml = !totalCoherence.ok
    ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(192,154,26,0.15);border-radius:8px;font-size:11px;color:var(--orange)">⚠️ ${totalCoherence.warning}</div>`
    : `<div style="margin-top:6px;font-size:10.5px;color:var(--green-glow)">✅ Cohérence macros vérifiée (${Math.round(totalCoherence.theoretical||totalKcal)} kcal théoriques)</div>`;

  // Note on fibres
  const fibreNote = totalF > 0
    ? `<div style="font-size:10px;color:var(--text-muted);margin-top:3px">💡 Fibres (${totalF}g) incluses dans glucides — non comptées en kcal séparément</div>`
    : '';

  document.getElementById('kcal-result-num').innerHTML=
    `<div style="font-size:22px;font-weight:700;color:var(--green-glow);margin-bottom:6px">${totalKcal} kcal</div>
     ${detailHtml}
     <div style="margin-top:8px;font-size:12px;font-weight:600;color:var(--text-muted)">G: ${totalG}g &nbsp;|&nbsp; P: ${totalP}g &nbsp;|&nbsp; L: ${totalL}g &nbsp;|&nbsp; F: ${totalF}g</div>
     ${coherenceHtml}
     ${fibreNote}`;
  document.getElementById('kcal-result').style.display='block';
  document.getElementById('btn-save-meal').style.display='block';
  document.getElementById('btn-save-meal').dataset.kcal=totalKcal;
}
function saveMeal(){
  const name=document.getElementById('new-meal-name').value.trim()||'Repas';
  const rows=[...document.querySelectorAll('#ing-list .ing-row')];
  const ingredients=[];
  let totalKcal=0;
  rows.forEach(row=>{
    const id=row.id.replace('ir-','');
    const iname=(document.getElementById('ii-'+id)||{}).value?.trim();
    const qty=parseFloat((document.getElementById('iq-'+id)||{}).value)||100;
    const unit=(document.getElementById('iu-'+id)||{}).value||'g';
    if(iname){ ingredients.push({name:iname,qty,unit}); totalKcal+=estimateKcalVal(iname,qty,unit).kcal; }
  });
  const storedKcal=parseInt(document.getElementById('btn-save-meal').dataset.kcal);
  const kcal=storedKcal||totalKcal;
  const k=fullDateKey(S.selDate);
  if(!S.meals[k]) S.meals[k]=[];
  S.meals[k].push({name,kcal,type:S.selMealType,ingredients});
  save(); closeMealModal(); renderAgenda();
}

// ============================================================
// EDIT MEAL MODAL
// ============================================================
let editKey=null, editIdx=null, editRowCnt=0, editMealType='déjeuner';

function openEditMealModal(key,idx){
  const meal=(S.meals[key]||[])[idx];
  if(!meal) return;
  editKey=key; editIdx=idx; editMealType=meal.type||'déjeuner';

  document.getElementById('edit-meal-name').value=meal.name||'';

  // Set correct type chip
  document.querySelectorAll('#edit-type-chips .type-chip').forEach(c=>{
    c.classList.toggle('selected', c.getAttribute('onclick').includes(`'${meal.type}'`));
  });

  // Reset ingredient list
  editRowCnt=0;
  const list=document.getElementById('edit-ing-list');
  list.innerHTML='';

  const ings=meal.ingredients||[];
  if(ings.length>0){
    // Meal has stored ingredients — restore them all
    ings.forEach(ing=>addEditIngRow(ing.name, ing.qty, ing.unit||'g'));
  } else {
    // Meal has no ingredient detail (added via chat or manually without ingredients)
    // Show a helpful placeholder message + one empty row to add
    const infoRow=document.createElement('div');
    infoRow.style.cssText='padding:10px 12px;font-size:12px;color:var(--text-muted);background:var(--bg-tertiary);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px';
    infoRow.innerHTML='<span style="font-size:16px">ℹ️</span> Ce repas n\'a pas de détail ingrédients. Ajoutez-en ci-dessous pour affiner les calories.';
    list.appendChild(infoRow);
    addEditIngRow();
  }

  // Show current kcal
  document.getElementById('edit-kcal-result').style.display='block';
  document.getElementById('edit-kcal-result-num').innerHTML=
    `<div style="font-size:20px;font-weight:700;color:var(--green-glow)">${meal.kcal} kcal</div>
     <div style="font-size:11px;color:var(--text-muted);margin-top:3px">Valeur actuelle — cliquez "Estimer" après modification pour recalculer</div>`;
  document.getElementById('btn-update-meal').dataset.kcal=meal.kcal;
  document.getElementById('edit-meal-modal').classList.add('open');
}
function closeEditMealModal(){document.getElementById('edit-meal-modal').classList.remove('open');}

function selectEditMealType(el,type){
  editMealType=type;
  document.querySelectorAll('#edit-type-chips .type-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}

function addEditIngRow(name='',qty=100,unit='g'){
  const id=++editRowCnt;
  const row=document.createElement('div');
  row.className='ing-row'; row.id='eir-'+id;
  row.innerHTML=`<div style="width:100%">
    <div class="ing-search-wrap">
      <input class="ing-input" id="eii-${id}" placeholder="Ingrédient du frigo..." autocomplete="off" value="${name}"
        oninput="editIngSearch(${id},this.value)" onblur="setTimeout(()=>hideEditSugg(${id}),180)">
      <div class="ing-sugg" id="eis-${id}"></div>
    </div>
    <div id="eih-${id}" style="display:none;font-size:10px;color:var(--green-glow);padding:2px 0 0 2px;font-weight:600"></div>
  </div>
  <div class="qty-unit-wrap">
    <input class="qty-input" id="eiq-${id}" type="number" value="${qty}" min="1">
    <select class="unit-select" id="eiu-${id}">
      <option value="g" ${unit==='g'?'selected':''}>g</option>
      <option value="kg" ${unit==='kg'?'selected':''}>kg</option>
      <option value="L" ${unit==='L'?'selected':''}>L</option>
      <option value="ml" ${unit==='ml'?'selected':''}>ml</option>
      <option value="u" ${unit==='u'?'selected':''}>u</option>
    </select>
  </div>
  <button class="rem-row-btn" onclick="remEditRow(${id})">✕</button>`;
  document.getElementById('edit-ing-list').appendChild(row);
}
function remEditRow(id){const el=document.getElementById('eir-'+id);if(el)el.remove();}
function editIngSearch(id,val){
  const sugg=document.getElementById('eis-'+id);
  if(val.length<2){sugg.style.display='none';return;}
  const m=allIng().filter(i=>i.toLowerCase().includes(val.toLowerCase())).slice(0,5);
  if(!m.length){sugg.style.display='none';return;}
  sugg.style.display='block';
  sugg.innerHTML=m.map(i=>`<div class="ing-sugg-item" onmousedown="pickEditIng(${id},'${Q(i)}')">${i}</div>`).join('');
}
function hideEditSugg(id){const el=document.getElementById('eis-'+id);if(el)el.style.display='none';}
function pickEditIng(id,name){
  document.getElementById('eii-'+id).value=name;
  hideEditSugg(id);
  const ratio=getCookingRatio(name);
  const hint=document.getElementById('eih-'+id);
  if(hint&&ratio){
    if(ratio.type==='cereal'||ratio.type==='legume'){
      hint.textContent=`⚖️ Peser cru (×${ratio.cooked_ratio} à cuisson)`;
      hint.style.display='block';
    } else if(ratio.type==='protein'){
      hint.textContent=`⚖️ Peser cru — cuit ≈ ×${ratio.water_loss}`;
      hint.style.display='block';
    }
  }
}

function estimateEditKcal(){
  const rows=[...document.querySelectorAll('#edit-ing-list .ing-row')];
  const {totalKcal,totalG,totalP,totalL,totalF,lines,totalCoherence}=buildBreakdown(rows);

  const detailHtml = lines.map(l=>`
    <div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between">
        <span style="font-weight:600;color:var(--text)">${l.name}</span>
        <span style="color:var(--green-glow);font-weight:700">${l.kcal} kcal</span>
      </div>
      <div style="color:var(--text-muted);font-size:10.5px">${l.detail}</div>
      ${l.warn?`<div style="color:#e67e22;font-size:10px">⚠️ ${l.warn}</div>`:''}
    </div>`).join('');

  const coherenceHtml = !totalCoherence.ok
    ? `<div style="margin-top:6px;padding:6px 8px;background:rgba(192,154,26,0.15);border-radius:8px;font-size:11px;color:var(--orange)">⚠️ ${totalCoherence.warning}</div>`
    : `<div style="margin-top:6px;font-size:10.5px;color:var(--green-glow)">✅ Cohérence macros vérifiée</div>`;

  document.getElementById('edit-kcal-result-num').innerHTML=
    `<div style="font-size:22px;font-weight:700;color:var(--green-glow);margin-bottom:6px">${totalKcal} kcal</div>
     ${detailHtml}
     <div style="margin-top:8px;font-size:12px;font-weight:600;color:var(--text-muted)">G: ${totalG}g &nbsp;|&nbsp; P: ${totalP}g &nbsp;|&nbsp; L: ${totalL}g &nbsp;|&nbsp; F: ${totalF}g</div>
     ${coherenceHtml}`;
  document.getElementById('edit-kcal-result').style.display='block';
  document.getElementById('btn-update-meal').dataset.kcal=totalKcal;
}

function updateMeal(){
  const name=document.getElementById('edit-meal-name').value.trim()||'Repas';
  const rows=[...document.querySelectorAll('#edit-ing-list .ing-row')];
  const ingredients=[];
  let computedKcal=0;
  rows.forEach(row=>{
    const id=row.id.replace('eir-','');
    if(!id||isNaN(parseInt(id))) return; // skip info row
    const iname=(document.getElementById('eii-'+id)||{}).value?.trim();
    const qty=parseFloat((document.getElementById('eiq-'+id)||{}).value)||100;
    const unit=(document.getElementById('eiu-'+id)||{}).value||'g';
    if(iname){
      ingredients.push({name:iname,qty,unit});
      computedKcal+=estimateKcalVal(iname,String(qty),unit).kcal;
    }
  });
  // Use re-estimated value if the user clicked "Estimer", otherwise use computed from current rows
  const manualKcal=parseInt(document.getElementById('btn-update-meal').dataset.kcal)||0;
  // If ingredients were changed (computedKcal differs from manualKcal by >5%), use computed
  const kcal = ingredients.length>0 ? computedKcal : (manualKcal||computedKcal);
  if(S.meals[editKey]&&S.meals[editKey][editIdx]!==undefined){
    S.meals[editKey][editIdx]={name,kcal,type:editMealType,ingredients};
  }
  save(); closeEditMealModal(); renderAgenda();
}

// ============================================================
// CHAT IA
// ============================================================
function updateChatKcal(){
  const todayKey=fullDateKey(new Date());
  const kcal=(S.meals[todayKey]||[]).reduce((s,m)=>s+m.kcal,0);
  const budget=S.budget||S.tdee;
  const pct=Math.min((kcal/budget)*100,100);
  document.getElementById('chat-kcal-display').textContent=`${kcal} / ${budget} kcal`;
  document.getElementById('chat-prog').style.width=pct+'%';
  document.getElementById('chat-prog').style.background=pct>90?'#e74c3c':'var(--green)';
}

function getCookModes(){return [...document.querySelectorAll('.cook-chip.selected')].map(b=>b.dataset.mode||b.textContent.trim());}



// ============================================================
// CONTEXT BUILDER — injects budget, history, variety rules
// from the nutrition prompt spec
// ============================================================
function getDayContext(){
  const todayKey = fullDateKey(new Date());
  const meals = S.meals[todayKey]||[];
  const consumed = meals.reduce((s,m)=>s+m.kcal,0);
  const dailyBudget = S.budget||S.tdee; // use deficit-adjusted budget
  const remaining = dailyBudget - consumed;

  // Collect today's proteins and carb bases for variety rules
  const todayProteins = [], todayCarbs = [];
  const proteinKeywords = ['poulet','dinde','saumon','thon','oeuf','œuf','pois chiche','lentille','haricot','tofu','boeuf','porc','cabillaud'];
  const carbKeywords = ['riz','pâte','quinoa','lentille','patate douce','pomme de terre','couscous','boulgour','pain'];
  meals.forEach(m=>{
    const mn = (m.name||'').toLowerCase();
    proteinKeywords.forEach(k=>{ if(mn.includes(k)) todayProteins.push(k); });
    carbKeywords.forEach(k=>{ if(mn.includes(k)) todayCarbs.push(k); });
    // Also check ingredients if stored
    (m.ingredients||[]).forEach(ing=>{
      const in_ = ing.name.toLowerCase();
      proteinKeywords.forEach(k=>{ if(in_.includes(k)) todayProteins.push(k); });
      carbKeywords.forEach(k=>{ if(in_.includes(k)) todayCarbs.push(k); });
    });
  });

  return {
    consumed, remaining, meals,
    todayProteins: [...new Set(todayProteins)],
    todayCarbs: [...new Set(todayCarbs)],
    mealTypes: meals.map(m=>m.type)
  };
}
const MACRO_TARGETS = {
  'petit-déjeuner': {
    label:'Petit-déjeuner',
    kcalTarget: 350,
    pPct:25, gPct:50, lPct:25,   // moderate protein, higher carbs for energy
    note:'Glucides prioritaires pour l\'énergie matinale, protéines modérées.'
  },
  'déjeuner': {
    label:'Déjeuner',
    kcalTarget: 500,
    pPct:35, gPct:40, lPct:25,   // high protein, moderate carbs
    note:'Protéines élevées, glucides modérés pour énergie stable.'
  },
  'dîner': {
    label:'Dîner',
    kcalTarget: 450,
    pPct:40, gPct:30, lPct:30,   // high protein, low carbs (avoid excess evening carbs)
    note:'Protéines prioritaires, glucides limités — légumes favorisés.'
  },
  'snack': {
    label:'Snack',
    kcalTarget: 200,
    pPct:30, gPct:40, lPct:30,
    note:'Collation légère, privilégier protéines + fibres pour la satiété.'
  }
};

// Default quantities (grams) optimised per ingredient role
const ING_QTY={
  'œufs':120,'oeufs':120,'fromage bleu':30,'avocat':80,
  'patate douce':130,'pomme de terre':130,'panais':130,
  'brocoli':150,'carottes':120,'oignon':70,
  'poireau':100,'pois chiches':130,'lentille':130,
  'riz':80,'tomates':120,'betterave rouge':100
};
function defaultQty(name){
  const k=name.toLowerCase();
  for(const [key,val] of Object.entries(ING_QTY)){if(k.includes(key)) return val;}
  return 100;
}
function ingData(name){
  // Reuse KCAL_MAP from the estimation engine
  return ingNutrition(name);
}

// Recipe templates — ingredient candidates per meal type
const RECIPE_TEMPLATES={
  déjeuner:[
    {name:'Bowl protéiné du frigo',
     ings:['Pois chiches','Œufs','Brocoli','Carottes','Oignon','Tomates','Riz'],
     steps:{
       Vapeur:`🥚 **Œufs durs parfaits** : plonger dans l'eau froide, porter à ébullition, couper le feu et laisser 10 min à couvert — le jaune reste tendre sans être caoutchouteux.\n\n🥦 **Vapeur express** : placer brocoli et carottes (coupées en rondelles de 1cm) dans le panier vapeur. 8 min pour le brocoli → il doit être vert vif et légèrement croquant. 12 min pour les carottes → elles doivent céder sous la pointe d'un couteau sans s'écraser.\n\n💡 **Astuce** : assaisonnez les légumes encore chauds — ils absorbent mieux le sel et les épices.\n\n🧆 **Pois chiches** : égoutter et rincer, réchauffer 3 min à la poêle sèche à feu vif pour leur donner une légère croûte dorée.\n\n🍽️ Dresser en bowl : légumes, pois chiches croustillants, œufs coupés en deux. Finir avec un filet de citron et du poivre noir fraîchement moulu.`,
       Four:`🔥 **Préchauffer le four à 220°C** — température haute essentielle pour caraméliser sans dessécher.\n\n🥕 **Couper les légumes en cubes de 2cm** réguliers — taille uniforme = cuisson uniforme. Carottes et panais en premier car plus denses.\n\n💡 **Astuce four** : disposer sur plaque en une seule couche sans que les morceaux se touchent. Si entassés → ils cuisent à la vapeur et restent mous. Espacés → ils rôtissent et caramélisent.\n\n⏱️ **25-30 min à 220°C** : retourner à mi-cuisson. Les légumes sont prêts quand les bords sont dorés et légèrement croustillants.\n\n🧆 **Pois chiches rôtis** : ajouter sur la plaque les 10 dernières minutes pour qu'ils deviennent croustillants.\n\n🥚 Pendant ce temps : cuire les œufs durs (10 min eau bouillante). Dresser en bowl sur les légumes chauds sortis du four.`,
       Grill:`🔥 **Préchauffer le grill/plancha à feu vif** — il doit être très chaud avant de déposer quoi que ce soit (test : une goutte d'eau doit s'évaporer instantanément).\n\n🥕 **Couper les carottes en tranches diagonales de 8mm** — plus de surface de contact = plus de marques de grill et de saveur.\n\n🥦 **Brocoli** : couper en grosses fleurs. Les badigeonner légèrement d'eau avant de griller — évite qu'elles brûlent avant d'être cuites.\n\n⏱️ **4 min sans bouger** d'un côté, puis retourner. La règle d'or du grill : on ne touche pas. Les marques de grill se forment uniquement si on laisse le légume en contact direct et immobile.\n\n💡 **Astuce** : les légumes grillés continuent de cuire hors du feu — sortir légèrement avant la cuisson souhaitée.\n\n🥚 Cuire les œufs à la coque (6 min eau bouillante, jaune coulant) pour un résultat onctueux qui remplace une sauce.`,
       Cru:`🥕 **Carottes** : éplucher et tailler en julienne fine (bâtonnets de 3mm) plutôt qu'en rondelles — meilleure texture et meilleure absorption de l'assaisonnement.\n\n🍅 **Tomates** : couper en quartiers, pas en dés — elles gardent mieux leur jus et leur chair.\n\n💡 **Astuce cru** : saler les légumes 5 min avant de dresser, les rincer légèrement et les éponger. Ce "dégorgeage" rapide les rend plus tendres et intensifie leur goût.\n\n🧆 **Pois chiches** : égoutter et sécher sur papier absorbant pour une texture ferme et non collante.\n\n🥚 **Œufs mollets** (7 min eau bouillante, refroidir immédiatement sous eau froide) : le blanc est ferme, le jaune encore crémeux — bien supérieur à l'œuf dur pour un plat cru.\n\n🍽️ Dresser avec un filet de citron, poivre noir, et quelques feuilles d'herbes fraîches si disponibles.`,
       default:`🧅 **Faire revenir l'oignon** 5 min à feu moyen-doux dans une poêle légèrement huilée — il doit devenir translucide et légèrement doré, pas brûlé.\n\n🥕 Ajouter les légumes coupés en morceaux réguliers. Couvrir et cuire 10 min à feu moyen — la vapeur emprisonnée accélère la cuisson.\n\n🧆 Ajouter les pois chiches les 5 dernières minutes.\n\n🥚 Pendant ce temps, cuire les œufs durs séparément.\n\nAssaisonner avec sel, poivre et dresser en bowl.`
     }},
    {name:'Omelette légumes & fromage',
     ings:['Œufs','Fromage bleu','Oignon','Tomates','Brocoli','Carottes'],
     steps:{
       Poêle:`🥚 **Les œufs** : battre vigoureusement à la fourchette jusqu'à ce que le blanc et le jaune soient parfaitement homogènes — 30 secondes minimum. Saler et poivrer maintenant, pas après.\n\n🧅 **Oignon** : émincer finement. Faire revenir à feu moyen avec une noisette de beurre (ou à sec) **3-4 min** jusqu'à translucide. Un oignon insuffisamment cuit reste âcre et indigeste.\n\n💡 **La technique omelette** : verser les œufs battus sur l'oignon. Feu DOUX. Avec une spatule, ramener les bords vers le centre toutes les 15 secondes en inclinant la poêle. Arrêter quand le dessus est encore légèrement brillant (pas totalement sec).\n\n🧀 **Fromage** : émietter le fromage bleu sur une moitié de l'omelette encore baveuse — il fondra avec la chaleur résiduelle sans devenir caoutchouteux.\n\n🍅 **Tomates crues** : ajouter après cuisson sur le dessus — leur fraîcheur contraste avec le gras du fromage.\n\n🍽️ Replier et servir immédiatement — une omelette se mange dès la sortie de la poêle.`,
       Cru:`🍅 **Légumes crus préparés** : couper tomates en brunoise (petits dés de 5mm), oignon haché très finement. Mélanger avec une pincée de sel 5 min avant — les arômes se libèrent.\n\n🥚 **Omelette express** : battre 3 œufs, sel, poivre. Poêle chaude (feu moyen-vif), verser et laisser figer 2 min sans toucher — on veut une omelette fine et rapide, pas baveuse cette fois.\n\n🧀 **Fromage** : émietter sur l'omelette chaude hors du feu.\n\n💡 **Le principe du contraste** : le chaud de l'omelette + le froid et l'acidité des légumes crus crée une expérience de texture intéressante. La fraîcheur des tomates "nettoie" le gras du fromage.\n\n🍽️ Déposer les légumes crus et le fromage sur l'omelette repliée. Ne pas chauffer les légumes — leur croquant est voulu.`,
       default:`🥚 Battre 3 œufs vigoureusement, sel et poivre. Faire revenir l'oignon à feu moyen 3 min. Verser les œufs, cuire à feu doux en ramenant les bords vers le centre. Ajouter le fromage et les légumes avant de replier. Servir immédiatement.`
     }}
  ],
  dîner:[
    {name:'Soupe de légumes légère',
     ings:['Poireau','Carottes','Oignon','Betterave rouge','Panais','Brocoli'],
     steps:{
       Bouilli:`🧅 **Base aromatique** : émincer finement oignon et le blanc du poireau. Les faire revenir à sec (sans matière grasse) dans la casserole à feu moyen **5 min** jusqu'à légère coloration — cette étape "Maillard" crée de la profondeur de goût.\n\n🥕 **Légumes** : couper en rondelles ou cubes de taille similaire (2-3cm) pour une cuisson uniforme. Les plus denses d'abord : carottes, panais. Le brocoli seulement les 5 dernières minutes — il devient gris si trop cuit.\n\n💧 **Couvrir d'eau froide** (pas chaude) — démarrer à froid permet aux arômes de mieux se diffuser dans le bouillon. Porter à ébullition, puis réduire à feu doux.\n\n⏱️ **25 min à frémissement** — des petites bulles, pas un gros bouillon. Le bouillonnement violent détruit les saveurs délicates.\n\n💡 **Texture** : mixer partiellement (pas tout) pour avoir à la fois de la consistance et des morceaux. Une soupe entièrement mixée perd en intérêt.\n\n🧂 Assaisonner **toujours en fin de cuisson** — le sel se concentre à la cuisson.`,
       Mijoté:`🍲 **Le mijotage, c'est la patience** : feu au minimum, couvercle légèrement entrouvert pour laisser l'excès de vapeur s'échapper sans dessécher.\n\n🧅 **Oignon et poireau** : émincer et mettre directement dans la cocotte froide avec 2-3 cuillères à soupe d'eau. Porter à feu doux — ils vont fondre lentement pendant 8 min sans dorer. C'est la base d'un velouté doux.\n\n🥕 **Tous les légumes** coupés en morceaux similaires, recouverts d'eau à hauteur. **35-40 min** à feu très doux — on doit à peine voir frémir la surface.\n\n💡 **Pourquoi mijoter ?** La cuisson lente préserve les vitamines (moins de chaleur violente) et laisse les sucres naturels se concentrer — la soupe sera naturellement sucrée et ronde en bouche sans ajout de sucre.\n\n🍽️ Mixer en velouté total, passer au chinois si vous souhaitez une texture ultra-soyeuse. Ajuster la consistance avec l'eau de cuisson.`,
       Vapeur:`💧 **Vapeur** : remplir le fond de la casserole de 3cm d'eau. Porter à ébullition vive avant de déposer le panier.\n\n🥕 **Ordre de cuisson** : carottes et panais en premier (15 min), puis brocoli et poireau (8 min supplémentaires) — chaque légume a son temps optimal.\n\n💡 **Avantage vapeur** : les nutriments ne partent pas dans l'eau de cuisson. Le goût naturel de chaque légume est préservé au maximum.\n\n🍹 **Le bouillon** : l'eau de cuisson vapeur se charge en nutriments — la récupérer pour mixer la soupe avec, c'est un concentré de vitamines.\n\n🔄 Mixer les légumes cuits avec l'eau de cuisson tiède. Commencer avec peu de liquide et ajuster — mieux vaut une soupe épaisse qu'on dilue qu'une soupe trop liquide.\n\n🧂 Assaisonner à la fin uniquement.`,
       default:`Faire revenir oignon et poireau 5 min. Ajouter tous les légumes coupés en morceaux. Couvrir d'eau. Porter à ébullition puis laisser 25 min à feu doux. Mixer selon la texture souhaitée. Assaisonner.`
     }},
    {name:'Légumes rôtis & œufs',
     ings:['Panais','Patate douce','Brocoli','Œufs','Oignon'],
     steps:{
       Vapeur:`💧 **Patate douce vapeur** : couper en cubes de 3cm (avec la peau si bio — elle contient des nutriments). Placer dans le panier vapeur, **15-18 min**. Vérifier avec la pointe d'un couteau : elle doit entrer sans résistance mais les cubes ne doivent pas se désagréger.\n\n🥦 **Panais** : couper en tronçons de 2cm. Ajouter dans la vapeur les **5 dernières minutes** seulement — il cuit vite.\n\n💡 **Astuce vapeur-poêle** : sortir les légumes vapeur et les faire sauter 2 min à feu vif dans une poêle chaude à sec. Cette étape dite "de finition" crée une légère croûte et réveille les arômes.\n\n🥚 **Œufs au plat parfaits** : poêle à feu moyen-doux, casser l'œuf doucement pour ne pas briser le jaune. Couvrir 2 min — la vapeur cuit le blanc par le dessus sans toucher au jaune. Résultat : blanc ferme, jaune coulant.`,
       Four:`🔥 **Four à 210°C chaleur tournante** — la chaleur tournante est essentielle pour des légumes rôtis homogènes.\n\n🍠 **Patate douce** : couper en quartiers (pas en cubes) de 2cm d'épaisseur. Les quartiers donnent plus de surface caramélisée.\n\n💡 **Le secret du rôti parfait** : sécher les légumes avec du papier absorbant avant de les enfourner. L'humidité de surface est l'ennemi du croustillant — elle crée de la vapeur qui empêche la caramélisation.\n\n📐 **Plaque non surchargée** : les légumes doivent avoir 2cm d'espace entre eux. Si entassés, ils bouilliront dans leur propre vapeur.\n\n⏱️ **25 min à 210°C** : retourner à 15 min. Ils sont prêts quand les bords sont dorés et légèrement croustillants, le centre tendre.\n\n🥚 Les 5 dernières minutes : casser les œufs directement sur les légumes dans le plat ou cuire séparément selon préférence.`,
       Grill:`🔥 **Grill/plancha très chaud** — attendre 3-4 min de préchauffage. Tester avec quelques gouttes d'eau : elles doivent "danser" et s'évaporer immédiatement.\n\n🍠 **Patate douce** : tranches de 8mm maximum. Plus épaisses = pas assez cuites à cœur avant que l'extérieur brûle.\n\n💡 **Technique grill** : déposer les tranches et **ne pas toucher pendant 4 min**. C'est la règle absolue — les marques de grill se forment uniquement avec un contact immobile et continu. Retourner une seule fois.\n\n🥦 **Brocoli** : en fleurs aplaties (couper la tige pour que la tête touche bien le grill). 3 min/côté — les sommets vont légèrement carboniser, c'est voulu, ça crée une amertume agréable.\n\n🥚 **Œuf sur le grill** : créer un anneau avec de l'aluminium froissé pour contenir le blanc. Cuire 3 min à feu moyen.`,
       default:`Préchauffer une poêle à feu moyen-vif. Couper les légumes en morceaux réguliers. Faire cuire 12-15 min en remuant régulièrement. Cuire les œufs séparément selon la préférence. Dresser ensemble et assaisonner.`
     }}
  ],
  'petit-déjeuner':[
    {name:'Œufs & légumes du matin',
     ings:['Œufs','Avocat','Tomates','Oignon'],
     steps:{
       Poêle:`⏱️ **Le matin, on va vite** — organisation : préparer d'abord les légumes pendant que la poêle chauffe.\n\n🧅 **Oignon** : émincer très finement (plus c'est fin, plus ça cuit vite). 2 min à feu moyen — il doit juste devenir translucide et perdre son piquant.\n\n🍅 **Tomates** : ajouter coupées en deux, face coupée vers la poêle, 1 min. Elles chauffent sans rendre trop d'eau.\n\n🥚 **Les œufs brouillés parfaits** : baisser le feu au minimum. Casser les œufs directement dans la poêle sur les légumes. Briser le jaune avec une spatule et remuer lentement et constamment. **Arrêter avant qu'ils soient totalement cuits** — ils finissent de cuire avec la chaleur résiduelle. Le secret : les œufs brouillés doivent encore paraître légèrement humides à la sortie.\n\n🥑 **Avocat** : trancher au dernier moment. Quelques gouttes de citron si vous en avez — évite l'oxydation et rehausse le goût.\n\n🍽️ Dresser : œufs + légumes chauds, avocat froid à côté. Le contraste chaud/froid est agréable.`,
       Cru:`🥑 **Avocat parfaitement mûr** : il doit céder légèrement sous une pression douce. Couper en deux, retirer le noyau avec une cuillère, trancher en éventail dans la demi-peau puis prélever les tranches.\n\n🍅 **Tomates** : couper en quartiers — plus de surface, plus de goût. Saler légèrement 5 min avant de dresser.\n\n💡 **Montage cru** : disposer avocat et tomates dans l'assiette pendant que les œufs cuisent — ils arrivent à température ambiante, ce qui libère mieux leurs arômes (les légumes très froids ont moins de goût).\n\n🥚 **Œufs** : cuire à votre préférence. Pour un maximum de goût : œufs mollets (7 min eau bouillante, refroidir sous eau froide 1 min, écaler délicatement). Le jaune coulant enrichit naturellement l'ensemble comme une sauce.\n\n🍽️ Déposer les œufs chauds sur les légumes crus. Le choc thermique fait légèrement fondre l'avocat autour — c'est excellent.`,
       default:`Couper les légumes. Faire revenir oignon et tomates 3 min à la poêle. Ajouter les œufs et cuire selon préférence. Servir avec l'avocat tranché.`
     }},
    {name:'Bowl matinal légumes',
     ings:['Œufs','Betterave rouge','Carottes','Avocat'],
     steps:{
       Vapeur:`🥚 **Œufs durs** (pour transport facile) : eau froide dans casserole, ajouter les œufs, porter à ébullition, couper le feu, couvrir et attendre **10 min exactement**. Refroidir immédiatement sous eau froide 2 min — stoppe la cuisson et facilite l'épluchage.\n\n🥕 **Carottes vapeur** : couper en rondelles de 5mm. **10 min vapeur** — elles doivent être tendres mais conserver une légère résistance. Trop cuites = cotonneuses.\n\n🔴 **Betterave** : si crue, couper en julienne fine (râper grossièrement). Si précuite, couper en cubes. La betterave crue a plus de croquant et de goût — la cuite est plus douce.\n\n🥑 **Avocat** : trancher en dernier. Pour un bowl équilibré : une base de légumes, les œufs coupés, l'avocat en éventail. La présentation en bowl encourage à manger lentement.\n\n💡 **Astuce matin** : préparer les œufs durs et les légumes la veille — ils se conservent 3-4 jours au frigo. Le matin : assembler en 2 minutes.`,
       Cru:`🥕 **Carottes râpées** : utiliser une râpe à gros trous — les filaments trop fins deviennent spongieux. Assaisonner immédiatement avec un peu de sel et de citron.\n\n🔴 **Betterave crue** : la peler (mettre des gants — elle tache tout). Râper ou couper en julienne très fine. Mélanger avec les carottes — les deux légumes se marient très bien crus.\n\n🥚 **Œufs mollets** : 7 min exactes dans l'eau bouillante. Refroidir sous eau froide 2 min. Écaler avec soin — ils sont plus fragiles que les durs. Couper en deux : le blanc est ferme, le jaune encore crémeux.\n\n🥑 **Assemblage** : légumes râpés en base, avocat tranché sur le côté, œufs au centre. Le jaune coulant au moment de manger crée une sauce naturelle avec les légumes.\n\n💡 **Variation** : les légumes râpés peuvent être préparés la veille et conservés au frigo dans un bocal hermétique.`,
       default:`Cuire les œufs durs 10 min. Couper ou râper les légumes. Trancher l'avocat. Assembler en bol avec les œufs coupés en deux.`
     }}
  ],
  snack:[
    {name:'Crudités & houmous express',
     ings:['Pois chiches','Carottes','Avocat','Tomates','Betterave rouge'],
     steps:{
       Cru:`🧆 **Houmous express sans tahini** : égoutter et rincer soigneusement les pois chiches (rince l'excès de sel). Les sécher sur du papier absorbant — l'humidité dilue le goût.\n\nMixer avec 2-3 cuillères à soupe d'eau froide, une pincée de sel, poivre, et optionnellement une pointe de cumin. **Mixer 2-3 min** — plus longtemps = plus crémeux. La texture doit être lisse et s'étaler facilement.\n\n💡 **Astuce texture** : l'eau glacée donne un houmous plus blanc et plus léger. Ajouter l'eau progressivement jusqu'à la consistance souhaitée.\n\n🥕 **Crudités** : carottes en bâtonnets de 1cm de section et 8cm de longueur — la taille idéale pour la main. Pas trop fins (ils cassent) ni trop épais (difficiles à croquer).\n\n🥑 **Avocat** : trancher en quartiers — ils servent de "cuillère naturelle" pour le houmous.\n\n🍽️ Dresser le houmous dans un bol, faire un creux au centre, saupoudrer de paprika. Disposer les crudités autour.`,
       Vapeur:`🧆 **Pois chiches tièdes** : si en boîte, égoutter et rincer. Réchauffer dans le panier vapeur **4-5 min** — ils reprennent leur moelleux et deviennent plus faciles à mixer.\n\n💡 **Pourquoi tiède ?** Les pois chiches chauds se mixent mieux que froids et donnent un houmous plus crémeux naturellement, sans avoir besoin d'ajouter trop d'eau.\n\nMixer avec sel, poivre, eau de cuisson si disponible. Ajuster la texture.\n\n🥕 **Crudités vapeur légère** : 3 min max pour les carottes — elles doivent rester bien croquantes. L'idée est juste de les tiédir légèrement, ce qui révèle leur douceur naturelle tout en gardant le croquant.\n\n🍽️ Servir le houmous tiède avec les crudités légèrement vapeur. Le contraste de températures est surprenant et agréable.`,
       default:`Égoutter et rincer les pois chiches. Mixer avec sel, poivre et un peu d'eau jusqu'à obtenir une pâte crémeuse. Couper les carottes en bâtonnets. Trancher l'avocat. Disposer le houmous dans un bol entouré des crudités.`
     }}
  ]
};

function getBestRecipe(type, selIngs, maxKcal){
  const pool = RECIPE_TEMPLATES[type] || RECIPE_TEMPLATES['déjeuner'];
  const target = MACRO_TARGETS[type] || MACRO_TARGETS['déjeuner'];
  const ctx = getDayContext();
  const fridgeIng = allIng();
  // Filter fridgeIng by diet restrictions and preferences
  const fridgeIngFiltered = fridgeIng.filter(i=>isIngAllowed(i));
  const fridgeLower = fridgeIngFiltered.map(i=>i.toLowerCase());
  const modes = getCookModes();

  // Day context for adaptive suggestion
  const dayCtx = analyzeDayContext();

  // Effective calorie cap: min(maxKcal, remaining budget, target)
  // If context suggests light meal, lower the cap
  let effectiveCap = Math.min(maxKcal, ctx.remaining>0?ctx.remaining:target.kcalTarget, target.kcalTarget*1.2);
  if(dayCtx.suggestion==='light') effectiveCap=Math.min(effectiveCap,300);

  // Score templates — prefer protein-heavy if context demands it
  let best=pool[0], bestScore=-1;
  for(const r of pool){
    const avail = r.ings.filter(i=>fridgeLower.some(f=>f===i.toLowerCase()||f.includes(i.toLowerCase().split(' ')[0])));
    const selBonus = selIngs.length ? selIngs.filter(s=>r.ings.some(i=>i.toLowerCase()===s.toLowerCase())).length*3 : 0;
    const varietyPenalty = r.ings.filter(i=>ctx.todayProteins.some(p=>i.toLowerCase().includes(p))).length * -2;
    const score = avail.length + selBonus + varietyPenalty;
    if(score>bestScore){bestScore=score; best=r;}
  }

  // Build ingredient list with smart quantity scaling
  const actualIngs = [];
  let totalKcal=0, totalG=0, totalP=0, totalL=0, totalF=0;
  const added = new Set();

  const addIng = (name, forceQty=null) => {
    if(!isIngAllowed(name)) return; // skip disliked/restricted
    const key = name.toLowerCase();
    if(added.has(key)) return;
    added.add(key);
    let qty = forceQty || defaultQty(name);
    const r = estimateKcalVal(name, String(qty), 'g');
    actualIngs.push({name, qty, kcal:r.kcal, detail:r.detail});
    totalKcal += r.kcal;
    totalG += r.g||0;
    totalP += r.p||0;
    totalL += r.l||0;
    totalF += r.f||0;
  };

  for(const sel of selIngs){
    const match = fridgeIng.find(f=>f.toLowerCase()===sel.toLowerCase());
    if(match) addIng(match);
  }
  for(const tIng of best.ings){
    const match = fridgeIng.find(f=>f.toLowerCase()===tIng.toLowerCase()||f.toLowerCase().includes(tIng.toLowerCase().split(' ')[0].toLowerCase()));
    if(match) addIng(match);
  }
  if(!actualIngs.length) fridgeIng.slice(0,3).forEach(f=>addIng(f));

  // Scale down quantities proportionally if over budget
  if(totalKcal > effectiveCap && actualIngs.length > 0){
    const scaleFactor = effectiveCap / totalKcal;
    actualIngs.forEach(ing=>{
      ing.qty = Math.round(ing.qty * scaleFactor);
      ing.kcal = Math.round(ing.kcal * scaleFactor);
      ing.detail = `${ing.qty}g × ${ingData(ing.name).kcal} kcal/100g = ${ing.kcal} kcal`;
    });
    const newTotal = actualIngs.reduce((s,i)=>s+i.kcal,0);
    totalKcal = newTotal;
  }

  // Cooking steps
  let steps = best.steps.default || Object.values(best.steps)[0];
  let usedMode = '';
  for(const mode of modes){ if(best.steps[mode]){steps=best.steps[mode]; usedMode=mode; break;} }

  // Coherence analysis with budget awareness
  const targetKcal = Math.min(target.kcalTarget, effectiveCap);
  const diff = totalKcal - targetKcal;
  let coherence='✅ Cohérent', adjustment='';
  if(ctx.remaining < 200 && ctx.remaining > 0){
    coherence='⚠️ Budget serré';
    adjustment=`Il vous reste ${ctx.remaining} kcal pour la journée. Portions ajustées pour respecter votre objectif.`;
  } else if(diff > 120){
    coherence='⚠️ Légèrement élevé';
    adjustment=`Réduire légèrement les portions pour atteindre ~${targetKcal} kcal.`;
  } else if(diff < -120){
    coherence='⚠️ Léger';
    adjustment=`Ajouter une source de protéines pour compléter ce ${target.label.toLowerCase()}.`;
  } else {
    adjustment=`Repas adapté à un déficit calorique. Budget restant après ce repas : ~${Math.max(0,ctx.remaining-totalKcal)} kcal.`;
  }

  // Variety note
  let varietyNote = '';
  if(ctx.todayProteins.length && type==='dîner'){
    varietyNote = `Protéine différente du déjeuner ✓`;
  }

  // Evocative name
  const evocativeName = getEvocativeName(type, dayCtx.suggestion, actualIngs);
  // Context badges
  const ctxBadges = getContextBadges(totalKcal, {g:totalG,p:totalP,l:totalL}, type);
  // Recipe history
  const similarRecent = findSimilarRecent(best.name, actualIngs);
  const variantNote = similarRecent ? `🔄 Variante de "${similarRecent.name}" du ${similarRecent.date}` : null;
  // Reliability
  const reliability = getReliabilityBadge(actualIngs);

  return {
    name: evocativeName, originalName: best.name,
    kcal: totalKcal, actualIngs, steps,
    modeLabel: usedMode||'classique',
    macros:{g:totalG, p:totalP, l:totalL, f:totalF},
    target, coherence, adjustment, note:target.note,
    ctx, dayCtx, ctxBadges, variantNote, reliability
  };
}

// Last generated recipe — for modification context
let lastGeneratedRecipe = null;

let recipeCardIndex = 0;
function respondMeal(type, selIngs=[], maxKcal=9999, baseRecipe=null){
  const r = baseRecipe || getBestRecipe(type, selIngs, maxKcal);
  const ctx = r.ctx || getDayContext();
  const cardId = 'recipe-card-'+(++recipeCardIndex);

  // Show context message first if meaningful
  if(r.dayCtx&&r.dayCtx.contextMsg&&!baseRecipe){
    addMsg(r.dayCtx.contextMsg,'bot');
  }

  // Build ingredient list HTML
  function buildIngHtml(ings){
    return ings.map(i=>{
      const cruEntry=getCruCuitEntry(i.name);
      const cooked=isExplicitlyCooked(i.name);
      if(cruEntry&&!cooked){
        const qtyCooked=Math.round(i.qty*cruEntry.ratio);
        return `<div class="recipe-ing-row">
          <span class="ring-name">${i.name} <span style="font-size:10px;color:var(--text-muted);font-weight:400">(cru→cuit)</span></span>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:10px;color:var(--text-muted)">${i.qty}g cru →</span>
            <span style="font-weight:700;color:var(--green-glow);font-size:13px">${qtyCooked}g cuit</span>
            <span class="ring-qty">${i.kcal} kcal</span>
          </div></div>`;
      }
      return `<div class="recipe-ing-row">
        <span class="ring-name">${i.name}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-weight:600;font-size:13px">${i.qty}g</span>
          <span class="ring-qty">${i.kcal} kcal</span>
        </div></div>`;
    }).join('');
  }

  // Store last recipe + add to history
  lastGeneratedRecipe={...r, type, timestamp:Date.now()};
  addToRecipeHistory(r.name, r.actualIngs);

  function buildCardHtml(ings, kcal, macros, portionLabel=''){
    const energyTotal=macros.g*4+macros.p*4+macros.l*9||1;
    const gPct=Math.round(macros.g*4/energyTotal*100);
    const pPct=Math.round(macros.p*4/energyTotal*100);
    const lPct=100-gPct-pPct;
    const budget=S.budget||S.tdee;
    const budgetPct=Math.min(100,Math.round((ctx.consumed+kcal)/budget*100));
    const badgesHtml=(r.ctxBadges||[]).map(b=>`<span class="ctx-badge">${b}</span>`).join('');
    const reliabilityHtml=`<span class="reliability-badge ${r.reliability.cls}" style="float:right">${r.reliability.label}</span>`;
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
        <span class="tag">${type}</span>
        ${reliabilityHtml}
      </div>
      <h3 style="margin-top:6px">${r.name}</h3>
      ${portionLabel?`<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${portionLabel}</div>`:''}
      <div class="recipe-context-badges">${badgesHtml}</div>
      <div class="kcal-badge" style="font-size:14px;margin-bottom:10px">🔥 ${kcal} kcal</div>
      ${r.variantNote?`<div style="font-size:11px;color:var(--orange);margin-bottom:6px">${r.variantNote}</div>`:''}
      <div class="ing-list-block">${buildIngHtml(ings)}</div>
      <div style="margin:10px 0 6px;padding:12px 14px;background:var(--bg-secondary);border-radius:12px;border:1px solid var(--border);font-size:13px;line-height:1.8;color:var(--text-secondary)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">👨‍🍳 Préparation</div>
        ${r.steps.replace(/\*\*(.*?)\*\*/g,'<strong style="color:var(--text)">$1</strong>').replace(/\n\n/g,'</p><p style="margin-top:10px">').replace(/\n/g,'<br>')}
      </div>
      <div class="portion-btns">
        <button class="portion-btn" onclick="adjustPortion('${cardId}',0.5)">½ portion</button>
        <button class="portion-btn" onclick="adjustPortion('${cardId}',2)">×2 portion</button>
      </div>
      <div class="portion-label" id="${cardId}-plbl"></div>
      <div style="margin:6px 0 4px;font-size:11px;font-weight:700;color:var(--text-muted)">MACROS</div>
      <div style="display:flex;height:6px;border-radius:4px;overflow:hidden;margin-bottom:4px">
        <div style="width:${gPct}%;background:#c09a1a"></div>
        <div style="width:${pPct}%;background:var(--green-dark)"></div>
        <div style="width:${lPct}%;background:#457B9D"></div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;font-size:11px">
        <span class="macro-chip">🍞 G: ${macros.g}g</span>
        <span class="macro-chip">🥩 P: ${macros.p}g</span>
        <span class="macro-chip">🥑 L: ${macros.l}g</span>
        ${(macros.f||0)>0?`<span class="macro-chip">🌿 F: ${macros.f}g</span>`:''}
      </div>
      <div style="padding:8px 10px;background:var(--bg-secondary);border-radius:10px;font-size:11px;line-height:1.6;margin-bottom:8px;border:1px solid var(--border)">
        <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--green-glow);margin-bottom:4px">
          <span>Budget jour</span><span>${ctx.consumed+kcal} / ${budget} kcal</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${budgetPct}%;background:${budgetPct>90?'var(--danger)':'var(--green-glow)'};border-radius:3px"></div>
        </div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Reste : ${Math.max(0,budget-ctx.consumed-kcal)} kcal</div>
      </div>
      <button class="btn-add-meal" onclick="addFromChat('${Q(r.name)}',${kcal},'${type}',${JSON.stringify(ings.map(i=>({name:i.name,qty:i.qty,unit:'g'}))).replace(/"/g,'&quot;')},this)">+ Ajouter à l'agenda d'aujourd'hui</button>`;
  }

  // Recipe card state for portion adjustments
  window._recipeCards = window._recipeCards||{};
  window._recipeCards[cardId]={r, portionFactor:1};

  const html=`<div class="msg">
    <div class="msg-avatar">${LOGO_SVG}</div>
    <div>
      <div class="msg-bubble" style="margin-bottom:8px">Voici un <strong>${r.target.label.toLowerCase()}</strong> adapté (cuisson : <strong>${r.modeLabel}</strong>) :</div>
      <div class="meal-card" id="${cardId}">
        ${buildCardHtml(r.actualIngs, r.kcal, r.macros)}
      </div>
    </div>
  </div>`;
  const c=document.getElementById('chat-messages');
  c.insertAdjacentHTML('beforeend',html);
  c.scrollTop=c.scrollHeight;
}

function adjustPortion(cardId, factor){
  const state=window._recipeCards&&window._recipeCards[cardId];
  if(!state) return;
  state.portionFactor*=factor;
  const pf=state.portionFactor;
  const r=state.r;
  // Scale all quantities
  const scaledIngs=r.actualIngs.map(i=>{
    const qty=Math.round(i.qty*pf);
    const rv=estimateKcalVal(i.name,String(qty),'g');
    return {...i,qty,kcal:rv.kcal};
  });
  const kcal=scaledIngs.reduce((s,i)=>s+i.kcal,0);
  const macros={
    g:Math.round((r.macros.g||0)*pf),
    p:Math.round((r.macros.p||0)*pf),
    l:Math.round((r.macros.l||0)*pf),
    f:Math.round((r.macros.f||0)*pf)
  };
  const pLabel=pf===1?'':`${pf>1?'×'+pf:'½'} portion`;
  const card=document.getElementById(cardId);
  if(!card) return;
  // Rebuild inner content
  const r2={...r, actualIngs:scaledIngs};
  window._recipeCards[cardId].r=r2;
  // Re-render (keep card DOM node, just update innerHTML)
  const ctx=getDayContext();
  const energyTotal=macros.g*4+macros.p*4+macros.l*9||1;
  const gPct=Math.round(macros.g*4/energyTotal*100);
  const pPct=Math.round(macros.p*4/energyTotal*100);
  const lPct=100-gPct-pPct;
  const budget=S.budget||S.tdee;
  const budgetPct=Math.min(100,Math.round((ctx.consumed+kcal)/budget*100));
  const badgesHtml=(r.ctxBadges||[]).map(b=>`<span class="ctx-badge">${b}</span>`).join('');
  const buildIngHtml2=(ings)=>ings.map(i=>{
    const cruEntry=getCruCuitEntry(i.name);const cooked=isExplicitlyCooked(i.name);
    if(cruEntry&&!cooked){const qc=Math.round(i.qty*cruEntry.ratio);
      return `<div class="recipe-ing-row"><span class="ring-name">${i.name} <span style="font-size:10px;color:var(--text-muted)">(cru→cuit)</span></span><div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--text-muted)">${i.qty}g cru →</span><span style="font-weight:700;color:var(--green-glow);font-size:13px">${qc}g cuit</span><span class="ring-qty">${i.kcal} kcal</span></div></div>`;}
    return `<div class="recipe-ing-row"><span class="ring-name">${i.name}</span><div style="display:flex;align-items:center;gap:6px"><span style="font-weight:600;font-size:13px">${i.qty}g</span><span class="ring-qty">${i.kcal} kcal</span></div></div>`;
  }).join('');
  card.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
      <span class="tag">${r.target.label}</span>
      <span class="reliability-badge ${r.reliability.cls}">${r.reliability.label}</span>
    </div>
    <h3 style="margin-top:6px">${r.name}</h3>
    ${pLabel?`<div style="font-size:11px;color:var(--orange);margin-bottom:4px;font-weight:600">${pLabel}</div>`:''}
    <div class="recipe-context-badges">${badgesHtml}</div>
    <div class="kcal-badge" style="font-size:14px;margin-bottom:10px">🔥 ${kcal} kcal</div>
    <div class="ing-list-block">${buildIngHtml2(scaledIngs)}</div>
    <div class="portion-btns">
      <button class="portion-btn" onclick="adjustPortion('${cardId}',0.5)">½ portion</button>
      <button class="portion-btn" onclick="adjustPortion('${cardId}',2)">×2 portion</button>
    </div>
    <div style="margin:6px 0 4px;font-size:11px;font-weight:700;color:var(--text-muted)">MACROS</div>
    <div style="display:flex;height:6px;border-radius:4px;overflow:hidden;margin-bottom:4px">
      <div style="width:${gPct}%;background:#c09a1a"></div>
      <div style="width:${pPct}%;background:var(--green-dark)"></div>
      <div style="width:${lPct}%;background:#457B9D"></div>
    </div>
    <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px;font-size:11px">
      <span class="macro-chip">🍞 G: ${macros.g}g</span><span class="macro-chip">🥩 P: ${macros.p}g</span><span class="macro-chip">🥑 L: ${macros.l}g</span>
    </div>
    <div style="padding:8px 10px;background:var(--bg-secondary);border-radius:10px;font-size:11px;line-height:1.6;margin-bottom:8px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--green-glow);margin-bottom:4px"><span>Budget jour</span><span>${ctx.consumed+kcal} / ${budget} kcal</span></div>
      <div style="height:4px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${budgetPct}%;background:${budgetPct>90?'var(--danger)':'var(--green-glow)'};border-radius:3px"></div></div>
      <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Reste : ${Math.max(0,budget-ctx.consumed-kcal)} kcal</div>
    </div>
    <button class="btn-add-meal" onclick="addFromChat('${Q(r.name)}',${kcal},'${r.target.label}',${JSON.stringify(scaledIngs.map(i=>({name:i.name,qty:i.qty,unit:'g'}))).replace(/"/g,'&quot;')},this)">+ Ajouter à l'agenda d'aujourd'hui</button>`;
}

function addFromChat(name,kcal,type,ingredients,btn){
  // ingredients can be a string (HTML-decoded JSON) or array
  let ings=[];
  try{ ings=typeof ingredients==='string'?JSON.parse(ingredients.replace(/&quot;/g,'"')):ingredients; }catch(e){}
  const todayKey=fullDateKey(new Date());
  if(!S.meals[todayKey]) S.meals[todayKey]=[];
  S.meals[todayKey].push({name,kcal,type,ingredients:ings});
  save(); updateChatKcal();
  btn.textContent='✓ Ajouté à l\'agenda !';
  btn.style.background='#3d8a3c';
  btn.disabled=true;
}

function addMsg(html,from){
  const c=document.getElementById('chat-messages');
  const d=document.createElement('div');
  d.className='msg'+(from==='user'?' user':'');
  if(from==='user') d.innerHTML=`<div class="msg-bubble">${html}</div>`;
  else d.innerHTML=`<div class="msg-avatar">${LOGO_SVG}</div><div class="msg-bubble">${html}</div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}
function showTyping(){
  const c=document.getElementById('chat-messages');
  const d=document.createElement('div'); d.className='msg'; d.id='typing-msg';
  d.innerHTML=`<div class="msg-avatar">${LOGO_SVG}</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  c.appendChild(d); c.scrollTop=c.scrollHeight;
}
function removeTyping(){const t=document.getElementById('typing-msg');if(t)t.remove();}
function detectType(msg){
  const m=msg.toLowerCase();
  if(m.includes('déjeuner')||m.includes('midi')) return 'déjeuner';
  if(m.includes('dîner')||m.includes('soir')) return 'dîner';
  if(m.includes('petit')||m.includes('matin')) return 'petit-déjeuner';
  if(m.includes('snack')||m.includes('collation')) return 'snack';
  return 'déjeuner';
}

// Detect modification intent from message
function detectModificationIntent(msg){
  const low = msg.toLowerCase();
  // Removal
  if(low.includes('retire') || low.includes('enlève') || low.includes('sans') || low.includes('supprime') || low.includes('enlever')) return 'remove';
  // Replacement
  if(low.includes('remplace') || low.includes('à la place') || low.includes('plutôt')) return 'replace';
  // Quantity increase
  if(low.includes('plus de') || low.includes('augmente') || low.includes('davantage') || low.includes('double')) return 'increase';
  // Quantity decrease
  if(low.includes('moins de') || low.includes('réduis') || low.includes('diminue') || low.includes('moins')) return 'decrease';
  // Addition
  if(low.includes('ajoute') || low.includes('rajoute') || low.includes('avec plus') || low.includes('ajouter')) return 'add';
  return null;
}

// Extract ingredient name from modification message
function extractIngredientFromMsg(msg, allIngs){
  const low = msg.toLowerCase();
  // Check if any frigo ingredient is mentioned
  for(const ing of allIngs){
    if(low.includes(ing.toLowerCase())) return ing;
  }
  // Generic terms
  const proteinWords = ['protéine','poulet','saumon','oeuf','thon','lentille','pois chiche'];
  for(const p of proteinWords){ if(low.includes(p)) return p; }
  return null;
}

// Modify last recipe based on intent
function modifyLastRecipe(msg, intent){
  if(!lastGeneratedRecipe) return false;
  const r = JSON.parse(JSON.stringify(lastGeneratedRecipe)); // deep clone
  const low = msg.toLowerCase();
  const fridgeIng = allIng();

  if(intent === 'remove'){
    // Find which ingredient to remove
    const toRemove = r.actualIngs.find(i => low.includes(i.name.toLowerCase()));
    if(!toRemove){
      addMsg(`Je n'ai pas trouvé l'ingrédient à retirer dans la recette. Dites-moi lequel exactement.`,'bot');
      return true;
    }
    r.actualIngs = r.actualIngs.filter(i => i.name !== toRemove.name);
    addMsg(`✅ J'ai retiré <strong>${toRemove.name}</strong> du repas et recalculé les calories.`,'bot');

  } else if(intent === 'replace'){
    // Find what to replace (old) and with what (new)
    const toReplace = r.actualIngs.find(i => low.includes(i.name.toLowerCase()));
    // Find replacement in frigo
    const replacement = fridgeIng.find(f => {
      const fn = f.toLowerCase();
      return low.includes(fn) && !r.actualIngs.some(i => i.name.toLowerCase() === fn);
    });
    if(!toReplace || !replacement){
      addMsg(`Précisez ce que vous voulez remplacer et par quoi (avec un ingrédient de votre frigo).`,'bot');
      return true;
    }
    const oldIdx = r.actualIngs.indexOf(toReplace);
    const qty = toReplace.qty;
    const rv = estimateKcalVal(replacement, String(qty), 'g');
    r.actualIngs[oldIdx] = {name:replacement, qty, kcal:rv.kcal, detail:rv.detail};
    addMsg(`✅ J'ai remplacé <strong>${toReplace.name}</strong> par <strong>${replacement}</strong> (même quantité).`,'bot');

  } else if(intent === 'increase'){
    const target = r.actualIngs.find(i => low.includes(i.name.toLowerCase()));
    if(target){
      target.qty = Math.round(target.qty * 1.5);
      const data = ingNutrition(target.name);
      target.kcal = Math.round(data.kcal * target.qty / 100);
      addMsg(`✅ J'ai augmenté <strong>${target.name}</strong> à ${target.qty}g.`,'bot');
    } else if(low.includes('protéine')){
      // Boost all proteins in the recipe
      const protKw = ['oeuf','poulet','saumon','thon','pois chiche','lentille','tofu'];
      let boosted=[];
      r.actualIngs.forEach(i=>{
        if(protKw.some(k=>i.name.toLowerCase().includes(k))){
          i.qty=Math.round(i.qty*1.4);
          const data=ingNutrition(i.name);
          i.kcal=Math.round(data.kcal*i.qty/100);
          boosted.push(i.name);
        }
      });
      if(boosted.length) addMsg(`✅ Protéines augmentées : <strong>${boosted.join(', ')}</strong>.`,'bot');
      else addMsg(`Aucune source de protéine identifiée dans ce repas.`,'bot');
    } else {
      addMsg(`Précisez quel ingrédient vous voulez augmenter.`,'bot');
      return true;
    }
  } else if(intent === 'decrease'){
    const target = r.actualIngs.find(i => low.includes(i.name.toLowerCase()));
    if(target){
      target.qty = Math.round(target.qty * 0.6);
      const data = ingNutrition(target.name);
      target.kcal = Math.round(data.kcal * target.qty / 100);
      addMsg(`✅ J'ai réduit <strong>${target.name}</strong> à ${target.qty}g.`,'bot');
    } else {
      addMsg(`Précisez quel ingrédient vous voulez réduire.`,'bot');
      return true;
    }
  } else if(intent === 'add'){
    // Find new ingredient in frigo not already in recipe
    const toAdd = fridgeIng.find(f => {
      const fn = f.toLowerCase();
      return low.includes(fn) && !r.actualIngs.some(i => i.name.toLowerCase() === fn);
    });
    if(toAdd){
      const qty = defaultQty(toAdd);
      const r2 = estimateKcalVal(toAdd, String(qty), 'g');
      r.actualIngs.push({name:toAdd, qty, kcal:r2.kcal, detail:r2.detail});
      addMsg(`✅ J'ai ajouté <strong>${toAdd}</strong> (${qty}g) au repas.`,'bot');
    } else {
      addMsg(`Précisez quel ingrédient de votre frigo vous souhaitez ajouter.`,'bot');
      return true;
    }
  }

  // Recalculate totals using estimateKcalVal (cru/cuit aware)
  let totalKcal=0, totalG=0, totalP=0, totalL=0;
  r.actualIngs.forEach(i=>{
    const rv=estimateKcalVal(i.name, String(i.qty), 'g');
    i.kcal=rv.kcal; i.detail=rv.detail;
    totalKcal+=rv.kcal; totalG+=rv.g||0; totalP+=rv.p||0; totalL+=rv.l||0;
  });
  r.kcal=totalKcal;
  r.macros={g:totalG,p:totalP,l:totalL};
  r.ctx=getDayContext();

  // Re-render the modified recipe
  setTimeout(()=>respondMeal(r.type,[],9999,r),100);
  return true;
}

async function sendMessage(){
  const input=document.getElementById('chat-input');
  const msg=input.value.trim(); if(!msg) return;
  input.value=''; input.style.height='auto';
  addMsg(msg,'user'); showTyping();
  setTimeout(()=>{
    removeTyping();
    const low=msg.toLowerCase();
    const name=S.profileName||document.getElementById('profile-name')?.value||'';

    // 1. Check for modification intent on last recipe
    const modIntent = detectModificationIntent(msg);
    if(modIntent && lastGeneratedRecipe){
      if(modifyLastRecipe(msg, modIntent)) return;
    }

    // 2. New recipe request
    if(low.includes('repas')||low.includes('recette')||low.includes('déjeuner')||low.includes('dîner')||low.includes('manger')||low.includes('midi')||low.includes('soir')||low.includes('matin')||low.includes('snack')||low.includes('collation')){
      respondMeal(detectType(msg),[],9999);
    } else if(low.includes('calorie')||low.includes('kcal')||low.includes('bilan')){
      const todayKey=fullDateKey(new Date());
      const kcal=(S.meals[todayKey]||[]).reduce((s,m)=>s+m.kcal,0);
      const budget=S.budget||S.tdee;
      const rem=budget-kcal;
      addMsg(`📊 <strong>Bilan du jour :</strong><br>Consommé : <strong>${kcal} kcal</strong><br>Budget : ${budget} kcal<br>${rem>0?`Il vous reste <strong>${rem} kcal</strong>`:'<strong>Objectif atteint !</strong>'}`, 'bot');
    } else if(low.includes('frigo')||low.includes('ingrédient')){
      const all=allIng();
      addMsg(`🧊 Dans votre frigo : <strong>${all.slice(0,6).join(', ')}${all.length>6?'…':''}</strong>.<br>Voulez-vous une recette ?`,'bot');
    } else if(low.includes('bonjour')||low.includes('salut')){
      addMsg(`👋 Bonjour ${name||'!'} Que puis-je faire pour vous ?`,'bot');
    } else {
      addMsg(`📝 Je n'ai pas compris. Essayez : "Fais-moi un déjeuner", "Retire les tomates", "Remplace le riz par des pâtes".`,'bot');
    }
  },1300);
}

// chat listeners removed (chat screen removed)

// ============================================================
// ANALYSE
// ============================================================
function updateIMC(){
  const w=parseFloat(document.getElementById('profile-weight')?.value)||S.profileWeight||0;
  const h=parseInt(document.getElementById('profile-height')?.value)||S.profileHeight||0;
  const valEl=document.getElementById('imc-value');
  const lblEl=document.getElementById('imc-label');
  const banner=document.getElementById('imc-banner');
  if(!valEl||!lblEl||!w||!h) return;
  const hm=h/100;
  const imc=Math.round((w/(hm*hm))*10)/10;
  valEl.textContent=imc.toFixed(1);
  let label='',color='',bg='';
  if(imc<18.5){        label='Insuffisance pondérale'; color='#2980b9'; bg='#EBF5FB'; }
  else if(imc<25){     label='Poids normal ✓';         color='#27ae60'; bg='#EBF9F1'; }
  else if(imc<30){     label='Surpoids';               color='#e67e22'; bg='#FEF9E7'; }
  else if(imc<35){     label='Obésité modérée';        color='#e74c3c'; bg='#FDEDEC'; }
  else{                label='Obésité sévère';         color='#c0392b'; bg='#FDEDEC'; }
  valEl.style.color=color;
  lblEl.textContent=label;
  lblEl.style.color=color;
  banner.style.background=bg;
}

function getDeficitAmount(){
  const defMap={deficit_doux:250,deficit_modere:500,deficit_fort:750,maintien:0,custom:S.customDeficit||600};
  return defMap[S.goal]||500;
}

function calcTDEE(){
  const age=parseInt(document.getElementById('profile-age')?.value)||S.profileAge||26;
  const w=parseFloat(document.getElementById('profile-weight')?.value)||S.profileWeight||70;
  const h=parseInt(document.getElementById('profile-height')?.value)||S.profileHeight||170;
  let bmr=S.gender==='homme'?10*w+6.25*h-5*age+5:10*w+6.25*h-5*age-161;
  const m={sedentaire:1.2,leger:1.375,modere:1.55,actif:1.725};
  const tdee=Math.round(bmr*(m[S.activity]||1.2));
  bmr=Math.round(bmr);
  const deficit=getDeficitAmount();
  const budget=Math.max(1200,tdee-deficit);
  return{tdee,bmr,deficit,budget};
}

function updateTDEE(){
  const{tdee,bmr,deficit,budget}=calcTDEE();
  S.tdee=tdee; S.budget=budget;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('tdee-value',`${tdee} kcal/jour`); set('bmr-value',`Métabolisme de base : ${bmr} kcal`);
  set('tdee-stats-val',`${tdee} kcal`); set('bmr-stats-val',`Métabolisme de base : ${bmr} kcal`);
  set('tdee-line-lbl',`--- Budget ${budget} kcal`);
  // Update breakdown banner in profile
  set('cb-bmr',`${bmr} kcal`); set('cb-tdee',`${tdee} kcal`);
  set('cb-deficit',`−${deficit} kcal`); set('cb-budget',`${budget} kcal`);
  // Projection
  const target=parseFloat(document.getElementById('profile-target-weight')?.value)||S.profileTargetWeight||0;
  const current=parseFloat(document.getElementById('profile-weight')?.value)||S.profileWeight||0;
  const toLose=current-target;
  const weeksTo=toLose>0&&deficit>0?Math.round(toLose/(deficit/7000)):0;
  const months=weeksTo>0?Math.round(weeksTo/4.3):0;
  const projEl=document.getElementById('cb-projection');
  if(projEl){
    projEl.textContent = toLose>0&&weeksTo>0
      ? `🎯 Objectif ${target} kg atteint en ~${weeksTo} sem. (~${months} mois) à ce rythme`
      : deficit===0?'⚖️ Mode maintien — aucun déficit appliqué':'';
  }
  updateChatKcal();
  updateIMC();
}

function setMealInputMode(mode){
  const isAuto = mode==='auto';
  document.getElementById('meal-mode-auto').style.display = isAuto?'block':'none';
  document.getElementById('meal-mode-manual').style.display = isAuto?'none':'block';
  const autoBtn=document.getElementById('mode-auto-btn');
  const manBtn=document.getElementById('mode-manual-btn');
  autoBtn.style.background=isAuto?'var(--green-dark)':'none';
  autoBtn.style.color=isAuto?'white':'var(--text-muted)';
  autoBtn.style.borderColor=isAuto?'var(--green-dark)':'var(--border)';
  manBtn.style.background=isAuto?'none':'var(--green-dark)';
  manBtn.style.color=isAuto?'var(--text-muted)':'white';
  manBtn.style.borderColor=isAuto?'var(--border)':'var(--green-dark)';
}
function saveManualMeal(){
  const name=document.getElementById('new-meal-name').value.trim()||'Repas';
  const kcal=parseInt(document.getElementById('manual-kcal').value)||0;
  if(!kcal){alert('Veuillez saisir les calories du repas.');return;}
  const k=fullDateKey(S.selDate);
  if(!S.meals[k]) S.meals[k]=[];
  S.meals[k].push({name,kcal,type:S.selMealType,ingredients:[]});
  save(); closeMealModal(); renderAgenda();
}
function setGender(g){
  S.gender=g;
  document.getElementById('btn-homme').classList.toggle('active',g==='homme');
  document.getElementById('btn-femme').classList.toggle('active',g==='femme');
  updateTDEE();
}
function setActivity(el,val){
  S.activity=val;
  document.querySelectorAll('.activity-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected'); updateTDEE();
}
function setGoal(el,val){
  S.goal=val;
  document.querySelectorAll('#goal-options .activity-opt').forEach(o=>o.classList.remove('selected'));
  el.classList.add('selected');
  if(val==='custom'){
    setTimeout(()=>document.getElementById('profile-custom-deficit')?.focus(),50);
  }
  profileUpdateCustomDeficit();
  updateTDEE();
}
function profileUpdateCustomDeficit(){
  const val=parseInt(document.getElementById('profile-custom-deficit')?.value)||600;
  const kgWeek=Math.round(val/7000*7*100)/100;
  const el=document.getElementById('profile-custom-kgweek');
  if(el) el.textContent=`~${kgWeek} kg/sem`;
  if(S.goal==='custom'){ S.customDeficit=val; updateTDEE(); }
}
function toggleCook(el){el.classList.toggle('selected');}
function saveProfile(){
  S.profileName=document.getElementById('profile-name')?.value?.trim()||S.profileName;
  S.profileAge=parseInt(document.getElementById('profile-age')?.value)||S.profileAge;
  S.profileWeight=parseFloat(document.getElementById('profile-weight')?.value)||S.profileWeight;
  S.profileHeight=parseInt(document.getElementById('profile-height')?.value)||S.profileHeight;
  S.profileTargetWeight=parseFloat(document.getElementById('profile-target-weight')?.value)||S.profileTargetWeight;
  if(S.goal==='custom') S.customDeficit=parseInt(document.getElementById('profile-custom-deficit')?.value)||S.customDeficit||600;
  updateTDEE(); save(); updateWelcome();
  const btn=document.querySelector('.btn-save');
  btn.textContent='✓ Profil sauvegardé !';
  setTimeout(()=>btn.innerHTML='💾 Sauvegarder le profil',2000);
}
function switchTab(tab){
  document.getElementById('tab-profil-content').style.display=tab==='profil'?'block':'none';
  document.getElementById('tab-stats-content').style.display=tab==='stats'?'block':'none';
  document.getElementById('tab-profil').classList.toggle('active',tab==='profil');
  document.getElementById('tab-stats').classList.toggle('active',tab==='stats');
  if(tab==='stats') renderStats();
}

var curPeriod='week';
function setPeriod(el,p){
  curPeriod=p;
  document.querySelectorAll('.period-btn').forEach(b=>b.classList.remove('active'));
  el.classList.add('active'); renderStats();
}
function getDays(period){
  const today=new Date();
  const days=[];
  if(period==='today'){
    days.push(new Date(today));
  } else {
    const n=period==='week'?7:period==='month'?30:90;
    for(let i=n-1;i>=0;i--){
      const d=new Date(today); d.setDate(today.getDate()-i);
      days.push(d);
    }
  }
  return days;
}
function kcalForDate(date){
  return (S.meals[fullDateKey(date)]||[]).reduce((s,m)=>s+m.kcal,0);
}

