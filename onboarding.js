/**
 * KALO — export.js
 */

// MODULE: Export / Import — repas & frigo
// Format JSON avec métadonnées de version pour compatibilité
// ============================================================

// ── Export repas ──────────────────────────────────────────────
function exportMeals(){
  const meals = S.meals || {};
  const nbJours = Object.keys(meals).length;
  const nbRepas = Object.values(meals).reduce((t, m) => t + m.length, 0);
  const data = {
    version: '1.0',
    type: 'kalo_meals',
    exportDate: new Date().toISOString(),
    meals,  // ALL meals, no filter
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  a.href     = url;
  a.download = `kalo_repas_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(
    nbRepas > 0
      ? `✅ ${nbRepas} repas exportés (${nbJours} jours)`
      : '⚠️ Aucun repas à exporter',
    'OK', null, 2500
  );
}

// ── Import repas ──────────────────────────────────────────────
function triggerImportMeals(){
  document.getElementById('import-meals-file').click();
}

function importMeals(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      // Validate format
      if(data.type !== 'kalo_meals' || !data.meals){
        showToast('\u274C Fichier invalide \u2014 ce n\u2019est pas un export KALO repas', 'OK', null, 3000);
        return;
      }
      // Count meals
      const days = Object.keys(data.meals).length;
      const total = Object.values(data.meals).reduce((s,m) => s + m.length, 0);
      // Merge strategy: imported meals are ADDED to existing, no overwrite
      let added = 0, skipped = 0;
      for(const [dateKey, meals] of Object.entries(data.meals)){
        const existing = S.meals[dateKey] || [];
        const existingNames = existing.map(m => m.name?.toLowerCase());
        const toAdd = meals.filter(m => !existingNames.includes(m.name?.toLowerCase()));
        if(toAdd.length > 0){
          S.meals[dateKey] = [...existing, ...toAdd];
          if(_idb) await idbPut('meals', { date: dateKey, meals: S.meals[dateKey] }).catch(()=>{});
          added += toAdd.length;
        }
        skipped += meals.length - toAdd.length;
      }
      save();
      renderAgenda();
      showToast(`✅ Import terminé : ${added} repas ajoutés${skipped > 0 ? `, ${skipped} ignorés (doublons)` : ''}`, 'OK', null, 4000);
    } catch(err) {
      showToast('\u274C Erreur lors de l\u2019import : fichier corrompu', 'OK', null, 3000);
      console.error('Import error:', err);
    }
  };
  reader.readAsText(file);
  input.value = ''; // reset so same file can be re-imported
}

// ── Export frigo ──────────────────────────────────────────────
function exportFrigo(){
  const data = {
    version: '1.0',
    type: 'kalo_frigo',
    exportDate: new Date().toISOString(),
    ingredients: S.ingredients || {},
    archive: S.archive || [],
    customNutrition: S.customNutrition || {},
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  a.href     = url;
  a.download = `kalo_frigo_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Frigo exporté avec succès !', 'OK', null, 2500);
}

// ── Import frigo ──────────────────────────────────────────────
function triggerImportFrigo(){
  document.getElementById('import-frigo-file').click();
}

function importFrigo(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if(data.type !== 'kalo_frigo' || !data.ingredients){
        showToast('\u274C Fichier invalide \u2014 ce n\u2019est pas un export KALO frigo', 'OK', null, 3000);
        return;
      }
      let added = 0;
      for(const [cat, items] of Object.entries(data.ingredients)){
        if(!S.ingredients[cat]) S.ingredients[cat] = [];
        const existing = S.ingredients[cat].map(i => i.toLowerCase());
        const toAdd = (items || []).filter(i => !existing.includes(i.toLowerCase()));
        S.ingredients[cat].push(...toAdd);
        added += toAdd.length;
        if(_idb) await idbPut('ingredients', { category: cat, items: S.ingredients[cat] }).catch(()=>{});
      }
      if(data.customNutrition) Object.assign(S.customNutrition, data.customNutrition);
      if(Array.isArray(data.archive)){
        const existingArchive = (S.archive || []).map(a => a.name?.toLowerCase());
        const newArchive = data.archive.filter(a => !existingArchive.includes(a.name?.toLowerCase()));
        S.archive = [...(S.archive || []), ...newArchive];
      }
      save();
      renderFrigo();
      showToast('\u2705 Frigo import\u00e9 : ' + added + ' ingr\u00e9dients ajout\u00e9s', 'OK', null, 3000);
    } catch(err) {
      showToast('\u274C Erreur lors de l\u2019import frigo', 'OK', null, 3000);
      console.error('Import frigo error:', err);
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ── Export complet (repas + macros + ingrédients) ─────────────
function exportCompletData(){
  const meals = S.meals || {};
  const ingredients = S.ingredients || {};
  const customNutrition = S.customNutrition || {};
  const weightLog = S.weightLog || [];
  const stepsLog = S.stepsLog || {};

  // Build meal details with macros
  const mealDetails = {};
  let totalMeals = 0;
  for(const [dateKey, dayMeals] of Object.entries(meals)){
    if(!dayMeals||!dayMeals.length) continue;
    mealDetails[dateKey] = dayMeals.map(m => {
      totalMeals++;
      return {
        nom: m.name||m.nom||'Repas',
        type: m.type||'',
        calories: m.kcal||0,
        proteines_g: Math.round((m.proteines||m.p||0)*10)/10,
        glucides_g: Math.round((m.glucides||m.g||0)*10)/10,
        lipides_g: Math.round((m.lipides||m.l||0)*10)/10,
        fibres_g: Math.round((m.fibres||m.f||0)*10)/10,
        ingredients: (m.ingredients||[]).map(ing=>({
          nom: ing.name||ing.nom,
          quantite: ing.qty||ing.quantite||'',
          unite: ing.unit||ing.unite||'g'
        }))
      };
    });
  }

  // Flat ingredient list
  const allIngredients = [];
  for(const [cat, items] of Object.entries(ingredients)){
    (items||[]).forEach(name=>{
      const key = typeof name==='string'?name.toLowerCase():'';
      const nutr = customNutrition[key]||null;
      allIngredients.push({
        nom: name,
        categorie: cat,
        valeurs_personnalisees: nutr?{
          kcal_100g: nutr.kcal||null,
          proteines_g: nutr.p||null,
          glucides_g: nutr.g||null,
          lipides_g: nutr.l||null,
          fibres_g: nutr.f||null
        }:null
      });
    });
  }

  const profil = {
    prenom: S.profileName||'',
    age: S.profileAge||'',
    poids_kg: S.profileWeight||'',
    taille_cm: S.profileHeight||'',
    poids_objectif_kg: S.profileTargetWeight||'',
    genre: S.gender||'',
    activite: S.activity||'',
    objectif: S.goal||'',
    TDEE_kcal: S.tdee||0,
    budget_kcal: S.budget||0,
    budget_personnalise_kcal: S.customBudgetKcal||0,
    objectif_pas_jour: S.stepsGoal||10000,
    objectif_eau_ml: S.waterGoal||2000
  };

  const allDaysKcal = Object.values(mealDetails).map(day=>day.reduce((t,m)=>t+m.calories,0));
  const avgKcal = allDaysKcal.length?Math.round(allDaysKcal.reduce((a,b)=>a+b,0)/allDaysKcal.length):0;

  const data = {
    version: '2.0',
    type: 'kalo_export_complet',
    exportDate: new Date().toISOString(),
    profil,
    statistiques: {
      total_repas: totalMeals,
      jours_avec_donnees: Object.keys(mealDetails).length,
      moyenne_kcal_par_jour: avgKcal,
      budget_kcal: S.budget||0
    },
    repas_par_jour: mealDetails,
    ingredients_frigo: allIngredients,
    historique_poids: weightLog,
    historique_pas: stepsLog
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob(['\uFEFF'+json], {type:'application/json;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  a.href     = url;
  a.download = `kalo_export_complet_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`✅ Export complet : ${totalMeals} repas + ${allIngredients.length} ingrédients`, 'OK', null, 3000);
}

// ── Export CSV macros ─────────────────────────────────────────
function exportMacrosCSV(){
  const meals = S.meals || {};
  const lines = ['\uFEFFDate,Repas,Type,Kcal,Protéines(g),Glucides(g),Lipides(g),Fibres(g),Ingrédients'];
  for(const [dateKey, dayMeals] of Object.entries(meals)){
    (dayMeals||[]).forEach(m=>{
      const ings = (m.ingredients||[]).map(i=>`${i.name||i.nom||''}${i.qty?' '+i.qty+(i.unit||i.unite||'g'):''}`)
        .join(' | ');
      lines.push([
        dateKey,
        `"${(m.name||m.nom||'Repas').replace(/"/g,'""')}"`,
        m.type||'',
        m.kcal||0,
        Math.round((m.proteines||m.p||0)*10)/10,
        Math.round((m.glucides||m.g||0)*10)/10,
        Math.round((m.lipides||m.l||0)*10)/10,
        Math.round((m.fibres||m.f||0)*10)/10,
        `"${ings.replace(/"/g,'""')}"`
      ].join(','));
    });
  }
  const csv = lines.join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  a.href     = url;
  a.download = `kalo_macros_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  const total = Object.values(meals).reduce((t,d)=>t+(d||[]).length,0);
  showToast(`✅ CSV macros exporté : ${total} repas`, 'OK', null, 2500);
}

// ============================================================
