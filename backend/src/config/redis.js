const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 2,
  lazyConnect: false
});

redis.on("connect", function () { console.log("Redis connecté"); });
redis.on("error", function (err) { console.error("Erreur Redis : " + err.message); });

module.exports = redis;