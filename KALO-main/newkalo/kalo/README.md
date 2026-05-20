# KALO — Architecture des fichiers source

## Structure
```
kalo/
├── index.html          ← App compilée (ouvrir dans le navigateur)
├── css/
│   └── main.css        ← Tous les styles (design tokens, composants)
├── db/
│   ├── database.js     ← IndexedDB + localStorage fallback
│   └── nutrition.js    ← Base de données nutritionnelle (467 aliments)
├── js/
│   ├── store.js        ← État global + actions async
│   └── utils.js        ← Utilitaires (dates, formatters)
└── pages/
    ├── accueil.js      ← Dashboard (poids, eau, stats)
    ├── chat.js         ← Conseils repas + estimation
    ├── frigo.js        ← Gestion des ingrédients
    ├── agenda.js       ← Calendrier + repas
    └── profil.js       ← Profil + TDEE + thème

## Base de données
- **IndexedDB** : stockage principal (persistent, structuré)
  - `profile` store : données profil + préférences
  - `meals` store : repas par date
  - `weightLog` store : historique du poids
  - `waterLog` store : consommation d'eau par entrée et par date
  - `ingredients` store : frigo par catégorie
  - `settings` store : paramètres divers
- **localStorage** : backup automatique (migration, fallback)

## Déploiement
- Ouvrir `index.html` directement dans le navigateur
- Ou déployer sur tout hébergeur statique (Netlify, Vercel, GitHub Pages)
- PWA-ready : ajouter un manifest.json et service worker pour mode offline
