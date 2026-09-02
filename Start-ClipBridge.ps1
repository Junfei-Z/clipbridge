$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20 or later is required. Download it from https://nodejs.org/."
}

Set-Location -LiteralPath $PSScriptRoot
node .\src\server.mjs
