[CmdletBinding()]
param(
    [string]$AsarPath = "",
    [switch]$ForceClose
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DefaultAppDir = Join-Path $env:LOCALAPPDATA "Programs\antigravity"
if ([string]::IsNullOrWhiteSpace($AsarPath)) {
    $AsarPath = Join-Path $DefaultAppDir "resources\app.asar"
}

$PatchScript = Join-Path $ProjectDir "scripts\patch-asar.js"
$SrcMain = Join-Path $ProjectDir "src\customThemeMain.js"
$SrcPreload = Join-Path $ProjectDir "src\customThemePreload.js"
$SrcCss = Join-Path $ProjectDir "theme\theme.css"
$SrcJs = Join-Path $ProjectDir "theme\custom-theme.js"

foreach ($required in @($AsarPath, $PatchScript, $SrcMain, $SrcPreload, $SrcCss, $SrcJs)) {
    if (-not (Test-Path -LiteralPath $required)) {
        Write-Error "Required file not found: $required"
        exit 1
    }
}

$RunningProcs = @(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue)
if ($RunningProcs.Count -gt 0) {
    if ($ForceClose) {
        Write-Host "[install] Closing Antigravity..." -ForegroundColor Yellow
        $RunningProcs | Stop-Process -Force
        Start-Sleep -Milliseconds 800
    }
    else {
        Write-Error "Antigravity is currently running. Please close it completely (including the system tray icon) or rerun with -ForceClose."
        exit 1
    }
}

$ThemeRoot = Join-Path $env:APPDATA "Antigravity\custom-theme"
$WallpapersDir = Join-Path $ThemeRoot "wallpapers"
New-Item -ItemType Directory -Path $ThemeRoot -Force | Out-Null
New-Item -ItemType Directory -Path $WallpapersDir -Force | Out-Null

Copy-Item -LiteralPath $SrcCss -Destination (Join-Path $ThemeRoot "theme.css") -Force
Copy-Item -LiteralPath $SrcJs -Destination (Join-Path $ThemeRoot "custom-theme.js") -Force

$ConfigPath = Join-Path $ThemeRoot "config.json"
if (-not (Test-Path -LiteralPath $ConfigPath)) {
    $DefaultConfig = @"
{
  "version": 1,
  "enabled": true,
  "wallpaper": "",
  "bgDim": 35,
  "bgBlur": 0,
  "sidebarOpacity": 55,
  "sidebarBlur": 14,
  "composerOpacity": 55,
  "composerBlur": 16,
  "panelOpacity": 72,
  "panelBlur": 14,
  "bubblePreset": "default",
  "inputPreset": "glass"
}
"@
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ConfigPath, $DefaultConfig + "`n", $Utf8NoBom)
    Write-Host "[install] Created default config: $ConfigPath"
}
else {
    Write-Host "[install] Keeping existing config: $ConfigPath"
}

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
    & $NodeCmd.Source $PatchScript "install" "--asar" $AsarPath "--project" $ProjectDir
    $ExitCode = $LASTEXITCODE
}
else {
    $ElectronExe = Join-Path $DefaultAppDir "Antigravity.exe"
    if (-not (Test-Path -LiteralPath $ElectronExe)) {
        Write-Error "Neither Node.js nor Antigravity.exe was found to execute patch-asar.js."
        exit 1
    }
    $PrevRunAsNode = $env:ELECTRON_RUN_AS_NODE
    $PrevNoAsar = $env:ELECTRON_NO_ASAR
    try {
        $env:ELECTRON_RUN_AS_NODE = "1"
        $env:ELECTRON_NO_ASAR = "1"
        & $ElectronExe $PatchScript "install" "--asar" $AsarPath "--project" $ProjectDir | Out-Host
        $ExitCode = $LASTEXITCODE
    }
    finally {
        if ($null -eq $PrevRunAsNode) {
            Remove-Item Env:\ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
        }
        else {
            $env:ELECTRON_RUN_AS_NODE = $PrevRunAsNode
        }
        if ($null -eq $PrevNoAsar) {
            Remove-Item Env:\ELECTRON_NO_ASAR -ErrorAction SilentlyContinue
        }
        else {
            $env:ELECTRON_NO_ASAR = $PrevNoAsar
        }
    }
}

if ($ExitCode -ne 0) {
    Write-Error "Installation failed (exit code: $ExitCode)."
    exit $ExitCode
}

Write-Host ""
Write-Host "[install] Antigravity Custom Theme installed successfully!" -ForegroundColor Green
Write-Host "  - ASAR: $AsarPath"
Write-Host "  - Theme directory: $ThemeRoot"
Write-Host "  - Reopen Antigravity and go to Settings -> Custom Theme to customize."
