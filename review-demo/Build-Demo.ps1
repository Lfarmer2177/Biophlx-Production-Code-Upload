$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
  node review-demo/prepare-demo.cjs
  if ($LASTEXITCODE -ne 0) { throw 'Demo preparation failed' }
  node -e "const cp=require('child_process'),fs=require('fs'); cp.execFileSync('./node_modules/@esbuild/win32-x64/esbuild.exe',JSON.parse(fs.readFileSync('review-demo/build-args.json','utf8')),{stdio:'inherit'});"
  if ($LASTEXITCODE -ne 0) { throw 'Demo build failed' }
} finally { Pop-Location }
