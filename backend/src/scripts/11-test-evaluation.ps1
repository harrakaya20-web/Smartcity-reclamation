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

function Login($e) { $r = Appel "Post" "/api/auth/login" @{ email = $e; password = "Test1234" }; return $r.data.token }
$ta = Login "admin@seed.ma"
$t8 = Login "citoyen8@seed.ma"
$t9 = Login "citoyen9@seed.ma"
Verif "Connexions administrateur et citoyens" ($ta -and $t8 -and $t9)
if (-not ($ta -and $t8 -and $t9)) { Write-Host "Connexion impossible : le serveur tourne-t-il ?"; exit }

# Reclamation sans GPS : aucun incident n'est cree, le nettoyage est simple
$d = Appel "Post" "/api/complaints" @{ title = "Test evaluation lampadaire"; category = "autre"; description = "Reclamation de test pour la route d'evaluation" } $t8
$id = $d.data.id
Verif "1. Depot de la reclamation de test" ($d.ok -and $id)

$r = Appel "Post" "/api/complaints/$id/evaluation" @{ rating = 4 } $t8
Verif "2. Evaluation refusee tant que la reclamation n'est pas resolue (409)" ($r.code -eq 409)

$null = Appel "Patch" "/api/complaints/$id/status" @{ status = "en_cours" } $ta
$null = Appel "Patch" "/api/complaints/$id/status" @{ status = "resolue" } $ta

$r = Appel "Post" "/api/complaints/$id/evaluation" @{ rating = 4 } $t9
Verif "3. Un autre citoyen ne peut pas evaluer (404)" ($r.code -eq 404)

$r = Appel "Post" "/api/complaints/$id/evaluation" @{ rating = 6 } $t8
Verif "4. Note hors limites refusee (400)" ($r.code -eq 400)

$r = Appel "Post" "/api/complaints/$id/evaluation" @{ rating = "5" } $t8
Verif "5. Note de type texte refusee (400)" ($r.code -eq 400)

$r = Appel "Post" "/api/complaints/$id/evaluation" @{ rating = 4; comment = "Intervention rapide, merci" } $t8
Verif "6. Evaluation valide acceptee (note 4)" ($r.ok -and $r.data.evaluation.note -eq 4)

$r = Appel "Post" "/api/complaints/$id/evaluation" @{ rating = 1 } $t8
Verif "7. Deuxieme evaluation refusee (409)" ($r.code -eq 409)

$m = Appel "Get" "/api/complaints/mine?limit=1" $null $t8
Verif "8. L'evaluation apparait dans Mes reclamations" ($m.ok -and $m.data.items[0].evaluation.note -eq 4)

$null = Appel "Delete" "/api/complaints/$id" $null $ta

Write-Host ""
Write-Host "$reussis / $total tests reussis"