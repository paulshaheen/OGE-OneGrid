<#
================================================================================
 OneGrid on Microsoft Fabric - Single-Click Solution Deploy
================================================================================
 Provisions, from scratch in the current tenant:
   * A Fabric workspace (on a capacity you supply) + Lakehouse + Eventhouse/KQL DB
     + Eventstream + all notebooks + pipeline
   * Loads the bundled historical data (Lakehouse Delta tables + Eventhouse PiEvents)
   * An Import semantic model (SQL endpoint) + report, refreshed via a fixed-identity SP
   * An Azure AI Foundry account + model deployments (model selector backend)
   * The chat agent on Azure Container Apps (managed identity, no GitHub token)
   * All required identity grants

 Prerequisites: az CLI logged in (az login), an EXISTING Fabric capacity, and the
 containerapp az extension (auto-installed). Fill config.json (see config.sample.json).

 Usage:   ./deploy.ps1 -ConfigPath ./config.json
          ./deploy.ps1 -ConfigPath ./config.json -Only foundry,chatagent   # subset
================================================================================
#>
[CmdletBinding()]
param(
  [string]$ConfigPath = "./config.json",
  [string[]]$Only,                       # optional: run only these phases
  [switch]$SkipData,                     # skip the (slow) data load
  [switch]$Interactive,                  # discover + prompt for tenant/subscription/capacity/region/hosting, then deploy
  [switch]$Teardown,                     # remove the Fabric workspace + Azure resource groups created by this deploy
  [switch]$DataPlane,                     # opt-in bolt-on: wire the PI->Fabric forwarder (bolt-ons/data-plane) after deploy
  [string]$TeardownWorkspaceId,          # optional: tear down THIS specific workspace id (else resolved by config name)
  [string[]]$TeardownResourceGroups      # optional: resource groups to delete during teardown (else foundry+chatAgent from config)
)
$ErrorActionPreference = "Continue"   # az CLI writes warnings to stderr; 'Stop' would treat them as fatal.
                                       # Fabric REST helpers throw explicitly and are wrapped in try/catch.
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Here

# ---- Force UTF-8 so the Python-based az CLI can print success glyphs (e.g. '✓',
# U+2713) without crashing with UnicodeEncodeError on a cp1252 console. Without this,
# 'az containerapp up' dies while printing its success checkmark and the deploy wrongly
# reports the app as "not up", then burns ~15 min retrying each fallback region.
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { $OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
try { chcp 65001 | Out-Null } catch {}

# ---- Source identifiers (replaced with new target IDs during deploy) ----------
$SRC = @{
  WorkspaceId  = "163ba38c-3869-406f-adb7-37cbc981390c"
  LakehouseId  = "7e08480c-cf8d-4206-901d-38b74dbe35d9"
  KqlDbId      = "da213762-0780-4c20-aef2-04371f1a4d89"
  SqlEndpoint  = "i22siiabnewedg7vb3coyirmp4-rsrtwftjhbxublnxg7f4tajzbq"
  KustoHost    = "trd-8a08ckb2duw406mvvg.z2.kusto"
  OgeDatasetId = "53085889-e53f-416b-9810-996fd66baea9"   # source dataset id (find/replace token only)
}

# ============================ helpers =========================================
function Log($m,$c="Cyan"){ Write-Host "[$(Get-Date -f HH:mm:ss)] $m" -ForegroundColor $c }
# Run an az command that may legitimately fail (e.g. existence checks) without
# tripping $ErrorActionPreference='Stop' on native stderr. Returns stdout (trimmed) or ''.
function AzTry([scriptblock]$sb) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & $sb 2>$null; if ($LASTEXITCODE -ne 0) { return '' } return ($out | Out-String).Trim() }
  finally { $ErrorActionPreference = $old }
}
function Tok($res){ az account get-access-token --resource $res --query accessToken -o tsv }
function FTok { Tok "https://api.fabric.microsoft.com" }
function PbiTok { Tok "https://analysis.windows.net/powerbi/api" }
function KustoTok($u){ Tok $u }

# ============================ install telemetry ==============================
# Fire-and-forget install event to a central Application Insights so the OGE team
# can see adoption. DEFAULT ON with opt-out: uncheck the box in the wizard, set
# config.telemetry.enabled=false, or set env ONEGRID_TELEMETRY=0. The endpoint is
# overridable via env ONEGRID_TELEMETRY_CONNSTR or config.telemetry.connectionString.
# The ingestion key is a write-only telemetry key; its presence in a public repo is
# expected and by design.
$WizardVersion    = "1.0.0"
$TelemetryConnStr = "InstrumentationKey=7c64a144-82d7-4e02-9a4d-c16a2b108f2c;IngestionEndpoint=https://eastus2-3.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus2.livediagnostics.monitor.azure.com/;ApplicationId=1b85964c-e4ab-487a-a0cb-9d3b3e87c7ad"
$script:TelemetryOn = $false
$script:TelemetryConnStrEff = $null
$script:TelemetryCtx = @{}
function Send-Telemetry($eventName, $props, $measurements) {
  try {
    if (-not $script:TelemetryOn -or -not $script:TelemetryConnStrEff) { return }
    $cs   = $script:TelemetryConnStrEff
    $ikey = ([regex]::Match($cs, 'InstrumentationKey=([^;]+)')).Groups[1].Value
    $endp = ([regex]::Match($cs, 'IngestionEndpoint=([^;]+)')).Groups[1].Value
    if (-not $ikey) { return }
    if (-not $endp) { $endp = 'https://dc.services.visualstudio.com/' }
    $p = @{}
    if ($script:TelemetryCtx) { $script:TelemetryCtx.GetEnumerator() | ForEach-Object { if ($null -ne $_.Value -and "$($_.Value)".Length) { $p[$_.Key] = "$($_.Value)" } } }
    if ($props) { $props.GetEnumerator() | ForEach-Object { $p[$_.Key] = "$($_.Value)" } }
    $m = if ($measurements) { $measurements } else { @{} }
    $envelope = @{
      name = "Microsoft.ApplicationInsights.Event"
      time = (Get-Date).ToUniversalTime().ToString("o")
      iKey = $ikey
      tags = @{ "ai.cloud.role" = "onegrid-wizard"; "ai.application.ver" = $WizardVersion }
      data = @{ baseType = "EventData"; baseData = @{ ver = 2; name = $eventName; properties = $p; measurements = $m } }
    }
    $body = $envelope | ConvertTo-Json -Depth 8 -Compress
    Invoke-RestMethod -Uri ($endp.TrimEnd('/') + '/v2/track') -Method Post -Body $body -ContentType 'application/json' -TimeoutSec 8 | Out-Null
  } catch {}
}

