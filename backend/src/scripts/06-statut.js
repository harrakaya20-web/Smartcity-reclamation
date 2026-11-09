const smartcity = db.getSiblingDB("smartcity");

// Transitions autorisées : on ne peut pas revenir en arrière ni sauter une étape
const transitions = { en_attente: ["en_cours"], en_cours: ["resolue"] };

function changerStatut(id, nouveauStatut, par) {
  const actuel = smartcity.complaints.findOne({ _id: id }, { statut: 1 });
  if (!actuel) return "introuvable";
  const permis = transitions[actuel.statut] || [];
  if (!permis.includes(nouveauStatut)) {
    return "refusé : " + actuel.statut + " -> " + nouveauStatut + " interdit";
  }
  const maintenant = new Date();
  const maj = {
    $set: { statut: nouveauStatut },
    $push: { historique: { statut: nouveauStatut, date: maintenant, par: par } }
  };
  if (nouveauStatut === "resolue") maj.$set.resolvedAt = maintenant;
  // Le filtre contient l'ancien statut : si quelqu'un d'autre l'a changé entre-temps, rien n'est modifié
  const res = smartcity.complaints.updateOne({ _id: id, statut: actuel.statut }, maj);
  return res.modifiedCount === 1 ? "ok" : "conflit : déjà modifiée par quelqu'un d'autre";
}

const c = smartcity.complaints.findOne({ statut: "en_attente", seed: true });
print("Réclamation testée : " + c.titre);
print("en_attente -> en_cours : " + changerStatut(c._id, "en_cours", "admin"));
print("en_cours -> en_attente : " + changerStatut(c._id, "en_attente", "admin"));
print("en_cours -> resolue    : " + changerStatut(c._id, "resolue", "admin"));
print("resolue -> en_cours    : " + changerStatut(c._id, "en_cours", "admin"));
printjson(smartcity.complaints.findOne({ _id: c._id }, { titre: 1, statut: 1, historique: 1, resolvedAt: 1 }));