param(
  [string]$Query = "",
  [int]$SinceDays = 2,
  [switch]$All,
  [string]$OutDir = "",
  [string]$Stamp = ""
)

$ErrorActionPreference = "Stop"

if (-not $env:GOOGLE_WORKSPACE_CLI_CONFIG_DIR) {
  $candidate = Join-Path $env:APPDATA "gws-chieh"
  if (Test-Path $candidate) {
    $env:GOOGLE_WORKSPACE_CLI_CONFIG_DIR = $candidate
  }
}

if (-not $Stamp) {
  $Stamp = Get-Date -Format "yyyy-MM-dd"
}
if (-not $OutDir) {
  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $OutDir = Join-Path $repoRoot "data\ideabrowser-seeds"
}
if (-not $Query) {
  if ($All) {
    $Query = "from:notifications@mail.ideabrowser.com -in:trash"
  } else {
    $Query = "from:notifications@mail.ideabrowser.com newer_than:${SinceDays}d -in:trash"
  }
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$dailyDir = Join-Path $OutDir "daily"
New-Item -ItemType Directory -Force -Path $dailyDir | Out-Null

$masterPath = Join-Path $OutDir "ideabrowser-opportunity-seeds.jsonl"
$dailyPath = Join-Path $dailyDir "ideabrowser-opportunity-seeds-$Stamp.jsonl"
$manifestPath = Join-Path $OutDir "ideabrowser-import-$Stamp.md"

function Decode-Base64Url([string]$s) {
  if (-not $s) { return "" }
  $p = $s.Replace("-", "+").Replace("_", "/")
  switch ($p.Length % 4) {
    2 { $p += "==" }
    3 { $p += "=" }
  }
  [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($p))
}

function Get-LeafParts($part) {
  if ($part.parts) {
    foreach ($p in $part.parts) { Get-LeafParts $p }
  } else {
    $part
  }
}

function Clean-Text([string]$s) {
  if (-not $s) { return "" }
  $s = $s -replace "[\u200B-\u200F\uFEFF\u034F]", ""
  $s = $s -replace [char]0x00A0, " "
  $s = $s -replace "`r", ""
  $s = [regex]::Replace($s, "(?m)^\s+$", "")
  $s.Trim()
}

function Canonical-Url([string]$url) {
  if (-not $url) { return $null }
  $u = $url.Trim()
  if ($u -like "https://www.ideabrowser.com/*") {
    return ($u -replace "\?.*$", "")
  }
  $u
}

function Slug-Title([string]$url) {
  if (-not $url) { return $null }
  $u = Canonical-Url $url
  $slug = ($u -split "/")[-1]
  $slug = $slug -replace "-[0-9a-f]{4,}$", ""
  $words = ($slug -replace "-", " ").Trim()
  if (-not $words) { return $null }
  (Get-Culture).TextInfo.ToTitleCase($words)
}

function Lines([string]$s) {
  if (-not $s) { return @() }
  @($s -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ })
}

function Section([string]$text, [string]$start, [string[]]$ends) {
  $i = $text.IndexOf($start)
  if ($i -lt 0) { return "" }
  $s = $i + $start.Length
  $end = $text.Length
  foreach ($e in $ends) {
    $j = $text.IndexOf($e, $s)
    if ($j -ge 0 -and $j -lt $end) { $end = $j }
  }
  Clean-Text $text.Substring($s, $end - $s)
}

function First-Url([string]$s, [string]$prefix) {
  if (-not $s) { return $null }
  $m = [regex]::Match($s, [regex]::Escape($prefix) + "\S+")
  if ($m.Success) { return Canonical-Url $m.Value }
  $null
}

function Teaser([string]$s, [int]$n = 220) {
  $v = Clean-Text($s -replace "https://\S+", "")
  $v = [regex]::Replace($v, "\s+", " ")
  if ($v.Length -le $n) { return $v }
  $v.Substring(0, $n).Trim() + "..."
}

