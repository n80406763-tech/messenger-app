param(
    [string]$PolicyRoot = 'C:\ProgramData\UsbPolicy',
    [string]$MasterAccessGroup = 'UsbMasterAccess',
    [string]$RevokedTokenIdsFile = 'C:\ProgramData\UsbPolicy\revoked-token-ids.txt',
    [string]$ConfigFile = 'C:\ProgramData\UsbPolicy\agent-config.json'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$testScript = Join-Path $PolicyRoot 'Test-UsbToken.ps1'
$secretFile = Join-Path $PolicyRoot 'secret.key'

if (-not (Test-Path -LiteralPath $testScript)) {
    throw "Test script not found: $testScript"
}

if (-not (Test-Path -LiteralPath $secretFile)) {
    throw "Secret file not found: $secretFile"
}

if (-not (Test-Path -LiteralPath $ConfigFile)) {
    throw "Config file not found: $ConfigFile"
}

$config = Get-Content -LiteralPath $ConfigFile -Raw | ConvertFrom-Json
$targetUser = [string]$config.TargetUserName
$mode = [string]$config.Mode
$denyHosts = @()
if ($config.DenyHosts) {
    $denyHosts = @($config.DenyHosts | ForEach-Object { [string]$_ })
}

function Ensure-LocalGroup {
    param([string]$GroupName)

    $exists = Get-LocalGroup -Name $GroupName -ErrorAction SilentlyContinue
    if (-not $exists) {
        New-LocalGroup -Name $GroupName -Description 'Temporary group for master USB access' | Out-Null
    }
}

function Get-CurrentInteractiveUser {
    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    if ($identity -like '*\\*') {
        return ($identity.Split('\\')[-1])
    }
    return $identity
}

function Evaluate-UsbToken {
    param([string]$DriveRoot)

    $resultJson = & powershell.exe -ExecutionPolicy Bypass -File $testScript -SecretFile $secretFile -UsbRoot $DriveRoot -RevokedTokenIdsFile $RevokedTokenIdsFile 2>$null
    if ($LASTEXITCODE -eq 0 -and $resultJson) {
        return ($resultJson | ConvertFrom-Json)
    }
    return $null
}

function Ensure-FirewallBlockRule {
    param([string]$Host)

    $ruleName445 = "UsbPolicy-BlockSMB-445-$Host"
    $ruleName139 = "UsbPolicy-BlockSMB-139-$Host"

    if (-not (Get-NetFirewallRule -DisplayName $ruleName445 -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName445 -Direction Outbound -Action Block -Protocol TCP -RemotePort 445 -RemoteAddress $Host | Out-Null
    }

    if (-not (Get-NetFirewallRule -DisplayName $ruleName139 -ErrorAction SilentlyContinue)) {
        New-NetFirewallRule -DisplayName $ruleName139 -Direction Outbound -Action Block -Protocol TCP -RemotePort 139 -RemoteAddress $Host | Out-Null
    }
}

function Remove-AllUsbPolicyFirewallRules {
    Get-NetFirewallRule -DisplayName 'UsbPolicy-BlockSMB-*' -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
}

$currentUser = Get-CurrentInteractiveUser
if (-not [string]::IsNullOrWhiteSpace($targetUser) -and ($currentUser -ne $targetUser)) {
    return
}

Ensure-LocalGroup -GroupName $MasterAccessGroup
$masterGranted = $false

$drives = Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 2" | Select-Object -ExpandProperty DeviceID
foreach ($d in $drives) {
    $root = "$d\"
    $tokenResult = Evaluate-UsbToken -DriveRoot $root
    if ($null -ne $tokenResult -and $tokenResult.IsAllowedForCurrentComputer -and $tokenResult.Role -eq 'Master') {
        $masterGranted = $true
        break
    }
}

$member = Get-LocalGroupMember -Group $MasterAccessGroup -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "\\$currentUser$" }

if ($masterGranted -and -not $member) {
    Add-LocalGroupMember -Group $MasterAccessGroup -Member $currentUser -ErrorAction SilentlyContinue
}

if ((-not $masterGranted) -and $member) {
    Remove-LocalGroupMember -Group $MasterAccessGroup -Member $currentUser -ErrorAction SilentlyContinue
}

if ($mode -eq 'Admin') {
    Remove-AllUsbPolicyFirewallRules
    foreach ($host in $denyHosts) {
        if (-not [string]::IsNullOrWhiteSpace($host)) {
            Ensure-FirewallBlockRule -Host $host
        }
    }
}
else {
    Remove-AllUsbPolicyFirewallRules
}
