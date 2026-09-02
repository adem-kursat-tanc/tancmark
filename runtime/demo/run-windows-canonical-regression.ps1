param(
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$PnpmCliPath,
  [Parameter(Mandatory = $true)][string]$FfmpegPath,
  [Parameter(Mandatory = $true)][string]$FfprobePath,
  [Parameter(Mandatory = $true)][string]$PythonPath,
  [Parameter(Mandatory = $true)][string]$PythonPackagePath,
  [Parameter(Mandatory = $true)][string]$OutputPath
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$evidenceRoot = Join-Path (Split-Path -Parent $OutputPath) 'windows-regression-logs'
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

foreach ($required in @($NodePath, $PnpmCliPath, $FfmpegPath, $FfprobePath, $PythonPath)) {
  if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
    throw "REQUIRED_FILE_MISSING:$required"
  }
}

$env:NODE_ENV = 'test'
$env:TANCMARK_LIVE_TEST_FFMPEG = (Resolve-Path -LiteralPath $FfmpegPath).Path
$env:TANCMARK_LIVE_TEST_FFPROBE = (Resolve-Path -LiteralPath $FfprobePath).Path
$env:TANCMARK_LIVE_WATERMARK_PYTHON = (Resolve-Path -LiteralPath $PythonPath).Path
$env:TANCMARK_LIVE_WATERMARK_WORKER_SCRIPT = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot 'runtime\live\live_streaming_adapter_worker.py')).Path
$env:TANCMARK_LIVE_ADAPTER_C_SCRIPT = (Resolve-Path -LiteralPath (Join-Path $repositoryRoot 'runtime\product-runtime\unified_pts_watermark_adapter_c.py')).Path
$env:PYTHONPATH = (Resolve-Path -LiteralPath $PythonPackagePath).Path
Remove-Item Env:TANCMARK_MEDIA_RUNTIME_PROFILE -ErrorAction SilentlyContinue
Remove-Item Env:TANCMARK_DEMO_ONLY -ErrorAction SilentlyContinue
$env:Path = "$(Split-Path -Parent $NodePath);$(Split-Path -Parent $PythonPath);$(Split-Path -Parent $FfmpegPath);$env:Path"

function Invoke-Gate([string]$Name, [string]$Script) {
  $safeName = $Name -replace '[^A-Za-z0-9_.-]', '_'
  $log = Join-Path $evidenceRoot "$safeName.log"
  $started = Get-Date
  Push-Location $repositoryRoot
  try {
    & $NodePath $PnpmCliPath run $Script *> $log
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  $ended = Get-Date
  $result = [ordered]@{
    name = $Name
    script = $Script
    exitCode = $exitCode
    durationMs = [math]::Round(($ended - $started).TotalMilliseconds, 3)
    logPath = "windows-regression-logs/$safeName.log"
    logSha256 = (Get-FileHash -LiteralPath $log -Algorithm SHA256).Hash.ToLowerInvariant()
    logBytes = (Get-Item -LiteralPath $log).Length
    status = if ($exitCode -eq 0) { 'PASSED' } else { 'FAILED' }
  }
  Write-Host "$Name=$($result.status) durationMs=$($result.durationMs)"
  return [pscustomobject]$result
}

$beforeStatus = (& git -C $repositoryRoot status --porcelain=v1) -join "`n"
$beforeHead = (& git -C $repositoryRoot rev-parse HEAD).Trim()
$beforeFfmpegSha = (Get-FileHash -LiteralPath $FfmpegPath -Algorithm SHA256).Hash.ToLowerInvariant()
$beforeFfprobeSha = (Get-FileHash -LiteralPath $FfprobePath -Algorithm SHA256).Hash.ToLowerInvariant()

$gates = @(
  @{ Name = 'typecheck'; Script = 'typecheck' },
  @{ Name = 'normal-build'; Script = 'build' },
  @{ Name = 'product-build'; Script = 'build:product' },
  @{ Name = 'public-tests'; Script = 'test:public' },
  @{ Name = 'built-route-contract'; Script = 'test:built' },
  @{ Name = 'normal-built-smoke'; Script = 'test:normal-built' },
  @{ Name = 'product-built-smoke'; Script = 'test:product-built' },
  @{ Name = 'canonical-reader-scope'; Script = 'test:canonical-reader-scope' },
  @{ Name = 'media-runtime-resolver'; Script = 'test:media-runtime-resolver' },
  @{ Name = 'physical-text-image'; Script = 'test:physical-text-image' },
  @{ Name = 'physical-audio'; Script = 'test:physical-audio' },
  @{ Name = 'clean-live'; Script = 'test:clean-live' },
  @{ Name = 'c2pa'; Script = 'test:c2pa' }
)

$results = foreach ($gate in $gates) {
  Invoke-Gate -Name $gate.Name -Script $gate.Script
}

$afterStatus = (& git -C $repositoryRoot status --porcelain=v1) -join "`n"
$afterHead = (& git -C $repositoryRoot rev-parse HEAD).Trim()
$failed = @($results | Where-Object { $_.exitCode -ne 0 })
$evidence = [ordered]@{
  schemaVersion = 'tancmark-windows-canonical-regression-v1'
  profile = 'WINDOWS_CANONICAL_PRODUCT_PROFILE'
  measuredAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  repositoryHeadBefore = $beforeHead
  repositoryHeadAfter = $afterHead
  repositoryHeadChanged = ($beforeHead -ne $afterHead)
  trackedAndUntrackedStatusChangedByTests = ($beforeStatus -ne $afterStatus)
  runtime = [ordered]@{
    nodeVersion = (& $NodePath --version).Trim()
    pnpmVersion = (& $NodePath $PnpmCliPath --version).Trim()
    ffmpegSha256 = $beforeFfmpegSha
    ffprobeSha256 = $beforeFfprobeSha
    mediaRuntimeProfileEnvironment = 'unset (canonical Windows default)'
  }
  invariants = [ordered]@{
    linuxDemoProfileSelectedDuringWindowsRegression = $false
    canonicalFfmpegHashPreserved = ($beforeFfmpegSha -eq '6b22601b72c358b3b41bdb8480964b178b5a2bfd1849fb24991f460d2f85a946')
    canonicalFfprobeHashPreserved = ($beforeFfprobeSha -eq 'e540d5392a3981ddfa4cfcccba0becf07fb612a53bf0771e4bc61f4840182a68')
  }
  gates = @($results)
  failedGates = @($failed | ForEach-Object { $_.name })
  status = if ($failed.Count -eq 0 -and $beforeHead -eq $afterHead -and $beforeStatus -eq $afterStatus) { 'PASSED' } else { 'FAILED' }
}

$evidence | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding utf8NoBOM
Write-Output "RESULT=$OutputPath"
Write-Output "STATUS=$($evidence.status)"
if ($evidence.status -ne 'PASSED') { exit 1 }
