const smartcity = db.getSiblingDB("smartcity");

print("=== 6.1 Mes réclamations (un citoyen) ===");
const u = smartcity.users.findOne({ role: "citoyen" });
printjson(smartcity.complaints
  .find({ citizenId: u._id }, { titre: 1, statut: 1, createdAt: 1 })
  .sort({ createdAt: -1 }).limit(3).toArray());

print("=== 6.2 Réclamations à moins de 500 m du centre de Marrakech ===");
printjson(smartcity.complaints.find(
  { location: { $near: { $geometry: { type: "Point", coordinates: [-8.0089, 31.6295] }, $maxDistance: 500 } } },
  { titre: 1, quartier: 1 }
).limit(5).toArray());

print("=== 6.3 Recherche par mot : lampadaire ===");
printjson(smartcity.complaints.find(
  { $text: { $search: "lampadaire" } },
  { titre: 1, quartier: 1, score: { $meta: "textScore" } }
).sort({ score: { $meta: "textScore" } }).limit(3).toArray());

print("=== 6.4 Les 5 plus urgentes non résolues ===");
printjson(smartcity.complaints.find(
  { statut: { $ne: "resolue" } },
  { titre: 1, quartier: 1, "urgence.score": 1, statut: 1 }
).sort({ "urgence.score": -1 }).limit(5).toArray());

print("=== 6.5 Nombre de réclamations par statut ===");
printjson(smartcity.complaints.aggregate([
  { $group: { _id: "$statut", total: { $sum: 1 } } },
  { $sort: { total: -1 } }
]).toArray());