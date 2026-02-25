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
    [int]$ExpiresInDays = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $SecretFile)) {
    throw "Secret file not found: $SecretFile"
}

if (-not (Test-Path -LiteralPath $UsbRoot)) {
    throw "USB root not found: $UsbRoot"
}

$secretBase64 = (Get-Content -LiteralPath $SecretFile -Raw).Trim()
$secretBytes = [Convert]::FromBase64String($secretBase64)

if ($Role -eq 'User' -and [string]::IsNullOrWhiteSpace($AllowedComputerName)) {
    throw 'AllowedComputerName is required for User token.'
}

$issuedAt = [DateTime]::UtcNow
$expiresAt = $issuedAt.AddDays($ExpiresInDays)

$token = [ordered]@{
    TokenId = [guid]::NewGuid().Guid
    Role = $Role
    UserName = $UserName
    AllowedComputerName = if ($Role -eq 'Master') { '*' } else { $AllowedComputerName.ToUpperInvariant() }
    IssuedAtUtc = $issuedAt.ToString('o')
    ExpiresAtUtc = $expiresAt.ToString('o')
    Version = 2
}

$payloadJson = $token | ConvertTo-Json -Compress
$hmac = [System.Security.Cryptography.HMACSHA256]::new($secretBytes)
try {
    $hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payloadJson))
}
finally {
    $hmac.Dispose()
}

$token.Signature = [Convert]::ToBase64String($hash)

$outPath = Join-Path $UsbRoot 'usb-token.json'
$token | ConvertTo-Json | Set-Content -LiteralPath $outPath -Encoding UTF8

Write-Host "Token created: $outPath"
Write-Host "Role: $Role"
Write-Host "AllowedComputerName: $($token.AllowedComputerName)"
Write-Host "ExpiresAtUtc: $($token.ExpiresAtUtc)"
