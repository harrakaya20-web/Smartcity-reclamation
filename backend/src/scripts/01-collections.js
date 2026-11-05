const smartcity = db.getSiblingDB("smartcity");

if (!smartcity.getCollectionNames().includes("users")) {
  smartcity.createCollection("users", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["nom", "email", "passwordHash", "role", "createdAt"],
        properties: {
          nom: { bsonType: "string" },
          email: { bsonType: "string", pattern: "^.+@.+\\..+$" },
          passwordHash: { bsonType: "string" },
          role: { enum: ["citoyen", "admin"] },
          createdAt: { bsonType: "date" }
        }
      }
    }
  });
  print("Collection users créée");
} else {
  print("Collection users existe déjà");
}
if (!smartcity.getCollectionNames().includes("complaints")) {
  smartcity.createCollection("complaints", {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["citizenId", "titre", "description", "categorie", "location", "statut", "createdAt"],
        properties: {
          citizenId: { bsonType: "objectId" },
          titre: { bsonType: "string", minLength: 5 },
          description: { bsonType: "string" },
          categorie: { enum: ["voirie", "eclairage", "proprete", "autre"] },
          statut: { enum: ["en_attente", "en_cours", "resolue"] },
          location: {
            bsonType: "object",
            required: ["type", "coordinates"],
            properties: {
              type: { enum: ["Point"] },
              coordinates: { bsonType: "array", minItems: 2, maxItems: 2 }
            }
          },
          createdAt: { bsonType: "date" }
        }
      }
    }
  });
  print("Collection complaints créée");
} else {
  print("Collection complaints existe déjà");
}

["incidents", "events"].forEach(function (nom) {
  if (!smartcity.getCollectionNames().includes(nom)) {
    smartcity.createCollection(nom);
    print("Collection " + nom + " créée");
  } else {
    print("Collection " + nom + " existe déjà");
  }
});