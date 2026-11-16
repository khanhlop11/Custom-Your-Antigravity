[CmdletBinding()]
param(
    [switch]$ForceClose
)

$ErrorActionPreference = "Stop"

# Tu dong tai thu vien can thiet neu la may moi
$AsarModule = Join-Path $PSScriptRoot "node_modules\@electron\asar"
if (-not (Test-Path $AsarModule)) {
    Write-Host "[install] Dang cai dat thu vien can thiet..." -ForegroundColor Cyan
    npm install
}

Write-Host "[install] Dang dong Antigravity de cap nhat file..." -ForegroundColor Yellow
taskkill /F /IM Antigravity.exe /T 2>$null
Start-Sleep -Seconds 2

$retry = 0
while ((Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue) -and ($retry -lt 5)) {
    Write-Host "[install] Cho tien trinh giai phong file..." -ForegroundColor Yellow
    taskkill /F /IM Antigravity.exe /T 2>$null
    Start-Sleep -Seconds 1
    $retry++
}

$DeployScript = Join-Path $PSScriptRoot "deploy.ps1"
powershell -ExecutionPolicy Bypass -File $DeployScript

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "====================================================" -ForegroundColor Green
    Write-Host "[SUCCESS] Da cai dat mod thanh cong!" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green
}
exit $LASTEXITCODE
