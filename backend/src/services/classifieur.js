const fs = require("fs");
const path = require("path");

const STOP = new Set(["les", "des", "une", "est", "sont", "dans", "sur", "pour", "par", "avec", "qui",
  "que", "aux", "cette", "ces", "depuis", "devant", "rue", "tres", "trop", "plus", "mais", "son", "ses",
  "nous", "car", "pas", "toute", "tout", "tous", "ont", "etre", "fait"]);

// Texte -> liste de mots : minuscules, sans accents, sans mots vides, singulier approximatif
function normaliser(texte) {
  return String(texte).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(function (m) { return m.length > 2 && !STOP.has(m); })
    .map(function (m) { return m.replace(/(s|x)$/, ""); })
    .filter(function (m) { return m.length > 2; });
}

function chargerExemples() {
  const dossier = path.join(__dirname, "..", "data");
  let exemples = [];
  fs.readdirSync(dossier).filter(function (n) { return /^entrainement.*\.json$/.test(n); }).forEach(function (n) {
    exemples = exemples.concat(JSON.parse(fs.readFileSync(path.join(dossier, n), "utf8")));
  });
  return exemples;
}

// Apprentissage : on compte les mots de chaque catégorie
function entrainer(exemples) {
  const classes = {};
  const vocab = new Set();
  exemples.forEach(function (e) {
    if (!classes[e.categorie]) classes[e.categorie] = { n: 0, mots: {}, nbMots: 0 };
    const c = classes[e.categorie];
    c.n++;
    normaliser(e.texte).forEach(function (m) {
      c.mots[m] = (c.mots[m] || 0) + 1;
      c.nbMots++;
      vocab.add(m);
    });
  });
  return { classes: classes, vocab: vocab, total: exemples.length };
}

// Prédiction : probabilité de chaque catégorie (Naive Bayes avec lissage de Laplace)
function predire(modele, texte) {
  const mots = normaliser(texte);
  const connus = mots.filter(function (m) { return modele.vocab.has(m); });
  const cats = Object.keys(modele.classes);
  const scores = {};
  cats.forEach(function (cat) {
    const c = modele.classes[cat];
    let s = Math.log(c.n / modele.total);
    connus.forEach(function (m) {
      s += Math.log(((c.mots[m] || 0) + 1) / (c.nbMots + modele.vocab.size));
    });
    scores[cat] = s;
  });
  const max = Math.max.apply(null, cats.map(function (c) { return scores[c]; }));
  let somme = 0;
  const probas = {};
  cats.forEach(function (c) { probas[c] = Math.exp(scores[c] - max); somme += probas[c]; });
  cats.forEach(function (c) { probas[c] = probas[c] / somme; });
  const meilleure = cats.sort(function (a, b) { return probas[b] - probas[a]; })[0];
  return {
    categorie: meilleure,
    confiance: connus.length === 0 ? 0 : Math.round(probas[meilleure] * 100) / 100,
    motsReconnus: connus.length
  };
}

let modeleCourant = null;
function classer(texte) {
  if (!modeleCourant) modeleCourant = entrainer(chargerExemples());
  return predire(modeleCourant, texte);
}

// Validation croisée « un contre tous » : chaque exemple est testé par un modèle qui ne l'a jamais vu
function evaluerValidationCroisee() {
  const ex = chargerExemples();
  const cats = Array.from(new Set(ex.map(function (e) { return e.categorie; })));
  const matrice = {};
  cats.forEach(function (a) { matrice[a] = {}; cats.forEach(function (b) { matrice[a][b] = 0; }); });
  let bons = 0;
  const erreurs = [];
  ex.forEach(function (e, i) {
    const reste = ex.filter(function (_, j) { return j !== i; });
    const p = predire(entrainer(reste), e.texte);
    matrice[e.categorie][p.categorie]++;
    if (p.categorie === e.categorie) bons++;
    else erreurs.push({ texte: e.texte, attendu: e.categorie, obtenu: p.categorie, confiance: p.confiance });
  });
  return { total: ex.length, bons: bons, precision: Math.round(bons / ex.length * 1000) / 10, matrice: matrice, erreurs: erreurs };
}

module.exports = { normaliser, entrainer, predire, classer, evaluerValidationCroisee };