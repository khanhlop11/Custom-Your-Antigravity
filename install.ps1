[CmdletBinding()]
param(
    [switch]$ForceClose
)

$ErrorActionPreference = "Stop"

# Tự động tải thư viện nếu là máy mới tải repo về lần đầu
$AsarModule = Join-Path $PSScriptRoot "node_modules\@electron\asar"
if (-not (Test-Path $AsarModule)) {
    Write-Host "[install] Dang cai dat thu vien can thiet..." -ForegroundColor Cyan
    npm install --omit=dev
}

$RunningProcs = @(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue)
if ($RunningProcs.Count -gt 0) {
    Write-Host "[install] Dang dong Antigravity..." -ForegroundColor Yellow
    $RunningProcs | Stop-Process -Force
    Start-Sleep -Milliseconds 800
}

$DeployScript = Join-Path $PSScriptRoot "deploy.ps1"
powershell -ExecutionPolicy Bypass -File $DeployScript
exit $LASTEXITCODE
