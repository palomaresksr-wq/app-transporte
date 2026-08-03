$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$functionsPath = Join-Path $repositoryRoot "supabase\functions"
$image = "denoland/deno:2.1.4"
$mount = "${functionsPath}:/src"

function Invoke-Deno([string[]]$Arguments) {
  & docker run --rm --volume $mount --workdir /src $image deno @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Deno validation failed: deno $($Arguments -join ' ')" }
}

Invoke-Deno @("fmt", "--check", ".")
Invoke-Deno @("lint", ".")

$entrypoints = Get-ChildItem -LiteralPath $functionsPath -Filter "index.ts" -File -Recurse |
  ForEach-Object { "/src/" + $_.FullName.Substring($functionsPath.Length + 1).Replace("\", "/") }

if ($entrypoints.Count -eq 0) { throw "No Edge Function entrypoints were found." }
Invoke-Deno (@("check", "--no-lock") + $entrypoints)