function FGet($path){ Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/$path" -Headers @{ Authorization="Bearer $(FTok)" } }
function FDelete($path){ Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/$path" -Method Delete -Headers @{ Authorization="Bearer $(FTok)" } }
function FPost($path,$body){
  $h = @{ Authorization="Bearer $(FTok)"; "Content-Type"="application/json" }
  $b = if ($body -is [string]) { $body } else { $body | ConvertTo-Json -Depth 30 }
  Invoke-WebRequest -Uri "https://api.fabric.microsoft.com/v1/$path" -Method Post -Headers $h -Body ([Text.Encoding]::UTF8.GetBytes($b)) -UseBasicParsing
}
# Poll a Fabric long-running-operation response; return the result body (if any).
function FWait($resp){
  if ($resp.StatusCode -eq 201) { return ($resp.Content | ConvertFrom-Json) }
  if ($resp.StatusCode -ne 202) { return ($resp.Content | ConvertFrom-Json) }
  $loc = ([string[]]$resp.Headers['Location'])[0]
  for ($i=0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 6
    $st = Invoke-RestMethod -Uri $loc -Headers @{ Authorization="Bearer $(FTok)" }
    if ($st.status -eq 'Succeeded') {
      try { return Invoke-RestMethod -Uri "$loc/result" -Headers @{ Authorization="Bearer $(FTok)" } } catch { return $st }
    }
    if ($st.status -eq 'Failed') { throw "Fabric operation failed: $($st.error | ConvertTo-Json -Depth 6)" }
  }
  throw "Fabric operation timed out"
}

# Build a definition body from a local exported item folder, rebinding source IDs.
function BuildDefinition($folder, $map) {
  $parts = @()
  Get-ChildItem $folder -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($folder.Length).TrimStart('\','/').Replace('\','/')
    $bytes = [IO.File]::ReadAllBytes($_.FullName)
    # Rebind IDs on text parts only.
    $isText = $_.Extension -match '\.(json|tmdl|py|ipynb|pbir|platform|kql|txt|xml)$' -or $_.Name -eq '.platform'
    if ($isText) {
      $txt = [Text.Encoding]::UTF8.GetString($bytes)
      foreach ($k in $map.Keys) { $txt = $txt.Replace($k, $map[$k]) }
      $bytes = [Text.Encoding]::UTF8.GetBytes($txt)
    }
    $parts += @{ path=$rel; payload=[Convert]::ToBase64String($bytes); payloadType="InlineBase64" }
  }
  return @{ parts = $parts }
}

# Notebook definition needs format="ipynb" when the content part is .ipynb;
# .py content uses the default (fabricGitSource) format.
function BuildNotebookDefinition($folder, $map) {
  $def = BuildDefinition $folder $map
  $hasIpynb = Get-ChildItem $folder -Recurse -File -Filter *.ipynb -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($hasIpynb) { $def.format = "ipynb" }
  return $def
}

# Idempotent item upsert by displayName: create if absent, else update the definition.
# $seg = API segment (notebooks|dataPipelines|semanticModels|reports). Returns the item.
function UpsertItem($ws, $seg, $name, $def) {
  $existing = (FGet "workspaces/$ws/$seg").value | Where-Object { $_.displayName -eq $name } | Select-Object -First 1
  if ($existing) {
    try { FWait (FPost "workspaces/$ws/$seg/$($existing.id)/updateDefinition" @{ definition=$def }) | Out-Null } catch {}
    return $existing
  }
  return (FWait (FPost "workspaces/$ws/$seg" @{ displayName=$name; definition=$def }))
}

# Organize workspace items into folders per fabric/_folders.json (idempotent).
function Apply-Folders($ws) {
  $mfPath = Join-Path $Here "fabric\_folders.json"
  if (-not (Test-Path $mfPath)) { return }
  $mf = Get-Content $mfPath -Raw | ConvertFrom-Json
  # Create folders (get-or-create), build name->id.
  $existing = (FGet "workspaces/$ws/folders").value
  $fid = @{}; $existing | ForEach-Object { $fid[$_.displayName] = $_.id }
  foreach ($fn in $mf.folders) {
    if (-not $fid.ContainsKey($fn)) {
      try { $f = FWait (FPost "workspaces/$ws/folders" @{ displayName=$fn }); $fid[$fn] = $f.id } catch {}
    }
  }
  # Move items to their mapped folder.
  $items = (FGet "workspaces/$ws/items").value
  $moved = 0
  foreach ($it in $items) {
    $key = "$($it.type)|$($it.displayName)"
    $target = $mf.items.$key
    if ($target -and $fid.ContainsKey($target) -and $it.folderId -ne $fid[$target]) {
      try { FPost "workspaces/$ws/items/$($it.id)/move" @{ targetFolderId=$fid[$target] } | Out-Null; $moved++ } catch {}
    }
  }
  Log "  organized $moved item(s) into $($fid.Count) folder(s)"
}

# ============================ load config =====================================
if (Test-Path $ConfigPath) {
  $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json
}
elseif ($Teardown) {
  # Teardown driven by the wizard's picker supplies the workspace + resource groups
  # explicitly, so a saved config.json isn't required. Use a minimal placeholder.
  $cfg = [pscustomobject]@{ subscriptionId=''; fabric=[pscustomobject]@{}; foundry=[pscustomobject]@{}; chatAgent=[pscustomobject]@{} }
}
else { throw "Config not found: $ConfigPath (copy config.sample.json)" }
az account show 1>$null 2>$null; if ($LASTEXITCODE -ne 0) { throw "Run 'az login' first." }
if (-not $cfg.subscriptionId) { $cfg.subscriptionId = az account show --query id -o tsv }
az account set --subscription $cfg.subscriptionId 1>$null

# ---- resolve install telemetry (default on; opt out via wizard checkbox, config, or env) ----
$script:TelemetryConnStrEff = if ($env:ONEGRID_TELEMETRY_CONNSTR) { $env:ONEGRID_TELEMETRY_CONNSTR } elseif ($cfg.telemetry -and $cfg.telemetry.connectionString) { $cfg.telemetry.connectionString } else { $TelemetryConnStr }
$script:TelemetryOn = $true
if ($Teardown) { $script:TelemetryOn = $false }
if ($env:ONEGRID_TELEMETRY -eq '0') { $script:TelemetryOn = $false }
if ($cfg.telemetry -and $cfg.telemetry.enabled -eq $false) { $script:TelemetryOn = $false }
if (-not $script:TelemetryConnStrEff) { $script:TelemetryOn = $false }
$telAcct = try { az account show -o json 2>$null | ConvertFrom-Json } catch { $null }
$script:TelemetryCtx = @{
  tenantId       = $telAcct.tenantId
  user           = $telAcct.user.name
  subscriptionId = $cfg.subscriptionId
  region         = $cfg.location
  workspaceName  = $cfg.fabric.workspaceName
  wizardVersion  = $WizardVersion
  os             = [System.Environment]::OSVersion.Platform.ToString()
}
$script:deployStart = Get-Date
if ($script:TelemetryOn) { Log "  telemetry ON: reporting an install event to Microsoft OGE (opt out in the wizard, or ONEGRID_TELEMETRY=0)" "DarkGray" }
else { Log "  telemetry OFF (opted out)" "DarkGray" }
Send-Telemetry "OneGridDeployStart" @{ outcome = "started"; only = ($Only -join ',') } @{}

$state = @{}   # collects created IDs across phases
$script:phaseErrors = @()   # non-fatal phase issues, summarized at the end

function Should($p){ return (-not $Only) -or ($Only -contains $p) }

# ============================ PHASE: workspace ================================
function Phase-Workspace {
  Log "PHASE workspace: creating '$($cfg.fabric.workspaceName)'"
  $existing = (FGet "workspaces").value | Where-Object { $_.displayName -eq $cfg.fabric.workspaceName }
  if ($existing) { $ws = $existing[0]; Log "  reusing existing workspace $($ws.id)" "Yellow" }
  else {
    $resp = FPost "workspaces" @{ displayName=$cfg.fabric.workspaceName }
    $ws = FWait $resp
  }
  # assign capacity
  $cap = $cfg.fabric.capacityId
  if ($cap) {
    try { FPost "workspaces/$($ws.id)/assignToCapacity" @{ capacityId = $cap } | Out-Null; Log "  assigned capacity" }
    catch { Log "  capacity assign: $($_.Exception.Message)" "Yellow" }
  }
  $state.WorkspaceId = $ws.id
  Log "  workspace = $($ws.id)" "Green"
}

# ============================ PHASE: core items ===============================
function New-Item-Simple($type, $seg, $name) {
  $body = @{ displayName=$name; type=$type }
  $resp = FPost "workspaces/$($state.WorkspaceId)/items" $body
  return (FWait $resp)
}

function Phase-Core {
  $ws = $state.WorkspaceId
  Log "PHASE core: lakehouse, eventhouse, kql db, eventstream"

  # Lakehouse (schema-enabled - the semantic model references gold./ml./dbo. schemas;
  # the OGE add-on adds an 'oge' schema loaded from data/lakehouse/oge/*)
  $lh = (FGet "workspaces/$ws/lakehouses").value | Where-Object { $_.displayName -eq $cfg.fabric.lakehouseName } | Select-Object -First 1
  if (-not $lh) { $lh = FWait (FPost "workspaces/$ws/lakehouses" @{ displayName=$cfg.fabric.lakehouseName; creationPayload=@{ enableSchemas=$true } }) }
  $state.LakehouseId = $lh.id
  # SQL endpoint (may take a moment to provision)
  for ($i=0;$i -lt 20;$i++){
    $lhFull = FGet "workspaces/$ws/lakehouses/$($lh.id)"
    if ($lhFull.properties.sqlEndpointProperties.connectionString) {
      $state.SqlEndpoint = $lhFull.properties.sqlEndpointProperties.connectionString; break
    }
    Start-Sleep -Seconds 10
  }
  Log "  lakehouse=$($lh.id)  sqlEndpoint=$($state.SqlEndpoint)" "Green"

  # Eventhouse (+ default KQL DB)
  $eh = (FGet "workspaces/$ws/eventhouses").value | Where-Object { $_.displayName -eq $cfg.fabric.eventhouseName } | Select-Object -First 1
  if (-not $eh) { $eh = FWait (FPost "workspaces/$ws/eventhouses" @{ displayName=$cfg.fabric.eventhouseName }) }
  $state.EventhouseId = $eh.id
  $kdb = (FGet "workspaces/$ws/kqlDatabases").value | Where-Object { $_.displayName -eq $cfg.fabric.kqlDatabaseName } | Select-Object -First 1
  if (-not $kdb) {
    $kdb = FWait (FPost "workspaces/$ws/kqlDatabases" @{ displayName=$cfg.fabric.kqlDatabaseName; creationPayload=@{ databaseType="ReadWrite"; parentEventhouseItemId=$eh.id } })
  }
  $state.KqlDbId = $kdb.id
  $ehFull = FGet "workspaces/$ws/eventhouses/$($eh.id)"
  $state.KustoUri = $ehFull.properties.queryServiceUri
  Log "  eventhouse=$($eh.id) kqlDb=$($kdb.id) kusto=$($state.KustoUri)" "Green"

  # Apply Eventhouse schema (tables, mappings, functions). Probe readiness, skip if already applied.
  $schemaFile = Join-Path $Here "fabric\eventhouse\schema.kql"
  if (Test-Path $schemaFile) {
    $mgmt = "$($state.KustoUri)/v1/rest/mgmt"
    $already = $false
    for ($i=0; $i -lt 10; $i++) {
      try {
        $probe = Invoke-RestMethod -Uri $mgmt -Method Post -Headers @{ Authorization="Bearer $(KustoTok $state.KustoUri)"; "Content-Type"="application/json" } -Body (@{ db=$cfg.fabric.kqlDatabaseName; csl=".show tables | project TableName" } | ConvertTo-Json)
        $tbls = $probe.Tables[0].Rows | ForEach-Object { $_[0] }
        if ($tbls -contains 'PiEvents') { $already = $true }
        break   # DB is responsive
      } catch { Start-Sleep -Seconds 12 }
    }
    if ($already) { Log "  eventhouse schema already present - skipping"; $state.EventhouseSchemaApplied = $true }
    else {
      $csl = Get-Content $schemaFile -Raw
      # Defensive: PS 5.1 ConvertTo-Json emits raw (unescaped) non-ASCII, which Kusto's
      # strict JSON reader rejects (breaks the request body). Fold any stray non-ASCII to
      # ASCII so a smart-quote/em-dash in the schema can never corrupt the request again.
      $csl = [regex]::Replace($csl, '[^\x00-\x7F]', '-')
      $body = @{ db=$cfg.fabric.kqlDatabaseName; csl=".execute database script with (ContinueOnErrors=true) <| $csl" } | ConvertTo-Json
      # A fresh KQL DB accepts .show tables before it can run .execute database script,
      # so retry the script itself patiently (up to ~5 min) until it succeeds.
      $applied = $false; $lastErr = $null
      for ($i=1; $i -le 8; $i++) {
        try { Invoke-RestMethod -Uri $mgmt -Method Post -Headers @{ Authorization="Bearer $(KustoTok $state.KustoUri)"; "Content-Type"="application/json" } -Body $body | Out-Null; Log "  applied eventhouse schema"; $applied=$true; break }
        catch { $lastErr = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; Log "  eventhouse schema not ready (attempt $i/8): $lastErr" "DarkYellow"; if ($i -lt 8) { Start-Sleep -Seconds 20 } }
      }
      $state.EventhouseSchemaApplied = $applied
      if (-not $applied) { Log "  eventhouse schema FAILED after 8 attempts - last error: $lastErr" "Red" }
    }
  }

  # Seed synthetic demo outages into PCIOutages (idempotent) so the report's Fleet
  # Availability tile has realistic derates/outages to drill into. Runs as a standalone
  # .ingest inline command (NOT via the database-script apply, which can't host inline CSV).
  $seedFile = Join-Path $Here "fabric\eventhouse\seed-demo.kql"
  if ((Test-Path $seedFile) -and $state.KustoUri) {
    try {
      $qBody = @{ db=$cfg.fabric.kqlDatabaseName; csl="PCIOutages | where modified_by == 'demo-seed' | count" } | ConvertTo-Json
      $cntResp = Invoke-RestMethod -Uri "$($state.KustoUri)/v1/rest/query" -Method Post -Headers @{ Authorization="Bearer $(KustoTok $state.KustoUri)"; "Content-Type"="application/json" } -Body $qBody
      $seedCnt = [int]$cntResp.Tables[0].Rows[0][0]
      if ($seedCnt -eq 0) {
        $seedCsl = Get-Content $seedFile -Raw
        Invoke-RestMethod -Uri "$($state.KustoUri)/v1/rest/mgmt" -Method Post -Headers @{ Authorization="Bearer $(KustoTok $state.KustoUri)"; "Content-Type"="application/json" } -Body (@{ db=$cfg.fabric.kqlDatabaseName; csl=$seedCsl } | ConvertTo-Json) | Out-Null
        Log "  seeded synthetic outages (PCIOutages)" "Green"
      } else { Log "  synthetic outages already present ($seedCnt) - skipping" }
    } catch {
      if ($_.Exception.Message -match '\b400\b') {
        Log "  NOTE (expected, harmless): demo outages not pre-seeded - the new KQL table is still warming up. They populate automatically when you click 'Launch Demo'. Continuing deployment." "DarkGray"
      } else {
        Log "  demo outages not pre-seeded ($($_.Exception.Message)) - non-fatal; they populate on 'Launch Demo'. Continuing." "DarkGray"
      }
    }
  }
}

# ============================ PHASE: notebooks/pipeline =======================
function Phase-Artifacts {
  $ws = $state.WorkspaceId
  Log "PHASE artifacts: notebooks + pipeline (rebinding IDs)"
  $map = @{
    $SRC.WorkspaceId = $ws
    $SRC.LakehouseId = $state.LakehouseId
    $SRC.KqlDbId     = $state.KqlDbId
    $SRC.SqlEndpoint = ($state.SqlEndpoint -split '\.')[0]
    $SRC.KustoHost   = (([Uri]$state.KustoUri).Host -replace '\.fabric\.microsoft\.com$','')
  }
  # Notebooks (idempotent; _export_data and _load_data are deploy helpers, not app notebooks)
  Get-ChildItem (Join-Path $Here "fabric\notebooks") -Directory | ForEach-Object {
    $name = $_.Name
    if ($name -in @('_export_data','_load_data')) { return }
    $def = BuildNotebookDefinition $_.FullName $map
    try { UpsertItem $ws "notebooks" $name $def | Out-Null; Log "  notebook: $name" }
    catch { Log "  notebook $name FAILED: $($_.Exception.Message)" "Yellow" }
  }
  # Pipeline(s)
  Get-ChildItem (Join-Path $Here "fabric\pipelines") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $def = BuildDefinition $_.FullName $map
    try { UpsertItem $ws "dataPipelines" $_.Name $def | Out-Null; Log "  pipeline: $($_.Name)" }
    catch { Log "  pipeline $($_.Name) FAILED: $($_.Exception.Message)" "Yellow" }
  }
  # KQL dashboards (the real-time report). Rebind eventhouse/KQL-DB ids via $map.
  Get-ChildItem (Join-Path $Here "fabric\kqldashboards") -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $def = BuildDefinition $_.FullName $map
    try { UpsertItem $ws "kqlDashboards" $_.Name $def | Out-Null; Log "  kql dashboard: $($_.Name)" }
    catch { Log "  kql dashboard $($_.Name) FAILED: $($_.Exception.Message)" "Yellow" }
  }
}

