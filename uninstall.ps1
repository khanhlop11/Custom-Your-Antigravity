[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

Write-Host "[uninstall] Closing Antigravity..." -ForegroundColor Yellow
taskkill /F /IM Antigravity.exe /T 2>$null
Start-Sleep -Seconds 2

$retry = 0
while ((Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue) -and ($retry -lt 5)) {
    Write-Host "[uninstall] Waiting for processes to release files..." -ForegroundColor Yellow
    taskkill /F /IM Antigravity.exe /T 2>$null
    Start-Sleep -Seconds 1
    $retry++
}

$DeployScript = Join-Path $PSScriptRoot "deploy.ps1"
powershell -ExecutionPolicy Bypass -File $DeployScript --restore

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "[SUCCESS] Antigravity restored to pristine condition!" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERROR] An error occurred during restoration." -ForegroundColor Red
}
exit $LASTEXITCODE
