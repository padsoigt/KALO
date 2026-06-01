/**
 * KALO — profil.js
 */

function syncProfilScreen(){
  const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!==undefined&&v!==null&&v!=='')el.value=v;};
  set('profile-name',S.profileName);
  // Steps goal
  if(S.stepsGoal){ const sg=document.getElementById('steps-goal-input'); if(sg&&!sg.value) sg.value=S.stepsGoal; }
  set('profile-age',S.profileAge);
  set('profile-weight',S.profileWeight);
  set('profile-height',S.profileHeight);
  set('profile-target-weight',S.profileTargetWeight);
  set('steps-goal-input',S.stepsGoal||10000);
  set('water-goal-input',S.waterGoal||2000);
  if(S.customDeficit)set('profile-custom-deficit',S.customDeficit);
  const homme=document.getElementById('ob-btn-homme');
  const femme=document.getElementById('ob-btn-femme');
  if(homme)homme.classList.toggle('active',(S.gender||'homme')==='homme');
  if(femme)femme.classList.toggle('active',S.gender==='femme');
  applyDietChips();
  if(typeof applyCookModes==='function') applyCookModes();
  // Refresh mode display
  applyTheme();
}

// Alias for profil screen save (same as syncProfileForm target)
function saveProfile(){
  S.profileName=document.getElementById('profile-name')?.value||S.profileName;
  S.profileAge=document.getElementById('profile-age')?.value||S.profileAge;
  S.profileWeight=document.getElementById('profile-weight')?.value||S.profileWeight;
  S.profileHeight=document.getElementById('profile-height')?.value||S.profileHeight;
  S.profileTargetWeight=document.getElementById('profile-target-weight')?.value||S.profileTargetWeight;
  if(S.goal==='custom'){
    S.customDeficit=parseInt(document.getElementById('profile-custom-deficit')?.value)||600;
  }
  const {tdee,budget}=calcTDEE?.()||{tdee:S.tdee,budget:S.budget};
  S.tdee=tdee;S.budget=budget;
  save();
  updateTDEE();
  renderCalorieRing();
  renderHomeHeader();
  renderWeightChart();
  showToast('\u2705 Profil sauvegard\u00e9 !','OK',null,2000);
}


// ============================================================

