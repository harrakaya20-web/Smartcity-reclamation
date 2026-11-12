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
$tc = Login "citoyen10@seed.ma"
Verif "Connexions administrateur et citoyen" ($ta -and $tc)
if (-not ($ta -and $tc)) { Write-Host "Connexion impossible : le serveur tourne-t-il ?"; exit }

$texte = "Lampadaire casse, reverbere eteint, eclairage public en panne, la rue est dans le noir"
$ids = @()

# 1. Le citoyen choisit "autre" alors que le texte parle d'eclairage : correction automatique
$r1 = Appel "Post" "/api/complaints" @{ title = "Test IA lampadaire casse"; category = "autre"; description = $texte } $tc
if ($r1.data.id) { $ids += $r1.data.id }
Verif "1. Categorie 'autre' corrigee en 'eclairage'" ($r1.ok -and $r1.data.category -eq "eclairage" -and $r1.data.ai.corrigee -eq $true)

# 2. Le citoyen choisit "route" pour un texte d'eclairage : sa categorie est gardee, desaccord signale
$r2 = Appel "Post" "/api/complaints" @{ title = "Test IA lampadaire casse"; category = "route"; description = $texte } $tc
if ($r2.data.id) { $ids += $r2.data.id }
Verif "2. Categorie choisie 'route' conservee" ($r2.ok -and $r2.data.category -eq "route" -and $r2.data.ai.corrigee -eq $false)
Verif "3. Desaccord signale a l'administrateur" ($r2.ok -and $r2.data.ai.categorie -eq "eclairage" -and $r2.data.ai.desaccord -eq $true)

# 3. Accord entre le citoyen et l'IA : aucun desaccord
$r3 = Appel "Post" "/api/complaints" @{ title = "Test IA lampadaire casse"; category = "eclairage"; description = $texte } $tc
if ($r3.data.id) { $ids += $r3.data.id }
Verif "4. Accord : pas de desaccord" ($r3.ok -and $r3.data.ai.desaccord -eq $false)

foreach ($id in $ids) { $null = Appel "Delete" "/api/complaints/$id" $null $ta }

Write-Host ""
Write-Host "$reussis / $total tests reussis"