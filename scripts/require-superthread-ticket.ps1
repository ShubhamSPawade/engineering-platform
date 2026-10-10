[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$Repository = 'ShubhamSPawade/engineering-demo-api',
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$VerifiedHead
)
$ErrorActionPreference = 'Stop'
function Get-GitHubJson {
    param([string[]]$Arguments)
    $response = & gh api @Arguments
    if ($LASTEXITCODE -ne 0) { throw "GitHub request failed: $($Arguments[0])" }
    return ($response -join "`n" | ConvertFrom-Json)
}
$statuses = Get-GitHubJson -Arguments @("repos/$Repository/commits/$VerifiedHead/statuses?per_page=100")
$ticket = @($statuses | Where-Object context -eq 'superthread-ticket' | Select-Object -First 1)
if ($ticket.Count -ne 1 -or $ticket[0].state -ne 'success' -or $ticket[0].creator.login -ne 'github-actions[bot]') {
    throw 'A successful live ticket status from GitHub Actions on the verified head is required.'
}
$checks = Get-GitHubJson -Arguments @("repos/$Repository/commits/dev/check-runs?per_page=100")
$publisher = @($checks.check_runs | Where-Object { $_.name -eq 'demo-verify' -and $_.conclusion -eq 'success' -and $_.app.slug -eq 'github-actions' } | Select-Object -First 1)
if ($publisher.Count -ne 1) { throw 'Cannot identify the successful GitHub Actions check publisher.' }
$rulePages = Get-GitHubJson -Arguments @("repos/$Repository/rulesets?includes_parents=false&per_page=100", '--paginate', '--slurp')
$registeredRules = @($rulePages | ForEach-Object { $_ } | Where-Object name -eq 'engineering-demo-branch-policy')
if ($registeredRules.Count -ne 1) { throw 'Expected one registered demo ruleset.' }
$ruleset = Get-GitHubJson -Arguments @("repos/$Repository/rulesets/$($registeredRules[0].id)")
if ($ruleset.name -ne 'engineering-demo-branch-policy' -or $ruleset.enforcement -ne 'active') { throw 'Expected active pilot ruleset was not found.' }
$required = @($ruleset.rules | Where-Object type -eq 'required_status_checks')
if ($required.Count -ne 1) { throw 'Expected one required-status rule.' }
$existingTicket = @($required[0].parameters.required_status_checks | Where-Object context -eq 'superthread-ticket')
if ($existingTicket.Count -eq 0) {
    $required[0].parameters.required_status_checks = @($required[0].parameters.required_status_checks) + @(@{ context = 'superthread-ticket'; integration_id = [int]$publisher[0].app.id })
} elseif ($existingTicket.Count -ne 1 -or $existingTicket[0].integration_id -ne $publisher[0].app.id) {
    throw 'Existing ticket policy has an unexpected publisher.'
}
$payload = [ordered]@{
    name = $ruleset.name; target = $ruleset.target; enforcement = $ruleset.enforcement
    bypass_actors = @($ruleset.bypass_actors); conditions = $ruleset.conditions; rules = @($ruleset.rules)
}
$policyPath = Join-Path ([System.IO.Path]::GetTempPath()) 'engineering-superthread-ruleset.json'
[System.IO.File]::WriteAllText($policyPath, ($payload | ConvertTo-Json -Depth 30), (New-Object System.Text.UTF8Encoding($false)))
$null = Get-GitHubJson -Arguments @("repos/$Repository/rulesets/$($ruleset.id)", '--method', 'PUT', '--input', $policyPath)
foreach ($branch in @('dev', 'staging', 'main')) {
    $active = Get-GitHubJson -Arguments @("repos/$Repository/rules/branches/$branch")
    $rule = @($active | Where-Object { $_.ruleset_id -eq $ruleset.id -and $_.type -eq 'required_status_checks' })
    if (-not ($rule.parameters.required_status_checks | Where-Object { $_.context -eq 'superthread-ticket' -and $_.integration_id -eq $publisher[0].app.id })) {
        throw "Ticket status was not verified as required on $branch."
    }
}
Write-Host 'Verified: superthread-ticket is required on dev, staging and main; existing rules preserved.'
