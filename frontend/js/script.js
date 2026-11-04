
const complaintForm = document.getElementById("complaintForm");

if (complaintForm) {

    complaintForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const title = document.getElementById("title").value;
        const category = document.getElementById("category").value;
        const description = document.getElementById("description").value;
        const location = document.getElementById("location").value;

        const message = document.getElementById("message");

        if (title === "" || category === "" ||
            description === "" || location === "") {

            message.textContent = "Veuillez remplir tous les champs obligatoires.";
            message.style.color = "red";

        } else {

            message.textContent = "Votre réclamation a été envoyée avec succès !";
            message.style.color = "green";

            complaintForm.reset();
        }

    });

}
 

//code de register.html



// Gestion du formulaire d'inscription
const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        const message = document.getElementById("registerMessage");

        if (name === "" || email === "" || password === "" || confirmPassword === "") {

            message.textContent = "Veuillez remplir tous les champs obligatoires.";
            message.style.color = "red";

        } else if (password.length < 8) {

            message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
            message.style.color = "red";

        } else if (password !== confirmPassword) {

            message.textContent = "Les mots de passe ne correspondent pas.";
            message.style.color = "red";

        } else {

            message.textContent = "Inscription réussie ! Bienvenue sur SmartCity.";
            message.style.color = "green";

            registerForm.reset();
        }

    });
}


// login.html




// Gestion du formulaire de connexion
const loginForm = document.getElementById("loginForm");

if (loginForm) {

    loginForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;

        const message = document.getElementById("loginMessage");

        if (email === "" || password === "") {

            message.textContent = "Veuillez remplir tous les champs.";
            message.style.color = "red";

        } else if (password.length < 8) {

            message.textContent = "Le mot de passe doit contenir au moins 8 caractères.";
            message.style.color = "red";

        } else {

            message.textContent = "Connexion réussie ! Bienvenue sur SmartCity.";
            message.style.color = "green";

            loginForm.reset();
        }

    });
}





// Gestion des statistiques de mes réclamations

const complaintsTable = document.querySelector(".complaints-list tbody");

if (complaintsTable) {

    const rows = complaintsTable.querySelectorAll("tr");

    let total = rows.length;
    let pending = 0;
    let progress = 0;
    let resolved = 0;

    rows.forEach(function(row) {

        const status = row.querySelector(".status");

        if (status.classList.contains("pending")) {
            pending++;
        }

        else if (status.classList.contains("progress")) {
            progress++;
        }

        else if (status.classList.contains("resolved")) {
            resolved++;
        }

    });

    document.getElementById("totalComplaints").textContent = total;
    document.getElementById("pendingCount").textContent = pending;
    document.getElementById("progressCount").textContent = progress;
    document.getElementById("resolvedCount").textContent = resolved;

}



//admin.html


// Gestion des réclamations dans l'administration

const adminTable = document.querySelector(".complaints-list tbody");

if (adminTable) {

    const selects = adminTable.querySelectorAll("select");

    const adminMessage = document.getElementById("adminMessage");

    function updateAdminStats() {

        let pending = 0;
        let progress = 0;
        let resolved = 0;

        selects.forEach(function(select) {

            const status = select.value;

            if (status === "En attente") {
                pending++;
            }
            else if (status === "En cours") {
                progress++;
            }
            else if (status === "Résolue") {
                resolved++;
            }

        });

        document.getElementById("adminTotal").textContent = selects.length;
        document.getElementById("adminPending").textContent = pending;
        document.getElementById("adminProgress").textContent = progress;
        document.getElementById("adminResolved").textContent = resolved;
    }

    selects.forEach(function(select) {

        select.addEventListener("change", function() {

            adminMessage.textContent =
                "Le statut de la réclamation a été modifié avec succès !";

            adminMessage.style.color = "green";

            updateAdminStats();

        });

    });

    updateAdminStats();

}