const express = require("express");
const { getDB } = require("../config/db");
const redis = require("../config/redis");
const { authRequired, requireRole } = require("../middlewares/auth");

const router = express.Router();
const CLE = "dashboard:stats";
const TTL = 300; // 5 minutes

// GET /api/stats/dashboard : tableau de bord (administrateur), avec cache Redis
router.get("/dashboard", authRequired, requireRole("admin"), async (req, res) => {
  const debut = Date.now();
  try {
    try {
      const cache = await redis.get(CLE);
      if (cache) return res.json(Object.assign({ source: "redis", ms: Date.now() - debut }, JSON.parse(cache)));
    } catch (err) {
      console.error("Redis indisponible, calcul direct : " + err.message);
    }

    const limite = new Date(Date.now() - 48 * 3600 * 1000);
    const r = await getDB().collection("complaints").aggregate([{ $facet: {
      parStatut: [{ $group: { _id: "$statut", n: { $sum: 1 } } }],
      parCategorie: [{ $group: { _id: "$categorie", n: { $sum: 1 } } }, { $sort: { n: -1 } }],
      topQuartiers: [{ $group: { _id: "$quartier", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }],
      satisfaction: [
        { $match: { "evaluation.note": { $exists: true, $ne: null } } },
        { $group: { _id: null, noteMoyenne: { $avg: "$evaluation.note" }, nbEvaluations: { $sum: 1 } } }
      ],
      enRetard: [
        { $match: { "urgence.niveau": "haute", statut: "en_attente", createdAt: { $lt: limite } } },
        { $count: "n" }
      ]
    } }]).toArray();

    const data = r[0];
    try { await redis.set(CLE, JSON.stringify(data), "EX", TTL); } catch (err) { /* cache facultatif */ }
    res.json(Object.assign({ source: "mongodb", ms: Date.now() - debut }, data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

module.exports = router;