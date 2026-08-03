param([int]$DatabasePort = 55422)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$runId = [Guid]::NewGuid().ToString("N")
$ephemeralRoot = Join-Path ([System.IO.Path]::GetTempPath()) "albatrans-sql-$runId"
$ephemeralSupabase = Join-Path $ephemeralRoot "supabase"
$projectId = "albatrans-sql-$($runId.Substring(0, 12))"
$started = $false

try {
  New-Item -ItemType Directory -Path $ephemeralSupabase -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repositoryRoot "supabase\migrations") -Destination $ephemeralSupabase -Recurse
  Copy-Item -LiteralPath (Join-Path $repositoryRoot "supabase\tests") -Destination $ephemeralSupabase -Recurse
  Copy-Item -LiteralPath (Join-Path $repositoryRoot "supabase\config.toml") -Destination $ephemeralSupabase

  $configPath = Join-Path $ephemeralSupabase "config.toml"
  $config = Get-Content -LiteralPath $configPath -Raw
  $config = $config -replace 'project_id = "[^"]+"', "project_id = `"$projectId`""
  $config = $config -replace '(?ms)(\[db\].*?port\s*=\s*)\d+', "`${1}$DatabasePort"
  $config = $config -replace '(?ms)(\[api\].*?port\s*=\s*)\d+', "`${1}$($DatabasePort - 1)"
  $config = $config -replace '(?ms)(\[studio\].*?port\s*=\s*)\d+', "`${1}$($DatabasePort + 1)"
  [System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))

  Write-Host "Starting isolated Supabase database project $projectId on port $DatabasePort..."
  npx supabase start --workdir $ephemeralRoot --exclude gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
  if ($LASTEXITCODE -ne 0) { throw "The isolated Supabase database did not start." }
  $started = $true

  npx supabase test db --workdir $ephemeralRoot
  if ($LASTEXITCODE -ne 0) { throw "The isolated pgTAP suite failed." }
}
finally {
  if ($started) { npx supabase stop --workdir $ephemeralRoot --no-backup }
  if (Test-Path -LiteralPath $ephemeralRoot) { Remove-Item -LiteralPath $ephemeralRoot -Recurse -Force }
}
