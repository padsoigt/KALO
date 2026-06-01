/**
 * KALO — frigo.js
 */

function renderFrigo(filter=''){
  const list=document.getElementById('frigo-list');
  let html='';
  for(const [cat,items] of Object.entries(S.ingredients)){
    const sorted=[...items].sort((a,b)=>a.localeCompare(b,'fr'));
    const f=sorted.filter(i=>i.toLowerCase().includes(filter.toLowerCase()));
    if(!f.length) continue;
    html+=`<div class="ingredient-section"><div class="section-label">${CAT_E[cat]} ${CAT_N[cat]}</div>
      ${f.map(item=>{
        const custom=S.customNutrition&&S.customNutrition[item.toLowerCase()];
        const badge=custom?`<span style="font-size:10px;color:var(--green-glow);background:var(--green-pale);padding:2px 6px;border-radius:20px;margin-left:6px">${custom.kcal} kcal/100g</span>`:'';
        const prefs=S.preferences||{aimé:[],évité:[]};
        const liked=(prefs.aimé||[]).includes(item);
        const disliked=(prefs.évité||[]).includes(item);
        return `<div class="ingredient-item" style="${disliked?'opacity:.45':''}">
          <span class="ingredient-name">${item}${badge}</span>
          <div style="display:flex;gap:4px;align-items:center">
            <button class="pref-btn ${liked?'active':''}" onclick="togglePref('${Q(item)}','aimé')" title="${liked?'Retirer des favoris':'Marquer comme favori'}" style="font-size:13px;opacity:${liked?1:.3}">${liked?'★':'☆'}</button>
            <button class="pref-btn ${disliked?'active':''}" onclick="togglePref('${Q(item)}','évité')" title="${disliked?'Retirer des exclus':'Exclure des recettes'}" style="font-size:13px;opacity:${disliked?1:.3}">${disliked?'✕':'–'}</button>
            <button onclick="openFrigoEdit('${Q(item)}')" title="Modifier les valeurs nutritionnelles"
              style="background:none;border:1px solid var(--border);border-radius:8px;padding:5px 7px;cursor:pointer;display:flex;align-items:center;color:var(--text-muted)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="delete-btn" onclick="deleteIng('${cat}','${Q(item)}')">
              <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>`}).join('')}
    </div>`;
  }
  list.innerHTML=html||'<div class="empty-day" style="margin:16px"><p>Aucun ingrédient trouvé</p></div>';
  document.getElementById('frigo-count').textContent=allIng().length+' ingrédients actifs';
  renderArchive();
  // Re-attach listeners after DOM rebuild
  const _tog=document.getElementById('archive-toggle-btn');
  if(_tog) _tog.onclick=function(){
    this.classList.toggle('open');
    const b=document.getElementById('archive-body');
    if(b) b.classList.toggle('open');
  };
  const _src=document.getElementById('frigo-search-input');
  if(_src) _src.oninput=e=>renderFrigo(e.target.value);
  const _add=document.getElementById('frigo-add-btn');
  if(_add) _add.onclick=openFrigoModal;
}

function deleteIng(cat,name){
  S.ingredients[cat]=S.ingredients[cat].filter(i=>i!==name);
  if(!S.archive.find(a=>a.name===name)) S.archive.push({name,cat});
  save(); renderFrigo();
}

function renderArchive(){
  const body=document.getElementById('archive-body');
  if(!S.archive.length){body.innerHTML='<div class="archive-empty">Aucun ingrédient archivé</div>';return;}
  body.innerHTML=S.archive.map(a=>`<div class="archive-item">
    <div><span>${a.name}</span><span class="cat-badge">${CAT_N[a.cat]||a.cat}</span></div>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="restore-btn" onclick="restoreIng('${Q(a.name)}','${a.cat}')">Restaurer</button>
      <button onclick="deleteArchiveItem('${Q(a.name)}')" title="Supprimer définitivement" style="background:#e74c3c;border:none;border-radius:8px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
      </button>
    </div>
  </div>`).join('');
}

