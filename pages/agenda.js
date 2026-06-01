/**
 * KALO — agenda.js
 */

function renderCalendar(){
  const grid=document.getElementById('cal-grid'); if(!grid) return;
  const monthNames=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  document.getElementById('cal-month-title').textContent=`${monthNames[calMonth]} ${calYear}`;
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const todayKey=fullDateKey(new Date());
  const selKey=fullDateKey(S.selDate);
  const dowLabels=['D','L','M','M','J','V','S'];
  let html=dowLabels.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day empty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const key=toDateKey(calYear,calMonth,d);
    const isToday=key===todayKey;
    const isSel=key===selKey;
    const hasMeals=(S.meals[key]||[]).length>0;
    html+=`<div class="cal-day${isToday?' today':''}${isSel?' selected':''}${hasMeals?' has-meals':''}" onclick="calSelectDay(${d})">${d}</div>`;
  }
  grid.innerHTML=html;
}
function calSelectDay(d){
  S.selDate=new Date(calYear,calMonth,d);
  S.selDay=d;
  renderCalendar(); renderWeekNav(); renderDayContent();
}
function calPrev(){
  calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCalendar();
}
function calNext(){
  calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCalendar();
}

function updateWelcome(){
  const name=S.profileName||document.getElementById('profile-name')?.value||'';
  const greeting=name?`👋 Bonjour ${name} !`:'👋 Bonjour !';
  const el=document.getElementById('welcome-msg');
  if(el) el.textContent=`${greeting} Je suis KALO, votre coach nutrition. Demandez-moi un repas, ex : "Fais-moi le déjeuner de ce midi" ou dites-moi ce que vous avez mangé.`;
}

// ============================================================
// FRIGO
// ============================================================

