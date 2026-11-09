const { MongoClient } = require("mongodb");

let client;
let db;

async function connectDB() {
  client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME);
  console.log("MongoDB connecté : base " + process.env.DB_NAME);
  return db;
}

function getDB() {
  if (!db) throw new Error("Base de données non connectée");
  return db;
}

function getClient() {
  return client;
}

module.exports = { connectDB, getDB, getClient };