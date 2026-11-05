const smartcity = db.getSiblingDB("smartcity");

smartcity.users.createIndex({ email: 1 }, { unique: true });
smartcity.complaints.createIndex({ location: "2dsphere" });
smartcity.complaints.createIndex({ titre: "text", description: "text" }, { default_language: "french" });
smartcity.complaints.createIndex({ statut: 1, "urgence.score": -1 });
smartcity.complaints.createIndex({ citizenId: 1, createdAt: -1 });
smartcity.incidents.createIndex({ location: "2dsphere" });
smartcity.incidents.createIndex({ statut: 1, priorite: -1 });

print("Index créés");