param(
    [string]$SecretFileSource,
    [string]$PolicyRoot = 'C:\ProgramData\UsbPolicy',
    [string]$MasterAccessGroup = 'UsbMasterAccess',
    [string]$RevokedTokenIdsFile = 'C:\ProgramData\UsbPolicy\revoked-token-ids.txt',
    [ValidateSet('User', 'Admin')]
    [string]$Mode,
    [string]$TargetUserName,
    [string[]]$DenyHosts,
    [switch]$EnableAudit,
    [switch]$DisablePasswordCredentialProvider
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Prompt-IfEmpty {
    param([string]$Value, [string]$Prompt)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return (Read-Host $Prompt)
    }
    return $Value
}

if (-not ([bool](net session 2>$null))) {
    throw 'Run this script as Administrator.'
}

$SecretFileSource = Prompt-IfEmpty -Value $SecretFileSource -Prompt 'Path to secret.key (example C:\UsbTokenAdmin\secret.key)'
if (-not (Test-Path -LiteralPath $SecretFileSource)) {
    throw "Secret source file not found: $SecretFileSource"
}

$Mode = Prompt-IfEmpty -Value $Mode -Prompt 'Who are you? Type User or Admin'
if ($Mode -ne 'User' -and $Mode -ne 'Admin') {
    throw 'Mode must be User or Admin.'
}

$TargetUserName = Prompt-IfEmpty -Value $TargetUserName -Prompt 'Target Windows user name (this installation will work only for this user)'
if ([string]::IsNullOrWhiteSpace($TargetUserName)) {
    throw 'TargetUserName is required.'
}

if ($Mode -eq 'Admin' -and (-not $DenyHosts -or $DenyHosts.Count -eq 0)) {
    $raw = Read-Host 'Optional deny hosts/IPs for SMB (comma separated). Empty = allow all'
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $DenyHosts = @($raw.Split(',') | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    }
}

New-Item -ItemType Directory -Path $PolicyRoot -Force | Out-Null

$repoScriptRoot = $PSScriptRoot
$filesToCopy = @('Test-UsbToken.ps1', 'UsbAccessAgent.ps1', 'Apply-UsbPolicyHardening.ps1')
foreach ($f in $filesToCopy) {
    $src = Join-Path $repoScriptRoot $f
    if (-not (Test-Path -LiteralPath $src)) {
        throw "Required file not found: $src"
    }
    Copy-Item -LiteralPath $src -Destination (Join-Path $PolicyRoot $f) -Force
}

Copy-Item -LiteralPath $SecretFileSource -Destination (Join-Path $PolicyRoot 'secret.key') -Force

if (-not (Test-Path -LiteralPath $RevokedTokenIdsFile)) {
    New-Item -ItemType File -Path $RevokedTokenIdsFile -Force | Out-Null
}

$config = [ordered]@{
    Mode = $Mode
    TargetUserName = $TargetUserName
    DenyHosts = @($DenyHosts)
}
$configFile = Join-Path $PolicyRoot 'agent-config.json'
$config | ConvertTo-Json | Set-Content -LiteralPath $configFile -Encoding UTF8

$hardeningScript = Join-Path $PolicyRoot 'Apply-UsbPolicyHardening.ps1'
$hardeningParams = @{}
if ($EnableAudit) { $hardeningParams.EnableAudit = $true }
if ($DisablePasswordCredentialProvider) { $hardeningParams.DisablePasswordCredentialProvider = $true }
& $hardeningScript @hardeningParams

$agentScript = Join-Path $PolicyRoot 'UsbAccessAgent.ps1'
$taskName = "UsbAccessAgent-$TargetUserName"
$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File \"$agentScript\" -PolicyRoot \"$PolicyRoot\" -MasterAccessGroup \"$MasterAccessGroup\" -RevokedTokenIdsFile \"$RevokedTokenIdsFile\" -ConfigFile \"$configFile\""
$taskTriggers = @(
    (New-ScheduledTaskTrigger -AtLogOn -User $TargetUserName),
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2) -RepetitionDuration (New-TimeSpan -Days 3650))
)
$taskPrincipal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable

try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}
catch {}

Register-ScheduledTask -TaskName $taskName -Action $taskAction -Trigger $taskTriggers -Principal $taskPrincipal -Settings $taskSettings | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host 'USB access control installed.'
Write-Host "Mode: $Mode"
Write-Host "Target user: $TargetUserName"
Write-Host "Policy root: $PolicyRoot"
Write-Host "Task name: $taskName"
Write-Host "Master access group: $MasterAccessGroup"
if ($Mode -eq 'Admin') {
    if ($DenyHosts -and $DenyHosts.Count -gt 0) {
        Write-Host "Denied hosts: $($DenyHosts -join ', ')"
    }
    else {
        Write-Host 'Denied hosts: (none) => all hosts allowed'
    }
}
Write-Host 'Done.'
