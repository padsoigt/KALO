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


