[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(
    "mdx-fuel-atlas-crm-dev",
    "mdx-fuel-atlas-crm-staging",
    "mdx-fuel-atlas-crm-prod"
  )]
  [string]$ProjectId,

  [Parameter(Mandatory = $true)]
  [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
  [string]$BackupEvidence,

  [switch]$Execute
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$manifestPath = Join-Path $PSScriptRoot "firebase-deployment-manifest.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$evidence = Get-Content -Raw -LiteralPath $BackupEvidence | ConvertFrom-Json

if ($evidence.projectId -ne $ProjectId) {
  throw "Backup evidence project does not match the deployment project."
}

if ($evidence.firestoreExport.status -ne "SUCCESSFUL") {
  throw "Backup evidence does not record a SUCCESSFUL Firestore export."
}

if (-not $evidence.firestoreExport.outputUriPrefix) {
  throw "Backup evidence does not contain the Firestore export URI."
}

if ($evidence.authentication.snapshotComplete -ne $true) {
  throw "Authentication reconciliation is incomplete."
}

if ($evidence.storage.snapshotComplete -ne $true) {
  throw "Storage reconciliation is incomplete."
}

$onlyTargets = ($manifest.functions | ForEach-Object { "functions:$_" }) -join ","
$expectedTargets = "functions:qualifyNewLead,functions:scanStaleOpportunities,functions:recheckStaleOpportunity,functions:generateWeeklySalesReport"
if ($onlyTargets -ne $expectedTargets) {
  throw "Deployment manifest differs from Patrick's approved four-function allowlist."
}

Write-Host "Phase 14 scoped Functions deployment"
Write-Host "  Project: $ProjectId"
Write-Host "  Backup: $($evidence.firestoreExport.outputUriPrefix)"
Write-Host "  Targets: $onlyTargets"

if (-not $Execute) {
  Write-Host "Dry run only. Re-run with -Execute after final desktop verification."
  exit 0
}

Push-Location $repositoryRoot
try {
  & npx --no-install firebase deploy --project $ProjectId --only $onlyTargets
  if ($LASTEXITCODE -ne 0) {
    throw "Scoped Firebase Functions deployment failed."
  }
} finally {
  Pop-Location
}
