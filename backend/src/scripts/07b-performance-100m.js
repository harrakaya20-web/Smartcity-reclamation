const smartcity = db.getSiblingDB("smartcity");
const col = smartcity.complaints;
const citoyen = smartcity.users.findOne({ email: "citoyen1@seed.ma" });

function etapes(p) {
  let s = [p.stage];
  if (p.inputStage) s = s.concat(etapes(p.inputStage));
  if (p.inputStages) p.inputStages.forEach(function (x) { s = s.concat(etapes(x)); });
  return s;
}

function mesure(nom, mode, curseurFn) {
  curseurFn().explain("executionStats");            // premier passage pour réchauffer
  const e = curseurFn().explain("executionStats");
  const wp = e.queryPlanner.winningPlan;
  const plan = etapes(wp.queryPlan || wp).filter(function (x) { return x; });
  const st = e.executionStats;
  print(nom + " | " + mode + " | plan : " + plan.join(" > ") +
        " | " + st.executionTimeMillis + " ms | examinés : " + st.totalDocsExamined +
        " | retournés : " + st.nReturned);
}

const requetes = {
  "A. Autour du centre (rayon 100 m)": function () {
    return col.find({ location: { $geoWithin: { $centerSphere: [[-8.0089, 31.6295], 0.1 / 6378.1] } } });
  },
  "B. 10 plus urgentes en attente": function () {
    return col.find({ statut: "en_attente" }).sort({ "urgence.score": -1 }).limit(10);
  },
  "C. Mes réclamations (un citoyen)": function () {
    return col.find({ citizenId: citoyen._id }).sort({ createdAt: -1 });
  }
};

print("Nombre de réclamations : " + col.countDocuments());
print("------ AVEC INDEX ------");
Object.keys(requetes).forEach(function (n) { mesure(n, "avec index", requetes[n]); });

col.dropIndex("location_2dsphere");
col.dropIndex("statut_1_urgence.score_-1");
col.dropIndex("citizenId_1_createdAt_-1");
print("------ SANS INDEX ------");
Object.keys(requetes).forEach(function (n) { mesure(n, "sans index", requetes[n]); });

// On remet les index
col.createIndex({ location: "2dsphere" });
col.createIndex({ statut: 1, "urgence.score": -1 });
col.createIndex({ citizenId: 1, createdAt: -1 });
print("------ Index recréés ------");