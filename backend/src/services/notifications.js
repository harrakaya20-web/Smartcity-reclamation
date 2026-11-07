const { getDB } = require("../config/db");

let flux = null;
let relanceEnCours = false;

function relancer() {
  if (relanceEnCours) return;
  relanceEnCours = true;
  setTimeout(function () {
    relanceEnCours = false;
    ecouter().catch(function (err) {
      console.error("Relance des notifications impossible : " + err.message);
      relancer();
    });
  }, 3000);
}

// Crée une notification pour chaque citoyen de l'incident résolu
async function creerNotifications(incident) {
  if (!incident) return;
  const maintenant = new Date();
  const notifs = (incident.citoyens || []).map(function (uid) {
    return {
      userId: uid,
      incidentId: incident._id,
      type: "INCIDENT_RESOLU",
      message: "Le problème que vous avez signalé (" + incident.titre + ") est résolu. Vous pouvez évaluer la réponse reçue.",
      lu: false,
      createdAt: maintenant
    };
  });
  if (notifs.length === 0) return;
  try {
    await getDB().collection("notifications").insertMany(notifs, { ordered: false });
  } catch (err) {
    // L'index unique empêche les doublons si le flux est relancé : on les ignore
    const doublons = Array.isArray(err.writeErrors) && err.writeErrors.every(function (e) { return e.code === 11000; });
    if (!(err.code === 11000 || doublons)) throw err;
  }
  console.log("Notifications créées : " + notifs.length + " pour l'incident " + incident._id);
}

async function ecouter() {
  const db = getDB();
  await db.collection("notifications").createIndex({ userId: 1, incidentId: 1, type: 1 }, { unique: true });
  await db.collection("notifications").createIndex({ userId: 1, createdAt: -1 });

  // On ne réagit qu'aux mises à jour qui passent le statut à "resolue"
  const pipeline = [
    { $match: { operationType: "update", "updateDescription.updatedFields.statut": "resolue" } }
  ];
  flux = db.collection("incidents").watch(pipeline, { fullDocument: "updateLookup" });
  console.log("Notifications : écoute des incidents résolus");

  flux.on("change", function (evt) {
    creerNotifications(evt.fullDocument).catch(function (err) {
      console.error("Erreur de notification : " + err.message);
    });
  });
  flux.on("error", function (err) {
    console.error("Flux de notifications interrompu : " + err.message);
    Promise.resolve().then(function () { return flux.close(); }).catch(function () {});
    relancer();
  });
}

function demarrerNotifications() {
  return ecouter().catch(function (err) {
    console.error("Notifications indisponibles : " + err.message);
    relancer();
  });
}

module.exports = { demarrerNotifications };