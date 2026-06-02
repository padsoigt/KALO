/**
 * KALO — accueil.js
 */

// MODULE: Water Tracking (IDB-backed, per-entry with timestamps)
// ============================================================
async function initWaterForToday(){
  S._waterEntries=await loadWaterForDate(fullDateKey(new Date()));
  renderWaterWidget();
}
function addWaterQuick(amount,unit){
  let ml=amount;
  if(unit==='cl')ml=amount*10;
  else if(unit==='L')ml=amount*1000;
  const now=new Date();
  const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  S._waterEntries.push({ml:Math.round(ml),label:`+${amount}${unit}`,time});
  const dateKey=fullDateKey(now);
  saveWaterForDate(dateKey,S._waterEntries).then(()=>{renderWaterWidget();updateAgendaWaterBar();});
}
function addWaterCustom(){
  const val=parseFloat(document.getElementById('water-custom-input')?.value)||0;
  const unit=document.getElementById('water-custom-unit')?.value||'ml';
  if(val<=0)return;
  addWaterQuick(val,unit);
  document.getElementById('water-custom-input').value='';
}
function saveWaterGoal(){
  const val=parseInt(document.getElementById('water-goal-input')?.value)||2000;
  S.waterGoal=Math.max(500,Math.min(6000,val));
  save();renderWaterWidget();
  const btn=document.querySelector('button[onclick="saveWaterGoal()"]');
  if(btn){btn.textContent='✓';setTimeout(()=>btn.textContent='Valider',1500);}
}
function renderWaterWidget(){
  const goal=S.waterGoal||2000;
  const entries=S._waterEntries||[];
  const current=entries.reduce((s,e)=>s+(e.ml||0),0);
  const pct=Math.min(Math.round(current/goal*100),100);
  const goalInput=document.getElementById('water-goal-input');
  if(goalInput&&!goalInput.value)goalInput.value=goal;
  const amtLbl=document.getElementById('water-amount-lbl');
  const goalLbl=document.getElementById('water-goal-lbl');
  const pctLbl=document.getElementById('water-pct-lbl');
  const progFill=document.getElementById('water-prog-fill');
  if(amtLbl)amtLbl.textContent=current>=1000?`${(current/1000).toFixed(2).replace(/\.?0+$/,'')} L`:`${current} ml`;
  if(goalLbl)goalLbl.textContent=goal>=1000?`${goal/1000}L`:`${goal}`;
  if(pctLbl){pctLbl.textContent=pct+'%';pctLbl.style.color=pct>=100?'#27ae60':pct>=70?'#2980b9':'#5dade2';}
  if(progFill)progFill.style.width=pct+'%';
  updateAgendaWaterBar();
}
function updateAgendaWaterBar(){
  const goal=S.waterGoal||2000;
  const current=(S._waterEntries||[]).reduce((s,e)=>s+(e.ml||0),0);
  const pct=Math.min(current/goal*100,100);
  const bar=document.getElementById('agenda-water-fill');
  const lbl=document.getElementById('agenda-water-lbl');
  if(bar)bar.style.width=pct+'%';
  if(lbl)lbl.textContent=`💧 ${current>=1000?(current/1000).toFixed(1)+'L':current+'ml'} / ${goal>=1000?goal/1000+'L':goal+'ml'}`;
}

// ============================================================
// MODULE: Weight Popup — editable entries
// ============================================================