# ============================ PHASE: data =====================================
function OneLakePut($ws, $lh, $localFile, $relPath) {
  $tok = Tok "https://storage.azure.com/"
  $url = "https://onelake.dfs.fabric.microsoft.com/$ws/$lh/Files/$relPath"
  $hdr = @{ Authorization="Bearer $tok"; "x-ms-version"="2021-06-08" }
  # Skip if already uploaded with matching size (idempotent re-runs).
  try {
    $head = Invoke-WebRequest -Uri $url -Method Head -Headers $hdr -UseBasicParsing -ErrorAction Stop
    if ([int64]$head.Headers['Content-Length'] -eq (Get-Item $localFile).Length) { return }
  } catch {}
  Invoke-RestMethod -Uri "$url`?resource=file" -Method Put -Headers $hdr | Out-Null
  $bytes = [IO.File]::ReadAllBytes($localFile)
  Invoke-RestMethod -Uri "$url`?action=append&position=0" -Method Patch -Headers (@{ Authorization="Bearer $tok"; "x-ms-version"="2021-06-08"; "Content-Type"="application/octet-stream" }) -Body $bytes | Out-Null
  Invoke-RestMethod -Uri "$url`?action=flush&position=$($bytes.Length)" -Method Patch -Headers $hdr | Out-Null
}

function OneLakeGet($ws, $lh, $relPath) {
  $tok = Tok "https://storage.azure.com/"
  $url = "https://onelake.dfs.fabric.microsoft.com/$ws/$lh/Files/$relPath"
  return Invoke-RestMethod -Uri $url -Method Get -Headers @{ Authorization="Bearer $tok"; "x-ms-version"="2021-06-08" }
}

