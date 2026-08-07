# Creates (or removes) a junction that exposes the Universal Anomaly Data Export
# working copy as an MO2 mod, so the exporter is runnable in-game without copying
# files (the copy-usade-to-gamma.mjs round trip). A junction (not a symlink)
# because it needs no admin rights / Developer Mode and MO2's VFS follows it
# transparently.
#
#   .\scripts\link-mo2-mod.ps1
#   .\scripts\link-mo2-mod.ps1 -Remove
#   .\scripts\link-mo2-mod.ps1 -SourceRepo "C:\path\to\repo" -ModsDir "D:\...\mods"
#
# MO2 mods hold their payload under <mod>\gamedata, and the source repo root also
# carries .git, README.md, data\ and scripts\ that have no business in the VFS. So
# the mod folder is a real directory and only *gamedata* inside it is the junction.
#
# After creating it, refresh MO2 (F5) and enable the mod. Load order is not
# sensitive - the exporter only adds new script files, it overrides nothing.
[CmdletBinding()]
param(
    # Repo containing the gamedata folder to link
    [string]$SourceRepo,

    # MO2 mods folder to link into
    [string]$ModsDir = "D:\gamma0.9.5\GAMMA\mods",

    # Mod folder name as it appears in MO2
    [string]$Name = "Universal Anomaly Data Export (dev)",

    # Remove the junction instead of creating it
    [switch]$Remove
)

$ErrorActionPreference = "Stop"

# Default to the sibling checkout: scripts\ -> repo root -> C:\Source\Other.
if (-not $SourceRepo) {
    $siblings = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    $SourceRepo = Join-Path $siblings "Universal-Stalker-Anomaly-Data-Export"
}

$source = Join-Path $SourceRepo "gamedata"
$modRoot = Join-Path $ModsDir $Name
$link = Join-Path $modRoot "gamedata"

if (-not (Test-Path -LiteralPath $ModsDir -PathType Container)) {
    throw "Mods folder not found: $ModsDir"
}

if ($Remove) {
    if (-not (Test-Path -LiteralPath $link)) {
        Write-Host "Nothing to remove: $link does not exist."
        return
    }
    $item = Get-Item -LiteralPath $link -Force
    # Only ever delete a reparse point: a real directory here is an installed copy
    # of the mod, and deleting it would destroy files.
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "$link is a real directory, not a junction - refusing to delete it."
    }
    # Deletes the junction itself; the target's contents are untouched.
    $item.Delete()
    Write-Host "Removed junction: $link"

    # Clean up the wrapper folder, but only if the junction was all it held.
    if (-not (Get-ChildItem -LiteralPath $modRoot -Force)) {
        Remove-Item -LiteralPath $modRoot -Force
        Write-Host "Removed empty mod folder: $modRoot"
    } else {
        Write-Host "Left $modRoot in place - it still contains other files (meta.ini, etc)."
    }
    return
}

if (-not (Test-Path -LiteralPath $source -PathType Container)) {
    throw "No gamedata folder in source repo: $source"
}

if (Test-Path -LiteralPath $link) {
    $item = Get-Item -LiteralPath $link -Force
    $isJunction = $item.Attributes -band [IO.FileAttributes]::ReparsePoint
    if ($isJunction -and $item.Target.TrimEnd('\') -eq $source.TrimEnd('\')) {
        Write-Host "Already linked: $link -> $source"
    } elseif ($isJunction) {
        throw "$link is a junction to $($item.Target), not to $source - pass -Remove first."
    } else {
        throw "$link is a real directory - remove the mod in MO2 first."
    }
} else {
    New-Item -ItemType Directory -Path $modRoot -Force | Out-Null
    New-Item -ItemType Junction -Path $link -Target $source | Out-Null
    Write-Host "Created junction: $link -> $source"
    Write-Host "Refresh MO2 (F5) and enable '$Name' in the left pane."
}