function Domains([string]$s) {
  $hay = " " + $s.ToLowerInvariant() + " "
  $hits = New-Object System.Collections.Generic.List[string]
  $rules = [ordered]@{
    "AI/ML" = @(" ai ", "llm", "agent", "model", "prompt", "copilot", "computer vision", "machine learning", "chatgpt", "claude", "search")
    "Developer Tools" = @("developer", "code", "github", "api", "devtool", "test", "deploy", "documentation", "workflow")
    "Legal Tech" = @("lawsuit", "legal", "contract", "compliance", "regulation", "court", "settlement")
    "FinTech" = @("payment", "invoice", "grant", "student aid", "finance", "cash", "revenue", "tax", "bank")
    "Health Tech" = @("health", "patient", "clinic", "medical", "doctor", "care", "therapy")
    "Education" = @("student", "school", "teacher", "learning", "course", "education")
    "Creator Economy" = @("creator", "newsletter", "content", "seo", "media", "audience")
    "Hardware/IoT" = @("hardware", "sensor", "camera", "robot", "device", "aircraft")
    "Sustainability" = @("carbon", "energy", "waste", "climate", "sustainability")
    "Gaming" = @("game", "gaming", "player")
    "Logistics" = @("logistics", "delivery", "inventory", "parts", "supply", "warehouse", "fleet")
    "Marketplace" = @("marketplace", "seller", "buyer", "vendor")
    "Real Estate Tech" = @("real estate", "property manager", " tenant ", " lease ", " landlord ", " adu ", " zoning ")
    "Consumer Apps" = @("consumer", "personal", "family", "wedding", "event")
    "B2B SaaS" = @("dashboard", "team", "approval", "procurement", "operator", "business", "brand")
  }
  foreach ($name in $rules.Keys) {
    foreach ($kw in $rules[$name]) {
      if ($hay.Contains($kw)) {
        $hits.Add($name)
        break
      }
    }
  }
  if ($hits.Count -eq 0) { $hits.Add("B2B SaaS") }
  @($hits | Select-Object -Unique -First 4)
}

function Add-Seed($list, $record) {
  if (-not $record.title -and -not $record.url) { return }
  $record.asagiri_domains = @(Domains (($record.title, $record.teaser, $record.seed_type) -join " "))
  $list.Add([pscustomobject]$record) | Out-Null
}

function Record-Key($record) {
  "$($record.gmail_message_id)|$($record.seed_type)|$($record.url)|$($record.title)"
}

$ids = New-Object System.Collections.Generic.List[string]
$pageToken = $null
while ($true) {
  $params = @{ userId = "me"; q = $Query; maxResults = 100 }
  if ($pageToken) { $params.pageToken = $pageToken }
  $paramsJson = $params | ConvertTo-Json -Compress
  $json = gws gmail users messages list --params $paramsJson --format json | ConvertFrom-Json
  foreach ($m in @($json.messages)) { $ids.Add($m.id) | Out-Null }
  if (-not $json.nextPageToken) { break }
  $pageToken = $json.nextPageToken
}

$records = New-Object System.Collections.Generic.List[object]
$failures = New-Object System.Collections.Generic.List[string]

