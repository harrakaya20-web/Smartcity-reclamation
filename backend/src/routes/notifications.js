const express = require("express");
const { ObjectId } = require("mongodb");
const { getDB } = require("../config/db");
const { authRequired } = require("../middlewares/auth");

const router = express.Router();
router.use(authRequired);

function formater(n) {
  return { id: n._id, type: n.type, message: n.message, incidentId: n.incidentId, read: n.lu, createdAt: n.createdAt };
}

// GET /api/notifications : mes notifications (les plus récentes d'abord)
router.get("/", async (req, res) => {
  try {
    const uid = new ObjectId(req.user.id);
    const col = getDB().collection("notifications");
    const [items, unread] = await Promise.all([
      col.find({ userId: uid }).sort({ createdAt: -1 }).limit(50).toArray(),
      col.countDocuments({ userId: uid, lu: false })
    ]);
    res.json({ unread: unread, items: items.map(formater) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

// PATCH /api/notifications/:id/read : marquer comme lue (seulement les siennes)
router.patch("/:id/read", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) return res.status(400).json({ erreur: "Identifiant invalide" });
    const r = await getDB().collection("notifications").findOneAndUpdate(
      { _id: new ObjectId(req.params.id), userId: new ObjectId(req.user.id) },
      { $set: { lu: true } },
      { returnDocument: "after" }
    );
    const doc = r && r.value !== undefined ? r.value : r;
    if (!doc) return res.status(404).json({ erreur: "Notification introuvable" });
    res.json(formater(doc));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: "Erreur serveur" });
  }
});

module.exports = router;