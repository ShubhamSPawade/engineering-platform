[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$Repository = 'ShubhamSPawade/engineering-demo-api'
)

$ErrorActionPreference = 'Stop'
$null = Get-Command gh -ErrorAction Stop

function Invoke-GitHubJson {
    param([string[]]$Arguments)
    $output = & gh api @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "GitHub API request failed: $($Arguments[0]). No later steps were attempted."
    }
    return ($output -join "`n" | ConvertFrom-Json)
}

# Verify access, branches, and the actual check publisher before changing settings.
$repo = Invoke-GitHubJson -Arguments @("repos/$Repository")
if (-not $repo.permissions.admin) {
    throw "Repository administration access is required for $Repository."
}
foreach ($branch in @('dev', 'staging', 'main')) {
    $null = Invoke-GitHubJson -Arguments @("repos/$Repository/branches/$branch")
}
$checks = Invoke-GitHubJson -Arguments @("repos/$Repository/commits/main/check-runs?per_page=100")
$check = @($checks.check_runs | Where-Object {
    $_.name -eq 'demo-verify' -and $_.conclusion -eq 'success' -and $_.app.slug -eq 'github-actions'
} | Sort-Object completed_at -Descending | Select-Object -First 1)
if ($check.Count -ne 1) {
    throw 'A successful GitHub Actions demo-verify check on main is required before enabling this policy.'
}

$rulesetName = 'engineering-demo-branch-policy'
$pages = Invoke-GitHubJson -Arguments @("repos/$Repository/rulesets?includes_parents=false&per_page=100", '--paginate', '--slurp')
$existing = @($pages | ForEach-Object { $_ } | Where-Object { $_.name -eq $rulesetName })
if ($existing.Count -gt 1) {
    throw "Multiple rulesets named $rulesetName exist. Resolve that ambiguity before running this script."
}

# Preserve additional adopted merge gates when the foundation script is rerun.
$requiredChecks = @(@{ context = 'demo-verify'; integration_id = [int]$check[0].app.id })
if ($existing.Count -eq 1) {
    $current = Invoke-GitHubJson -Arguments @("repos/$Repository/rulesets/$($existing[0].id)")
    foreach ($rule in @($current.rules | Where-Object type -eq 'required_status_checks')) {
        $requiredChecks += @($rule.parameters.required_status_checks | Where-Object context -ne 'demo-verify')
    }
}

$policy = @{
    name = $rulesetName
    target = 'branch'
    enforcement = 'active'
    bypass_actors = @()
    conditions = @{
        ref_name = @{
            include = @('refs/heads/dev', 'refs/heads/staging', 'refs/heads/main')
            exclude = @()
        }
    }
    rules = @(
        @{ type = 'deletion' }
        @{ type = 'non_fast_forward' }
        @{
            type = 'pull_request'
            parameters = @{
                required_approving_review_count = 0
                dismiss_stale_reviews_on_push = $false
                require_code_owner_review = $false
                require_last_push_approval = $false
                required_review_thread_resolution = $true
            }
        }
        @{
            type = 'required_status_checks'
            parameters = @{
                strict_required_status_checks_policy = $true
                do_not_enforce_on_create = $false
                required_status_checks = $requiredChecks
            }
        }
    )
}

# Files hold only configuration, never tokens. UTF-8 without BOM works in Windows PowerShell.
$policyPath = Join-Path $PSScriptRoot 'demo-branch-policy.json'
$settingsPath = Join-Path $PSScriptRoot 'demo-repository-settings.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($policyPath, ($policy | ConvertTo-Json -Depth 12), $utf8)
[System.IO.File]::WriteAllText($settingsPath, '{"default_branch":"dev"}', $utf8)

$null = Invoke-GitHubJson -Arguments @("repos/$Repository", '--method', 'PATCH', '--input', $settingsPath)
if ($existing.Count -eq 1) {
    $result = Invoke-GitHubJson -Arguments @("repos/$Repository/rulesets/$($existing[0].id)", '--method', 'PUT', '--input', $policyPath)
} else {
    $result = Invoke-GitHubJson -Arguments @("repos/$Repository/rulesets", '--method', 'POST', '--input', $policyPath)
}

$verifiedRepo = Invoke-GitHubJson -Arguments @("repos/$Repository")
$verifiedRule = Invoke-GitHubJson -Arguments @("repos/$Repository/rulesets/$($result.id)")
if ($verifiedRepo.default_branch -ne 'dev' -or $verifiedRule.enforcement -ne 'active') {
    throw 'GitHub did not return the requested default branch and active ruleset. Inspect the repository settings.'
}
foreach ($branch in @('dev', 'staging', 'main')) {
    $active = @(Invoke-GitHubJson -Arguments @("repos/$Repository/rules/branches/$branch"))
    foreach ($type in @('deletion', 'non_fast_forward', 'pull_request', 'required_status_checks')) {
        if (-not ($active | Where-Object { $_.ruleset_id -eq $result.id -and $_.type -eq $type })) {
            throw "Expected rule $type is not active on $branch."
        }
    }
}

Write-Host "Configured and verified $Repository"
Write-Host 'Default branch: dev'
Write-Host 'Protected branches: dev, staging, main'
Write-Host 'Required: pull requests, resolved review threads, and current demo-verify checks'
Write-Host 'Blocked: force pushes and branch deletion; no bypass actors configured'
Write-Host 'Required approving reviews: 0 (solo pilot)'
Write-Host "Ruleset: https://github.com/$Repository/rules/$($result.id)"
