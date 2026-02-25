param(
    [Parameter(Mandatory = $true)]
    [string]$SecretFile,

    [Parameter(Mandatory = $true)]
    [string]$UsbRoot,

    [string]$RevokedTokenIdsFile
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-TokenRevoked {
    param(
        [string]$TokenId,
        [string]$RevokedListPath
    )

    if ([string]::IsNullOrWhiteSpace($RevokedListPath)) {
        return $false
    }

    if (-not (Test-Path -LiteralPath $RevokedListPath)) {
        return $false
    }

    $revoked = Get-Content -LiteralPath $RevokedListPath |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    return ($revoked -contains $TokenId)
}

$result = [ordered]@{
    IsValid = $false
    IsAllowedForCurrentComputer = $false
    IsExpired = $false
    IsRevoked = $false
    Role = $null
    UserName = $null
    Message = $null
}

try {
    if (-not (Test-Path -LiteralPath $SecretFile)) {
        throw "Secret file not found: $SecretFile"
    }

    $tokenPath = Join-Path $UsbRoot 'usb-token.json'
    if (-not (Test-Path -LiteralPath $tokenPath)) {
        throw "Token file not found: $tokenPath"
    }

    $secretBase64 = (Get-Content -LiteralPath $SecretFile -Raw).Trim()
    $secretBytes = [Convert]::FromBase64String($secretBase64)

    $tokenObj = Get-Content -LiteralPath $tokenPath -Raw | ConvertFrom-Json

    $signature = [string]$tokenObj.Signature
    if ([string]::IsNullOrWhiteSpace($signature)) {
        throw 'Token signature is missing.'
    }

    $payload = [ordered]@{
        TokenId = $tokenObj.TokenId
        Role = $tokenObj.Role
        UserName = $tokenObj.UserName
        AllowedComputerName = $tokenObj.AllowedComputerName
        IssuedAtUtc = $tokenObj.IssuedAtUtc
        ExpiresAtUtc = $tokenObj.ExpiresAtUtc
        Version = $tokenObj.Version
    }

    $payloadJson = $payload | ConvertTo-Json -Compress

    $hmac = [System.Security.Cryptography.HMACSHA256]::new($secretBytes)
    try {
        $expectedHash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($payloadJson))
    }
    finally {
        $hmac.Dispose()
    }

    $expectedSignature = [Convert]::ToBase64String($expectedHash)
    $valid = [System.Security.Cryptography.CryptographicOperations]::FixedTimeEquals(
        [Text.Encoding]::UTF8.GetBytes($signature),
        [Text.Encoding]::UTF8.GetBytes($expectedSignature)
    )

    $currentComputer = $env:COMPUTERNAME.ToUpperInvariant()
    $allowedComputer = [string]$tokenObj.AllowedComputerName
    $isAllowedComputer = ($allowedComputer -eq '*') -or ($allowedComputer.ToUpperInvariant() -eq $currentComputer)

    $isExpired = $false
    if (-not [string]::IsNullOrWhiteSpace([string]$tokenObj.ExpiresAtUtc)) {
        $expiresAt = [DateTime]::Parse([string]$tokenObj.ExpiresAtUtc).ToUniversalTime()
        $isExpired = ([DateTime]::UtcNow -gt $expiresAt)
    }

    $isRevoked = Test-TokenRevoked -TokenId ([string]$tokenObj.TokenId) -RevokedListPath $RevokedTokenIdsFile

    $result.IsValid = $valid
    $result.IsExpired = $isExpired
    $result.IsRevoked = $isRevoked
    $result.IsAllowedForCurrentComputer = ($valid -and $isAllowedComputer -and -not $isExpired -and -not $isRevoked)
    $result.Role = [string]$tokenObj.Role
    $result.UserName = [string]$tokenObj.UserName

    $result.Message = if (-not $valid) {
        'Invalid signature.'
    }
    elseif ($isRevoked) {
        'Token is revoked.'
    }
    elseif ($isExpired) {
        'Token is expired.'
    }
    elseif (-not $isAllowedComputer) {
        "Token is not allowed for this computer ($currentComputer)."
    }
    else {
        'Token is valid.'
    }
}
catch {
    $result.Message = $_.Exception.Message
}

$result | ConvertTo-Json
if (-not $result.IsAllowedForCurrentComputer) {
    exit 1
}
