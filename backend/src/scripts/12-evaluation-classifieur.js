const { evaluerValidationCroisee } = require("../services/classifieur");
const r = evaluerValidationCroisee();
console.log("Exemples d'entrainement : " + r.total);
console.log("Bonnes predictions      : " + r.bons + " / " + r.total);
console.log("Precision               : " + r.precision + " %");
console.log("");
console.log("Matrice de confusion (ligne = vraie categorie, colonne = categorie predite) :");
console.table(r.matrice);
console.log("Erreurs (" + r.erreurs.length + ") :");
r.erreurs.forEach(function (e) {
  console.log("- [" + e.attendu + " -> " + e.obtenu + ", confiance " + e.confiance + "] " + e.texte);
});