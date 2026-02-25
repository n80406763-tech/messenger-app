param(
    [Parameter(Mandatory = $true)]
    [string]$SecretFile,

    [Parameter(Mandatory = $true)]
    [string]$UsbRoot,

    [Parameter(Mandatory = $true)]
    [ValidateSet('User', 'Master')]
    [string]$Role,

    [string]$AllowedComputerName,
    [string]$UserName = $env:USERNAME,

    [ValidateRange(1, 3650)]
    [int]$ExpiresInDays = 30,

    [switch]$InitSecretIfMissing
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$issuerScript = Join-Path $PSScriptRoot 'New-UsbToken.ps1'
if (-not (Test-Path -LiteralPath $issuerScript)) {
    throw "Required script not found: $issuerScript"
}

if ((-not (Test-Path -LiteralPath $SecretFile)) -and $InitSecretIfMissing) {
    $secretDir = Split-Path -Parent $SecretFile
    if (-not (Test-Path -LiteralPath $secretDir)) {
        New-Item -ItemType Directory -Path $secretDir -Force | Out-Null
    }

    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    [Convert]::ToBase64String($bytes) | Set-Content -LiteralPath $SecretFile -Encoding ASCII
    Write-Host "Secret file generated: $SecretFile"
}

$params = @{
    SecretFile = $SecretFile
    UsbRoot = $UsbRoot
    Role = $Role
    UserName = $UserName
    ExpiresInDays = $ExpiresInDays
}

if ($Role -eq 'User') {
    if ([string]::IsNullOrWhiteSpace($AllowedComputerName)) {
        throw 'AllowedComputerName is required for User role.'
    }
    $params.AllowedComputerName = $AllowedComputerName
}

& $issuerScript @params
if ($LASTEXITCODE -ne 0) {
    throw "New-UsbToken.ps1 failed with exit code $LASTEXITCODE"
}

Write-Host 'USB flash token creation completed.'
