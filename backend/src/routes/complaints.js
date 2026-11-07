const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { authRequired, requireRole } = require("../middlewares/auth");

const { limiter } = require("../middlewares/rateLimit");
const limiteDepots = limiter(parseInt(process.env.RATE_LIMIT_MAX || "5", 10), 3600);
const { deposerAvecIncident, insererSimple } = require("../services/incidents");
const router = express.Router();
router.use(authRequired); // toutes les routes ci-dessous exigent une connexion

const CATEGORIES = ["route", "eclairage", "proprete", "autre"];
const STATUTS = ["en_attente", "en_cours", "resolue"];
const TRANSITIONS = { en_attente: ["en_cours"], en_cours: ["resolue"] };
const CENTRE_MARRAKECH = [-8.0089, 31.6295]; // [longitude, latitude]

const MOTS_URGENTS = ["danger", "dangereux", "accident", "blessé", "fuite", "inondation",
  "inondée", "feu", "électrique", "fil", "effondrement", "urgent", "enfants", "nuit"];

// Estimation simple de l'urgence (règles) : catégorie + mots-clés
function estimerUrgence(texte, categorie) {
  const t = texte.toLowerCase();
  let score = 3;
  if (categorie === "eclairage" || categorie === "route") score += 1;
  MOTS_URGENTS.forEach(function (m) { if (t.includes(m)) score += 2; });
  score = Math.min(score, 10);
  return { score: score, niveau: score >= 8 ? "haute" : score >= 5 ? "moyenne" : "basse" };
}

// Réponse envoyée au frontend (noms de champs de Nouhaila)
function formater(c) {
  return {
    id: c._id,
    title: c.titre,
    category: c.categorie,
    description: c.description,
    location: c.locationTexte || "",
    coordinates: c.location ? c.location.coordinates : null,
    status: c.statut,
    urgency: c.urgence,
    createdAt: c.createdAt,
    resolvedAt: c.resolvedAt || null,
    history: c.historique || [],
    evaluation: c.evaluation || null
  };
}

function pagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page: page, limit: limit, skip: (page - 1) * limit };
}

// Un filtre ne doit jamais être un objet : cela bloque les injections NoSQL
function filtreValide(valeur, autorises) {
  return valeur === undefined || (typeof valeur === "string" && autorises.includes(valeur));
}

