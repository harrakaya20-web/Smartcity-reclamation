

const complaintForm = document.getElementById("complaintForm");

if (complaintForm) {

    const photoInput = document.getElementById("photo");
    const photoPreview = document.getElementById("photoPreview");
    const message = document.getElementById("message");

    // Prévisualisation de la photo
    photoInput.addEventListener("change", function() {

        photoPreview.innerHTML = "";

        const file = photoInput.files[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            message.textContent = "Veuillez choisir un fichier image valide.";
            message.style.color = "red";
            photoInput.value = "";
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            message.textContent = "La taille de l'image ne doit pas dépasser 5 MB.";
            message.style.color = "red";
            photoInput.value = "";
            return;
        }

        const image = document.createElement("img");
        image.src = URL.createObjectURL(file);
        image.alt = "Aperçu de la photo";
        image.style.maxWidth = "200px";
        image.style.marginTop = "10px";
        image.style.borderRadius = "8px";

        photoPreview.appendChild(image);

        message.textContent = "";
    });

    // Gestion du formulaire
    complaintForm.addEventListener("submit", function(event) {

        event.preventDefault();

        const title = document.getElementById("title").value.trim();
        const category = document.getElementById("category").value;
        const description = document.getElementById("description").value.trim();
        const location = document.getElementById("location").value.trim();

        const file = photoInput.files[0];

        if (title === "" || category === "" ||
            description === "" || location === "") {

            message.textContent = "Veuillez remplir tous les champs obligatoires.";
            message.style.color = "red";
            return;
        }

        if (file && !file.type.startsWith("image/")) {
            message.textContent = "Veuillez choisir un fichier image valide.";
            message.style.color = "red";
            return;
        }

        if (file && file.size > 5 * 1024 * 1024) {
            message.textContent = "La taille de l'image ne doit pas dépasser 5 MB.";
            message.style.color = "red";
            return;
        }

        message.textContent = "Votre réclamation a été envoyée avec succès !";
        message.style.color = "green";

        complaintForm.reset();
        photoPreview.innerHTML = "";
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

        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

             message.textContent = "Veuillez saisir une adresse e-mail valide.";
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
   






// Afficher ou masquer le mot de passe

const passwordButtons = document.querySelectorAll(".toggle-password");

passwordButtons.forEach(function(button) {

    button.addEventListener("click", function() {

        const inputId = button.dataset.target;
        const passwordInput = document.getElementById(inputId);

        if (passwordInput.type === "password") {

            passwordInput.type = "text";
            button.textContent = "👁️";

        } else {

            passwordInput.type = "password";
            button.textContent = "🙈";

        }

    });

});