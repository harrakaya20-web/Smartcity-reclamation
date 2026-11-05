const smartcity = db.getSiblingDB("smartcity");

print("=== 6.6 Zones critiques : quartier + catégorie ===");
printjson(smartcity.complaints.aggregate([
  { $group: { _id: { quartier: "$quartier", categorie: "$categorie" },
              total: { $sum: 1 }, urgenceMoyenne: { $avg: "$urgence.score" } } },
  { $sort: { total: -1 } },
  { $limit: 5 }
]).toArray());

print("=== 6.7 Délai moyen de résolution par catégorie (en heures) ===");
printjson(smartcity.complaints.aggregate([
  { $match: { statut: "resolue" } },
  { $group: { _id: "$categorie",
      delaiMoyenHeures: { $avg: { $dateDiff: { startDate: "$createdAt", endDate: "$resolvedAt", unit: "hour" } } },
      total: { $sum: 1 } } },
  { $sort: { delaiMoyenHeures: 1 } }
]).toArray());

print("=== 6.8 Satisfaction moyenne par quartier ===");
printjson(smartcity.complaints.aggregate([
  { $match: { "evaluation.note": { $exists: true, $ne: null } } },
  { $group: { _id: "$quartier", noteMoyenne: { $avg: "$evaluation.note" }, nbEvaluations: { $sum: 1 } } },
  { $sort: { noteMoyenne: -1 } }
]).toArray());

print("=== 6.9 Retards : urgence haute, en attente depuis plus de 48 h ===");
const limite = new Date(Date.now() - 48 * 3600 * 1000);
const filtreRetard = { "urgence.niveau": "haute", statut: "en_attente", createdAt: { $lt: limite } };
print("Nombre en retard : " + smartcity.complaints.countDocuments(filtreRetard));
printjson(smartcity.complaints.find(filtreRetard, { titre: 1, quartier: 1, createdAt: 1 })
  .sort({ createdAt: 1 }).limit(3).toArray());

print("=== 6.10 Tableau de bord complet en une seule requête ($facet) ===");
printjson(smartcity.complaints.aggregate([{ $facet: {
  parStatut: [{ $group: { _id: "$statut", n: { $sum: 1 } } }],
  parCategorie: [{ $group: { _id: "$categorie", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
  top3Quartiers: [{ $group: { _id: "$quartier", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 3 }],
  satisfactionGlobale: [
    { $match: { "evaluation.note": { $exists: true, $ne: null } } },
    { $group: { _id: null, noteMoyenne: { $avg: "$evaluation.note" } } }
  ]
} }]).toArray());

print("=== 6.11 Score de priorité composite : les 5 premières à traiter ===");
printjson(smartcity.complaints.aggregate([
  { $match: { statut: { $ne: "resolue" } } },
  { $addFields: {
      ageHeures: { $dateDiff: { startDate: "$createdAt", endDate: "$$NOW", unit: "hour" } } } },
  { $addFields: {
      priorite: { $add: [
        { $multiply: ["$urgence.score", 5] },
        { $multiply: ["$nbSignalements", 3] },
        { $divide: ["$ageHeures", 12] } ] } } },
  { $sort: { priorite: -1 } },
  { $limit: 5 },
  { $project: { titre: 1, quartier: 1, "urgence.score": 1, ageHeures: 1, priorite: { $round: ["$priorite", 1] } } }
]).toArray());