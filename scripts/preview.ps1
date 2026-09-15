param([int]$Port = 3000)
$ErrorActionPreference = 'Stop'
$nbcProjectRoot = Split-Path -Parent $PSScriptRoot
$nbcLogDirectory = Join-Path $nbcProjectRoot 'tmp/server'
New-Item -ItemType Directory -Force -Path $nbcLogDirectory | Out-Null
$nbcNodePath = (Get-Command node.exe).Source
$nbcProcess = Start-Process -FilePath $nbcNodePath -ArgumentList 'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',$Port -WorkingDirectory $nbcProjectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $nbcLogDirectory 'stdout.log') -RedirectStandardError (Join-Path $nbcLogDirectory 'stderr.log') -PassThru
$nbcReady = $false
for ($nbcAttempt = 0; $nbcAttempt -lt 20; $nbcAttempt++) {
    Start-Sleep -Milliseconds 500
    $nbcProcess.Refresh()
    if ($nbcProcess.HasExited) {
        throw "Preview exited before startup. See $(Join-Path $nbcLogDirectory 'stderr.log')."
    }
    try {
        $nbcResponse = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/session" -UseBasicParsing -TimeoutSec 2
        $nbcResponseData = $nbcResponse.Content | ConvertFrom-Json
        if ($nbcResponse.StatusCode -eq 200 -and $nbcResponseData.PSObject.Properties.Name -contains 'session') {
            $nbcReady = $true
            break
        }
    } catch { }
}
if (-not $nbcReady) { throw 'The preview did not become ready; inspect tmp/server logs.' }
$nbcProcess.Id | Set-Content -LiteralPath (Join-Path $nbcLogDirectory 'preview.pid')
Write-Output "NBC preview: http://127.0.0.1:$Port (PID $($nbcProcess.Id))"
