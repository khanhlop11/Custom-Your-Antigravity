[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$RunningProcs = @(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue)
if ($RunningProcs.Count -gt 0) {
    Write-Host "[uninstall] Closing Antigravity..." -ForegroundColor Yellow
    $RunningProcs | Stop-Process -Force
    Start-Sleep -Milliseconds 800
}

$DeployScript = Join-Path $PSScriptRoot "deploy.ps1"
powershell -ExecutionPolicy Bypass -File $DeployScript --restore
exit $LASTEXITCODE
