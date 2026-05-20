/**
 * KALO — nutrition.js
 * Moteur nutritionnel : chargement JSON, recherche, estimation calories
 *
 * Les données viennent de data/nutrition.json (467 aliments) et
 * data/composite_foods.json (38 plats composés).
 * Aucune donnée en dur dans ce fichier — tout vient des fichiers JSON.
 */

// ── State ─────────────────────────────────────────────────────
let _foods        = [];   // tous les aliments de base
let _composites   = [];   // plats composés (pizza, sushi...)
let _conversions  = [];   // ratios cru/cuit
let _customFoods  = [];   // aliments personnalisés de l'utilisateur
let _index        = {};   // index nom → food (lowercase, sans accents)
let _loaded       = false;

// ── Loading ───────────────────────────────────────────────────
export async function loadNutritionData(basePath = '.') {
  if (_loaded) return true;
  try {
    const [foodsRes, compRes, convRes] = await Promise.all([
      fetch(`${basePath}/data/nutrition.json`),
      fetch(`${basePath}/data/composite_foods.json`),
      fetch(`${basePath}/data/conversions_cuisson.json`),
    ]);
    _foods       = await foodsRes.json();
    _composites  = await compRes.json();
    _conversions = await convRes.json();
    _buildIndex();
    _loaded = true;
    console.log(`[Nutrition] Loaded: ${_foods.length} foods, ${_composites.length} composites, ${_conversions.length} conversions`);
    return true;
  } catch (e) {
    console.error('[Nutrition] Failed to load data files:', e);
    return false;
  }
}

export function setCustomFoods(foods) {
  _customFoods = foods || [];
  _buildIndex(); // rebuild to include custom
}

function _norm(s) {
  return s.toLowerCase()
    .replace(/[éèêë]/g, 'e').replace(/[àâ]/g, 'a')
    .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u').replace(/[ç]/g, 'c');
}

function _buildIndex() {
  _index = {};
  // Custom foods take priority
  [..._foods, ..._customFoods].forEach(food => {
    const key = _norm(food.nom);
    _index[key] = food;
  });
}

// ── Search ────────────────────────────────────────────────────

/**
 * Recherche des aliments par nom (pour autocomplete)
 * @param {string} query - texte à chercher
 * @param {number} limit - max résultats
 * @returns {Array} liste d'aliments correspondants
 */
export function searchFoods(query, limit = 10) {
  if (!query || query.length < 2) return [];
  const q = _norm(query);
  const results = [];

  // Exact match first
  for (const [key, food] of Object.entries(_index)) {
    if (key === q) { results.unshift(food); continue; }
    if (key.startsWith(q)) results.push(food);
  }

  // Partial match
  for (const [key, food] of Object.entries(_index)) {
    if (!results.includes(food) && key.includes(q)) {
      results.push(food);
    }
  }

  return results.slice(0, limit);
}

/**
 * Cherche dans les plats composés (pizza, burger, sushi...)
 * @param {string} query
 * @returns {object|null}
 */
export function searchComposite(query) {
  const q = _norm(query);
  let best = null, bestLen = 0;
  for (const c of _composites) {
    const key = _norm(c.nom);
    if (q.includes(key) && key.length > bestLen) {
      best = c; bestLen = key.length;
    }
  }
  return best;
}

/**
 * Lookup nutritionnel principal (utilisé par estimateKcal)
 * @param {string} name - nom de l'aliment
 * @returns {object} {nom, kcal, proteines, glucides, lipides, fibres, source}
 */