function openWeightPopup(){
  const log=S.weightLog||[];
  const h=parseInt(document.getElementById('profile-height')?.value)||S.profileHeight||170;
  const hm=h/100;
  let rows=log.length===0
    ?'<p style="text-align:center;color:var(--text-muted);padding:18px;font-size:13px">Aucune entrée. Ajoutez votre premier poids.</p>'
    :[...log].reverse().map((e,ri)=>{
        const imc=hm>0?Math.round((e.weight/(hm*hm))*10)/10:null;
        const d=new Date(e.date+'T12:00:00');
        const lbl=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
        const actualIdx=log.length-1-ri;
        return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:12px;color:var(--text-muted);min-width:72px">${lbl}</span>
          <input type="number" id="wedit-kg-${actualIdx}" value="${e.weight}" step="0.1" min="30" max="300"
            style="width:72px;padding:5px 8px;border-radius:8px;border:1.5px solid var(--border);background:var(--bg-tertiary);color:var(--text);font-family:'DM Sans',sans-serif;font-size:14px;font-weight:700;text-align:center;outline:none"
            onfocus="this.style.borderColor='var(--green-glow)'" onblur="this.style.borderColor='var(--border)'">
          <span style="font-size:11px;color:var(--text-muted);flex:1">${imc?`IMC ${imc}`:''}</span>
          <button onclick="saveWeightEdit(${actualIdx},'${e.date}')"
            style="padding:5px 10px;border-radius:7px;border:none;background:var(--green-dark);color:white;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;cursor:pointer">✓</button>
          <button onclick="deleteWeightPopupEntry('${e.date}')"
            style="padding:5px 9px;border-radius:7px;border:1px solid var(--border);background:none;color:var(--danger);font-family:'DM Sans',sans-serif;font-size:12px;cursor:pointer">✕</button>
        </div>`;
      }).join('');
  document.getElementById('weight-popup-list').innerHTML=rows;
  document.getElementById('weight-popup-date').value=fullDateKey(new Date());
  document.getElementById('weight-popup-kg').value='';
  document.getElementById('weight-popup-overlay').classList.add('open');
  // Update latest display
  if(log.length>0){
    const last=log[log.length-1];
    const ld=document.getElementById('weight-latest-display');
    if(ld)ld.textContent=last.weight+' kg';
  }
}
function closeWeightPopup(){document.getElementById('weight-popup-overlay').classList.remove('open');}
function saveWeightEdit(idx,dateKey){
  const val=parseFloat(document.getElementById('wedit-kg-'+idx)?.value);
  if(!val||val<30||val>300)return;
  if(!S.weightLog)S.weightLog=[];
  if(S.weightLog[idx])S.weightLog[idx].weight=val;
  save();saveWeightIDB(dateKey,val);
  renderWeightChart();openWeightPopup();
  showToast('✅ Poids modifié','OK',null,1800);
}
function deleteWeightPopupEntry(dateKey){
  if(!S.weightLog)return;
  S.weightLog=S.weightLog.filter(e=>e.date!==dateKey);
  save();deleteWeightIDB(dateKey);
  renderWeightChart();openWeightPopup();
}
function addWeightFromPopup(){
  const dateKey=document.getElementById('weight-popup-date')?.value||fullDateKey(new Date());
  const val=parseFloat(document.getElementById('weight-popup-kg')?.value);
  if(!val||val<30||val>300){showToast('⚠️ Poids invalide (30–300 kg)','OK',null,2000);return;}
  if(!S.weightLog)S.weightLog=[];
  const ex=S.weightLog.findIndex(e=>e.date===dateKey);
  if(ex!==-1){S.weightLog[ex].weight=val;}
  else{S.weightLog.push({date:dateKey,weight:val});S.weightLog.sort((a,b)=>a.date.localeCompare(b.date));}
  if(S.weightLog.length>365)S.weightLog=S.weightLog.slice(-365);
  save();saveWeightIDB(dateKey,val);
  const prev=parseFloat(S.profileWeight)||0;
  if(prev&&dateKey===fullDateKey(new Date())&&Math.abs(val-prev)>=1){
    setTimeout(()=>showToast(`⚖️ Poids changé (${prev}→${val}kg). Recalculer TDEE ?`,'Recalculer',()=>switchTab('profil')),500);
  }
  renderWeightChart();openWeightPopup();
}

// ============================================================
// MODULE: Water Popup — per-entry log
// ============================================================

function openWaterPopup(){
  const dateKey=fullDateKey(new Date());
  loadWaterForDate(dateKey).then(entries=>{
    S._waterEntries=entries||[];
    _buildWaterPopupList(dateKey);
    document.getElementById('water-popup-overlay').classList.add('open');
  });
}
function closeWaterPopup(){document.getElementById('water-popup-overlay').classList.remove('open');}
function _buildWaterPopupList(dateKey){
  const entries=S._waterEntries||[];
  const total=entries.reduce((s,e)=>s+(e.ml||0),0);
  const goal=S.waterGoal||2000;
  const pct=Math.min(Math.round(total/goal*100),100);
  const rows=entries.length===0
    ?'<p style="text-align:center;color:var(--text-muted);padding:14px;font-size:13px">Aucune entr\u00e9e aujourd\u2019hui.</p>'
    :entries.map((e,i)=>`<div style="display:flex;align-items:center;gap:7px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:11px;color:var(--text-muted);min-width:36px">${e.time||''}</span>
        <span style="font-size:12px;color:var(--text-secondary);flex:1">${e.label||'Eau'}</span>
        <input type="number" id="wedit-water-${i}" value="${e.ml}" min="1" max="5000"
          style="width:68px;padding:4px 6px;border-radius:7px;border:1.5px solid var(--border);background:var(--bg-tertiary);color:var(--text);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:700;text-align:center;outline:none"
          onfocus="this.style.borderColor='#2980b9'" onblur="this.style.borderColor='var(--border)'">
        <span style="font-size:11px;color:var(--text-muted)">ml</span>
        <button onclick="saveWaterEdit(${i},'${dateKey}')"
          style="padding:4px 9px;border-radius:7px;border:none;background:#2980b9;color:white;font-size:11px;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif">✓</button>
        <button onclick="deleteWaterPopupEntry(${i},'${dateKey}')"
          style="padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:none;color:var(--danger);font-size:12px;cursor:pointer;font-family:'DM Sans',sans-serif">✕</button>
      </div>`).join('');
  document.getElementById('water-popup-list').innerHTML=rows;
  const totEl=document.getElementById('water-popup-total');
  if(totEl){
    totEl.textContent=`${total} ml / ${goal} ml · ${pct}%`;
    totEl.style.color=pct>=100?'#27ae60':'#2980b9';
  }
}
function saveWaterEdit(idx,dateKey){
  const val=parseInt(document.getElementById('wedit-water-'+idx)?.value)||0;
  if(val<=0)return;
  S._waterEntries[idx].ml=val;
  saveWaterForDate(dateKey,S._waterEntries).then(()=>{renderWaterWidget();_buildWaterPopupList(dateKey);});
}
function deleteWaterPopupEntry(idx,dateKey){
  S._waterEntries.splice(idx,1);
  saveWaterForDate(dateKey,S._waterEntries).then(()=>{renderWaterWidget();_buildWaterPopupList(dateKey);});
}
function addWaterFromPopup(){
  const val=parseInt(document.getElementById('water-popup-input')?.value)||0;
  const unit=document.getElementById('water-popup-unit')?.value||'ml';
  const label=document.getElementById('water-popup-label')?.value||'Eau';
  if(val<=0)return;
  let ml=val;
  if(unit==='cl')ml=val*10;
  else if(unit==='L')ml=val*1000;
  const now=new Date();
  const time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  const dateKey=fullDateKey(now);
  S._waterEntries.push({ml:Math.round(ml),label:label||`+${val}${unit}`,time});
  saveWaterForDate(dateKey,S._waterEntries).then(()=>{
    renderWaterWidget();
    _buildWaterPopupList(dateKey);
    updateAgendaWaterBar();
  });
  document.getElementById('water-popup-input').value='';
  document.getElementById('water-popup-label').value='';
}


// ============================================================

// MODULE: Steps Tracker
// ============================================================
function openStepsInput(){
  const wrap=document.getElementById('steps-input-wrap');
  if(wrap) wrap.style.display=wrap.style.display==='none'?'block':'none';
  const inp=document.getElementById('steps-input');
  if(inp){inp.value=(S.stepsLog&&S.stepsLog[fullDateKey(new Date())])||'';inp.focus();}
}
function closeStepsInput(){
  const wrap=document.getElementById('steps-input-wrap');
  if(wrap)wrap.style.display='none';
}
function saveSteps(){
  const val=parseInt(document.getElementById('steps-input')?.value)||0;
  if(val<0||val>100000)return;
  const dateKey=fullDateKey(new Date());
  if(!S.stepsLog)S.stepsLog={};
  S.stepsLog[dateKey]=val;
  // Save immediately to both LS and IDB
  lsBackup();
  if(_idb) idbPut('profile',{key:'main',data:(()=>{const d={...S};delete d.selDate;delete d._waterEntries;return d;})()}).catch(()=>{});
  closeStepsInput();renderStepsWidget();renderCalorieRing();
  showToast('\u{1F45F} Pas enregistr\u00e9s\u00a0: '+val.toLocaleString('fr-FR'),'OK',null,2000);
}
function saveStepsGoal(){
  const val=parseInt(document.getElementById('steps-goal-input')?.value)||10000;
  S.stepsGoal=Math.max(1000,Math.min(50000,val));
  save();renderStepsWidget();
  const btn=document.querySelector('button[onclick="saveStepsGoal()"]');
  if(btn){btn.textContent='\u2713';setTimeout(()=>btn.textContent='OK',1500);}
}
function renderStepsWidget(){
  const dateKey=fullDateKey(new Date());
  const steps=(S.stepsLog&&S.stepsLog[dateKey])||0;
  const goal=S.stepsGoal||10000;
  const pct=Math.min(Math.round(steps/goal*100),100);
  const weight=parseFloat(S.profileWeight)||70;
  const kcalBurned=Math.round(steps*0.04*(weight/70));
  const distKm=(steps*0.00075).toFixed(1);
  const el=id=>document.getElementById(id);
  if(el('steps-count'))el('steps-count').textContent=steps.toLocaleString('fr-FR');
  if(el('steps-goal-lbl'))el('steps-goal-lbl').textContent=goal.toLocaleString('fr-FR');
  if(el('steps-pct-lbl'))el('steps-pct-lbl').textContent=pct+'%';
  if(el('steps-bar'))el('steps-bar').style.width=pct+'%';
  if(el('steps-kcal-lbl'))el('steps-kcal-lbl').textContent='\u2248 '+kcalBurned+' kcal br\u00fbl\u00e9es';
  if(el('steps-dist-lbl'))el('steps-dist-lbl').textContent='\u2248 '+distKm+' km';
  if(el('steps-goal-input')&&!el('steps-goal-input').value)el('steps-goal-input').value=goal;
  return kcalBurned;
}

// ============================================================

// MODULE: Calorie Ring
// ============================================================
function renderCalorieRing(){
  const dateKey=fullDateKey(new Date());
  const meals=S.meals[dateKey]||[];
  const consumed=meals.reduce((t,m)=>t+(m.kcal||0),0);
  const budget=S.budget||S.tdee||2000;
  const age=parseInt(S.profileAge)||26;
  const weight=parseFloat(S.profileWeight)||70;
  const height=parseInt(S.profileHeight)||170;
  const gender=S.gender||'homme';
  let bmr=gender==='homme'
    ?Math.round(10*weight+6.25*height-5*age+5)
    :Math.round(10*weight+6.25*height-5*age-161);
  const stepsKcal=renderStepsWidget();
  const totalBurned=bmr+stepsKcal;
  const remaining=Math.max(0,budget-consumed);
  const pct=Math.min(consumed/budget,1);
  const circumference=289;
  const offset=circumference-(pct*circumference);
  const el=id=>document.getElementById(id);
  if(el('ring-remaining'))el('ring-remaining').textContent=remaining.toLocaleString('fr-FR');
  if(el('ring-consumed'))el('ring-consumed').textContent=consumed+' kcal';
  if(el('ring-budget'))el('ring-budget').textContent=budget+' kcal';
  if(el('ring-burned'))el('ring-burned').textContent=totalBurned+' kcal';
  if(el('calorie-ring')){
    el('calorie-ring').style.strokeDashoffset=offset;
    el('calorie-ring').style.stroke=pct>=1?'var(--danger)':pct>=0.85?'var(--orange)':'var(--green-glow)';
  }
  if(stepsKcal>0&&el('ring-steps-bonus'))el('ring-steps-bonus').textContent='(+'+stepsKcal+' pas)';
  const totalP=meals.reduce((t,m)=>t+(m.proteines||m.p||0),0);
  const totalG=meals.reduce((t,m)=>t+(m.glucides||m.g||0),0);
  const totalL=meals.reduce((t,m)=>t+(m.lipides||m.l||0),0);
  const tP=Math.round(budget*0.30/4),tG=Math.round(budget*0.45/4),tL=Math.round(budget*0.25/9);
  const pctP=Math.min(totalP/(tP||1)*100,100);
  const pctG=Math.min(totalG/(tG||1)*100,100);
  const pctL=Math.min(totalL/(tL||1)*100,100);
  if(el('macro-p-val'))el('macro-p-val').textContent=Math.round(totalP)+'g';
  if(el('macro-g-val'))el('macro-g-val').textContent=Math.round(totalG)+'g';
  if(el('macro-l-val'))el('macro-l-val').textContent=Math.round(totalL)+'g';
  if(el('macro-p-bar'))el('macro-p-bar').style.width=pctP+'%';
  if(el('macro-g-bar'))el('macro-g-bar').style.width=pctG+'%';
  if(el('macro-l-bar'))el('macro-l-bar').style.width=pctL+'%';
}

// ── Home header ───────────────────────────────────────────────
function renderHomeHeader(){
  const days=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const months=['janvier','f\u00e9vrier','mars','avril','mai','juin','juillet','ao\u00fbt','septembre','octobre','novembre','d\u00e9cembre'];
  const now=new Date();
  const el=id=>document.getElementById(id);
  if(el('home-name'))el('home-name').textContent=S.profileName||'';
  if(el('home-date'))el('home-date').textContent=days[now.getDay()]+' '+now.getDate()+' '+months[now.getMonth()];
  const w=parseFloat(S.profileWeight)||0,h=parseInt(S.profileHeight)||0;
  if(w&&h&&el('weight-imc-display'))el('weight-imc-display').textContent='IMC '+Math.round(w/((h/100)**2)*10)/10;
}

// ── Activity / Goal selectors for profil screen ───────────────
function selectActivity(elBtn,val){
  document.querySelectorAll('#screen-profil .activity-options .activity-opt').forEach(o=>o.classList.remove('selected'));
  if(elBtn)elBtn.classList.add('selected');
  S.activity=val;updateProfilePreview();
}
function selectGoal(elBtn,val){
  document.querySelectorAll('#screen-profil .goal-options .activity-opt').forEach(o=>o.classList.remove('selected'));
  if(elBtn)elBtn.classList.add('selected');
  S.goal=val;
  const wrap=document.getElementById('profile-custom-deficit-wrap');
  if(wrap)wrap.style.display=val==='custom'?'block':'none';
  updateProfilePreview();
}
function updateProfilePreview(){
  const age=parseInt(document.getElementById('profile-age')?.value)||S.profileAge||26;
  const w=parseFloat(document.getElementById('profile-weight')?.value)||S.profileWeight||70;
  const h=parseInt(document.getElementById('profile-height')?.value)||S.profileHeight||170;
  if(!age||!w||!h)return;
  const preview=document.getElementById('profile-tdee-preview');
  if(preview)preview.style.display='block';
  const gender=S.gender||'homme';
  let bmr=gender==='homme'?Math.round(10*w+6.25*h-5*age+5):Math.round(10*w+6.25*h-5*age-161);
  const actMap={sedentaire:1.2,leger:1.375,modere:1.55,actif:1.725};
  const tdee=Math.round(bmr*(actMap[S.activity]||1.2));
  const customD=parseInt(document.getElementById('profile-custom-deficit')?.value)||600;
  const defMap={deficit_doux:250,deficit_modere:500,deficit_fort:750,maintien:0,custom:customD};
  const budget=Math.max(1200,tdee-(defMap[S.goal]||500));
  const el=id=>document.getElementById(id);
  if(el('prev-bmr'))el('prev-bmr').textContent=bmr+' kcal';
  if(el('prev-tdee'))el('prev-tdee').textContent=tdee+' kcal';
  if(el('prev-budget'))el('prev-budget').textContent=budget+' kcal/jour';
}

// MODULE: Home Analytics — période + chart + résumé
// ============================================================
var homePeriod = 'week';

function setHomePeriod(btn, period){
  homePeriod = period;
  // Only remove active from home period buttons (not other .period-btn on the page)
  ['hbtn-week','hbtn-month','hbtn-3month'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.classList.remove('active');
  });
  if(btn) btn.classList.add('active');
  renderHomeAnalytics();
}

function renderHomeAnalytics(){
  const days    = getDays(homePeriod);
  const budget  = S.budget || S.tdee || 2000;
  const n       = days.length;

  // Compute kcal per day
  const data = days.map(d => {
    const key  = fullDateKey(d);
    const kcal = (S.meals[key] || []).reduce((t, m) => t + (m.kcal || 0), 0);
    return { date: d, key, kcal };
  });

  // Active days (have entries)
  const active = data.filter(d => d.kcal > 0);
  const total  = data.reduce((t, d) => t + d.kcal, 0);
  const avg    = active.length ? Math.round(total / active.length) : 0;
  const deficit= Math.max(0, Math.round(budget * n - total));

  const periodLbls = { week:'sur 7 jours', month:'sur 30 jours', '3month':'sur 90 jours' };

  const el = id => document.getElementById(id);
  if(el('home-avg-kcal'))    el('home-avg-kcal').textContent    = (avg || '—') + (avg ? ' kcal' : '');
  if(el('home-budget-lbl'))  el('home-budget-lbl').textContent  = budget;
  if(el('home-deficit-total')) el('home-deficit-total').textContent = deficit ? deficit + ' kcal' : '—';
  if(el('home-period-lbl'))  el('home-period-lbl').textContent  = periodLbls[homePeriod] || '';

  // Color avg
  if(el('home-avg-kcal')){
    const ratio = avg / budget;
    el('home-avg-kcal').style.color = ratio >= 1 ? 'var(--danger)' : ratio >= 0.9 ? 'var(--orange)' : 'var(--green-glow)';
  }

  renderHomeChart(data, budget);

  // Add export button below table
  const wrap = document.getElementById('home-bar-chart-wrap');
  if(wrap){
    const exportDiv = document.createElement('div');
    exportDiv.style.cssText = 'margin-top:12px;display:flex;justify-content:flex-end';
    exportDiv.innerHTML = `<button onclick="exportAnalytics()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1.5px solid var(--border);background:none;color:var(--text-secondary);font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Exporter
    </button>`;
    wrap.appendChild(exportDiv);
  }
}

function renderHomeChart(data, budget){
  const wrap = document.getElementById('home-bar-chart-wrap');
  if(!wrap) return;

  // Build rows depending on period
  let rows = [];
  const dayNames = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const mNames   = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  if(homePeriod === 'week'){
    rows = data.map(d => ({
      label:   dayNames[d.date.getDay()] + ' ' + d.date.getDate() + '/' + (d.date.getMonth()+1),
      kcal:    d.kcal,
      deficit: d.kcal > 0 ? budget - d.kcal : null,
      hasData: d.kcal > 0,
      isToday: d.key === fullDateKey(new Date()),
    }));
  } else if(homePeriod === 'month'){
    const weeks = [];
    let week = { days:[], kcal:0 };
    data.forEach((d, i) => {
      week.days.push(d);
      week.kcal += d.kcal;
      if(d.date.getDay() === 0 || i === data.length-1){
        const first = week.days[0].date;
        const last  = week.days[week.days.length-1].date;
        const active = week.days.filter(d=>d.kcal>0).length;
        const avgKcal = active ? Math.round(week.kcal / active) : 0;
        weeks.push({ label: first.getDate()+'/'+( first.getMonth()+1)+' → '+last.getDate()+'/'+(last.getMonth()+1), kcal: avgKcal, hasData: active > 0 });
        week = { days:[], kcal:0 };
      }
    });
    rows = weeks.map(w => ({ ...w, deficit: w.hasData ? budget - w.kcal : null, isToday: false }));
  } else {
    const byMonth = {};
    data.forEach(d => {
      const k = d.date.getMonth() + '-' + d.date.getFullYear();
      if(!byMonth[k]) byMonth[k] = { label: mNames[d.date.getMonth()]+' '+d.date.getFullYear(), kcal:0, count:0 };
      byMonth[k].kcal += d.kcal;
      if(d.kcal > 0) byMonth[k].count++;
    });
    rows = Object.values(byMonth).map(m => {
      const avg = m.count ? Math.round(m.kcal / m.count) : 0;
      return { label: m.label, kcal: avg, deficit: m.count ? budget - avg : null, hasData: m.count > 0, isToday: false };
    });
  }

  // Build table rows HTML
  const rowsHtml = rows.map(row => {
    if(!row.hasData) return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 8px;font-size:12px;font-weight:600;color:${row.isToday?'var(--green-glow)':'var(--text-muted)'}">${row.label}${row.isToday?' ●':''}</td>
        <td style="padding:7px 8px;font-size:12px;color:var(--text-muted);text-align:right">—</td>
        <td style="padding:7px 8px;font-size:12px;color:var(--text-muted);text-align:right">—</td>
      </tr>`;
    const defVal  = row.deficit;
    const defColor = defVal >= 0 ? 'var(--green-glow)' : 'var(--danger)';
    const defStr  = defVal >= 0 ? '-'+defVal+' kcal' : '+'+Math.abs(defVal)+' kcal';
    const kcalColor = row.kcal > budget ? 'var(--danger)' : row.kcal > budget*0.9 ? 'var(--orange)' : 'var(--text)';
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:7px 8px;font-size:12px;font-weight:${row.isToday?'700':'500'};color:${row.isToday?'var(--green-glow)':'var(--text)'}">${row.label}${row.isToday?' ●':''}</td>
        <td style="padding:7px 8px;font-size:13px;font-weight:700;color:${kcalColor};text-align:right">${row.kcal}</td>
        <td style="padding:7px 8px;font-size:12px;font-weight:700;color:${defColor};text-align:right">${defStr}</td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="border-bottom:2px solid var(--border)">
          <th style="padding:6px 8px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:left">Période</th>
          <th style="padding:6px 8px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Kcal</th>
          <th style="padding:6px 8px;font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;text-align:right">Déficit</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}


function exportAnalytics(){
  const days    = getDays(homePeriod);
  const budget  = S.budget || S.tdee || 2000;
  const dayNames= ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
  const mNames  = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const periodLabel = {week:'7 jours', month:'1 mois', '3month':'3 mois'}[homePeriod];

  // Build CSV
  const lines = ['Période,Kcal consommées,Déficit,Objectif'];
  days.forEach(d => {
    const key   = fullDateKey(d);
    const kcal  = (S.meals[key]||[]).reduce((t,m)=>t+(m.kcal||0),0);
    const def   = budget - kcal;
    const label = dayNames[d.getDay()]+' '+d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear();
    lines.push(`"${label}",${kcal||0},${kcal?def:0},${budget}`);
  });

  // Add summary row
  const total   = days.reduce((t,d)=>t+(S.meals[fullDateKey(d)]||[]).reduce((s,m)=>s+(m.kcal||0),0),0);
  const active  = days.filter(d=>(S.meals[fullDateKey(d)]||[]).length>0).length;
  const avg     = active ? Math.round(total/active) : 0;
  lines.push('');
  lines.push(`"Moyenne / jour (${active} jours actifs)",${avg},${budget-avg},${budget}`);

  const csv  = lines.join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g,'-');
  a.href     = url;
  a.download = `kalo_analyse_${periodLabel.replace(' ','_')}_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('\u2705 Export CSV t\u00e9l\u00e9charg\u00e9 !','OK',null,2000);
}

// ── Boot (all functions defined above, safe to call initApp) ──
document.addEventListener('DOMContentLoaded', function(){
(async function bootKalo(){
  try {
    await loadIDB();
  } catch(e) {
    console.warn('[Boot] IDB failed, using localStorage:', e);
    loadLS();
  }
  try {
    await loadNutritionFiles();
  } catch(e) {
    console.warn('[Boot] Nutrition files not loaded:', e);
  }
  if(!S.onboardingDone){
    document.getElementById('onboarding-screen').style.display='flex';
    applyTheme();
  } else {
    document.getElementById('onboarding-screen').style.display='none';
    initApp();
  }
})();
}); // end DOMContentLoaded
