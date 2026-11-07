const smartcity = db.getSiblingDB("smartcity");
const ids = smartcity.incidents.find({ titre: /^Test incident/ }).toArray().map(function (i) { return i._id; });
smartcity.events.deleteMany({ incidentId: { $in: ids } });
smartcity.complaints.deleteMany({ titre: /^Test incident/ });
smartcity.incidents.deleteMany({ titre: /^Test incident/ });
print("Nettoyage terminé : " + ids.length + " incident(s) de test supprimé(s)");