export function getNutrition(name) {
  const n = _norm(name.trim());

  // 1. Custom foods (priorité)
  for (const cf of _customFoods) {
    if (_norm(cf.nom) === n) return cf;
  }

  // 2. Exact match
  if (_index[n]) return _index[n];

  // 3. Longest key that is contained in the query
  let best = null, bestLen = 0;
  for (const [key, food] of Object.entries(_index)) {
    if (n.includes(key) && key.length > bestLen) {
      best = food; bestLen = key.length;
    }
  }
  if (best) return best;

  // 4. First significant word match
  const firstWord = n.split(' ')[0];
  if (firstWord.length >= 4) {
    for (const [key, food] of Object.entries(_index)) {
      if (key.includes(firstWord)) return food;
    }
  }

  // 5. Category fallback
  const fallbacks = [
    { test: ['legume','chou','salade','verdure','poireau','epinard'],
      data: { nom:'légume générique', kcal:25, proteines:2, glucides:5, lipides:0.2, fibres:2, categorie:'légumes' } },
    { test: ['fruit','baie','berry'],
      data: { nom:'fruit générique', kcal:50, proteines:0.5, glucides:12, lipides:0.2, fibres:2, categorie:'fruits' } },
    { test: ['viande','steak','filet','poulet','dinde','boeuf'],
      data: { nom:'viande générique', kcal:165, proteines:25, glucides:0, lipides:5, fibres:0, categorie:'protéines' } },
    { test: ['poisson','filet de'],
      data: { nom:'poisson générique', kcal:100, proteines:20, glucides:0, lipides:2, fibres:0, categorie:'protéines' } },
    { test: ['legumineuse','haricot','pois','lentille'],
      data: { nom:'légumineuse générique', kcal:130, proteines:9, glucides:22, lipides:0.5, fibres:7, categorie:'protéines' } },
    { test: ['cereale','riz','pate','pain'],
      data: { nom:'céréale générique', kcal:350, proteines:10, glucides:70, lipides:2, fibres:3, categorie:'céréales' } },
  ];

  for (const { test, data } of fallbacks) {
    if (test.some(t => n.includes(t))) return data;
  }

  // 6. Unknown
  return { nom: name, kcal: 80, proteines: 4, glucides: 10, lipides: 2, fibres: 1, categorie: 'inconnu', source: 'estimation' };
}

/**
 * Récupère l'entrée cru/cuit pour un aliment
 */
export function getCruCuitEntry(name) {
  const n = _norm(name);
  let best = null, bestLen = 0;
  for (const conv of _conversions) {
    const key = _norm(conv.aliment);
    if (n.includes(key) && key.length > bestLen) {
      best = conv; bestLen = key.length;
    }
  }
  return best;
}

export function isExplicitlyCooked(name) {
  const n = name.toLowerCase();
  return n.includes('cuit') || n.includes('boite') || n.includes('boîte') ||
         n.includes('conserve') || n.includes('egoutte') || n.includes('égouttée');
}

// Pertes à la cuisson pour les protéines
const PROTEIN_LOSS = {
  poulet:0.75, dinde:0.75, boeuf:0.70, steak:0.72,
  porc:0.75, saumon:0.80, cabillaud:0.78, crevette:0.80, thon:0.75
};

export function getCookingLoss(name) {
  const n = name.toLowerCase();
  for (const [k, v] of Object.entries(PROTEIN_LOSS)) {
    if (n.includes(k)) return v;
  }
  return null;
}

// ── Unit conversion ───────────────────────────────────────────
const UNIT_OVERRIDES = {
  'oeuf': { kcalPerUnit: 78, proteines: 6.5, glucides: 0.4, lipides: 5.3, fibres: 0 },
  'œuf':  { kcalPerUnit: 78, proteines: 6.5, glucides: 0.4, lipides: 5.3, fibres: 0 },
};

export function toGrams(qty, unit) {
  switch(unit) {
    case 'kg': return qty * 1000;
    case 'L':  return qty * 1000;
    case 'cl': return qty * 10;
    case 'ml': return qty;
    default:   return qty; // g or unit
  }
}

// ── Estimation ────────────────────────────────────────────────

/**
 * Estime les valeurs nutritionnelles d'un ingrédient
 * @param {string} name - nom
 * @param {number} qty  - quantité
 * @param {string} unit - unité (g, kg, ml, L, u)
 * @returns {{ kcal, proteines, glucides, lipides, fibres, detail, note }}
 */
