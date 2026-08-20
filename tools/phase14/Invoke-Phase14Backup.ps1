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
  [ValidatePattern("^gs://[a-z0-9._-]+(?:/.*)?$")]
  [string]$ExportDestination,

  [Parameter(Mandatory = $true)]
  [string]$EvidenceOutput,

  [switch]$Execute
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$exportUri = $ExportDestination.TrimEnd("/") + "/phase14-$timestamp"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw "Google Cloud CLI (gcloud) is required for a managed Firestore export."
}

$account = (& gcloud auth list --filter=status:ACTIVE --format="value(account)").Trim()
if (-not $account) {
  throw "No active gcloud account was found. Run gcloud auth login first."
}

Write-Host "Phase 14 managed Firestore backup"
Write-Host "  Project: $ProjectId"
Write-Host "  Operator: $account"
Write-Host "  Destination: $exportUri"
Write-Host "  Evidence: $EvidenceOutput"

if (-not $Execute) {
  Write-Host "Dry run only. Re-run with -Execute after verifying the project and bucket."
  exit 0
}

& gcloud firestore export $exportUri --project=$ProjectId
if ($LASTEXITCODE -ne 0) {
  throw "Firestore export submission failed."
}

$sourceCommit = (& git rev-parse HEAD).Trim()
$evidence = [ordered]@{
  projectId = $ProjectId
  capturedAt = (Get-Date).ToUniversalTime().ToString("o")
  operator = $account
  sourceCommit = $sourceCommit
  firestoreExport = [ordered]@{
    status = "SUCCESSFUL"
    operationName = $null
    outputUriPrefix = $exportUri
  }
  authentication = [ordered]@{
    snapshotComplete = $false
    userCount = $null
    profileCount = $null
    unmatchedAuthUsers = $null
    unmatchedProfiles = $null
  }
  storage = [ordered]@{
    snapshotComplete = $false
    bucket = $null
    objectCount = $null
  }
}
$evidencePath = [System.IO.Path]::GetFullPath($EvidenceOutput)
$evidenceDirectory = Split-Path -Parent $evidencePath
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
$evidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $evidencePath

Write-Host "Firestore export completed and initial evidence was written."
Write-Host "Run reconciliation against the same evidence file before deployment."
