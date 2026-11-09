const { ObjectId } = require("mongodb");
const { getDB, getClient } = require("../config/db");
const redis = require("../config/redis");

const RAYON_M = 60; // deux réclamations à moins de 60 m = même problème

function calculerPriorite(urgenceMax, nbSignalements) {
  return urgenceMax * 5 + nbSignalements * 3;
}

// Verrou Redis : un seul dépôt à la fois par catégorie (évite deux incidents jumeaux)
async function prendreVerrou(cle) {
  const jeton = new ObjectId().toString();
  try {
    for (let i = 0; i < 40; i++) {
      const ok = await redis.set(cle, jeton, "EX", 10, "NX");
      if (ok === "OK") return jeton;
      await new Promise(function (r) { setTimeout(r, 50); });
    }
  } catch (err) {
    console.error("Redis indisponible, pas de verrou : " + err.message);
  }
  return null; // sans verrou on continue : mieux vaut un dépôt qu'une erreur
}

async function libererVerrou(cle, jeton) {
  if (!jeton) return;
  try {
    await redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      1, cle, jeton
    );
  } catch (err) { /* le verrou expire tout seul au bout de 10 s */ }
}

// Réclamation sans GPS fiable : simple insertion, sans incident
async function insererSimple(doc) {
  const r = await getDB().collection("complaints").insertOne(doc);
  doc._id = r.insertedId;
  return { incidentId: null, nouvelIncident: null, nbSignalements: null };
}

// Réclamation avec GPS : rattachement à un incident existant ou création
async function deposerAvecIncident(doc) {
  const db = getDB();
  const cleVerrou = "lock:incident:" + doc.categorie;
  const jeton = await prendreVerrou(cleVerrou);
  const session = getClient().startSession();
  let resultat = null;
  try {
    // 1. Incident ouvert le plus proche, de la même catégorie (index 2dsphere)
    const proche = await db.collection("incidents").aggregate([
      { $geoNear: {
          near: doc.location, distanceField: "distanceM", maxDistance: RAYON_M, spherical: true,
          query: { categorie: doc.categorie, statut: { $ne: "resolue" } } } },
      { $limit: 1 }
    ]).toArray();

    // 2. Transaction : réclamation + incident + événement, tout ou rien
    await session.withTransaction(async function () {
      const maintenant = new Date();
      const score = doc.urgence.score;
      let incident = null;
      let nouvel = false;

      if (proche.length > 0) {
        const r = await db.collection("incidents").findOneAndUpdate(
          { _id: proche[0]._id, statut: { $ne: "resolue" } },
          [
            { $set: {
                nbSignalements: { $add: ["$nbSignalements", 1] },
                citoyens: { $setUnion: ["$citoyens", [doc.citizenId]] },
                urgenceMax: { $max: ["$urgenceMax", score] },
                updatedAt: maintenant } },
            { $set: { priorite: { $add: [
                { $multiply: ["$urgenceMax", 5] },
                { $multiply: ["$nbSignalements", 3] } ] } } }
          ],
          { session: session, returnDocument: "after" }
        );
        incident = r && r.value !== undefined ? r.value : r; // selon la version du driver
      }

      if (!incident) { // aucun incident proche, ou il vient d'être résolu
        const nouveau = {
          categorie: doc.categorie, titre: doc.titre, location: doc.location, quartier: doc.quartier,
          citoyens: [doc.citizenId], nbSignalements: 1, urgenceMax: score,
          priorite: calculerPriorite(score, 1), statut: "en_attente",
          createdAt: maintenant, updatedAt: maintenant
        };
        const ri = await db.collection("incidents").insertOne(nouveau, { session: session });
        nouveau._id = ri.insertedId;
        incident = nouveau;
        nouvel = true;
      }

      doc.incidentId = incident._id;
      const rc = await db.collection("complaints").insertOne(doc, { session: session });
      doc._id = rc.insertedId;

      await db.collection("events").insertOne({
        incidentId: incident._id,
        complaintId: doc._id,
        citizenId: doc.citizenId,
        type: nouvel ? "INCIDENT_CREE" : "SIGNALEMENT_AJOUTE",
        at: maintenant
      }, { session: session });

      resultat = {
        incidentId: incident._id,
        nouvelIncident: nouvel,
        nbSignalements: incident.nbSignalements,
        priorite: incident.priorite
      };
    });

    // 3. File de priorité Redis (facultative : une panne de Redis ne bloque pas le dépôt)
    try {
      await redis.zadd("urgent:incidents", resultat.priorite, resultat.incidentId.toString());
    } catch (err) {
      console.error("File Redis non mise à jour : " + err.message);
    }
    return resultat;
  } finally {
    await session.endSession();
    await libererVerrou(cleVerrou, jeton);
  }
}

module.exports = { deposerAvecIncident, insererSimple };