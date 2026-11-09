const redis = require("../config/redis");

// Limite le nombre d'appels par utilisateur sur une période (compteur Redis avec expiration)
function limiter(max, secondes) {
  return async function (req, res, next) {
    try {
      const cle = "ratelimit:complaints:" + req.user.id;
      await redis.set(cle, 0, "EX", secondes, "NX"); // crée le compteur avec sa durée, seulement s'il n'existe pas
      const n = await redis.incr(cle);
      if (n > max) {
        const ttl = await redis.ttl(cle);
        return res.status(429).json({
          erreur: "Trop de réclamations déposées. Réessayez dans " + Math.ceil(Math.max(ttl, 1) / 60) + " minute(s)"
        });
      }
    } catch (err) {
      console.error("Redis indisponible, limite ignorée : " + err.message);
    }
    next();
  };
}

module.exports = { limiter };