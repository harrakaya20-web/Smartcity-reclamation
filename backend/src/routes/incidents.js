const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB, getClient } = require("../config/db");
const redis = require("../config/redis");
const { authRequired, requireRole } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired, requireRole("admin")); // tout est réservé à l'administrateur

const STATUTS = ["en_attente", "en_cours", "resolue"];
const TRANSITIONS = { en_attente: ["en_cours"], en_cours: ["resolue"] };

function formater(i) {
  return {
    id: i._id,
    category: i.categorie,
    title: i.titre,
    coordinates: i.location ? i.location.coordinates : null,
    district: i.quartier,
    signalements: i.nbSignalements,
    citizens: (i.citoyens || []).length,
    urgencyMax: i.urgenceMax,
    priority: i.priorite,
    status: i.statut,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    resolvedAt: i.resolvedAt || null
  };
}

function pagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page: page, limit: limit, skip: (page - 1) * limit };
}

// GET /api/incidents : incidents triés par priorité décroissante
router.get("/", async (req, res) => {
  try {
    const st = req.query.status;
    if (st !== undefined && !(typeof st === "string" && STATUTS.includes(st)))
      return res.status(400).json({ erreur: "Statut invalide" });
    const { page, limit, skip } = pagination(req.query);
    const filtre = st ? { statut: st } : {};
    const col = getDB().collection("incidents");
    const [items, total] = await Promise.all([
      col.find(filtre).sort({ priorite: -1, createdAt: 1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filtre)
    ]);
    res.json({ page: page, limit: limit, total: total, items: items.map(formater) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// PATCH /api/incidents/:id/status : l'incident et toutes ses réclamations changent ensemble
router.patch("/:id/status", async (req, res) => {
  const session = getClient().startSession();
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erreur: "Identifiant invalide" });
    const nouveau = (req.body || {}).status;
    if (typeof nouveau !== "string" || !STATUTS.includes(nouveau))
      return res.status(400).json({ erreur: "Statut invalide" });

    const id = new ObjectId(req.params.id);
    const db = getDB();
    const actuel = await db.collection("incidents").findOne({ _id: id }, { projection: { statut: 1 } });
    if (!actuel) return res.status(404).json({ erreur: "Incident introuvable" });

    const permis = TRANSITIONS[actuel.statut] || [];
    if (!permis.includes(nouveau))
      return res.status(409).json({ erreur: "Transition interdite : " + actuel.statut + " -> " + nouveau });

    const maintenant = new Date();
    await session.withTransaction(async function () {
      const set = { statut: nouveau, updatedAt: maintenant };
      if (nouveau === "resolue") set.resolvedAt = maintenant;
      const r = await db.collection("incidents").updateOne(
        { _id: id, statut: actuel.statut }, { $set: set }, { session: session });
      if (r.modifiedCount !== 1) { const e = new Error("conflit"); e.conflit = true; throw e; }

      const filtreC = nouveau === "en_cours"
        ? { incidentId: id, statut: "en_attente" }
        : { incidentId: id, statut: { $in: ["en_attente", "en_cours"] } };
      const setC = { statut: nouveau };
      if (nouveau === "resolue") setC.resolvedAt = maintenant;
      await db.collection("complaints").updateMany(filtreC, {
        $set: setC,
        $push: { historique: { statut: nouveau, date: maintenant, par: req.user.id } }
      }, { session: session });

      await db.collection("events").insertOne({
        incidentId: id, type: "INCIDENT_" + nouveau.toUpperCase(), par: req.user.id, at: maintenant
      }, { session: session });
    });

    // Redis : un incident résolu quitte la file de priorité, et le cache du tableau de bord est périmé
    try {
      if (nouveau === "resolue") await redis.zrem("urgent:incidents", id.toString());
      await redis.del("dashboard:stats");
    } catch (err) {
      console.error("Redis non mis à jour : " + err.message);
    }

    res.json(formater(await db.collection("incidents").findOne({ _id: id })));
  } catch (err) {
    if (err.conflit) return res.status(409).json({ erreur: "Cet incident vient d'être modifié par quelqu'un d'autre" });
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  } finally {
    await session.endSession();
  }
});

module.exports = router;