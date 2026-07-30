# ruletka network helper (Windows, open source)
# Full mini-hub + tunnel. Island chat on YOUR URL. No control of seed site.
#   powershell -ExecutionPolicy Bypass -File .\rulet-helper.ps1

$ErrorActionPreference = "Stop"
$BaseUrl = if ($env:RULETKA_BASE) { $env:RULETKA_BASE } else { "https://ruletka.vip" }
$Dir = if ($env:RULETKA_HELPER_DIR) { $env:RULETKA_HELPER_DIR } else { Join-Path $env:USERPROFILE ".ruletka-helper" }
$Port = if ($env:RULETKA_HELPER_PORT) { [int]$env:RULETKA_HELPER_PORT } else { 8791 }
$Bin = Join-Path $Dir "roulette-bridge.exe"
$Cf = Join-Path $Dir "cloudflared.exe"
$InstanceId = if ($env:ROULETTE_INSTANCE_ID) { $env:ROULETTE_INSTANCE_ID } else { "helper-win-$env:COMPUTERNAME-$PID" }
$UiDir = Join-Path $Dir "ui"

Write-Host ""
Write-Host "  ruletka · network helper (Windows)"
Write-Host "  ──────────────────────────────────"
Write-Host "  Independent mini hub on your PC."
Write-Host "  Chat can use YOUR public URL if the seed site is down."
Write-Host "  Stop anytime: Ctrl+C"
Write-Host ""

New-Item -ItemType Directory -Force -Path (Join-Path $UiDir "brand") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $UiDir "legal") | Out-Null

function Get-File($Url, $Out) {
  Write-Host "Downloading $Url …"
  Invoke-WebRequest -Uri $Url -OutFile $Out -UseBasicParsing
}

function Sync-Ui {
  Write-Host "Syncing chat UI from $BaseUrl …"
  $files = @(
    "index.html", "live.html", "contribute.html",
    "home.css", "style.css", "live-stage.css",
    "i18n.js", "identity.js", "hubs.js", "webrtc.js", "live.js", "sw.js",
    "hubs.json", "favicon.svg", "manifest.webmanifest"
  )
  foreach ($f in $files) {
    try { Get-File "$BaseUrl/$f" (Join-Path $UiDir $f) } catch {}
  }
  if (-not (Test-Path (Join-Path $UiDir "live.html"))) {
    Set-Content -Path (Join-Path $UiDir "live.html") -Value "<!doctype html><p>UI download failed — build from source.</p>" -Encoding UTF8
    Copy-Item (Join-Path $UiDir "live.html") (Join-Path $UiDir "index.html") -Force
  }
}

Sync-Ui

if (-not (Test-Path $Bin)) {
  $tmp = "$Bin.download"
  Get-File "$BaseUrl/download/roulette-bridge-windows-amd64.exe" $tmp
  try {
    $sumsPath = Join-Path $Dir "SHA256SUMS"
    Get-File "$BaseUrl/download/SHA256SUMS" $sumsPath
    $line = Get-Content $sumsPath | Where-Object { $_ -match "roulette-bridge-windows-amd64\.exe\s*$" } | Select-Object -First 1
    if ($line) {
      $expect = ($line -split "\s+")[0].ToLower()
      $got = (Get-FileHash -Path $tmp -Algorithm SHA256).Hash.ToLower()
      if ($got -ne $expect) {
        Remove-Item $tmp -Force -ErrorAction SilentlyContinue
        throw "Checksum mismatch for windows binary (expected $expect got $got)"
      }
      Write-Host "  ✓ SHA256 verified"
    }
  } catch {
    if ($_.Exception.Message -match "Checksum mismatch") { throw }
    # Missing SHA256SUMS is non-fatal
  }
  Move-Item -Force $tmp $Bin
}
if (-not (Test-Path $Cf)) {
  Get-File "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" $Cf
}

$bridgeLog = Join-Path $Dir "bridge.log"
$tunnelLog = Join-Path $Dir "tunnel.log"
$script:bridge = $null
$script:tunnel = $null

