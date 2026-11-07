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
$t5 = Login "citoyen5@seed.ma"
$t6 = Login "citoyen6@seed.ma"
$t7 = Login "citoyen7@seed.ma"
Verif "Connexions administrateur et citoyens" ($ta -and $t5 -and $t6 -and $t7)
if (-not ($ta -and $t5 -and $t6 -and $t7)) { Write-Host "Connexion impossible : le serveur tourne-t-il ?"; exit }

function Depot($tok, $lat, $lng) {
  Appel "Post" "/api/complaints" @{ title = "Test notif lampadaire"; category = "route"; description = "Nid de poule dangereux, test des notifications d'incident"; location = "Rue test notif"; latitude = $lat; longitude = $lng } $tok
}
$d1 = Depot $t5 31.6250 -8.0300
$d2 = Depot $t6 31.6252 -8.0300
$d3 = Depot $t7 31.6250 -8.0302
$inc = $d1.data.incidentId
Verif "1. Trois citoyens, un seul incident" ($d1.ok -and $d2.ok -and $d3.ok -and $d2.data.incidentId -eq $inc -and $d3.data.incidentId -eq $inc)
Verif "2. Le compteur de signalements vaut 3" ($d3.data.incident.nbSignalements -eq 3)

$l = Appel "Get" "/api/incidents?status=en_attente&limit=50" $null $ta
$tri = $true
for ($i = 1; $i -lt $l.data.items.Count; $i++) { if ($l.data.items[$i].priority -gt $l.data.items[$i-1].priority) { $tri = $false } }
Verif "3. Liste des incidents triee par priorite (administrateur)" ($l.ok -and $l.data.items.Count -ge 1 -and $tri)

$r = Appel "Get" "/api/incidents" $null $t5
Verif "4. Un citoyen ne voit pas les incidents (403)" ($r.code -eq 403)

$r = Appel "Patch" "/api/incidents/$inc/status" @{ status = "resolue" } $ta
Verif "5. Saut en_attente -> resolue refuse (409)" ($r.code -eq 409)

$r = Appel "Patch" "/api/incidents/$inc/status" @{ status = "en_cours" } $ta
Verif "6. Incident passe en_cours" ($r.ok -and $r.data.status -eq "en_cours")

$m = Appel "Get" "/api/complaints/mine?limit=1" $null $t5
Verif "7. Les reclamations de l'incident passent aussi en_cours" ($m.ok -and $m.data.items[0].status -eq "en_cours")

$r = Appel "Patch" "/api/incidents/$inc/status" @{ status = "resolue" } $ta
Verif "8. Incident resolu" ($r.ok -and $r.data.status -eq "resolue")
Start-Sleep -Seconds 2

$n5 = Appel "Get" "/api/notifications" $null $t5
$n6 = Appel "Get" "/api/notifications" $null $t6
$n7 = Appel "Get" "/api/notifications" $null $t7
$a5 = @($n5.data.items | Where-Object { $_.incidentId -eq $inc })
$a6 = @($n6.data.items | Where-Object { $_.incidentId -eq $inc })
$a7 = @($n7.data.items | Where-Object { $_.incidentId -eq $inc })
Verif "9. Les trois citoyens recoivent exactement une notification" ($a5.Count -eq 1 -and $a6.Count -eq 1 -and $a7.Count -eq 1)

$m = Appel "Get" "/api/complaints/mine?limit=1" $null $t5
Verif "10. Les reclamations sont passees a resolue" ($m.ok -and $m.data.items[0].status -eq "resolue")

$nid = $a5[0].id
$r = Appel "Patch" "/api/notifications/$nid/read" $null $t5
Verif "11. Notification marquee comme lue" ($r.ok -and $r.data.read -eq $true)

$r = Appel "Patch" "/api/notifications/$nid/read" $null $t6
Verif "12. On ne peut pas lire la notification d'un autre (404)" ($r.code -eq 404)

$s = docker exec smartcity-redis redis-cli ZSCORE urgent:incidents $inc
Verif "13. L'incident resolu a quitte la file Redis" ((-not $s) -or ($s -eq "(nil)"))

Write-Host ""
Write-Host "$reussis / $total tests reussis"