export function estimateNutrition(name, qty, unit = 'g') {
  const n     = name.toLowerCase().trim();
  const numQty = parseFloat(qty) || 100;

  // 1. Œuf à l'unité
  const eggKey = Object.keys(UNIT_OVERRIDES).find(k => n.includes(k));
  if (eggKey && unit === 'u') {
    const ov = UNIT_OVERRIDES[eggKey];
    const count = numQty;
    return {
      kcal:      Math.round(ov.kcalPerUnit * count),
      proteines: Math.round(ov.proteines * count),
      glucides:  Math.round(ov.glucides * count),
      lipides:   Math.round(ov.lipides * count),
      fibres:    0,
      detail: `${count} œuf(s) × ${ov.kcalPerUnit} kcal/unité`,
      note: null,
    };
  }

  const grams = toGrams(numQty, unit || 'g');
  const cruEntry = getCruCuitEntry(name);
  const cooked   = isExplicitlyCooked(name);

  // 2. Cru/cuit conversion
  if (cruEntry) {
    let rawG, factor, kcal, prot, gluc, lip;
    if (!cooked) {
      // Poids cru saisi → calculer cru directement
      factor = grams / 100;
      rawG   = grams;
      kcal   = Math.round(cruEntry.kcal_cru_100g * factor);
      prot   = Math.round(cruEntry.proteines_cru * factor);
      gluc   = Math.round(cruEntry.glucides_cru * factor);
      lip    = Math.round(cruEntry.lipides_cru * factor);
      const cuitG = Math.round(grams * cruEntry.ratio_cuisson);
      return {
        kcal, proteines: prot, glucides: gluc, lipides: lip, fibres: 0,
        detail: `${grams}g cru × ${cruEntry.kcal_cru_100g} kcal/100g = ${kcal} kcal`,
        note: `Cru → ~${cuitG}g cuit`,
      };
    } else {
      // Poids cuit saisi → back-calculer poids cru
      rawG   = grams / cruEntry.ratio_cuisson;
      factor = rawG / 100;
      kcal   = Math.round(cruEntry.kcal_cru_100g * factor);
      prot   = Math.round(cruEntry.proteines_cru * factor);
      gluc   = Math.round(cruEntry.glucides_cru * factor);
      lip    = Math.round(cruEntry.lipides_cru * factor);
      return {
        kcal, proteines: prot, glucides: gluc, lipides: lip, fibres: 0,
        detail: `${grams}g cuit = ${Math.round(rawG)}g cru × ${cruEntry.kcal_cru_100g} kcal/100g = ${kcal} kcal`,
        note: `Poids cru équivalent : ${Math.round(rawG)}g`,
      };
    }
  }

  // 3. Standard
  const data   = getNutrition(name);
  const factor = grams / 100;
  const kcal   = Math.round(data.kcal * factor);
  const prot   = Math.round((data.proteines || 0) * factor);
  const gluc   = Math.round((data.glucides  || 0) * factor);
  const lip    = Math.round((data.lipides   || 0) * factor);
  const fib    = Math.round((data.fibres    || 0) * factor);
  const loss   = getCookingLoss(name);
  return {
    kcal, proteines: prot, glucides: gluc, lipides: lip, fibres: fib,
    detail: `${grams}g × ${data.kcal} kcal/100g = ${kcal} kcal`,
    note: loss ? `Peser cru — cuit ≈ ${Math.round(grams * loss)}g` : null,
  };
}

/**
 * Vérifie la cohérence macros ↔ calories
 */
export function checkMacroCoherence(kcal, prot, gluc, lip) {
  if (!kcal) return { ok: true };
  const theoretical = (gluc * 4) + (prot * 4) + (lip * 9);
  const ratio = Math.abs(theoretical - kcal) / kcal;
  if (ratio > 0.15) {
    return {
      ok: false,
      warning: `Vérification : ${gluc}g G×4 + ${prot}g P×4 + ${lip}g L×9 = ${theoretical} kcal théoriques vs ${kcal} kcal (écart ${Math.round(ratio * 100)}%)`,
      theoretical,
    };
  }
  return { ok: true, theoretical };
}

/**
 * Analyse en langage naturel (pour le mode Estimation)
 * Ex: "20 makis saumon, une banane, 300g de pâtes"
 */

const PORTION_MAP = {
  maki:18, sushi:25, california:30, nigiri:30, temaki:100,
  biscuit:10, cookie:15, tranche:30, carré:5, cube:15, boule:60,
  pizza:350, burger:200, sandwich:180, wrap:180, crêpe:60, pancake:50,
  omelette:150, banane:120, pomme:150, orange:160, kiwi:80, datte:8,
  noix:5, amande:1.2, bol:250, assiette:300, verre:200, tasse:240,
  'cuillère à soupe':15, 'cuillère à café':5, cs:15, cc:5, portion:100,
};

