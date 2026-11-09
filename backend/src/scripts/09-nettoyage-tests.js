const smartcity = db.getSiblingDB("smartcity");
const motif = /^(Test incident|Test notif|Lampadaire casse rue Mohammed V)/;
const ids = smartcity.incidents.find({ titre: motif }).toArray().map(function (i) { return i._id; });
smartcity.notifications.deleteMany({ incidentId: { $in: ids } });
smartcity.events.deleteMany({ incidentId: { $in: ids } });
smartcity.complaints.deleteMany({ $or: [{ incidentId: { $in: ids } }, { titre: motif }] });
smartcity.incidents.deleteMany({ _id: { $in: ids } });
print("Nettoyage terminé : " + ids.length + " incident(s) de test supprimé(s)");