param(
    [string]$OutputDir = "$env:USERPROFILE\Desktop\UsbAccessKit"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$required = @(
    'Create-UsbFlash.ps1',
    'Install-UsbAccessControl.ps1',
    'New-UsbToken.ps1',
    'Test-UsbToken.ps1',
    'UsbAccessAgent.ps1',
    'Apply-UsbPolicyHardening.ps1'
)

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

foreach ($file in $required) {
    $src = Join-Path $PSScriptRoot $file
    if (-not (Test-Path -LiteralPath $src)) {
        throw "Missing required script: $src"
    }

    Copy-Item -LiteralPath $src -Destination (Join-Path $OutputDir $file) -Force
}

$readme = @"
USB Access Kit created.

Main scripts:
1) Create-UsbFlash.ps1 - create User/Master USB token.
2) Install-UsbAccessControl.ps1 - install enforcement on PC (prompts User/Admin and target user).

You can now run these from Desktop folder:
$OutputDir
"@

$readme | Set-Content -LiteralPath (Join-Path $OutputDir 'START-HERE.txt') -Encoding UTF8
Write-Host "Desktop kit generated at: $OutputDir"