const QUANTITY_WORDS = {
  'un':1,'une':1,'deux':2,'trois':3,'quatre':4,'cinq':5,
  'six':6,'sept':7,'huit':8,'neuf':9,'dix':10,
  'une dizaine':10,'une douzaine':12,'une vingtaine':20,
  'demi':0.5,'moitié':0.5,
};

export function parseNaturalLanguage(text) {
  const low = text.toLowerCase().trim();
  const parts = low.split(/\bet\b|[,;+]|\bavec\b/).map(p => p.trim()).filter(Boolean);
  const lines = [];
  let totalKcal = 0, totalP = 0, totalG = 0, totalL = 0;

  for (const part of parts) {
    const result = _parsePart(part);
    if (result) {
      lines.push(result);
      totalKcal += result.kcal;
      totalP    += result.proteines;
      totalG    += result.glucides;
      totalL    += result.lipides;
    }
  }

  return {
    lines,
    totalKcal: Math.round(totalKcal),
    totalP:    Math.round(totalP),
    totalG:    Math.round(totalG),
    totalL:    Math.round(totalL),
  };
}

function _parsePart(text) {
  const low = text.trim();
  let qty = 1, grams = null, foodName = low;

  // Check composite foods first (sushi, pizza...)
  const composite = searchComposite(low);
  if (composite) {
    const numM = low.match(/^(\d+(?:[.,]\d+)?)\s+/);
    const count = numM ? parseFloat(numM[1].replace(',', '.')) : 1;
    const isPerUnit = composite.unite === 'pièce';
    const finalGrams = isPerUnit ? composite.poids_unite_g * count : composite.poids_unite_g;
    const factor = isPerUnit ? count : finalGrams / 100;
    return {
      nom:       composite.nom,
      qty:       count,
      grams:     Math.round(finalGrams),
      kcal:      Math.round(composite.kcal * factor),
      proteines: Math.round(composite.proteines * factor),
      glucides:  Math.round(composite.glucides * factor),
      lipides:   Math.round(composite.lipides * factor),
      fibres:    0,
      estimated: false,
    };
  }

  // Extract weight: "300g", "0.5kg", "200ml"
  const weightMatch = low.match(/(\d+(?:[.,]\d+)?)\s*(g|gr|grammes?|kg|ml|cl|l)\b/i);
  if (weightMatch) {
    let val = parseFloat(weightMatch[1].replace(',', '.'));
    const unit = weightMatch[2].toLowerCase();
    if (unit === 'kg') val *= 1000;
    else if (unit === 'cl') val *= 10;
    else if (unit === 'l') val *= 1000;
    grams = val;
    foodName = low.replace(weightMatch[0], '').trim();
  }

  // Extract quantity number
  if (!grams) {
    const numM = foodName.match(/^(\d+(?:[.,]\d+)?)\s+/);
    if (numM) {
      qty = parseFloat(numM[1].replace(',', '.'));
      foodName = foodName.slice(numM[0].length).trim();
    }
  }

  // Extract quantity word
  if (!grams && qty === 1) {
    for (const [word, val] of Object.entries(QUANTITY_WORDS)) {
      if (foodName.startsWith(word + ' ') || foodName === word) {
        qty = val;
        foodName = foodName.slice(word.length).trim();
        break;
      }
    }
  }

  // Check portion map
  if (!grams) {
    for (const [portion, portionGrams] of Object.entries(PORTION_MAP)) {
      if (foodName.includes(portion)) {
        grams = portionGrams * qty;
        break;
      }
    }
  }

  if (!grams) grams = 100 * qty;

  // Clean food name
  const cleanName = foodName
    .replace(/\b(au|à la|avec|sans|de|du|des|le|la|les|un|une|cuit[es]?|cru[es]?|grillé[es]?|poché[es]?|frit[es]?)\b/g, '')
    .replace(/\s+/g, ' ').trim();

  const est = estimateNutrition(cleanName || foodName, grams, 'g');
  return {
    nom:       foodName,
    qty,
    grams:     Math.round(grams),
    kcal:      est.kcal,
    proteines: est.proteines,
    glucides:  est.glucides,
    lipides:   est.lipides,
    fibres:    est.fibres || 0,
    estimated: false,
  };
}

// ── Public getters ────────────────────────────────────────────
export function getAllFoods()      { return _foods; }
export function getComposites()    { return _composites; }
export function getConversions()   { return _conversions; }
export function isLoaded()         { return _loaded; }
