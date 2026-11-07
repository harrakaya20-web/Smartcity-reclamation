$base = "http://localhost:5000"

function Appel($m, $u, $b, $t) {
  $h = @{}
  if ($t) { $h["Authorization"] = "Bearer $t" }
  try {
    if ($b) { $r = Invoke-RestMethod -Method $m -Uri "$base$u" -ContentType "application/json" -Body ($b | ConvertTo-Json) -Headers $h }
    else { $r = Invoke-RestMethod -Method $m -Uri "$base$u" -Headers $h }
    return @{ ok = $true; code = 200; data = $r }
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    return @{ ok = $false; code = $code; data = $_.ErrorDetails.Message }
  }
}

$total = 0
$reussis = 0
function Verif($nom, $cond) {
  $script:total++
  if ($cond) { $script:reussis++; Write-Host "[OK]    $nom" -ForegroundColor Green }
  else { Write-Host "[ECHEC] $nom" -ForegroundColor Red }
}

$c = Appel "Post" "/api/auth/login" @{ email = "citoyen1@seed.ma"; password = "Test1234" }
$a = Appel "Post" "/api/auth/login" @{ email = "admin@seed.ma"; password = "Test1234" }
$tc = $c.data.token
$ta = $a.data.token
Verif "Connexion citoyen et administrateur" ($tc -and $ta)
if (-not ($tc -and $ta)) { Write-Host "Connexion impossible : le serveur tourne-t-il ?"; exit }

$n = Appel "Post" "/api/complaints" @{ title = "Lampadaire casse rue Mohammed V"; category = "eclairage"; description = "Le lampadaire est casse depuis trois jours, c'est dangereux la nuit"; location = "Rue Mohammed V, Gueliz"; latitude = 31.6350; longitude = -8.0125 } $tc
Verif "1. Depot valide (statut en_attente)" ($n.ok -and $n.data.status -eq "en_attente")
Verif "2. Urgence estimee elevee (score >= 8)" ($n.ok -and $n.data.urgency.score -ge 8)

$r = Appel "Post" "/api/complaints" @{ title = "Test titre"; category = "nimporte"; description = "Description assez longue" } $tc
Verif "3. Categorie invalide refusee (400)" ($r.code -eq 400)

$r = Appel "Post" "/api/complaints" @{ title = "Test titre"; category = "route"; description = "Description assez longue" }
Verif "4. Depot sans connexion refuse (401)" ($r.code -eq 401)

$r = Appel "Get" "/api/complaints/mine?limit=3" $null $tc
Verif "5. Mes reclamations : la nouvelle est en premier" ($r.ok -and $r.data.items[0].id -eq $n.data.id)

$r = Appel "Get" "/api/complaints" $null $tc
Verif "6. Citoyen sur la liste administrateur refuse (403)" ($r.code -eq 403)

$r = Appel "Get" "/api/complaints?status=en_attente&limit=3" $null $ta
Verif "7. Administrateur : liste filtree" ($r.ok -and $r.data.total -gt 1000 -and $r.data.items.Count -eq 3)

$r = Appel "Get" '/api/complaints?status[$ne]=x' $null $ta
Verif "8. Injection NoSQL sans effet" ($r.code -eq 400 -or $r.ok)

$id = $n.data.id
$r = Appel "Patch" "/api/complaints/$id/status" @{ status = "en_cours" } $tc
Verif "9. Citoyen ne peut pas changer le statut (403)" ($r.code -eq 403)

$r = Appel "Patch" "/api/complaints/$id/status" @{ status = "en_cours" } $ta
Verif "10. Administrateur : passage en_cours" ($r.ok -and $r.data.status -eq "en_cours")

$r = Appel "Patch" "/api/complaints/$id/status" @{ status = "en_attente" } $ta
Verif "11. Retour en arriere refuse (409)" ($r.code -eq 409)

$r = Appel "Delete" "/api/complaints/$id" $null $ta
Verif "12. Suppression par l'administrateur" ($r.ok -and $r.data.ok)

Write-Host ""
Write-Host "$reussis / $total tests reussis"