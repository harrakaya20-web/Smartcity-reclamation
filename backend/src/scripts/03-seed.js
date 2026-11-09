const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env") });
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

const N = parseInt(process.argv[2] || "1000", 10);

// Centres approximatifs de quelques quartiers de Marrakech [longitude, latitude]
const quartiers = {
  "Guéliz": [-8.0125, 31.6350],
  "Médina": [-7.9890, 31.6295],
  "Hivernage": [-8.0100, 31.6200],
  "Palmeraie": [-7.9600, 31.6700],
  "Daoudiate": [-8.0200, 31.6450],
  "Mhamid": [-8.0300, 31.6050]
};
const noms = Object.keys(quartiers);

const titres = {
  route: ["Nid de poule dangereux", "Trottoir cassé", "Route inondée après la pluie"],
  eclairage: ["Lampadaire cassé", "Rue sans éclairage", "Lumière qui clignote"],
  proprete: ["Poubelles débordantes", "Déchets sur le trottoir", "Dépôt sauvage de gravats"],
  autre: ["Panneau de signalisation tombé", "Fuite d'eau dans la rue", "Arbre dangereux"]
};
const categories = Object.keys(titres);

const rand = (a, b) => Math.random() * (b - a) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const HEURE = 3600 * 1000;

function choisirStatut() {
  const r = Math.random();
  if (r < 0.40) return "en_attente";
  if (r < 0.65) return "en_cours";
  return "resolue";
}

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db(process.env.DB_NAME);
  const users = db.collection("users");
  const complaints = db.collection("complaints");

  // On ne supprime que les données de test (marquées seed), jamais les vraies
  await complaints.deleteMany({ seed: true });
  await users.deleteMany({ email: /@seed\.ma$/ });

  const hash = bcrypt.hashSync("Test1234", 10);
  const liste = [{
    _id: new ObjectId(), nom: "Admin Test", email: "admin@seed.ma", phone: "0600000000",
    passwordHash: hash, role: "admin", createdAt: new Date(), seed: true
  }];
  for (let i = 1; i <= 50; i++) {
    liste.push({
      _id: new ObjectId(), nom: "Citoyen " + i, email: "citoyen" + i + "@seed.ma",
      phone: "06" + String(10000000 + i), passwordHash: hash, role: "citoyen",
      createdAt: new Date(), seed: true
    });
  }
  await users.insertMany(liste);
  const citoyens = liste.slice(1);

  let total = 0;
  const LOT = 5000;
  while (total < N) {
    const docs = [];
    const taille = Math.min(LOT, N - total);
    for (let i = 0; i < taille; i++) {
      const cat = pick(categories);
      const quartier = pick(noms);
      const centre = quartiers[quartier];
      const createdAt = new Date(Date.now() - rand(0, 90) * 24 * HEURE);
      const statut = choisirStatut();
      const score = Math.floor(rand(1, 11));

      const historique = [{ statut: "en_attente", date: createdAt, par: "systeme" }];
      let resolvedAt = null;
      let evaluation = null;
      if (statut === "en_cours" || statut === "resolue") {
        historique.push({ statut: "en_cours", date: new Date(createdAt.getTime() + rand(1, 48) * HEURE), par: "admin" });
      }
      if (statut === "resolue") {
        resolvedAt = new Date(createdAt.getTime() + rand(50, 300) * HEURE);
        historique.push({ statut: "resolue", date: resolvedAt, par: "admin" });
        if (Math.random() < 0.7) evaluation = { note: Math.ceil(rand(0, 5)), commentaire: "" };
      }

      docs.push({
        citizenId: pick(citoyens)._id,
        titre: pick(titres[cat]),
        description: "Signalement de test numéro " + (total + i) + " dans le quartier " + quartier,
        categorie: cat,
        photos: [],
        location: {
          type: "Point",
          coordinates: [centre[0] + rand(-0.008, 0.008), centre[1] + rand(-0.008, 0.008)]
        },
        quartier: quartier,
        urgence: { score: score, niveau: score >= 8 ? "haute" : score >= 5 ? "moyenne" : "basse" },
        statut: statut,
        nbSignalements: 1,
        historique: historique,
        evaluation: evaluation,
        createdAt: createdAt,
        resolvedAt: resolvedAt,
        seed: true
      });
    }
    await complaints.insertMany(docs);
    total += taille;
    console.log(total + " / " + N);
  }

  console.log("Terminé : " + N + " réclamations et " + liste.length + " utilisateurs de test");
  await client.close();
})();