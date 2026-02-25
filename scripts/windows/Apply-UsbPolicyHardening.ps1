param(
    [switch]$DisablePasswordCredentialProvider,
    [switch]$EnableAudit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Set-DwordValue {
    param(
        [Parameter(Mandatory = $true)] [string]$Path,
        [Parameter(Mandatory = $true)] [string]$Name,
        [Parameter(Mandatory = $true)] [int]$Value
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -Path $Path -Force | Out-Null
    }

    New-ItemProperty -Path $Path -Name $Name -PropertyType DWord -Value $Value -Force | Out-Null
}

# 1) Reduce local bypass vectors (example hardening baseline)
Set-DwordValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'dontdisplaylastusername' -Value 1
Set-DwordValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'DisableCAD' -Value 0
Set-DwordValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Name 'LocalAccountTokenFilterPolicy' -Value 0

# 2) Optional: disable password credential provider (only when custom CP is deployed and tested)
if ($DisablePasswordCredentialProvider) {
    $passwordProvider = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Authentication\Credential Providers\{60B78E88-EAD8-445C-9CFD-0B87F74EA6CD}'
    Set-DwordValue -Path $passwordProvider -Name 'Disabled' -Value 1
}

# 3) Optional: enable advanced audit policy for logon
if ($EnableAudit) {
    & auditpol /set /subcategory:'Logon' /success:enable /failure:enable | Out-Null
    & auditpol /set /subcategory:'Credential Validation' /success:enable /failure:enable | Out-Null
}

Write-Host 'Hardening policy applied.'
if ($DisablePasswordCredentialProvider) {
    Write-Host 'Password Credential Provider has been disabled.'
}
if ($EnableAudit) {
    Write-Host 'Advanced audit policy has been enabled.'
}
