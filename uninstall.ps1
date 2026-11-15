[CmdletBinding()]
param(
    [string]$AsarPath = "",
    [switch]$ForceClose,
    [switch]$RemoveData
)

$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DefaultAppDir = Join-Path $env:LOCALAPPDATA "Programs\antigravity"
if ([string]::IsNullOrWhiteSpace($AsarPath)) {
    $AsarPath = Join-Path $DefaultAppDir "resources\app.asar"
}

$PatchScript = Join-Path $ProjectDir "scripts\patch-asar.js"
if (-not (Test-Path -LiteralPath $PatchScript)) {
    Write-Error "Patch script not found: $PatchScript"
    exit 1
}

$RunningProcs = @(Get-Process -Name "Antigravity" -ErrorAction SilentlyContinue)
if ($RunningProcs.Count -gt 0) {
    if ($ForceClose) {
        Write-Host "[uninstall] Closing Antigravity..." -ForegroundColor Yellow
        $RunningProcs | Stop-Process -Force
        Start-Sleep -Milliseconds 800
    }
    else {
        Write-Error "Antigravity is currently running. Please close it completely (including the system tray icon) or rerun with -ForceClose."
        exit 1
    }
}

$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($NodeCmd) {
    & $NodeCmd.Source $PatchScript "uninstall" "--asar" $AsarPath
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
        & $ElectronExe $PatchScript "uninstall" "--asar" $AsarPath | Out-Host
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
    Write-Error "Uninstall failed (exit code: $ExitCode)."
    exit $ExitCode
}

$ThemeRoot = Join-Path $env:APPDATA "Antigravity\custom-theme"
if ($RemoveData -and (Test-Path -LiteralPath $ThemeRoot)) {
    Remove-Item -LiteralPath $ThemeRoot -Recurse -Force
    Write-Host "[uninstall] Removed theme data directory: $ThemeRoot"
}
else {
    Write-Host "[uninstall] Kept wallpapers and config at $ThemeRoot (pass -RemoveData to delete them)."
}

Write-Host "[uninstall] Successfully restored the original app.asar!" -ForegroundColor Green
