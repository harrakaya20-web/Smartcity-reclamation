const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function creerToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "2h" }
  );
}

// POST /api/auth/register  (champs du frontend : name, email, phone, password)
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body || {};

    // On exige des chaînes de caractères : cela bloque les injections NoSQL
    // du type { "email": { "$ne": null } }
    if (typeof name !== "string" || name.trim().length < 2)
      return res.status(400).json({ erreur: "Nom invalide (2 caractères minimum)" });
    if (typeof email !== "string" || !emailRegex.test(email))
      return res.status(400).json({ erreur: "Email invalide" });
    if (typeof password !== "string" || password.length < 8)
      return res.status(400).json({ erreur: "Mot de passe trop court (8 caractères minimum)" });
    if (phone !== undefined && phone !== "" && (typeof phone !== "string" || !/^[0-9+ ]{8,15}$/.test(phone)))
      return res.status(400).json({ erreur: "Téléphone invalide" });

    const user = {
      nom: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone || "",
      passwordHash: await bcrypt.hash(password, 10),
      role: "citoyen",            // le rôle n'est JAMAIS lu depuis la requête
      createdAt: new Date()
    };

    const r = await getDB().collection("users").insertOne(user);
    user._id = r.insertedId;
    res.status(201).json({
      token: creerToken(user),
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role }
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erreur: "Cet email est déjà utilisé" });
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// POST /api/auth/login  (champs du frontend : email, password)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || typeof password !== "string")
      return res.status(400).json({ erreur: "Email et mot de passe requis" });

    const user = await getDB().collection("users").findOne({ email: email.trim().toLowerCase() });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    // Même message dans les deux cas : on ne révèle pas si l'email existe
    if (!ok) return res.status(401).json({ erreur: "Email ou mot de passe incorrect" });

    res.json({
      token: creerToken(user),
      user: { id: user._id, nom: user.nom, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// GET /api/auth/me  (route protégée : sert à tester le jeton)
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await getDB().collection("users").findOne(
      { _id: new ObjectId(req.user.id) },
      { projection: { passwordHash: 0 } }
    );
    if (!user) return res.status(404).json({ erreur: "Utilisateur introuvable" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

module.exports = router;