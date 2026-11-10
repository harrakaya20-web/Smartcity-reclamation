const API_URL = "http://localhost:5000/api";

// -------------------------
// Fonctions générales
// -------------------------

function afficherMessage(element, texte, type = "error") {
    if (!element) return;

    element.textContent = texte;
    element.style.color = type === "success" ? "green" : "red";
}

async function lireReponse(response) {
    let data = {};

    try {
        data = await response.json();
    } catch {
        throw new Error("Réponse invalide du serveur.");
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            data.error ||
            data.erreur ||
            "Une erreur est survenue."
        );
    }

    return data;
}

function obtenirToken() {
    return localStorage.getItem("token");
}

function obtenirUtilisateur() {
    try {
        return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
        return null;
    }
}

function formaterDate(date) {
    if (!date) return "—";

    const valeur = new Date(date);

    if (Number.isNaN(valeur.getTime())) return "—";

    return valeur.toLocaleDateString("fr-FR");
}

function libelleCategorie(categorie) {
    const categories = {
        route: "Routes",
        eclairage: "Éclairage public",
        proprete: "Propreté",
        autre: "Autre"
    };

    return categories[categorie] || categorie || "—";
}

function libelleStatut(statut) {
    const statuts = {
        en_attente: "En attente",
        en_cours: "En cours",
        resolue: "Résolue"
    };

    return statuts[statut] || statut || "—";
}

function creerCellule(texte) {
    const cellule = document.createElement("td");
    cellule.textContent = texte ?? "—";
    return cellule;
}

function viderTableau(tableau, nombreColonnes, message) {
    tableau.innerHTML = "";

    const ligne = document.createElement("tr");
    const cellule = document.createElement("td");

    cellule.colSpan = nombreColonnes;
    cellule.textContent = message;

    ligne.appendChild(cellule);
    tableau.appendChild(ligne);
}

function supprimerSession() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
}

