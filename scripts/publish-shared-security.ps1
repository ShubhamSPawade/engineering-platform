[CmdletBinding()]
param(
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$PlatformRepository = 'ShubhamSPawade/engineering-platform',
    [ValidatePattern('^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$')]
    [string]$DemoRepository = 'ShubhamSPawade/engineering-demo-api'
)

& (Join-Path $PSScriptRoot 'publish-shared-node-ci.ps1') -Stage Security -PlatformRepository $PlatformRepository -DemoRepository $DemoRepository
