$ErrorActionPreference = 'Stop'
$root = "d:\Agents\main\projects\ideas\NBC_web"
Set-Location $root
$Host.UI.RawUI.WindowTitle = "NBC Live Share (Cloudflare Tunnel)"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "           STARTING NBC COMPETITION LIVE PREVIEW                  " -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Ensure .env.local exists and has remote demo allowed
$envFile = Join-Path $root ".env.local"
if (-not (Test-Path $envFile)) {
    @"
NBC_DEMO_MODE=true
NBC_ALLOW_REMOTE_DEMO=true
NBC_DATA_DIR=.data/nbc
"@ | Set-Content -LiteralPath $envFile -Encoding utf8
}

Write-Host ">>> Stopping any existing processes on port 3000..." -ForegroundColor Yellow
Get-Process -Name cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
$portProc = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($portProc) {
    Stop-Process -Id $portProc -Force -ErrorAction SilentlyContinue
}

$node = (Get-Command node.exe).Source
$nextCli = Join-Path $root "node_modules\next\dist\bin\next"

Write-Host ">>> Starting Next.js production server..." -ForegroundColor Yellow
$serverLog = Join-Path $root "tmp\server\stdout.log"
$serverErr = Join-Path $root "tmp\server\stderr.log"
New-Item -ItemType Directory -Force -Path (Split-Path $serverLog) | Out-Null

$serverProc = Start-Process -FilePath $node -ArgumentList @($nextCli, "start", "--hostname", "127.0.0.1", "--port", "3000") -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr -PassThru

Write-Host ">>> Waiting for server to become ready..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $res = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/session" -UseBasicParsing -TimeoutSec 2
        if ($res.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
}

if (-not $ready) {
    Write-Host "ERROR: Next.js server failed to respond on port 3000." -ForegroundColor Red
    pause
    exit 1
}

$cfExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cfExe)) {
    $cfExe = (Get-Command cloudflared.exe -ErrorAction SilentlyContinue).Source
}

$logPath = Join-Path $root "tmp\server\cloudflared.log"
Remove-Item -Force -Path $logPath -ErrorAction SilentlyContinue

Write-Host ">>> Connecting Cloudflare Tunnel (HTTP/2)..." -ForegroundColor Yellow
$cfProc = Start-Process -FilePath $cfExe -ArgumentList @("tunnel", "--protocol", "http2", "--url", "http://127.0.0.1:3000") -WorkingDirectory $root -RedirectStandardError $logPath -PassThru

$tunnelUrl = $null
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $logPath) {
        $lines = Get-Content $logPath -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match 'https://([a-zA-Z0-9-]+\.trycloudflare\.com)') {
                $subdomain = $matches[1]
                if ($subdomain -notmatch '^(api|pkg|region)') {
                    $tunnelUrl = "https://$subdomain"
                    break
                }
            }
        }
        if ($tunnelUrl) { break }
    }
}

if (-not $tunnelUrl) {
    Write-Host "ERROR: Failed to establish Cloudflare tunnel. Check tmp\server\cloudflared.log" -ForegroundColor Red
    pause
    exit 1
}

$tunnelUrl | Set-Content -LiteralPath "$root\tmp\server\current_url.txt"

Clear-Host
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "             NBC COMPETITION DEMO IS ONLINE!                      " -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Participant Link: " -NoNewline; Write-Host "$tunnelUrl" -ForegroundColor Cyan
Write-Host "  Admin Workspace:  " -NoNewline; Write-Host "$tunnelUrl/admin" -ForegroundColor Cyan
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "  KEEP THIS WINDOW OPEN while your co-worker is testing.          " -ForegroundColor Yellow
Write-Host "  Closing this window will automatically stop the server.         " -ForegroundColor Yellow
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C or close this window to stop sharing." -ForegroundColor Gray
Write-Host ""

# Copy the link to clipboard if possible
try {
    Set-Clipboard -Value $tunnelUrl
    Write-Host "(The participant link has been copied to your clipboard!)" -ForegroundColor DarkCyan
    Write-Host ""
} catch {}

# Keep running until the window is closed
try {
    while ($true) {
        Start-Sleep -Seconds 2
        $cfProc.Refresh()
        $serverProc.Refresh()
        if ($cfProc.HasExited -or $serverProc.HasExited) { break }
    }
} finally {
    Write-Host ">>> Stopping server and tunnel..." -ForegroundColor Yellow
    Stop-Process -Id $serverProc.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $cfProc.Id -Force -ErrorAction SilentlyContinue
}