// POST /api/complaints : déposer une réclamation
router.post("/", limiteDepots, async (req, res) => {
  try {
    const { title, category, description, location, latitude, longitude } = req.body || {};

    if (typeof title !== "string" || title.trim().length < 5 || title.trim().length > 120)
      return res.status(400).json({ erreur: "Titre invalide (5 à 120 caractères)" });
    if (typeof category !== "string" || !CATEGORIES.includes(category))
      return res.status(400).json({ erreur: "Catégorie invalide" });
    if (typeof description !== "string" || description.trim().length < 10 || description.trim().length > 2000)
      return res.status(400).json({ erreur: "Description invalide (10 à 2000 caractères)" });
    if (location !== undefined && (typeof location !== "string" || location.length > 200))
      return res.status(400).json({ erreur: "Localisation invalide" });

    let coordonnees = CENTRE_MARRAKECH;
    let approximative = true;
    const aGps = latitude !== undefined && latitude !== null && latitude !== "" &&
                 longitude !== undefined && longitude !== null && longitude !== "";
    if (aGps) {
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180)
        return res.status(400).json({ erreur: "Coordonnées GPS invalides" });
      coordonnees = [lng, lat];
      approximative = false;
    }

    const maintenant = new Date();
    const doc = {
      citizenId: new ObjectId(req.user.id),
      titre: title.trim(),
      description: description.trim(),
      categorie: category,
      photos: [],
      locationTexte: (location || "").trim(),
      location: { type: "Point", coordinates: coordonnees },
      localisationApproximative: approximative,
      quartier: "Non précisé",
      urgence: estimerUrgence(title + " " + description, category),
      statut: "en_attente",
      nbSignalements: 1,
      historique: [{ statut: "en_attente", date: maintenant, par: "systeme" }],
      evaluation: null,
      createdAt: maintenant,
      resolvedAt: null
    };

    const incidentInfo = approximative ? await insererSimple(doc) : await deposerAvecIncident(doc);
    
    res.status(201).json(Object.assign(formater(doc), { incidentId: doc.incidentId || null, incident: incidentInfo }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// GET /api/complaints/mine : mes réclamations (utilise l'index citizenId + createdAt)
router.get("/mine", async (req, res) => {
  try {
    if (!filtreValide(req.query.status, STATUTS))
      return res.status(400).json({ erreur: "Statut invalide" });
    const { page, limit, skip } = pagination(req.query);
    const filtre = { citizenId: new ObjectId(req.user.id) };
    if (req.query.status) filtre.statut = req.query.status;

    const col = getDB().collection("complaints");
    const [items, total] = await Promise.all([
      col.find(filtre).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filtre)
    ]);
    res.json({ page: page, limit: limit, total: total, items: items.map(formater) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// GET /api/complaints : toutes les réclamations (administrateur), avec filtres
router.get("/", requireRole("admin"), async (req, res) => {
  try {
    if (!filtreValide(req.query.status, STATUTS))
      return res.status(400).json({ erreur: "Statut invalide" });
    if (!filtreValide(req.query.category, CATEGORIES))
      return res.status(400).json({ erreur: "Catégorie invalide" });
    const { page, limit, skip } = pagination(req.query);
    const filtre = {};
    if (req.query.status) filtre.statut = req.query.status;
    if (req.query.category) filtre.categorie = req.query.category;

    const col = getDB().collection("complaints");
    const [items, total] = await Promise.all([
      col.find(filtre).sort({ "urgence.score": -1, createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filtre)
    ]);
    res.json({ page: page, limit: limit, total: total, items: items.map(formater) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// PATCH /api/complaints/:id/status : changer le statut (administrateur)
router.patch("/:id/status", requireRole("admin"), async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erreur: "Identifiant invalide" });
    const nouveau = (req.body || {}).status;
    if (typeof nouveau !== "string" || !STATUTS.includes(nouveau))
      return res.status(400).json({ erreur: "Statut invalide" });

    const id = new ObjectId(req.params.id);
    const col = getDB().collection("complaints");
    const actuel = await col.findOne({ _id: id }, { projection: { statut: 1 } });
    if (!actuel) return res.status(404).json({ erreur: "Réclamation introuvable" });

    const permis = TRANSITIONS[actuel.statut] || [];
    if (!permis.includes(nouveau))
      return res.status(409).json({ erreur: "Transition interdite : " + actuel.statut + " -> " + nouveau });

    const maintenant = new Date();
    const maj = {
      $set: { statut: nouveau },
      $push: { historique: { statut: nouveau, date: maintenant, par: req.user.id } }
    };
    if (nouveau === "resolue") maj.$set.resolvedAt = maintenant;

    // Le filtre contient l'ancien statut : si quelqu'un l'a changé entre-temps, rien n'est modifié
    const r = await col.updateOne({ _id: id, statut: actuel.statut }, maj);
    if (r.modifiedCount !== 1)
      return res.status(409).json({ erreur: "Cette réclamation vient d'être modifiée par quelqu'un d'autre" });

    res.json(formater(await col.findOne({ _id: id })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// DELETE /api/complaints/:id : supprimer (administrateur)
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erreur: "Identifiant invalide" });
    const r = await getDB().collection("complaints").deleteOne({ _id: new ObjectId(req.params.id) });
    if (r.deletedCount === 0) return res.status(404).json({ erreur: "Réclamation introuvable" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

const redis = require("../config/redis");

// POST /api/complaints/:id/evaluation : le citoyen note la réponse reçue (une seule fois)
router.post("/:id/evaluation", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erreur: "Identifiant invalide" });
    const { rating, comment } = req.body || {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return res.status(400).json({ erreur: "La note doit être un entier de 1 à 5" });
    if (comment !== undefined && (typeof comment !== "string" || comment.length > 500))
      return res.status(400).json({ erreur: "Commentaire invalide (500 caractères maximum)" });

    const id = new ObjectId(req.params.id);
    const citizenId = new ObjectId(req.user.id);
    const col = getDB().collection("complaints");

    // Une seule opération atomique : bonne personne, réclamation résolue, pas encore évaluée
    const r = await col.updateOne(
      { _id: id, citizenId: citizenId, statut: "resolue", evaluation: null },
      { $set: { evaluation: { note: rating, commentaire: (comment || "").trim(), date: new Date() } } }
    );
    if (r.modifiedCount === 1) {
      try { await redis.del("dashboard:stats"); } catch (e) { /* cache facultatif */ }
      return res.json(formater(await col.findOne({ _id: id })));
    }

    // Aucune modification : on explique pourquoi
    const c = await col.findOne({ _id: id, citizenId: citizenId }, { projection: { statut: 1 } });
    if (!c) return res.status(404).json({ erreur: "Réclamation introuvable" });
    if (c.statut !== "resolue")
      return res.status(409).json({ erreur: "Vous pourrez évaluer quand la réclamation sera résolue" });
    return res.status(409).json({ erreur: "Cette réclamation a déjà été évaluée" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

module.exports = router;