function Start-Bridge([string]$PublicBase) {
  if ($script:bridge -and -not $script:bridge.HasExited) {
    Stop-Process -Id $script:bridge.Id -Force -ErrorAction SilentlyContinue
  }
  $env:ROULETTE_OPEN_TURN = "true"
  $env:ROULETTE_INSTANCE_ID = $InstanceId
  $env:ROULETTE_DIRECTORY_HUBS = $BaseUrl
  Remove-Item Env:ROULETTE_FEDERATION_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:ROULETTE_FEDERATION_PEERS -ErrorAction SilentlyContinue
  Remove-Item Env:ROULETTE_ADMIN_TOKEN -ErrorAction SilentlyContinue
  if ($PublicBase) { $env:ROULETTE_PUBLIC_BASE = $PublicBase }
  else { Remove-Item Env:ROULETTE_PUBLIC_BASE -ErrorAction SilentlyContinue }

  $script:bridge = Start-Process -FilePath $Bin -ArgumentList @(
    "--mode", "simple",
    "--listen", "127.0.0.1:$Port",
    "--ui-dir", $UiDir,
    "--friends-file", (Join-Path $Dir "friends.json")
  ) -PassThru -WindowStyle Hidden -RedirectStandardOutput $bridgeLog -RedirectStandardError $bridgeLog
  Start-Sleep -Seconds 1
  if ($script:bridge.HasExited) {
    Write-Host "Bridge failed to start. Log:"
    Get-Content $bridgeLog -Tail 30 -ErrorAction SilentlyContinue
    exit 1
  }
}

Write-Host "Starting local bridge on http://127.0.0.1:$Port/ …"
Start-Bridge ""

Write-Host "Starting HTTPS tunnel…"
"" | Set-Content $tunnelLog
$script:tunnel = Start-Process -FilePath $Cf -ArgumentList @(
  "tunnel", "--url", "http://127.0.0.1:$Port", "--no-autoupdate"
) -PassThru -WindowStyle Hidden -RedirectStandardOutput $tunnelLog -RedirectStandardError $tunnelLog

$public = $null
for ($i = 0; $i -lt 50; $i++) {
  Start-Sleep -Milliseconds 400
  if (Test-Path $tunnelLog) {
    $txt = Get-Content $tunnelLog -Raw -ErrorAction SilentlyContinue
    if ($txt -match 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com') {
      $public = $Matches[0]
      break
    }
  }
}

if ($public) {
  Start-Bridge $public
  $hubs = @{
    protocol = "ruletka-directory/1"
    hubs = @(
      @{ base = $public; name = "this helper" },
      @{ base = $BaseUrl; name = "seed" }
    )
  } | ConvertTo-Json -Depth 5
  Set-Content -Path (Join-Path $UiDir "hubs.json") -Value $hubs -Encoding UTF8
}

Write-Host ""
Write-Host "  ✓ Helper hub is running"
Write-Host "  Local:  http://127.0.0.1:$Port/live.html"
if ($public) {
  Write-Host "  Public: $public/live.html"
  Write-Host "  Share that URL for island chat on your hub."
  try {
    $body = @{ public_base = $public; instance_id = $InstanceId; note = "helper-windows" } | ConvertTo-Json
    Invoke-WebRequest -Uri "$BaseUrl/v1/seeder/request" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Out-Null
  } catch {}
} else {
  Write-Host "  Public tunnel not ready yet — see $tunnelLog"
}
Write-Host ""
Write-Host "  Open source · LGPL-2.1 · Press Ctrl+C to stop."
Write-Host ""

try {
  while (-not $script:bridge.HasExited) {
    Start-Sleep -Seconds 2
  }
} finally {
  if ($script:tunnel -and -not $script:tunnel.HasExited) { Stop-Process -Id $script:tunnel.Id -Force -ErrorAction SilentlyContinue }
  if ($script:bridge -and -not $script:bridge.HasExited) { Stop-Process -Id $script:bridge.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "Stopped."
}
