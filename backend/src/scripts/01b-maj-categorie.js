const smartcity = db.getSiblingDB("smartcity");
const info = smartcity.getCollectionInfos({ name: "complaints" })[0];
const v = info.options.validator;
v.$jsonSchema.properties.categorie.enum = ["route", "eclairage", "proprete", "autre"];
smartcity.runCommand({ collMod: "complaints", validator: v });
print("Catégories mises à jour");