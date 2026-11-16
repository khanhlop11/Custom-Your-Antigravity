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

# Set up initial custom-theme directory with default wallpaper and settings
$ThemeRoot = Join-Path $env:APPDATA "Antigravity\custom-theme"
$WallpapersDir = Join-Path $ThemeRoot "wallpapers"
New-Item -ItemType Directory -Path $WallpapersDir -Force | Out-Null

$RepoWallpapers = Join-Path $PSScriptRoot "theme\wallpapers"
if (Test-Path $RepoWallpapers) {
    Copy-Item (Join-Path $RepoWallpapers "*") -Destination $WallpapersDir -Force
}

$SrcCss = Join-Path $PSScriptRoot "theme\theme.css"
$SrcJs = Join-Path $PSScriptRoot "theme\custom-theme.js"
if (Test-Path $SrcCss) { Copy-Item $SrcCss (Join-Path $ThemeRoot "theme.css") -Force }
if (Test-Path $SrcJs) { Copy-Item $SrcJs (Join-Path $ThemeRoot "custom-theme.js") -Force }

$ConfigPath = Join-Path $ThemeRoot "config.json"
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    $DefaultConfig = @"
{
  "version": 1,
  "enabled": true,
  "wallpaper": "default-wallpaper.jpg",
  "bgDim": 66,
  "bgBlur": 0,
  "sidebarOpacity": 54,
  "sidebarBlur": 8,
  "composerOpacity": 53,
  "composerBlur": 8,
  "panelOpacity": 13,
  "panelBlur": 0,
  "bubblePreset": "scroll",
  "inputPreset": "neon-border"
}
"@
    Set-Content -LiteralPath $ConfigPath -Value $DefaultConfig -Encoding utf8
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