foreach ($id in $ids) {
  try {
    $paramsJson = @{ userId = "me"; id = $id; format = "full" } | ConvertTo-Json -Compress
    $msg = gws gmail users messages get --params $paramsJson --format json | ConvertFrom-Json
    $headers = @{}
    foreach ($h in $msg.payload.headers) { $headers[$h.name.ToLowerInvariant()] = $h.value }

    $plainPart = Get-LeafParts $msg.payload | Where-Object { $_.mimeType -eq "text/plain" } | Select-Object -First 1
    $text = Clean-Text (Decode-Base64Url $plainPart.body.data)
    if (-not $text) {
      $failures.Add($id) | Out-Null
      continue
    }

    $subject = [string]$headers["subject"]
    $date = [string]$headers["date"]
    $title = ($subject -replace "^Idea of the Day:\s*", "").Trim()
    $pre = Teaser (($text -split "`n" | Select-Object -First 1) -join "") 180

    $mainSection = Section $text "Idea of the Day" @("Browse this idea", "View full idea")
    $mainUrl = First-Url $text "https://www.ideabrowser.com/idea/"
    Add-Seed $records ([ordered]@{
      source = "ideabrowser_email"
      seed_type = "main_idea"
      title = $title
      teaser = Teaser $mainSection 260
      url = $mainUrl
      email_subject = $subject
      email_date = $date
      gmail_message_id = $id
      preheader = $pre
      extracted_at = $Stamp
      raw_email_kept = $false
    })

    $also = Section $text "Also released today:" @("----------------------------------------")
    foreach ($line in Lines $also) {
      $m = [regex]::Match($line, "^(?<title>.+?)\s+(?<url>https://www\.ideabrowser\.com/idea/\S+)$")
      if ($m.Success) {
        Add-Seed $records ([ordered]@{
          source = "ideabrowser_email"
          seed_type = "also_released"
          title = $m.Groups["title"].Value.Trim()
          teaser = $null
          url = Canonical-Url $m.Groups["url"].Value
          email_subject = $subject
          email_date = $date
          gmail_message_id = $id
          preheader = $pre
          extracted_at = $Stamp
          raw_email_kept = $false
        })
      }
    }

    $hidden = Section $text "HIDDEN NICHE OPPORTUNITY" @("View full analysis", "Founder Playbook")
    $hiddenUrl = First-Url $hidden "https://www.ideabrowser.com/market-insights/"
    if ($hidden -or $hiddenUrl) {
      Add-Seed $records ([ordered]@{
        source = "ideabrowser_email"
        seed_type = "hidden_niche"
        title = (Slug-Title $hiddenUrl)
        teaser = Teaser $hidden 260
        url = $hiddenUrl
        email_subject = $subject
        email_date = $date
        gmail_message_id = $id
        preheader = $pre
        extracted_at = $Stamp
        raw_email_kept = $false
      })
    }

    $play = Section $text "Founder Playbook" @("BUILDER BOOKMARKS")
    $playLines = Lines $play
    if ($playLines.Count -gt 0) {
      Add-Seed $records ([ordered]@{
        source = "ideabrowser_email"
        seed_type = "founder_playbook"
        title = $playLines[0]
        teaser = Teaser (($playLines | Select-Object -Skip 1) -join " ") 260
        url = First-Url $play "https://www.ideabrowser.com/api/redirect"
        email_subject = $subject
        email_date = $date
        gmail_message_id = $id
        preheader = $pre
        extracted_at = $Stamp
        raw_email_kept = $false
      })
    }

    $book = Section $text "BUILDER BOOKMARKS" @("Sneak peek at tomorrow", "PS -", "You're receiving")
    $bookLines = Lines $book
    for ($i = 0; $i -lt $bookLines.Count; $i++) {
      $m = [regex]::Match($bookLines[$i], "^\*\s*(?<title>.+?)\s+(?<url>https://\S+)$")
      if ($m.Success) {
        $desc = $null
        if ($i + 1 -lt $bookLines.Count -and $bookLines[$i + 1] -notmatch "^\*") { $desc = $bookLines[$i + 1] }
        Add-Seed $records ([ordered]@{
          source = "ideabrowser_email"
          seed_type = "builder_bookmark"
          title = $m.Groups["title"].Value.Trim()
          teaser = Teaser $desc 220
          url = $m.Groups["url"].Value.Trim()
          email_subject = $subject
          email_date = $date
          gmail_message_id = $id
          preheader = $pre
          extracted_at = $Stamp
          raw_email_kept = $false
        })
      }
    }
  } catch {
    $failures.Add("$id $($_.Exception.Message)") | Out-Null
  }
}

$existing = New-Object System.Collections.Generic.List[object]
$seen = @{}
if (Test-Path $masterPath) {
  foreach ($line in Get-Content -LiteralPath $masterPath) {
    if (-not $line.Trim()) { continue }
    $r = $line | ConvertFrom-Json
    $existing.Add($r) | Out-Null
    $seen[(Record-Key $r)] = $true
  }
}

$newRecords = New-Object System.Collections.Generic.List[object]
foreach ($r in $records) {
  $key = Record-Key $r
  if (-not $seen.ContainsKey($key)) {
    $newRecords.Add($r) | Out-Null
    $seen[$key] = $true
  }
}

$master = New-Object System.Collections.Generic.List[object]
foreach ($r in $newRecords) { $master.Add($r) | Out-Null }
foreach ($r in $existing) { $master.Add($r) | Out-Null }
$master | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 8 } | Set-Content -LiteralPath $masterPath -Encoding utf8
$newRecords | ForEach-Object { $_ | ConvertTo-Json -Compress -Depth 8 } | Set-Content -LiteralPath $dailyPath -Encoding utf8

$md = @(
  "# Ideabrowser Import",
  "",
  "Generated: $Stamp",
  "Query: ``$Query``",
  "Emails scanned: $($ids.Count)",
  "Records extracted: $($records.Count)",
  "New records appended: $($newRecords.Count)",
  "Master records: $($master.Count)",
  "Failures: $($failures.Count)",
  "",
  "Master seed: ``$masterPath``",
  "Daily delta: ``$dailyPath``"
)
if ($failures.Count -gt 0) {
  $md += ""
  $md += "## Failures"
  foreach ($f in $failures) { $md += "- $f" }
}
$md | Set-Content -LiteralPath $manifestPath -Encoding utf8

[pscustomobject]@{
  query = $Query
  emails = $ids.Count
  extracted_records = $records.Count
  new_records = $newRecords.Count
  master_records = $master.Count
  failures = $failures.Count
  master = $masterPath
  daily = $dailyPath
  manifest = $manifestPath
} | ConvertTo-Json -Depth 5
