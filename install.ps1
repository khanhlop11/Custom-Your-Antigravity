[CmdletBinding()]
param(
    [switch]$ForceClose
)

$ErrorActionPreference = "Stop"

# Auto-install dependencies if running on a fresh clone
$AsarModule = Join-Path $PSScriptRoot "node_modules\@electron\asar"
if (-not (Test-Path $AsarModule)) {
    Write-Host "[install] Installing required dependencies..." -ForegroundColor Cyan
    npm install
}

Write-Host "[install] Closing Antigravity to patch files..." -ForegroundColor Yellow
taskkill /F /IM Antigravity.exe /T 2>$null
Start-Sleep -Seconds 2

$retry = 0
while ((Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue) -and ($retry -lt 5)) {
    Write-Host "[install] Waiting for processes to release files..." -ForegroundColor Yellow
    taskkill /F /IM Antigravity.exe /T 2>$null
    Start-Sleep -Seconds 1
    $retry++
}

$DeployScript = Join-Path $PSScriptRoot "deploy.ps1"
powershell -ExecutionPolicy Bypass -File $DeployScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "[SUCCESS] Mod installed successfully!" -ForegroundColor Green
    Write-Host "You can now launch Antigravity Desktop." -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
}
exit $LASTEXITCODE
