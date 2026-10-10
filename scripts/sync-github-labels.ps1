param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$Repository
)
$ErrorActionPreference = 'Stop'
$labelsPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'configs/github-labels.json'
$labels = Get-Content -LiteralPath $labelsPath -Raw | ConvertFrom-Json
# Only synchronize named platform labels. Never delete unrelated repository labels.
foreach ($label in $labels) {
    & gh label create $label.name --repo $Repository --color $label.color --description $label.description --force
    if ($LASTEXITCODE -ne 0) { throw "Label synchronization failed for $($label.name)." }
}
$actualJson = & gh label list --repo $Repository --limit 1000 --json name,color,description
if ($LASTEXITCODE -ne 0) { throw 'Cannot verify repository labels.' }
$actual = $actualJson | ConvertFrom-Json
foreach ($label in $labels) {
    $match = @($actual | Where-Object { $_.name -ceq $label.name })
    if ($match.Count -ne 1 -or $match[0].color -ine $label.color -or $match[0].description -cne $label.description) {
        throw "Label verification failed for $($label.name)."
    }
}
Write-Output "Verified $($labels.Count) shared labels in $Repository."
