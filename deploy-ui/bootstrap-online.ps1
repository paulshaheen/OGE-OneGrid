<#
  bootstrap-online.ps1 - fetched and run by the one-file OneGrid-Wizard.cmd.

  The end user downloads a single small .cmd and double-clicks it. That .cmd
  pulls this script from the public repo and runs it. This script:
    1. downloads + extracts the lightweight wizard (OneGrid-Wizard.zip release asset)
       into %LOCALAPPDATA%\OneGrid-Wizard  (reused on later launches),
    2. hands off to the extracted deploy-ui\bootstrap.ps1, which installs Node +
       Azure CLI if missing, opens the browser, and starts the wizard.

  No git, no clone, no npm, no terminal. Azure sign-in is a button in the wizard.

  Overrides (optional env vars):
    ONEGRID_WIZARD_URL  - full URL to OneGrid-Wizard.zip
    ONEGRID_HOME        - install directory
    ONEGRID_FORCE       - '1' to force a fresh re-download
#>
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ZipUrl  = if ($env:ONEGRID_WIZARD_URL) { $env:ONEGRID_WIZARD_URL } else { 'https://github.com/paulshaheen/OGE-OneGrid/releases/latest/download/OneGrid-Wizard.zip' }
$Home_   = if ($env:ONEGRID_HOME) { $env:ONEGRID_HOME } else { Join-Path $env:LOCALAPPDATA 'OneGrid-Wizard' }
$Force   = ($env:ONEGRID_FORCE -eq '1')

function Info($m){ Write-Host "      ..  $m" -ForegroundColor DarkGray }
function Ok($m){ Write-Host "      OK  $m" -ForegroundColor Green }
function Step($n,$m){ Write-Host ''; Write-Host "  [$n] $m" -ForegroundColor Cyan }
function Die($m){ Write-Host ''; Write-Host "  ERROR  $m" -ForegroundColor Red; Write-Host ''; Read-Host '  Press Enter to close'; exit 1 }

Clear-Host
Write-Host ''
Write-Host '   ###########################################################' -ForegroundColor Blue
Write-Host '   #        O N E G R I D   Deployment  Wizard               #' -ForegroundColor White
Write-Host '   #        Microsoft Fabric solution accelerator            #' -ForegroundColor Gray
Write-Host '   ###########################################################' -ForegroundColor Blue
Write-Host ''
Info "install folder : $Home_"

$extractRoot = Join-Path $Home_ 'OneGrid-Wizard'      # zip root folder
$server      = Join-Path $extractRoot 'deploy-ui\server.js'
$innerBoot   = Join-Path $extractRoot 'deploy-ui\bootstrap.ps1'

if ((Test-Path $server) -and -not $Force) {
  Step 1 'Wizard already installed - reusing it'
  Ok "$extractRoot"
  Info "(set ONEGRID_FORCE=1 to re-download the latest version)"
}
else {
  Step 1 'Downloading the wizard'
  Info "from $ZipUrl"
  New-Item -ItemType Directory -Force -Path $Home_ | Out-Null
  $zip = Join-Path $Home_ 'OneGrid-Wizard.zip'
  try {
    $ProgressPreference = 'SilentlyContinue'   # faster large downloads
    Invoke-WebRequest -UseBasicParsing -Uri $ZipUrl -OutFile $zip
  } catch {
    Die "could not download the wizard ($($_.Exception.Message)). Check your connection, or download OneGrid-Wizard.zip manually and extract to $Home_."
  }
  $mb = [math]::Round((Get-Item $zip).Length/1MB,1)
  Ok "downloaded $mb MB"

  Step 2 'Extracting'
  if (Test-Path $extractRoot) { Remove-Item $extractRoot -Recurse -Force -ErrorAction SilentlyContinue }
  Expand-Archive -Path $zip -DestinationPath $Home_ -Force
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  if (-not (Test-Path $server)) {
    # some archives may extract without the top OneGrid-Wizard folder; find server.js
    $found = Get-ChildItem $Home_ -Recurse -Filter server.js -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -match '\\deploy-ui\\server\.js$' } | Select-Object -First 1
    if ($found) { $extractRoot = Split-Path (Split-Path $found.FullName -Parent) -Parent; $server = $found.FullName; $innerBoot = Join-Path $extractRoot 'deploy-ui\bootstrap.ps1' }
  }
  if (-not (Test-Path $server)) { Die "extraction did not produce deploy-ui\server.js under $Home_." }
  Ok "extracted to $extractRoot"
}

Step 3 'Starting the wizard'
if (-not (Test-Path $innerBoot)) { Die "launcher not found: $innerBoot" }

# If a wizard is already running on the port, just open it (don't start a second one).
$port = if ($env:DEPLOY_UI_PORT) { $env:DEPLOY_UI_PORT } else { 7333 }
try {
  $c = New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',[int]$port); $c.Close()
  Write-Host ''
  Write-Host "   The wizard is already running on port $port - opening it in your browser." -ForegroundColor Yellow
  Write-Host "   (To restart fresh, close the other wizard window first.)" -ForegroundColor DarkGray
  Start-Process "http://localhost:$port"
  return
} catch {}

# Hand off to the packaged launcher (installs Node + Azure CLI if needed, opens browser, runs server).
& $innerBoot