// Récupérer toutes les pages de réclamations
async function recupererToutesLesReclamations(endpoint, token) {
    const limite = 50;
    let page = 1;
    let toutesLesReclamations = [];
    let total = 0;

    do {
        const response = await fetch(
            `${API_URL}${endpoint}?page=${page}&limit=${limite}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await lireReponse(response);
        const items = Array.isArray(data.items) ? data.items : [];

        total = Number(data.total) || 0;
        toutesLesReclamations = toutesLesReclamations.concat(items);

        if (items.length === 0) break;

        page++;
    } while (toutesLesReclamations.length < total);

    return toutesLesReclamations;
}


// -------------------------
// Inscription
// -------------------------

const registerForm = document.getElementById("registerForm");

if (registerForm) {
    const message = document.getElementById("message");

    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const phone = document.getElementById("phone").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            afficherMessage(message, "Les mots de passe ne correspondent pas.");
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    password
                })
            });

            await lireReponse(response);

            afficherMessage(
                message,
                "Inscription réussie ! Vous pouvez maintenant vous connecter.",
                "success"
            );

            registerForm.reset();

        } catch (error) {
            afficherMessage(message, error.message);
        }
    });
}


// -------------------------
// Connexion
// -------------------------

const loginForm = document.getElementById("loginForm");

if (loginForm) {
    const message = document.getElementById("message");

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await lireReponse(response);

            if (!data.token) {
                throw new Error("Le serveur n'a pas retourné de token.");
            }

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user || {}));

            afficherMessage(message, "Connexion réussie !", "success");

            if (data.user && data.user.role === "admin") {
                window.location.href = "admin.html";
            } else {
                window.location.href = "mes-reclamations.html";
            }

        } catch (error) {
            afficherMessage(message, error.message);
        }
    });
}


// -------------------------
// Déposer une réclamation
// -------------------------

const complaintForm = document.getElementById("complaintForm");

if (complaintForm) {
const getLocationButton = document.getElementById("getLocation");
const gpsStatus = document.getElementById("gpsStatus");

let latitude = null;
let longitude = null;

if (getLocationButton) {
    getLocationButton.addEventListener("click", function () {
        if (!navigator.geolocation) {
            gpsStatus.textContent = "La géolocalisation n'est pas disponible.";
            return;
        }

        gpsStatus.textContent = "Détection de votre position...";

        navigator.geolocation.getCurrentPosition(
            function (position) {
                latitude = position.coords.latitude;
                longitude = position.coords.longitude;

                gpsStatus.textContent =
                    "Position GPS détectée avec succès !";
            },
            function (error) {
                latitude = null;
                longitude = null;

                gpsStatus.textContent =
                    "Impossible de détecter votre position. Vérifiez l'autorisation GPS.";
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    });
}
    const message = document.getElementById("message");
    const photoInput = document.getElementById("photo");
    const photoPreview = document.getElementById("photoPreview");

    // Prévisualisation locale de la photo
    if (photoInput && photoPreview) {
        photoInput.addEventListener("change", function () {
            photoPreview.innerHTML = "";

            const fichier = photoInput.files[0];

            if (!fichier) return;

            if (!fichier.type.startsWith("image/")) {
                afficherMessage(message, "Veuillez choisir une image.");
                photoInput.value = "";
                return;
            }

            const image = document.createElement("img");
            image.src = URL.createObjectURL(fichier);
            image.alt = "Aperçu de la photo";
            image.style.maxWidth = "200px";
            image.style.marginTop = "10px";

            photoPreview.appendChild(image);
        });
    }

    complaintForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const token = obtenirToken();

        if (!token) {
            afficherMessage(
                message,
                "Vous devez vous connecter avant de déposer une réclamation."
            );
            return;
        }

        const title = document.getElementById("title").value.trim();
        const category = document.getElementById("category").value;
        const description = document.getElementById("description").value.trim();
        const location = document.getElementById("location").value.trim();

        try {
            const response = await fetch(`${API_URL}/complaints`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                   title,
                   category,
                   description,
                   location,
                   latitude,
                   longitude
               })
            });

            await lireReponse(response);

            afficherMessage(
                message,
                "Votre réclamation a été envoyée avec succès !",
                "success"
            );

            complaintForm.reset();

            if (photoPreview) {
                photoPreview.innerHTML = "";
            }

        } catch (error) {
            afficherMessage(message, error.message);
        }
    });
}


// -------------------------
// Mes réclamations (citoyen)
// -------------------------

const complaintsTableBody = document.getElementById("complaintsTableBody");

if (complaintsTableBody) {
    const token = obtenirToken();
    const message = document.getElementById("complaintsMessage");

    async function chargerMesReclamations() {
        if (!token) {
            viderTableau(
                complaintsTableBody,
                4,
                "Veuillez vous connecter pour consulter vos réclamations."
            );
            return;
        }

        try {
            const reclamations = await recupererToutesLesReclamations(
                "/complaints/mine",
                token
            );

            const total = reclamations.length;
            const enAttente = reclamations.filter(
                r => r.status === "en_attente"
            ).length;
            const enCours = reclamations.filter(
                r => r.status === "en_cours"
            ).length;
            const resolues = reclamations.filter(
                r => r.status === "resolue"
            ).length;

            document.getElementById("totalComplaints").textContent = total;
            document.getElementById("pendingCount").textContent = enAttente;
            document.getElementById("progressCount").textContent = enCours;
            document.getElementById("resolvedCount").textContent = resolues;

            complaintsTableBody.innerHTML = "";

            if (total === 0) {
                viderTableau(
                    complaintsTableBody,
                    4,
                    "Vous n'avez pas encore déposé de réclamation."
                );
                return;
            }

            reclamations.forEach(function (reclamation) {
                const ligne = document.createElement("tr");

                ligne.appendChild(creerCellule(reclamation.title));
                ligne.appendChild(
                    creerCellule(libelleCategorie(reclamation.category))
                );
                ligne.appendChild(
                    creerCellule(formaterDate(reclamation.createdAt))
                );
                ligne.appendChild(
                    creerCellule(libelleStatut(reclamation.status))
                );

                complaintsTableBody.appendChild(ligne);
            });

        } catch (error) {
            afficherMessage(message, error.message);

            viderTableau(
                complaintsTableBody,
                4,
                "Impossible de charger les réclamations."
            );
        }
    }

    chargerMesReclamations();
}


// -------------------------
// Déconnexion citoyen
// -------------------------

const logoutLink = document.getElementById("logoutLink");

if (logoutLink) {
    logoutLink.addEventListener("click", function () {
        supprimerSession();
    });
}


// -------------------------
// Administration
// -------------------------

const adminTableBody = document.getElementById("adminTableBody");

if (adminTableBody) {
    const token = obtenirToken();
    const message = document.getElementById("adminMessage");

    const transitions = {
        en_attente: ["en_cours"],
        en_cours: ["resolue"],
        resolue: []
    };

    async function changerStatut(id, nouveauStatut, select) {
        const ancienStatut = select.dataset.ancienStatut;

        try {
            const response = await fetch(
                `${API_URL}/complaints/${id}/status`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        status: nouveauStatut
                    })
                }
            );

            await lireReponse(response);

            afficherMessage(
                message,
                "Le statut de la réclamation a été modifié.",
                "success"
            );

            await chargerToutesLesReclamations();

        } catch (error) {
            select.value = ancienStatut;
            afficherMessage(message, error.message);
        }
    }

    function creerSelectStatut(reclamation) {
        const select = document.createElement("select");
        const statutActuel = reclamation.status;

        select.dataset.ancienStatut = statutActuel;

        const optionActuelle = document.createElement("option");
        optionActuelle.value = statutActuel;
        optionActuelle.textContent = libelleStatut(statutActuel);
        select.appendChild(optionActuelle);

        const prochainesEtapes = transitions[statutActuel] || [];

        prochainesEtapes.forEach(function (statut) {
            const option = document.createElement("option");
            option.value = statut;
            option.textContent = libelleStatut(statut);
            select.appendChild(option);
        });

        if (prochainesEtapes.length > 0) {
            select.addEventListener("change", function () {
                changerStatut(
                    String(reclamation.id),
                    select.value,
                    select
                );
            });
        } else {
            select.disabled = true;
        }

        return select;
    }

    async function chargerToutesLesReclamations() {
        if (!token) {
            viderTableau(
                adminTableBody,
                6,
                "Vous devez vous connecter en tant qu'administrateur."
            );
            return;
        }

        try {
            const reclamations = await recupererToutesLesReclamations(
                "/complaints",
                token
            );

            const total = reclamations.length;
            const enAttente = reclamations.filter(
                r => r.status === "en_attente"
            ).length;
            const enCours = reclamations.filter(
                r => r.status === "en_cours"
            ).length;
            const resolues = reclamations.filter(
                r => r.status === "resolue"
            ).length;

            document.getElementById("adminTotal").textContent = total;
            document.getElementById("adminPending").textContent = enAttente;
            document.getElementById("adminProgress").textContent = enCours;
            document.getElementById("adminResolved").textContent = resolues;

            adminTableBody.innerHTML = "";

            if (total === 0) {
                viderTableau(
                    adminTableBody,
                    6,
                    "Aucune réclamation enregistrée."
                );
                return;
            }

            reclamations.forEach(function (reclamation) {
                const ligne = document.createElement("tr");

                // Le Backend ne retourne pas encore le nom du citoyen.
                ligne.appendChild(creerCellule("Non renseigné"));
                ligne.appendChild(creerCellule(reclamation.title));
                ligne.appendChild(
                    creerCellule(libelleCategorie(reclamation.category))
                );
                ligne.appendChild(creerCellule(reclamation.location));
                ligne.appendChild(
                    creerCellule(formaterDate(reclamation.createdAt))
                );

                const celluleStatut = document.createElement("td");
                celluleStatut.appendChild(creerSelectStatut(reclamation));
                ligne.appendChild(celluleStatut);

                adminTableBody.appendChild(ligne);
            });

        } catch (error) {
            afficherMessage(message, error.message);

            viderTableau(
                adminTableBody,
                6,
                "Impossible de charger les réclamations."
            );
        }
    }

    chargerToutesLesReclamations();
}


// -------------------------
// Déconnexion administrateur
// -------------------------

const adminLogout = document.getElementById("adminLogout");

if (adminLogout) {
    adminLogout.addEventListener("click", function () {
        supprimerSession();
    });
}
EOF