function restoreIng(name,cat){
  if(!S.ingredients[cat]) S.ingredients[cat]=[];
  if(!S.ingredients[cat].includes(name)) S.ingredients[cat].push(name);
  S.archive=S.archive.filter(a=>a.name!==name);
  save(); renderFrigo();
}
function deleteArchiveItem(name){
  S.archive=S.archive.filter(a=>a.name!==name);
  save(); renderFrigo();
}

// listeners attached in renderFrigo()
function openFrigoModal(){
  S.selCat='légumes';
  // Reset visual selection to légumes
  document.querySelectorAll('#modal-cats .cat-chip').forEach((c,i)=>c.classList.toggle('selected',i===0));
  document.getElementById('new-ingredient').value='';
  ['frigo-kcal','frigo-prot','frigo-gluc','frigo-lip','frigo-fib'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const fields=document.getElementById('frigo-nutr-fields');
  if(fields) fields.style.display='none';
  const icon=document.getElementById('frigo-nutr-toggle-icon');
  if(icon) icon.textContent='▼ Afficher';
  document.getElementById('frigo-modal').classList.add('open');
}
// frigo-add-btn listener attached in renderFrigo()

function selectCat(el,cat){
  S.selCat=cat;
  document.querySelectorAll('#modal-cats .cat-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}
function toggleFrigoNutrition(){
  const fields=document.getElementById('frigo-nutr-fields');
  const icon=document.getElementById('frigo-nutr-toggle-icon');
  const hidden=fields.style.display==='none';
  fields.style.display=hidden?'block':'none';
  icon.textContent=hidden?'▲ Masquer':'▼ Afficher';
}
function closeFrigoModal(){
  document.getElementById('frigo-modal').classList.remove('open');
  document.getElementById('new-ingredient').value='';
  ['frigo-kcal','frigo-prot','frigo-gluc','frigo-lip','frigo-fib'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  const fields=document.getElementById('frigo-nutr-fields');
  if(fields) fields.style.display='none';
  const icon=document.getElementById('frigo-nutr-toggle-icon');
  if(icon) icon.textContent='▼ Afficher';
}
function addIngredient(){
  const val=document.getElementById('new-ingredient').value.trim(); if(!val) return;
  if(!S.ingredients[S.selCat]) S.ingredients[S.selCat]=[];
  S.archive=S.archive.filter(a=>a.name.toLowerCase()!==val.toLowerCase());
  S.ingredients[S.selCat].push(val);
  // Save custom nutrition if provided
  const kcal=parseFloat(document.getElementById('frigo-kcal')?.value);
  if(kcal>0){
    if(!S.customNutrition) S.customNutrition={};
    S.customNutrition[val.toLowerCase()]={
      kcal, p:parseFloat(document.getElementById('frigo-prot')?.value)||0,
      g:parseFloat(document.getElementById('frigo-gluc')?.value)||0,
      l:parseFloat(document.getElementById('frigo-lip')?.value)||0,
      f:parseFloat(document.getElementById('frigo-fib')?.value)||0
    };
  }
  save(); closeFrigoModal(); renderFrigo();
}

// Frigo ingredient edit
let editIngName='';
function openFrigoEdit(name){
  editIngName=name;
  document.getElementById('edit-ing-name').value=name;
  const custom=S.customNutrition&&S.customNutrition[name.toLowerCase()];
  const dbVals=ingNutrition(name);
  if(custom){
    document.getElementById('edit-ing-kcal').value=custom.kcal||'';
    document.getElementById('edit-ing-prot').value=custom.p||'';
    document.getElementById('edit-ing-gluc').value=custom.g||'';
    document.getElementById('edit-ing-lip').value=custom.l||'';
    document.getElementById('edit-ing-fib').value=custom.f||'';
  } else {
    ['edit-ing-kcal','edit-ing-prot','edit-ing-gluc','edit-ing-lip','edit-ing-fib'].forEach(id=>{ document.getElementById(id).value=''; });
  }
  // Show current DB values as reference
  const curr=document.getElementById('edit-ing-current-vals');
  if(curr) curr.innerHTML=`📊 Valeurs base de données : ${dbVals.kcal} kcal · P: ${dbVals.p}g · G: ${dbVals.g}g · L: ${dbVals.l}g${custom?' <span style="color:var(--green-glow);font-weight:700">(personnalisé)</span>':''}`;
  document.getElementById('frigo-edit-modal').classList.add('open');
}
function closeFrigoEditModal(){ document.getElementById('frigo-edit-modal').classList.remove('open'); }
function saveIngredientEdit(){
  const newName=document.getElementById('edit-ing-name').value.trim()||editIngName;
  const kcal=parseFloat(document.getElementById('edit-ing-kcal').value);
  // Rename in frigo if name changed
  if(newName!==editIngName){
    for(const cat of Object.keys(S.ingredients)){
      const idx=S.ingredients[cat].indexOf(editIngName);
      if(idx!==-1){ S.ingredients[cat][idx]=newName; break; }
    }
  }
  // Save custom nutrition
  if(!S.customNutrition) S.customNutrition={};
  if(kcal>0){
    S.customNutrition[newName.toLowerCase()]={
      kcal, p:parseFloat(document.getElementById('edit-ing-prot').value)||0,
      g:parseFloat(document.getElementById('edit-ing-gluc').value)||0,
      l:parseFloat(document.getElementById('edit-ing-lip').value)||0,
      f:parseFloat(document.getElementById('edit-ing-fib').value)||0
    };
    // Remove old key if renamed
    if(newName!==editIngName) delete S.customNutrition[editIngName.toLowerCase()];
  } else if(newName!==editIngName){
    // Just rename, no custom nutrition
    const old=S.customNutrition[editIngName.toLowerCase()];
    if(old){ S.customNutrition[newName.toLowerCase()]=old; delete S.customNutrition[editIngName.toLowerCase()]; }
  }
  save(); closeFrigoEditModal(); renderFrigo();
}

// ============================================================
// FRIGO POPUP (chat)
// ============================================================
// frigo-popup-btn listener moved to initApp
function openFrigoPopup(){
  const c=document.getElementById('frigo-popup-items');
  let html='';
  for(const [cat,items] of Object.entries(S.ingredients)){
    if(!items.length) continue;
    html+=`<div class="popup-section"><div class="sec-lbl">${CAT_E[cat]} ${CAT_N[cat]}</div>
      <div class="chip-grid">${items.map(i=>`<button class="frigo-chip" onclick="this.classList.toggle('selected')">${i}</button>`).join('')}</div></div>`;
  }
  c.innerHTML=html;
  document.getElementById('frigo-popup-ov').classList.add('open');
}
function closeFrigoPopup(){document.getElementById('frigo-popup-ov').classList.remove('open');}

function selectPopupType(el, type){
  document.querySelectorAll('#popup-type-chips .frigo-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}

function generateFromFrigo(){
  const sel=[...document.querySelectorAll('#frigo-popup-items .frigo-chip.selected')].map(b=>b.textContent);
  const maxKcal=parseInt(document.getElementById('kcal-max-input').value)||600;
  const typeEl=document.querySelector('#popup-type-chips .frigo-chip.selected');
  const mealType=typeEl?typeEl.textContent.trim():'déjeuner';
  // Normalize type text to key
  const typeMap={'Déjeuner':'déjeuner','Petit-déjeuner':'petit-déjeuner','Dîner':'dîner','Snack':'snack'};
  const type=typeMap[mealType]||mealType.toLowerCase();
  closeFrigoPopup();
  const msg=sel.length
    ? `Fais-moi un ${type} incluant ${sel.join(', ')} (+ ce que j'ai dans mon frigo). Maximum ${maxKcal} kcal.`
    : `Fais-moi un ${type} avec ce que j'ai dans mon frigo. Maximum ${maxKcal} kcal.`;
  addMsg(msg,'user'); showTyping();
  setTimeout(()=>{removeTyping(); respondMeal(type,sel,maxKcal);},1400);
}

// ============================================================
// AGENDA
// ============================================================
function renderAgenda(){
  calYear=S.selDate.getFullYear();
  calMonth=S.selDate.getMonth();
  renderCalendar(); renderWeekNav(); renderDayContent();
}
function renderWeekNav(){
  const nav=document.getElementById('week-nav');
  const dn=['dim','lun','mar','mer','jeu','ven','sam'];
  const sel=S.selDate;
  let html='';
  for(let i=-3;i<=3;i++){
    const d=new Date(sel.getFullYear(),sel.getMonth(),sel.getDate()+i);
    const key=fullDateKey(d);
    const isSel=key===fullDateKey(sel);
    const has=(S.meals[key]||[]).length>0;
    html+=`<button class="day-btn ${isSel?'active':''}" onclick="selDay('${key}')">
      <span class="dn">${dn[d.getDay()]}</span>
      <span class="dd">${d.getDate()}</span>
      ${has?'<span class="dot"></span>':''}
    </button>`;
  }
  nav.innerHTML=html;
  setTimeout(()=>{
    const active=nav.querySelector('.day-btn.active');
    if(active) active.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'});
  },50);
}
function selDay(key){
  const parts=key.split('-');
  S.selDate=new Date(parseInt(parts[0]),parseInt(parts[1])-1,parseInt(parts[2]));
  S.selDay=S.selDate.getDate();
  calYear=S.selDate.getFullYear();
  calMonth=S.selDate.getMonth();
  renderCalendar(); renderWeekNav(); renderDayContent();
}
function renderDayContent(){
  const date=S.selDate;
  const key=fullDateKey(date);
  const meals=S.meals[key]||[];
  const kcal=meals.reduce((s,m)=>s+m.kcal,0);
  const pct=Math.min((kcal/S.tdee)*100,100);
  const rem=S.tdee-kcal;
  const lbl=dayLabel(date);
  let html=`<div class="day-summary"><div class="row"><span class="dlabel">${lbl}</span><span class="kbadge">🔥 ${kcal} / ${S.tdee} kcal</span></div>
    <div class="rem">${rem>0?rem+' kcal restantes':'Objectif atteint !'}</div>
    <div class="prog"><div class="prog-fill" style="width:${pct}%"></div></div></div>`;
  if(!meals.length){
    html+=`<div class="empty-day"><div class="icon">🍽️</div><p>Aucun repas ce jour</p><small>Utilisez le Chat KALO ou ajoutez manuellement</small></div>`;
  } else {
    const types=['petit-déjeuner','déjeuner','dîner','snack'];
    const lbls={'petit-déjeuner':'Petit-déjeuner','déjeuner':'Déjeuner','dîner':'Dîner','snack':'Snack'};
    for(const type of types){
      const tm=meals.filter(m=>m.type===type); if(!tm.length) continue;
      html+=`<div class="meal-section"><div class="meal-section-title">${lbls[type]}</div>`;
      tm.forEach(meal=>{
        const idx=meals.indexOf(meal);
        html+=`<div class="meal-item"><div class="meal-info"><span class="tag">${type}</span>
          <div class="mname">${meal.name}</div><div class="mkcal">🔥 ${meal.kcal} kcal</div></div>
          <div class="meal-item-actions">
            <button class="edit-meal-btn" onclick="openEditMealModal('${key}',${idx})" title="Modifier"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
            <button class="del-meal" onclick="delMeal('${key}',${idx})">✕</button>
          </div></div>`;
      });
      html+='</div>';
    }
  }
  document.getElementById('day-content').innerHTML=html;
  updateChatKcal();
}
function dayLabel(date){
  const n=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const m=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${n[date.getDay()]} ${date.getDate()} ${m[date.getMonth()]} ${date.getFullYear()}`;
}
function delMeal(key,idx){
  if(!S.meals[key]) return;
  S.meals[key].splice(idx,1);
  if(!S.meals[key].length) delete S.meals[key];
  save(); renderAgenda();
}

// ============================================================
// ADD MEAL MODAL
// ============================================================
function openMealModal(){
  document.getElementById('meal-modal').classList.add('open');
  document.getElementById('kcal-result').style.display='none';
  const saveBtn=document.getElementById('btn-save-meal');
  saveBtn.style.display='none'; saveBtn.dataset.kcal='';
  document.getElementById('new-meal-name').value='';
  document.getElementById('ing-list').innerHTML='';
  if(document.getElementById('manual-kcal')) document.getElementById('manual-kcal').value='';
  setMealInputMode('auto');
  rowCnt=0; addIngRow();
}
function closeMealModal(){document.getElementById('meal-modal').classList.remove('open');}
function selectMealType(el,type){
  S.selMealType=type;
  document.querySelectorAll('#meal-type-chips .type-chip').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
}

let rowCnt=0;
function addIngRow(){
  const id=++rowCnt;
  const row=document.createElement('div');
  row.className='ing-row'; row.id='ir-'+id;
  row.innerHTML=`<div style="width:100%">
    <div class="ing-search-wrap">
      <input class="ing-input" id="ii-${id}" placeholder="Ingrédient du frigo..." autocomplete="off"
        oninput="ingSearch(${id},this.value)" onblur="setTimeout(()=>hideSugg(${id}),180)">
      <div class="ing-sugg" id="is-${id}"></div>
    </div>
    <div id="ih-${id}" style="display:none;font-size:10px;color:var(--green-glow);padding:2px 0 0 2px;font-weight:600"></div>
  </div>
  <div class="qty-unit-wrap">
    <input class="qty-input" id="iq-${id}" type="number" placeholder="100" value="100" min="1">
    <select class="unit-select" id="iu-${id}">
      <option value="g">g</option>
      <option value="kg">kg</option>
      <option value="L">L</option>
      <option value="ml">ml</option>
      <option value="u">u</option>
    </select>
  </div>
  <button class="rem-row-btn" onclick="remRow(${id})">✕</button>`;
  document.getElementById('ing-list').appendChild(row);
}
function remRow(id){const el=document.getElementById('ir-'+id);if(el)el.remove();}
function ingSearch(id,val){
  const sugg=document.getElementById('is-'+id);
  if(val.length<2){sugg.style.display='none';return;}
  const m=allIng().filter(i=>i.toLowerCase().includes(val.toLowerCase())).slice(0,5);
  if(!m.length){sugg.style.display='none';return;}
  sugg.style.display='block';
  sugg.innerHTML=m.map(i=>`<div class="ing-sugg-item" onmousedown="pickIng(${id},'${Q(i)}')">${i}</div>`).join('');
}
function hideSugg(id){const el=document.getElementById('is-'+id);if(el)el.style.display='none';}
function pickIng(id,name){
  document.getElementById('ii-'+id).value=name;
  hideSugg(id);
  // Show raw-weight reminder for cereals/legumes/meats
  const ratio = getCookingRatio(name);
  const hint = document.getElementById('ih-'+id);
  if(hint && ratio){
    if(ratio.type==='cereal'||ratio.type==='legume'){
      hint.textContent=`⚖️ Peser cru — valeurs crues utilisées (${ratio.cooked_ratio}× à cuisson)`;
      hint.style.display='block';
    } else if(ratio.type==='protein'){
      hint.textContent=`⚖️ Peser cru — poids cuit ≈ ×${ratio.water_loss}`;
      hint.style.display='block';
    }
  }
}

// ============================================================
// NUTRITION DATABASE — valeurs pour 100g, standards fiables
// Règle : kcal/100g → calcul proportionnel strict
// ============================================================
// ============================================================
// BASE DE DONNÉES NUTRITIONNELLE OFFICIELLE — 244 aliments
// Source : kalo_nutrition_db — valeurs pour 100g ou unité
// Champs : kcal, p(protéines), g(glucides), l(lipides), f(fibres)
// ============================================================
// ============================================================
