[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$PlatformRepository = 'ShubhamSPawade/engineering-platform',
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$DemoRepository = 'ShubhamSPawade/engineering-demo-api'
)

$ErrorActionPreference = 'Stop'
$platformRoot = Split-Path -Parent $PSScriptRoot
$demoRoot = Join-Path $platformRoot 'demo-api'
$branchName = 'chore/adopt-shared-node-ci'
$null = Get-Command git -ErrorAction Stop
$null = Get-Command gh -ErrorAction Stop

function Invoke-Checked {
    param([string]$Program, [string[]]$Arguments)
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program failed. Resolve the reported error before retrying." }
}
function Get-GitText {
    param([string]$Root, [string[]]$Arguments)
    $output = & git -C $Root @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Git inspection failed in $Root." }
    return ($output -join "`n").Trim()
}
function Assert-Origin {
    param([string]$Root, [string]$Repository)
    $remote = Get-GitText -Root $Root -Arguments @('remote', 'get-url', 'origin')
    if ($remote -notin @("https://github.com/$Repository.git", "https://github.com/$Repository", "git@github.com:$Repository.git")) {
        throw "Unexpected origin in $Root. Expected $Repository, found $remote."
    }
}

# No repository mutation until identity, remote targets, and working trees are checked.
Invoke-Checked -Program gh -Arguments @('api', "repos/$PlatformRepository", '--jq', '.full_name')
Invoke-Checked -Program gh -Arguments @('api', "repos/$DemoRepository", '--jq', '.full_name')
Assert-Origin -Root $platformRoot -Repository $PlatformRepository
Assert-Origin -Root $demoRoot -Repository $DemoRepository
if ((Get-GitText -Root $platformRoot -Arguments @('branch', '--show-current')) -ne 'main') {
    throw 'Switch the platform repository to main before running this script.'
}
if (Get-GitText -Root $platformRoot -Arguments @('diff', '--cached', '--name-only')) {
    throw 'The platform has staged changes. Commit or unstage them before running this script.'
}
$demoChanges = Get-GitText -Root $demoRoot -Arguments @('status', '--porcelain')
if ($demoChanges -and $demoChanges -ne 'M .github/workflows/ci.yml') {
    throw 'The demo has unrelated changes. Commit or set them aside before running this script.'
}

# Publish only the reviewed platform files, excluding the raw source and nested demo.
$platformFiles = @(
    '.github/workflows/reusable-node-ci.yml', '.gitignore', 'README.md',
    'Implementation Plan - Engineering Automation Platform.md',
    'templates/demo-node-ci.yml', 'docs/shared-node-ci.md',
    'scripts/configure-demo-repository.ps1', 'scripts/publish-shared-node-ci.ps1'
)
Invoke-Checked -Program git -Arguments (@('-C', $platformRoot, 'add', '--') + $platformFiles)
& git -C $platformRoot diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    Invoke-Checked -Program git -Arguments @('-C', $platformRoot, 'commit', '-m', 'feat: add reusable Node CI and demo adoption automation')
} elseif ($LASTEXITCODE -ne 0) { throw 'Could not inspect the platform index.' }
Invoke-Checked -Program git -Arguments @('-C', $platformRoot, 'push', 'origin', 'main')
$platformSha = Get-GitText -Root $platformRoot -Arguments @('rev-parse', 'HEAD')
if ($platformSha -notmatch '^[0-9a-f]{40}$') { throw 'Expected an immutable platform commit SHA.' }

# Verify GitHub has the workflow at the exact revision before installing the caller.
Invoke-Checked -Program gh -Arguments @('api', "repos/$PlatformRepository/contents/.github/workflows/reusable-node-ci.yml?ref=$platformSha", '--jq', '.path')

& git -C $demoRoot show-ref --verify --quiet "refs/heads/$branchName"
if ($LASTEXITCODE -eq 0) {
    Invoke-Checked -Program git -Arguments @('-C', $demoRoot, 'switch', $branchName)
} elseif ($LASTEXITCODE -eq 1) {
    if ($demoChanges) { throw 'Uncommitted caller changes exist without the adoption branch; inspect them before continuing.' }
    Invoke-Checked -Program git -Arguments @('-C', $demoRoot, 'fetch', 'origin', 'dev')
    Invoke-Checked -Program git -Arguments @('-C', $demoRoot, 'switch', '-c', $branchName, 'origin/dev')
} else { throw 'Could not inspect the adoption branch.' }

$template = [System.IO.File]::ReadAllText((Join-Path $platformRoot 'templates/demo-node-ci.yml'))
$caller = $template.Replace('__PLATFORM_REPOSITORY__', $PlatformRepository).Replace('__PLATFORM_SHA__', $platformSha)
$callerPath = Join-Path $demoRoot '.github/workflows/ci.yml'
[System.IO.File]::WriteAllText($callerPath, $caller, (New-Object System.Text.UTF8Encoding($false)))
Invoke-Checked -Program git -Arguments @('-C', $demoRoot, 'add', '--', '.github/workflows/ci.yml')
& git -C $demoRoot diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
    Invoke-Checked -Program git -Arguments @('-C', $demoRoot, 'commit', '-m', 'ci: adopt pinned reusable Node workflow')
} elseif ($LASTEXITCODE -ne 0) { throw 'Could not inspect the demo index.' }
Invoke-Checked -Program git -Arguments @('-C', $demoRoot, 'push', '-u', 'origin', $branchName)

$existingPr = & gh pr list --repo $DemoRepository --base dev --head $branchName --state open --json url --jq '.[0].url'
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect existing adoption PRs.' }
if ($existingPr) {
    Write-Host "Existing adoption PR: $existingPr"
} else {
    $bodyPath = Join-Path $env:TEMP ([System.IO.Path]::GetRandomFileName())
    $body = @"
Replace duplicated demo CI with the shared Node workflow pinned to $platformSha in $PlatformRepository.

The caller retains the required demo-verify check and fails it whenever shared CI fails, is cancelled, or is skipped. Application checks, tests, packaging, smoke verification, and Docker build stay enabled; no secrets are inherited.

Validation: workflow YAML and input contracts checked locally; demo tests, packaging, and smoke checks pass. GitHub execution must pass on this PR before merging. This is pipeline maintenance with no application behavior change; Superthread validation is not yet enabled.
"@
    [System.IO.File]::WriteAllText($bodyPath, $body, (New-Object System.Text.UTF8Encoding($false)))
    try {
        Invoke-Checked -Program gh -Arguments @('pr', 'create', '--repo', $DemoRepository, '--base', 'dev', '--head', $branchName, '--title', 'ci: adopt pinned reusable Node workflow', '--body-file', $bodyPath)
    } finally {
        Remove-Item -LiteralPath $bodyPath -ErrorAction SilentlyContinue
    }
}
Write-Host "Published platform workflow at $platformSha and opened the demo adoption PR."
Write-Host 'The PR is ready for GitHub CI verification; it has not been merged.'
