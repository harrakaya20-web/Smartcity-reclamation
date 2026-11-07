require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB, getDB } = require("./src/config/db");

const app = express();
app.use(cors());
app.use(express.json());
const authRoutes = require("./src/routes/auth");
app.use("/api/auth", authRoutes);
const complaintRoutes = require("./src/routes/complaints");
app.use("/api/complaints", complaintRoutes);
const statsRoutes = require("./src/routes/stats");
app.use("/api/stats", statsRoutes);
const incidentRoutes = require("./src/routes/incidents");
app.use("/api/incidents", incidentRoutes);
const notificationRoutes = require("./src/routes/notifications");
app.use("/api/notifications", notificationRoutes);
const { demarrerNotifications } = require("./src/services/notifications");

// Route de test : prouve que le serveur et MongoDB communiquent
app.get("/api/health", async (req, res) => {
  try {
    const db = getDB();
    const n = await db.collection("complaints").countDocuments();
    res.json({ ok: true, service: "smartcity-api", base: db.databaseName, reclamations: n });
  } catch (err) {
    res.status(500).json({ ok: false, erreur: err.message });
  }
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log("Serveur démarré sur http://localhost:" + PORT));
    demarrerNotifications();
  })
  .catch((err) => {
    console.error("Connexion MongoDB impossible : " + err.message);
    process.exit(1);
  });