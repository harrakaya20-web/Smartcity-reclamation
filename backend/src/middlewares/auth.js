const jwt = require("jsonwebtoken");

// Vérifie le jeton envoyé dans l'en-tête Authorization: Bearer <jeton>
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ erreur: "Connexion requise" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.status(401).json({ erreur: "Session invalide ou expirée" });
  }
}

// Autorise seulement certains rôles (ex : requireRole("admin"))
function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ erreur: "Accès refusé" });
    }
    next();
  };
}

module.exports = { authRequired, requireRole };