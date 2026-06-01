/**
 * KALO — export.js
 */

// MODULE: Export / Import — repas & frigo
// Format JSON avec métadonnées de version pour compatibilité
// ============================================================

// ── Export repas ──────────────────────────────────────────────
function exportMeals(){
  const data = {
    version: '1.0',
    type: 'kalo_meals',
    exportDate: new Date().toISOString(),
    meals: S.meals || {},
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
  showToast('✅ Repas exportés avec succès !', 'OK', null, 2500);
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

// ============================================================