# Run a Fabric notebook job and poll to completion with a live, verbose heartbeat.
function Run-FabricNotebook($ws, $nbId, $label, $maxIters = 90) {
  try {
    $runResp = FPost "workspaces/$ws/items/$nbId/jobs/instances?jobType=RunNotebook" @{}
    $jobUrl = ([string[]]$runResp.Headers['Location'])[0]
    if (-not $jobUrl) { Log "  ${label}: could not start job" "Yellow"; return $false }
    $sw = [System.Diagnostics.Stopwatch]::StartNew(); $lastStatus = ''
    for ($i=0; $i -lt $maxIters; $i++) {
      Start-Sleep -Seconds 10
      $js = Invoke-RestMethod -Uri $jobUrl -Headers @{ Authorization="Bearer $(FTok)" }
      $el = [int]$sw.Elapsed.TotalSeconds
      if ($js.status -in @('Completed','Failed','Cancelled','Deduped')) {
        $clr = if ($js.status -eq 'Completed') { 'Green' } else { 'Yellow' }
        Log "  ${label}: $($js.status) (after ${el}s)" $clr
        return ($js.status -eq 'Completed')
      }
      if ($js.status -ne $lastStatus) { Log "    ${label}: state -> $($js.status)" "Cyan"; $lastStatus = $js.status }
      $spin = @('|','/','-','\')[$i % 4]
      Log ("    $spin ${label} running... status=$($js.status) | ${el}s elapsed") "DarkGray"
    }
    Log "  ${label}: timed out after $([int]$sw.Elapsed.TotalSeconds)s" "Yellow"
  } catch { Log "  ${label} run: $($_.Exception.Message)" "Yellow" }
  return $false
}
function Phase-Data {
  if ($SkipData) { Log "PHASE data: skipped (-SkipData)" "Yellow"; return }
  $ws = $state.WorkspaceId; $lh = $state.LakehouseId
  $dataRoot = Join-Path $Here "data\lakehouse"
  $hasLocalData = Test-Path $dataRoot
  $bundleUrl = if ($cfg.data -and $cfg.data.bundleUrl) { $cfg.data.bundleUrl } else { "https://github.com/paulshaheen/OGE-OneGrid/releases/latest/download/onegrid-data.zip" }

  if (-not $hasLocalData) {
    # -------- lightweight wizard: seed OneLake straight from the public repo (cloud-to-cloud) --------
    Log "PHASE data: cloud-seed - no local data bundle; seeding OneLake directly from the public repo"
    Log "  bundle: $bundleUrl"
    $smap = @{ $SRC.WorkspaceId=$ws; $SRC.LakehouseId=$lh; "__DATA_BUNDLE_URL__"=$bundleUrl }
    $sdef = BuildNotebookDefinition (Join-Path $Here "fabric\notebooks\_seed_data") $smap
    $snb  = UpsertItem $ws "notebooks" "_seed_data" $sdef
    Log "  running _seed_data notebook (downloads the bundle into OneLake - the laptop never touches it)..."
    if (-not (Run-FabricNotebook $ws $snb.id "_seed_data" 120)) { Log "  cloud-seed did not complete cleanly - Delta load may find no files" "Yellow" }
  }
  else {
    # -------- full clone: upload the local parquet bundle to OneLake --------
    Log "PHASE data: uploading bundled parquet to OneLake, then loading Delta tables"
    $lhFiles = @(Get-ChildItem $dataRoot -Recurse -File)
    $lhTotal = $lhFiles.Count
    $lhTotMB = [math]::Round((($lhFiles | Measure-Object Length -Sum).Sum)/1MB, 1)
    Log "  found $lhTotal parquet file(s) totalling $lhTotMB MB - uploading to OneLake..."
    $k = 0; $sentMB = 0.0; $sw = [System.Diagnostics.Stopwatch]::StartNew()
    foreach ($f in $lhFiles) {
      $k++
      $rel = "solution_import/lakehouse/" + $f.FullName.Substring($dataRoot.Length).TrimStart('\','/').Replace('\','/')
      $szMB = [math]::Round($f.Length/1MB, 2)
      Log ("    [{0,3}/{1}] -> {2}  ({3} MB)" -f $k, $lhTotal, $rel, $szMB)
      OneLakePut $ws $lh $f.FullName $rel
      $sentMB += $szMB
      $pct = [int](($k / $lhTotal) * 100)
      $rate = if ($sw.Elapsed.TotalSeconds -gt 0) { [math]::Round($sentMB / $sw.Elapsed.TotalSeconds, 1) } else { 0 }
      Log ("      ok  {0}% | {1}/{2} MB | {3} MB/s | {4}s elapsed" -f $pct, [math]::Round($sentMB,1), $lhTotMB, $rate, [int]$sw.Elapsed.TotalSeconds) "DarkGray"
    }
    $sw.Stop()
    Log ("  uploaded lakehouse parquet bundle - $lhTotal files, $lhTotMB MB in $([int]$sw.Elapsed.TotalSeconds)s") "Green"
  }

  # ---- load Delta tables (files are now in OneLake in both local + cloud-seed modes) ----
  $map = @{ $SRC.WorkspaceId=$ws; $SRC.LakehouseId=$lh }
  $def = BuildNotebookDefinition (Join-Path $Here "fabric\notebooks\_load_data") $map
  $nb  = UpsertItem $ws "notebooks" "_load_data" $def
  Log "  running _load_data notebook (loads Delta tables)..."
  Run-FabricNotebook $ws $nb.id "_load_data" 90 | Out-Null

  # ---- Eventhouse: ingest PiEvents parquet from OneLake into the KQL table ----
  $ehRoot = Join-Path $Here "data\eventhouse"
  if ($state.KustoUri -and $state.EventhouseSchemaApplied -eq $false) {
    Log "  skipping Eventhouse ingest - schema was not applied (fix the schema error above, then re-run: deploy.ps1 -Only data)" "Red"
  }
  elseif ($state.KustoUri) {
    $ehItems = @()
    if ($hasLocalData -and (Test-Path $ehRoot)) {
      Get-ChildItem $ehRoot -Directory | ForEach-Object {
        $tbl = $_.Name
        Get-ChildItem $_.FullName -Recurse -File -Filter *.parquet | ForEach-Object {
          $rel = "solution_import/eventhouse/$tbl/$($_.Name)"
          OneLakePut $ws $lh $_.FullName $rel
          $ehItems += @{ table=$tbl; rel=$rel }
        }
      }
    }
    else {
      # cloud-seed: PiEvents already landed in OneLake by _seed_data; read the index it wrote.
      try {
        $fx = OneLakeGet $ws $lh "solution_import/_files.json"
        foreach ($p in $fx.eventhouse.PSObject.Properties) {
          foreach ($leaf in $p.Value) { $ehItems += @{ table=$p.Name; rel="solution_import/eventhouse/$($p.Name)/$leaf" } }
        }
      } catch { Log "  eventhouse: could not read seeded file index (_files.json): $($_.Exception.Message)" "Yellow" }
    }

    if ($ehItems.Count -eq 0) { Log "  NOTE: no Eventhouse data to ingest." "Yellow" }
    else {
      foreach ($g in ($ehItems | Group-Object { $_.table })) {
        $tbl = $g.Name; $files = @($g.Group); $fail=0; $ok=0; $maxFail=5; $total=$files.Count
        Log "  eventhouse '$tbl': ingesting $total file(s) from OneLake into KQL (this can take several minutes)..."
        foreach ($it in $files) {
          if ($fail -ge $maxFail) { Log "  ABORT ingest '$tbl' - $fail failures hit. Skipping remaining $($total - $ok - $fail) file(s)." "Red"; break }
          $onelakeUrl = "https://onelake.dfs.fabric.microsoft.com/$ws/$lh/Files/$($it.rel)"
          $csl = ".ingest into table ['$tbl'] (h'$onelakeUrl;impersonate') with (format='parquet')"
          $body = @{ db=$cfg.fabric.kqlDatabaseName; csl=$csl } | ConvertTo-Json; $ingestErr = $null
          try { Invoke-RestMethod -Uri "$($state.KustoUri)/v1/rest/mgmt" -Method Post -Headers @{ Authorization="Bearer $(KustoTok $state.KustoUri)"; "Content-Type"="application/json" } -Body $body | Out-Null }
          catch { $ingestErr = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; $fail++; Log "  ingest $tbl/$(Split-Path $it.rel -Leaf) FAILED ($fail/$maxFail): $ingestErr" "Yellow" }
          if (-not $ingestErr) { $ok++ }
          $processed = $ok + $fail
          if ($processed % 10 -eq 0 -and $processed -lt $total) { Log "    eventhouse '$tbl': $processed/$total ingested..." "DarkGray" }
        }
        $clr = if ($fail -eq 0) { 'Green' } else { 'Yellow' }
        Log "  eventhouse '$tbl': $ok ingested, $fail failed (of $total file(s))" $clr
      }
    }
  }
  else {
    Log "  NOTE: Eventhouse not available (no KustoUri)." "Yellow"
  }
  # ---- PHASE sites: synthetic multi-site fan-out (clone reference site into N healthy sites) ----
  # Runs after Delta load + PiEvents ingest so it can clone gold/ml rows AND the PiEvents tail.
  # New sites are stable/green (no watchlist/anomaly/root-cause); only RV2/RV3 stay flagged.
  $siteCount = if ($cfg.fabric.siteCount) { [int]$cfg.fabric.siteCount } else { 0 }
  Log "PHASE sites: synthetic multi-site fan-out"
  if ($ws -and $lh -and $siteCount -gt 0) {
    Log "  cloning reference site into $siteCount healthy site(s)..."
    $map = @{
      $SRC.WorkspaceId = $ws
      $SRC.LakehouseId = $lh
    }
    if ($state.KustoUri) { $map[$SRC.KustoHost] = (([Uri]$state.KustoUri).Host -replace '\.fabric\.microsoft\.com$','') }
    $def = BuildNotebookDefinition (Join-Path $Here "fabric\notebooks\Multi-Site-Fanout") $map
    $nb  = UpsertItem $ws "notebooks" "Multi-Site-Fanout" $def
    $runBody = @{ executionData = @{ parameters = @{ N_SITES = @{ value = "$siteCount"; type = "int" } } } }
    try {
      $runResp = FPost "workspaces/$ws/items/$($nb.id)/jobs/instances?jobType=RunNotebook" $runBody
      $jobUrl = ([string[]]$runResp.Headers['Location'])[0]
      if ($jobUrl) {
        for ($i=0; $i -lt 100; $i++) {
          Start-Sleep -Seconds 15
          $js = Invoke-RestMethod -Uri $jobUrl -Headers @{ Authorization="Bearer $(FTok)" }
          if ($js.status -in @('Completed','Failed','Cancelled','Deduped')) {
            if ($js.status -in @('Completed','Deduped')) { Log "  Multi-Site-Fanout job: $($js.status) ($siteCount site(s))" "Green" }
            else { Log "PHASE sites ERROR: Multi-Site-Fanout job $($js.status)" "Yellow" }
            break
          }
        }
      }
    } catch { Log "PHASE sites ERROR: $($_.Exception.Message)" "Yellow" }
  }
  elseif ($siteCount -le 0) { Log "  skipped (fabric.siteCount = 0)" "DarkGray" }
}

# Force the Lakehouse SQL analytics endpoint to sync its metadata so newly-loaded Delta
# tables are visible to SQL/Import-model refresh. Fabric's background sync is unreliable/
# slow; without this the Import refresh fails with "key didn't match any rows" for tables
# that exist in OneLake but aren't yet exposed by the SQL endpoint.
function Sync-SqlEndpointMetadata($ws, $lakehouseId) {
  try {
    $lhFull = FGet "workspaces/$ws/lakehouses/$lakehouseId"
    $epId = $lhFull.properties.sqlEndpointProperties.id
    if (-not $epId) { Log "  (no SQL endpoint id - skipping metadata sync)" "Yellow"; return }
    $resp = Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$ws/sqlEndpoints/$epId/refreshMetadata?preview=true" -Method Post -Headers @{ Authorization="Bearer $(FTok)"; "Content-Type"="application/json" } -Body "{}"
    Log "  synced SQL endpoint metadata ($(($resp | Measure-Object).Count) tables)" "Green"
  } catch { Log "  SQL endpoint metadata sync: $($_.Exception.Message)" "Yellow" }
}

# Create (or reuse) a service principal used as the Import model's data-source refresh
# credential. Reuses config.fixedIdentity if fully populated; otherwise creates an AAD app
# + SP + secret and persists it back to config.json so re-runs reuse the same identity.
function Ensure-DeploySP {
  $fi = $cfg.fixedIdentity
  if ($fi -and $fi.clientId -and $fi.clientSecret -and $fi.tenantId) {
    Log "  using service principal from config.fixedIdentity ($($fi.clientId))"
    $oid = AzTry { az ad sp show --id $fi.clientId --query id -o tsv }
    return @{ tenantId=$fi.tenantId; clientId=$fi.clientId; clientSecret=$fi.clientSecret; objectId=$oid }
  }
  $tenantId = AzTry { az account show --query tenantId -o tsv }
  $appName  = "$($cfg.chatAgent.appName)-refresh-sp"
  $appId = AzTry { az ad app list --display-name $appName --query "[0].appId" -o tsv }
  if (-not $appId) {
    $appId = AzTry { az ad app create --display-name $appName --sign-in-audience AzureADMyOrg --query appId -o tsv }
    if (-not $appId) { Log "  could not create app registration (insufficient AAD permission?) - supply config.fixedIdentity manually" "Red"; return @{} }
    Log "  created app registration '$appName' ($appId)"
    Start-Sleep -Seconds 15   # AAD propagation
  } else { Log "  reusing app registration '$appName' ($appId)" }
  $spOid = AzTry { az ad sp show --id $appId --query id -o tsv }
  if (-not $spOid) { $spOid = AzTry { az ad sp create --id $appId --query id -o tsv }; Start-Sleep -Seconds 8 }
  $secret = AzTry { az ad app credential reset --id $appId --display-name deploy-refresh --years 1 --query password -o tsv }
  if (-not $secret) { Log "  could not create SP secret" "Red"; return @{} }
  # Persist to config.json (gitignored) so subsequent deploys reuse this identity.
  try {
    $cfg | Add-Member -NotePropertyName fixedIdentity -NotePropertyValue ([ordered]@{ tenantId=$tenantId; clientId=$appId; clientSecret=$secret }) -Force
    [IO.File]::WriteAllText($ConfigPath, ($cfg | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
    Log "  generated service principal '$appName' and saved it to config.json" "Green"
  } catch { Log "  (SP created but could not persist to config.json: $($_.Exception.Message))" "Yellow" }
  return @{ tenantId=$tenantId; clientId=$appId; clientSecret=$secret; objectId=$spOid }
}

# ============================ PHASE: semantic model + report ==================
function Phase-Semantic {
  $ws = $state.WorkspaceId
  Log "PHASE semantic: import model + report"
  $map = @{
    $SRC.WorkspaceId = $ws
    $SRC.SqlEndpoint = ($state.SqlEndpoint -split '\.')[0]
  }
  # Import semantic model (from exported semantic-main-import) - idempotent
  $smFolder = Join-Path $Here "fabric\semanticmodel\semantic-main-import"
  if (Test-Path $smFolder) {
    $def = BuildDefinition $smFolder $map
    $sm = UpsertItem $ws "semanticModels" "semantic-main-import" $def
    $state.DatasetId = $sm.id
    Log "  semantic model = $($sm.id)" "Green"

    # Ensure the SQL endpoint exposes all loaded tables before the Import model refreshes.
    Sync-SqlEndpointMetadata $ws $state.LakehouseId

    # Bind a fixed-identity SP connection + refresh so DAX works (Import model reads the SQL endpoint).
    $fi = Ensure-DeploySP
    if ($fi -and $fi.clientId -and $fi.clientSecret -and $fi.tenantId) {
      try {
        # Grant the SP workspace access FIRST - this SQL connection type requires a test
        # connection at create time, so the SP must be able to read the SQL endpoint already.
        $pbi = PbiTok
        try { Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$ws/users" -Method Post -Headers @{ Authorization="Bearer $pbi"; "Content-Type"="application/json" } -Body (@{ identifier=$fi.objectId; principalType="App"; groupUserAccessRight="Member" } | ConvertTo-Json) | Out-Null; Log "  granted refresh SP workspace access" }
        catch { if ($_.Exception.Message -notmatch '400') { Log "  SP workspace grant: $($_.Exception.Message)" "Yellow" } }
        Start-Sleep -Seconds 25   # let the workspace grant propagate before the connection test
        $connPayload = [ordered]@{
          connectivityType="ShareableCloud"; displayName="$($cfg.fabric.workspaceName) - sql"
          connectionDetails=[ordered]@{ type="SQL"; creationMethod="Sql"; parameters=@(
            @{ dataType="Text"; name="server"; value=$state.SqlEndpoint },
            @{ dataType="Text"; name="database"; value=$cfg.fabric.lakehouseName }) }
          privacyLevel="Organizational"
          credentialDetails=[ordered]@{ singleSignOnType="None"; connectionEncryption="Encrypted"; skipTestConnection=$false
            credentials=[ordered]@{ credentialType="ServicePrincipal"; tenantId=$fi.tenantId; servicePrincipalClientId=$fi.clientId; servicePrincipalSecret=$fi.clientSecret } } }
        $connName = "$($cfg.fabric.workspaceName) - sql"
        # Delete any existing same-named connection(s) before creating a fresh one. After a
        # teardown+redeploy the old connection still exists but points at the DELETED SQL
        # endpoint, so reusing it makes the refresh fail with a "default data connection
        # without explicit credentials" error. Always rebind to the CURRENT endpoint.
        foreach ($old in @((FGet "connections").value | Where-Object { $_.displayName -eq $connName })) {
          try { FDelete "connections/$($old.id)" | Out-Null; Log "  removed stale SQL connection $($old.id)" } catch { Log "  could not remove stale connection $($old.id): $($_.Exception.Message)" "Yellow" }
        }
        $conn = FWait (FPost "connections" $connPayload)
        $pbi = PbiTok
        Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$ws/datasets/$($sm.id)/Default.TakeOver" -Method Post -Headers @{ Authorization="Bearer $pbi" } | Out-Null
        Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$ws/datasets/$($sm.id)/Default.BindToGateway" -Method Post -Headers @{ Authorization="Bearer $pbi"; "Content-Type"="application/json" } -Body (@{ gatewayObjectId=$conn.id; datasourceObjectIds=@($conn.id) } | ConvertTo-Json) | Out-Null
        Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$ws/datasets/$($sm.id)/refreshes" -Method Post -Headers @{ Authorization="Bearer $pbi"; "Content-Type"="application/json" } -Body '{"type":"full","notifyOption":"NoNotification"}' | Out-Null
        Log "  semantic model connection bound + refresh started" "Green"
      } catch { $de = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; Log "  semantic bind/refresh: $de (do manually - see README)" "Yellow" }
    } else {
      Log "  (no fixedIdentity in config - bind connection + refresh manually; see README)" "Yellow"
    }
  }
  # Report
  $rptFolder = Join-Path $Here "fabric\report\Main_Overview"
  if ((Test-Path $rptFolder) -and $state.DatasetId) {
    $map2 = $map.Clone(); # report references dataset by id inside definition.pbir - rebind old dataset id
    $map2["ac47a321-8bc2-4aa1-99f0-fc1a3ce06e42"] = $state.DatasetId
    $def = BuildDefinition $rptFolder $map2
    try { UpsertItem $ws "reports" "Main Overview" $def | Out-Null; Log "  report created" }
    catch { Log "  report FAILED (rebind dataset manually): $($_.Exception.Message)" "Yellow" }
  }
}

# ============================ PHASE: OGE Power BI add-on =====================
# Adds the OGE Power BI module: a Direct Lake semantic model that reads the
# 'oge' schema of lh_poc (tables loaded by Phase-Data from data/lakehouse/oge/*).
# Build reports in the Fabric service directly against the 'semantic-oge' model.
function Phase-OGE {
  $ws = $state.WorkspaceId
  if (-not $state.LakehouseId) { Log "PHASE oge: no lakehouse - run 'core' + 'data' first" "Yellow"; return }
  Log "PHASE oge: Direct Lake semantic model"

  # Direct Lake semantic model over lh_poc / oge schema (rebind workspace + lakehouse GUIDs).
  $smFolder = Join-Path $Here "fabric\semanticmodel\semantic-oge"
  if (-not (Test-Path $smFolder)) { Log "  semantic-oge folder missing - skipping" "Yellow"; return }
  $map = @{ $SRC.WorkspaceId = $ws; $SRC.LakehouseId = $state.LakehouseId }
  $def = BuildDefinition $smFolder $map
  $sm  = UpsertItem $ws "semanticModels" "semantic-oge" $def
  $state.OgeDatasetId = $sm.id
  Log "  semantic-oge = $($sm.id)" "Green"
  Log "  build OGE reports against the 'semantic-oge' model in the Fabric service" "Green"
}

# ============================ PHASE: foundry ==================================
# A Cognitive Services / Foundry account SOFT-DELETES on teardown. While soft-deleted
# (retained ~48h) it still OWNS its global custom subdomain, so re-creating an account
# with the same name fails with CustomDomainInUse. Purge any soft-deleted account with
# this name (in whatever region/RG it was deleted from) to free the subdomain.
# Returns $true if the name is free (nothing soft-deleted remains), else $false.
function Purge-SoftDeletedFoundry($acct) {
  $json = AzTry { az cognitiveservices account list-deleted -o json }
  if (-not $json) { return $true }
  $match = @($json | ConvertFrom-Json | Where-Object { $_.name -eq $acct })
  if ($match.Count -eq 0) { return $true }
  $m = $match[0]
  $drg = ($m.id -split '/resourceGroups/')[1].Split('/')[0]
  $dloc = $m.location
  Log "  soft-deleted Foundry account '$acct' found in RG '$drg' ($dloc) - purging to free the subdomain..." "Yellow"
  for ($i = 1; $i -le 20; $i++) {
    $out = az cognitiveservices account purge --location $dloc --resource-group $drg --name $acct 2>&1
    if ($LASTEXITCODE -eq 0) { Log "  purged soft-deleted Foundry account '$acct'" "Green"; return $true }
    Start-Sleep -Seconds 15
  }
  Log "  could not purge soft-deleted Foundry account '$acct' (purge: az cognitiveservices account purge --location $dloc -g $drg -n $acct)" "Yellow"
  return $false
}

# Persist the (possibly updated) config back to disk, UTF-8 no BOM. Used when a phase changes
# a value at runtime (e.g. the Foundry subdomain fallback) so re-runs + chat agent stay in sync.
function Save-Config {
  $p = if (Test-Path $ConfigPath) { (Resolve-Path $ConfigPath).Path } else { Join-Path $Here 'config.json' }
  try { [IO.File]::WriteAllText($p, ($cfg | ConvertTo-Json -Depth 12), (New-Object System.Text.UTF8Encoding($false))); $true }
  catch { Log "  could not persist config ($p): $($_.Exception.Message)" "Yellow"; $false }
}
function New-FoundryAccount($name, $rg) {
  az cognitiveservices account create -n $name -g $rg -l $cfg.location --kind AIServices --sku S0 --custom-domain $name --assign-identity --yes -o none 2>&1 | Out-Null
  return ($LASTEXITCODE -eq 0)
}

function Phase-Foundry {
  Log "PHASE foundry: account + model deployments"
  $rg = $cfg.foundry.resourceGroup
  az group create -n $rg -l $cfg.location --tags "onegrid-deploy=1" "onegrid-workspace=$($state.WorkspaceId)" -o none
  $acct = $cfg.foundry.accountName
  $exists = AzTry { az cognitiveservices account show -n $acct -g $rg --query name -o tsv }
  if (-not $exists) {
    # Free the subdomain first if a soft-deleted account of the same name is holding it.
    [void](Purge-SoftDeletedFoundry $acct)
    $ok = New-FoundryAccount $acct $rg
    if (-not $ok) {
      # Retry once: the soft-deleted account may have only just become purgeable.
      Log "  Foundry account create failed - purging any same-named soft-deleted account and retrying..." "Yellow"
      [void](Purge-SoftDeletedFoundry $acct)
      $ok = New-FoundryAccount $acct $rg
    }
    # If the subdomain is held by an account we CAN'T purge (soft-deleted in ANOTHER
    # subscription with a 48h reservation, or genuinely taken), self-heal by switching to a
    # fresh unique name and persisting it to config so re-runs + the chat agent stay in sync.
    $tries = 0
    while (-not $ok -and $tries -lt 3) {
      $tries++
      $base = ($cfg.foundry.accountName -replace '-[0-9]{3,4}$','')
      $acct = "$base-$(Get-Random -Minimum 1000 -Maximum 9999)"
      Log "  subdomain unavailable - falling back to fresh Foundry name '$acct'" "Yellow"
      $ok = New-FoundryAccount $acct $rg
      if ($ok) { $cfg.foundry.accountName = $acct; [void](Save-Config); Log "  updated config.foundry.accountName -> '$acct'" "Green" }
    }
  }
  $state.FoundryEndpoint = AzTry { az cognitiveservices account show -n $acct -g $rg --query properties.endpoint -o tsv }
  if (-not $state.FoundryEndpoint) {
    throw "Foundry account '$acct' has no endpoint after fallback attempts. Set a different foundry.accountName in config and re-run: deploy.ps1 -Only foundry,chatagent,permissions."
  }
  foreach ($m in $cfg.foundry.models) {
    try {
      az cognitiveservices account deployment create -n $acct -g $rg --deployment-name $m.deployment `
        --model-name $m.model --model-version $m.version --model-format $m.format `
        --sku-name GlobalStandard --sku-capacity $m.capacity -o none 2>$null
      Log "  model: $($m.deployment)"
    } catch { Log "  model $($m.deployment) FAILED: $($_.Exception.Message)" "Yellow" }
  }
  Log "  foundry endpoint = $($state.FoundryEndpoint)" "Green"
}

# ============================ PHASE: chat agent ==============================
function Phase-ChatAgent {
  Log "PHASE chatagent: container app"
  $rg = $cfg.chatAgent.resourceGroup
  az group create -n $rg -l $cfg.location --tags "onegrid-deploy=1" "onegrid-workspace=$($state.WorkspaceId)" -o none
  if (-not (AzTry { az extension show -n containerapp --query name -o tsv })) { az extension add -n containerapp --only-show-errors 1>$null }
  az provider register -n Microsoft.App --wait 1>$null 2>$null

  $sub = $cfg.subscriptionId
  $models = ($cfg.foundry.models | ForEach-Object { "$($_.deployment)~$($_.deployment)~$($_.format)" }) -join ", "
  $envVars = @(
    "AI_PROVIDER=foundry",
    "AZURE_AI_ENDPOINT=$($state.FoundryEndpoint.TrimEnd('/'))",
    "AI_DEFAULT_MODEL=$($cfg.foundry.defaultModel)",
    "AI_MODELS=$models",
    "AZURE_AI_SUBSCRIPTION_ID=$sub",
    "AZURE_AI_RESOURCE_GROUP=$($cfg.foundry.resourceGroup)",
    "AZURE_AI_ACCOUNT=$($cfg.foundry.accountName)",
    "KUSTO_CLUSTER=$($state.KustoUri)",
    "KUSTO_DATABASE=$($cfg.fabric.kqlDatabaseName)",
    "PBI_WORKSPACE=$($state.WorkspaceId)"
  )
  # PBI_DATASET: prefer the id from this run's semantic phase; otherwise resolve the Import
  # model by name so 'chatagent' works even when run without 'semantic' in the same invocation.
  $datasetId = $state.DatasetId
  if (-not $datasetId) {
    $datasetId = AzTry { ((Invoke-RestMethod "https://api.powerbi.com/v1.0/myorg/groups/$($state.WorkspaceId)/datasets" -Headers @{ Authorization="Bearer $(PbiTok)" }).value | Where-Object { $_.name -eq 'semantic-main-import' } | Select-Object -First 1).id }
  }
  if ($datasetId) { $envVars += "PBI_DATASET=$datasetId" }
  else { Log "  WARNING: no Import model found - chat agent DAX will not work until PBI_DATASET is set (run the semantic phase first)" "Yellow" }

  # ---- Build the FULL dashboard image via ACR, then create the app from that image.
  # We deliberately do NOT use 'az containerapp up --source': its build-log stream prints a
  # Unicode success glyph (U+2713) that crashes the az CLI on Windows (cp1252 stdout),
  # making the deploy think the app failed and burn ~15 min per fallback region. Instead we
  # run 'az acr build' in a BACKGROUND JOB (so a client-side crash/hang can't block us) and
  # poll the ACR run status, then create the container app from the built --image.
  $app = $cfg.chatAgent.appName
  $acrName = 'acrpm' + [guid]::NewGuid().ToString('N').Substring(0,12)
  $tag = 'v' + (Get-Date -f 'yyyyMMddHHmmss')
  $imageRef = "$acrName.azurecr.io/$app`:$tag"
  Log "  creating registry '$acrName' + building dashboard image (several minutes)..."
  az acr create -n $acrName -g $rg -l $cfg.location --sku Basic --admin-enabled true -o none 2>$null
  $buildLog = Join-Path $env:TEMP "pm_acrbuild_$tag.log"
  $bjob = Start-Job -ScriptBlock {
    param($acr,$app,$tag,$here,$log)
    $env:PYTHONUTF8='1'; $env:PYTHONIOENCODING='utf-8'
    az acr build --registry $acr --image ($app + ':' + $tag) --file (Join-Path $here 'Dockerfile') $here *> $log 2>&1
  } -ArgumentList $acrName,$app,$tag,$Here,$buildLog
  $built = $false
  for ($i=0; $i -lt 75; $i++) {
    Start-Sleep -Seconds 20
    $st = AzTry { az acr task list-runs --registry $acrName --top 1 --query "[0].status" -o tsv }
    if ($st -eq 'Succeeded') { $built = $true; break }
    if ($st -in @('Failed','Canceled','Error','Timeout')) { Log "  ACR build $st (log: $buildLog)" "Red"; break }
    if ($i % 3 -eq 0) { Log "  ...building image ($([int]($i*20))s elapsed, status=$([string]$st))" }
  }
  Stop-Job $bjob -ErrorAction SilentlyContinue; Remove-Job $bjob -Force -ErrorAction SilentlyContinue
  if (-not $built) {
    $state.ChatAgentFailed = $true
    Log "  dashboard image did not build - chat agent NOT deployed. Re-run: deploy.ps1 -Only chatagent,permissions" "Red"
    return
  }
  Log "  dashboard image built: $imageRef" "Green"
  $acrUser = AzTry { az acr credential show -n $acrName --query username -o tsv }
  $acrPass = AzTry { az acr credential show -n $acrName --query "passwords[0].value" -o tsv }

  # ---- Create the managed environment + container app from the built image (no build
  # stream). Retry across regions if a managed environment fails to provision in one.
  $regions = @($cfg.location)
  if ($cfg.chatAgent.fallbackLocations) { $regions += $cfg.chatAgent.fallbackLocations }
  else { $regions += @('eastus','westus3','centralus','westeurope') | Where-Object { $_ -ne $cfg.location } }
  $regions = $regions | Select-Object -Unique
  $appOk = $false
  foreach ($loc in $regions) {
    # Region-unique env name so a FAILED env in one region can't block a retry in another.
    $envName = "$($cfg.chatAgent.environmentName)-$loc"
    $envState = AzTry { az containerapp env show -n $envName -g $rg --query properties.provisioningState -o tsv }
    if ($envState -eq 'Failed') { Log "  removing failed environment '$envName'..."; az containerapp env delete -n $envName -g $rg --yes 2>&1 | Out-Null; $envState = $null }
    if (-not $envState) {
      Log "  creating container app environment '$envName' in $loc ..."
      az containerapp env create -n $envName -g $rg -l $loc -o none 2>&1 | Out-Null
    }
    $envReady = $false
    for ($j=0; $j -lt 36; $j++) {
      $es = AzTry { az containerapp env show -n $envName -g $rg --query properties.provisioningState -o tsv }
      if ($es -eq 'Succeeded') { $envReady = $true; break }
      if ($es -eq 'Failed') { break }
      Start-Sleep -Seconds 10
    }
    if (-not $envReady) { Log "  env not ready in $loc - trying next region" "Yellow"; continue }
    Log "  creating container app '$app' in $loc ..."
    $createOut = az containerapp create -n $app -g $rg --environment $envName `
      --image $imageRef --registry-server "$acrName.azurecr.io" --registry-username $acrUser --registry-password $acrPass `
      --target-port 8080 --ingress external --min-replicas 1 --max-replicas 1 --cpu 1 --memory 2Gi `
      --env-vars @envVars -o none 2>&1
    # Poll briefly for the ingress FQDN (populates within seconds of a successful create).
    $fqdn = $null
    for ($k=0; $k -lt 12; $k++) {
      $fqdn = AzTry { az containerapp show -n $app -g $rg --query properties.configuration.ingress.fqdn -o tsv }
      if ($fqdn) { break }
      if ((AzTry { az containerapp show -n $app -g $rg --query properties.provisioningState -o tsv }) -eq 'Failed') { break }
      Start-Sleep -Seconds 5
    }
    if ($fqdn) { $appOk = $true; $state.ChatAgentLocation = $loc; $state.ChatAgentEnv = $envName; break }
    $ce = ("$createOut" -split "`n" | Where-Object { $_ -match 'ERROR|not recognized|Bad Request|denied|Quota' } | Select-Object -First 1)
    Log "  container app not up in $loc$(if($ce){" - $($ce.Trim())"}) - trying next region" "Yellow"
  }
  if (-not $appOk) {
    $state.ChatAgentFailed = $true
    Log "  chat agent FAILED to provision in all attempted regions ($($regions -join ', ')). Re-run: deploy.ps1 -Only chatagent,permissions" "Red"
    return
  }

  # Managed identity + Foundry role grants
  $appId = AzTry { az containerapp identity assign -n $cfg.chatAgent.appName -g $rg --system-assigned --query principalId -o tsv }
  $scope = AzTry { az cognitiveservices account show -n $cfg.foundry.accountName -g $cfg.foundry.resourceGroup --query id -o tsv }
  az role assignment create --assignee-object-id $appId --assignee-principal-type ServicePrincipal --role "Cognitive Services User" --scope $scope -o none 2>$null
  az role assignment create --assignee-object-id $appId --assignee-principal-type ServicePrincipal --role "Reader" --scope $scope -o none 2>$null
  $state.AppPrincipalId = $appId
  $state.AppUrl = "https://$fqdn"
  Log "  chat agent = $($state.AppUrl)" "Green"
}

# ============================ PHASE: permissions =============================
function Phase-Permissions {
  Log "PHASE permissions: Eventhouse + Power BI grants for the app identity"
  if ($state.ChatAgentFailed -or -not $state.AppPrincipalId) {
    $probe = AzTry { az containerapp identity show -n $cfg.chatAgent.appName -g $cfg.chatAgent.resourceGroup --query principalId -o tsv }
    if (-not $probe) { Log "  skipping grants - chat agent identity not available (chat agent did not provision). Re-run: deploy.ps1 -Only chatagent,permissions" "Yellow"; return }
  }
  $appId = $state.AppPrincipalId
  if (-not $appId) { $appId = AzTry { az containerapp identity show -n $cfg.chatAgent.appName -g $cfg.chatAgent.resourceGroup --query principalId -o tsv } }
  $tenant = AzTry { az account show --query tenantId -o tsv }
  $appClientId = AzTry { az ad sp show --id $appId --query appId -o tsv }

  # Eventhouse DB viewer
  if ($state.KustoUri -and $appClientId) {
    $csl = ".add database ['$($cfg.fabric.kqlDatabaseName)'] viewers ('aadapp=$appClientId;$tenant') 'chat agent MI'"
    $body = @{ db=$cfg.fabric.kqlDatabaseName; csl=$csl } | ConvertTo-Json
    try { Invoke-RestMethod -Uri "$($state.KustoUri)/v1/rest/mgmt" -Method Post -Headers @{ Authorization="Bearer $(KustoTok $state.KustoUri)"; "Content-Type"="application/json" } -Body $body | Out-Null; Log "  eventhouse viewer granted" }
    catch { Log "  eventhouse grant: $($_.Exception.Message)" "Yellow" }
  }
  # Power BI workspace member
  try {
    $b = @{ identifier=$appId; principalType="App"; groupUserAccessRight="Member" } | ConvertTo-Json
    Invoke-RestMethod -Uri "https://api.powerbi.com/v1.0/myorg/groups/$($state.WorkspaceId)/users" -Method Post -Headers @{ Authorization="Bearer $(PbiTok)"; "Content-Type"="application/json" } -Body $b | Out-Null
    Log "  power bi workspace member granted"
  } catch { Log "  pbi grant: $($_.Exception.Message)" "Yellow" }
}

# ============================ PHASE: teardown ================================
# Removes what the deploy created: the Fabric workspace (all items inside it) and
# the Azure resource groups (Foundry + chat agent). The Fabric CAPACITY is
# pre-existing (you supplied it) and is left untouched.
function Phase-Teardown {
  Log "PHASE teardown: removing Fabric workspace + Azure resource groups" "Yellow"

  # Resolve the workspace id. If an explicit -TeardownWorkspaceId was supplied (from the
  # wizard's deployment picker) use it; otherwise prefer the LIVE lookup by display name,
  # falling back to last-deploy-state.json.
  $wsId = $null
  $stateFile = Join-Path $Here "last-deploy-state.json"
  if ($TeardownWorkspaceId) { $wsId = $TeardownWorkspaceId }
  else {
    try { $wsId = ((FGet "workspaces").value | Where-Object { $_.displayName -eq $cfg.fabric.workspaceName } | Select-Object -First 1).id } catch {}
    if (-not $wsId -and (Test-Path $stateFile)) { try { $wsId = (Get-Content $stateFile -Raw | ConvertFrom-Json).WorkspaceId } catch {} }
  }
  if ($wsId) {
    try {
      Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$wsId" -Method Delete -Headers @{ Authorization="Bearer $(FTok)" } | Out-Null
      Log "  deleted Fabric workspace $wsId" "Green"
    } catch { Log "  workspace delete FAILED: $($_.Exception.Message)" "Red" }
  } else { Log "  no Fabric workspace found (nothing to delete)" "Yellow" }

  # Delete the tenant-level SQL connection this deploy created. Connections are NOT scoped
  # to the workspace, so they survive a workspace delete and would otherwise be reused on the
  # next deploy while still pointing at the now-deleted SQL endpoint (breaking the refresh).
  $connName = "$($cfg.fabric.workspaceName) - sql"
  try {
    foreach ($old in @((FGet "connections").value | Where-Object { $_.displayName -eq $connName })) {
      try { FDelete "connections/$($old.id)" | Out-Null; Log "  deleted SQL connection $($old.id)" "Green" } catch { Log "  connection delete FAILED $($old.id): $($_.Exception.Message)" "Yellow" }
    }
  } catch {}

  # Azure resource groups. Use the explicit list if supplied, else Foundry + chat agent from config.
  $rgs = if ($TeardownResourceGroups) { $TeardownResourceGroups } else { @($cfg.foundry.resourceGroup, $cfg.chatAgent.resourceGroup) }
  $rgs = $rgs | Where-Object { $_ } | Select-Object -Unique
  foreach ($rg in $rgs) {
    if (AzTry { az group show -n $rg --query name -o tsv }) {
      Log "  deleting resource group '$rg' (async)..."
      az group delete -n $rg --yes --no-wait 2>$null
      Log "  requested delete of '$rg'" "Green"
    } else { Log "  resource group '$rg' not found - skipping" "Yellow" }
  }

  # Foundry (Cognitive Services) accounts SOFT-DELETE: they must be PURGED or the name
  # can't be reused on the next deploy. Wait for the RG delete to reach a terminal state,
  # then purge. (Purge fails while the account is still provisioning/deleting.)
  $acct = $cfg.foundry.accountName; $floc = $cfg.location; $frg = $cfg.foundry.resourceGroup
  if ($acct) {
    $purged = $false
    for ($i=1; $i -le 20; $i++) {
      $soft = AzTry { az cognitiveservices account list-deleted --query "[?name=='$acct'].name" -o tsv }
      if (-not $soft) { $purged = $true; break }   # nothing soft-deleted (or already purged)
      $out = az cognitiveservices account purge --location $floc --resource-group $frg --name $acct 2>&1
      if ($LASTEXITCODE -eq 0) { $purged = $true; Log "  purged soft-deleted Foundry account '$acct'" "Green"; break }
      if ($i -eq 1) { Log "  waiting for resource group delete to finish before purging Foundry account..." }
      Start-Sleep -Seconds 30
    }
    if (-not $purged) { Log "  could not purge Foundry account '$acct' yet - purge manually later: az cognitiveservices account purge --location $floc -g $frg -n $acct" "Yellow" }
  }

  if (Test-Path $stateFile) { Remove-Item $stateFile -Force -ErrorAction SilentlyContinue; Log "  removed last-deploy-state.json" }
  Log "TEARDOWN COMPLETE - workspace removed; resource-group deletion continues async in Azure." "Green"
}

# ============================ PHASE: data plane (opt-in bolt-on) ==============
# Generates a ready-to-fill appsettings for the PI->Fabric forwarder
# (bolt-ons/data-plane/connectors/pi-forwarder). OPT-IN ONLY: never runs in the
# default deploy. Trigger with -DataPlane (after a deploy) or -Only dataplane (standalone).
# Non-destructive: only reads Fabric metadata and writes a local generated config file.
function Phase-DataPlane {
  Log "PHASE dataplane: wiring the data-plane bolt-on (connectors)"
  $connRoot = Join-Path $Here "bolt-ons\data-plane\connectors"
  if (-not (Test-Path $connRoot)) { Log "  data-plane connectors not found at $connRoot - skipping" "Yellow"; return }

  # Resolve workspace (standalone-safe: -Only dataplane skips Phase-Workspace).
  $ws = $state.WorkspaceId
  if (-not $ws) {
    $wsItem = (FGet "workspaces").value | Where-Object { $_.displayName -eq $cfg.fabric.workspaceName } | Select-Object -First 1
    if ($wsItem) { $ws = $wsItem.id; $state.WorkspaceId = $ws }
  }
  if (-not $ws) { Log "  no workspace resolved (name '$($cfg.fabric.workspaceName)') - deploy the accelerator first" "Yellow"; return }

  $tenantId = AzTry { az account show --query tenantId -o tsv }

  # Find the eventstream + its custom-endpoint source.
  $esName = "pi-events-stream"
  $streams = (FGet "workspaces/$ws/eventstreams").value
  $es = $streams | Where-Object { $_.displayName -eq $esName } | Select-Object -First 1
  if (-not $es) { $es = $streams | Select-Object -First 1 }
  $fqdn = "REPLACE-ME.servicebus.fabric.microsoft.com"
  $eventHubName = $esName
  if ($es) {
    Log "  eventstream: $($es.displayName) ($($es.id))"
    # Best-effort: resolve the custom-endpoint source connection (Event Hub-compatible).
    try {
      $topo = Invoke-RestMethod -Uri "https://api.fabric.microsoft.com/v1/workspaces/$ws/eventstreams/$($es.id)/topology" -Headers @{ Authorization="Bearer $(FTok)" }
      $srcId = ($topo.sources | Where-Object { $_.type -eq 'CustomEndpoint' } | Select-Object -First 1).id
      if ($srcId) {
        $conn = Invoke-RestMethod -Method Post -Uri "https://api.fabric.microsoft.com/v1/workspaces/$ws/eventstreams/$($es.id)/sources/$srcId/connection" -Headers @{ Authorization="Bearer $(FTok)"; "Content-Type"="application/json" }
        if ($conn.fullyQualifiedNamespace) { $fqdn = $conn.fullyQualifiedNamespace }
        if ($conn.eventHubName)            { $eventHubName = $conn.eventHubName }
        Log "  resolved custom-endpoint namespace: $fqdn" "Green"
      }
    } catch { Log "  couldn't auto-resolve endpoint FQDN ($($_.Exception.Message)) - leaving REPLACE-ME" "Yellow" }
  } else {
    Log "  no eventstream found in workspace - is the accelerator deployed?" "Yellow"
  }

  # Emit a pre-filled appsettings for EACH connector that has one (secrets stay REPLACE-ME).
  $written = @()
  foreach ($cDir in (Get-ChildItem $connRoot -Directory)) {
    $tmplPath = Join-Path $cDir.FullName "appsettings.json"
    if (-not (Test-Path $tmplPath)) { continue }
    try {
      $cfgObj = Get-Content $tmplPath -Raw | ConvertFrom-Json
      if ($cfgObj.PSObject.Properties.Name -notcontains 'Fabric') { continue }
      $cfgObj.Fabric.FabricNamespaceFqdn = $fqdn
      $cfgObj.Fabric.StreamName          = $eventHubName
      $cfgObj.Fabric.TenantId            = if ($tenantId) { $tenantId } else { "REPLACE-ME" }
      # ClientId + CertThumbprint intentionally stay REPLACE-ME (you create the Entra app + cert).
      $outPath = Join-Path $cDir.FullName "appsettings.generated.json"
      [IO.File]::WriteAllText($outPath, ($cfgObj | ConvertTo-Json -Depth 10), (New-Object System.Text.UTF8Encoding($false)))
      Log "  wrote $outPath" "Green"
      $written += $cDir.Name
    } catch { Log "  skipped $($cDir.Name): $($_.Exception.Message)" "Yellow" }
  }
  if ($written.Count -eq 0) { Log "  no connector appsettings templates found under $connRoot" "Yellow" }

  Log "  ----------------------------------------------------------------" "Green"
  Log "  DATA PLANE - next steps to go live:" "Green"
  Log "   1. Create an Entra app registration and upload a client certificate." "Gray"
  Log "   2. Grant that app 'Azure Event Hubs Data Sender' on the Eventstream custom endpoint." "Gray"
  Log "   3. Fill ClientId + CertThumbprint in each appsettings.generated.json (FQDN/Tenant prefilled)." "Gray"
  if ($fqdn -like 'REPLACE-ME*') {
    Log "   4. FQDN not auto-resolved: open Eventstream > custom endpoint 'PIForwarderEndpoint'" "Gray"
    Log "      > 'SAS Key Authentication' and copy the Event Hub namespace host into FabricNamespaceFqdn." "Gray"
  }
  Log "   5. Configure the source + install:" "Gray"
  Log "      - pi-forwarder: populate tags.json (see connectors/pi-forwarder/README.md)" "Gray"
  Log "      - db-forwarder: populate sources.json + set DBFWD_CONN_* (see connectors/db-forwarder/README.md)" "Gray"
}

# ============================ run =============================================
if ($Teardown) { Phase-Teardown; return }

$phases = [ordered]@{
  workspace   = { Phase-Workspace }
  core        = { Phase-Core }
  artifacts   = { Phase-Artifacts }
  data        = { Phase-Data }
  semantic    = { Phase-Semantic }
  oge         = { Phase-OGE }
  foundry     = { Phase-Foundry }
  chatagent   = { Phase-ChatAgent }
  permissions = { Phase-Permissions }
}
foreach ($name in $phases.Keys) {
  if (Should $name) {
    try { & $phases[$name] }
    catch { $script:phaseErrors += "$name : $($_.Exception.Message)"; Log "PHASE $name ERROR: $($_.Exception.Message)" "Red" }
  }
  else { Log "skip phase $name" "DarkGray" }
}

# Opt-in data-plane bolt-on (never part of the default deploy path).
if ($DataPlane -or ($Only -contains 'dataplane')) {
  try { Phase-DataPlane }
  catch { $script:phaseErrors += "dataplane : $($_.Exception.Message)"; Log "PHASE dataplane ERROR: $($_.Exception.Message)" "Red" }
}

# Collect non-fatal failures recorded by phases into the summary.
if ($state.EventhouseSchemaApplied -eq $false) { $script:phaseErrors += "core : eventhouse schema not applied (PiEvents/streaming tables missing)" }
if ($state.ChatAgentFailed)                     { $script:phaseErrors += "chatagent : container app did not provision (region capacity/build)" }

# Organize items into folders (after all items exist).
if ($state.WorkspaceId) { Log "Organizing workspace into folders..."; Apply-Folders $state.WorkspaceId }

Log "==================================================================" "Green"
if ($script:phaseErrors.Count -eq 0) {
  Log "DEPLOY COMPLETE - all phases succeeded" "Green"
} else {
  Log "DEPLOY FINISHED WITH $($script:phaseErrors.Count) ISSUE(S):" "Yellow"
  $script:phaseErrors | ForEach-Object { Log "  - $_" "Yellow" }
}
if ($state.AppUrl)        { Log "Chat agent: $($state.AppUrl)" "Green" }
elseif ($state.ChatAgentFailed) { Log "Chat agent: NOT DEPLOYED (see issues above)" "Yellow" }
Log "Workspace:  https://app.fabric.microsoft.com/groups/$($state.WorkspaceId)" "Green"
[IO.File]::WriteAllText((Join-Path $Here "last-deploy-state.json"), ($state | ConvertTo-Json -Depth 4), (New-Object System.Text.UTF8Encoding($false)))
Log "State written to last-deploy-state.json" "Green"
$durSec = [int]((Get-Date) - $script:deployStart).TotalSeconds
Send-Telemetry "OneGridDeployComplete" @{
  outcome   = $(if ($script:phaseErrors.Count -eq 0) { "success" } else { "issues" })
  chatAgent = [bool]$state.AppUrl
  region    = $state.ChatAgentLocation
} @{ durationSec = $durSec; issueCount = $script:phaseErrors.Count }
if ($script:phaseErrors.Count -gt 0) { exit 1 }
