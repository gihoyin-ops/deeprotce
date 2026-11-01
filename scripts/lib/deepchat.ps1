$ErrorActionPreference = "Stop"

$Script:DeepChatRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Script:DeepChatHost = "0.0.0.0"

function Set-DeepChatRoot {
  Set-Location $Script:DeepChatRoot
}

function Write-DeepChatLine($Text = "", $Color = "Gray") {
  Write-Host $Text -ForegroundColor $Color
}

function Write-DeepChatRule {
  Write-Host ("-" * 72) -ForegroundColor DarkGray
}

function Get-DeepChatPort {
  if ($env:DEEPCHAT_PORT) { return [int]$env:DEEPCHAT_PORT }
  return 3000
}

function Get-DeepChatLocalUrl($Port) {
  return "http://localhost:$Port"
}

function Initialize-DeepChatRuntime {
  Set-DeepChatRoot
  $dirs = @(
    "data",
    "data\chat",
    "data\chat\sharechat",
    "data\llm",
    "data\llm\api",
    "data\temp",
    "data\temp\file",
    "data\user",
    "data\user\memories",
    "data\backups",
    "data\logs"
  )
  foreach ($dir in $dirs) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $env:DEEPCHAT_AI_LOG = "1"
  $env:DEEPCHAT_LOG_FILE = Join-Path $Script:DeepChatRoot "data\logs\deepchat.log"
}

function Get-DeepChatLanAddress {
  try {
    $ip = Get-NetIPAddress -AddressFamily IPv4 |
      Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.PrefixOrigin -ne "WellKnown"
      } |
      Sort-Object InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($ip) { return $ip }
  } catch {
  }
  try {
    $ip = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq "InterNetwork" -and $_.IPAddressToString -notlike "127.*" -and $_.IPAddressToString -notlike "169.254.*" } |
      Select-Object -First 1
    if ($ip) { return $ip.IPAddressToString }
  } catch {
  }
  return "localhost"
}

function Test-DeepChatPortBusy($Port) {
  try {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
  } catch {
    return $false
  }
}

function Get-DeepChatPortOwnerPid($Port) {
  try {
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) { return $connection.OwningProcess }
  } catch {
  }
  return $null
}

function Stop-DeepChatPortOwner($Port) {
  $ownerPid = Get-DeepChatPortOwnerPid $Port
  if (-not $ownerPid) { return }
  Write-DeepChatLine "  Stopping server on port $Port with PID $ownerPid..." Yellow
  try {
    & taskkill.exe /PID $ownerPid /T /F | Out-Null
  } catch {
    Stop-Process -Id $ownerPid -Force -ErrorAction Stop
  }
  Start-Sleep -Seconds 2
}

function Get-DeepChatLatestSourceWriteTime {
  $paths = @(
    "src",
    "public",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "next.config.ts",
    "postcss.config.mjs",
    "tsconfig.json"
  )
  $latest = [DateTime]::MinValue
  foreach ($item in $paths) {
    if (-not (Test-Path $item)) { continue }
    $target = Get-Item $item
    if ($target.PSIsContainer) {
      $candidate = Get-ChildItem $item -Recurse -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($candidate -and $candidate.LastWriteTime -gt $latest) { $latest = $candidate.LastWriteTime }
    } elseif ($target.LastWriteTime -gt $latest) {
      $latest = $target.LastWriteTime
    }
  }
  return $latest
}

function Test-DeepChatBuildStale {
  $buildId = ".next\BUILD_ID"
  if (-not (Test-Path $buildId)) { return $true }
  $latestSource = Get-DeepChatLatestSourceWriteTime
  $buildTime = (Get-Item $buildId).LastWriteTime
  return $latestSource -gt $buildTime
}

function Test-DeepChatBuildReady {
  return Test-Path ".next\BUILD_ID"
}

function Invoke-DeepChatStep($Label, $Command, $Arguments) {
  $safeLabel = ($Label -replace "[^a-zA-Z0-9]+", "-").Trim("-").ToLowerInvariant()
  if (-not $safeLabel) { $safeLabel = "step" }
  $stdoutPath = Join-Path $Script:DeepChatRoot "data\logs\$safeLabel.out.log"
  $stderrPath = Join-Path $Script:DeepChatRoot "data\logs\$safeLabel.err.log"
  $process = Start-Process -FilePath $Command -ArgumentList $Arguments -WorkingDirectory $Script:DeepChatRoot -NoNewWindow -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
  $frames = @("|", "/", "-", "\")
  $index = 0
  while (-not $process.HasExited) {
    Write-Host ("`r  {0} {1}" -f $Label, $frames[$index % $frames.Length]) -ForegroundColor Yellow -NoNewline
    Start-Sleep -Milliseconds 160
    $index++
  }
  $process.WaitForExit()
  Write-Host ("`r  {0} done.                                    " -f $Label) -ForegroundColor Green
  if ($process.ExitCode -ne 0) {
    throw "$Label failed with exit code $($process.ExitCode). Check data\logs\$safeLabel.out.log and data\logs\$safeLabel.err.log."
  }
}

function Test-DeepChatDependenciesReady {
  $nextCmd = Join-Path $Script:DeepChatRoot "node_modules\.bin\next.cmd"
  $sqliteModule = Join-Path $Script:DeepChatRoot "node_modules\better-sqlite3"
  return (Test-Path $nextCmd) -and (Test-Path $sqliteModule)
}

function Assert-DeepChatNode {
  $raw = (& node --version) 2>$null
  if (-not $raw) { throw "Node.js 20.9 or newer is required." }
  $version = $raw.TrimStart("v")
  $parts = $version.Split(".")
  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  if ($major -lt 20 -or ($major -eq 20 -and $minor -lt 9)) {
    throw "Node.js 20.9 or newer is required. Current version is $raw."
  }
}

function Invoke-DeepChatPnpmInstall {
  Assert-DeepChatNode
  if (Test-DeepChatDependenciesReady) {
    Write-DeepChatLine "  Dependencies are already installed." DarkGray
    return
  }
  try {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
      Invoke-DeepChatStep "Enabling Corepack..." "corepack.cmd" @("enable")
    }
  } catch {
    Write-DeepChatLine "  Corepack is unavailable, continuing with fallback." DarkGray
  }
  $pnpmHelp = ""
  if (Get-Command pnpm.cmd -ErrorAction SilentlyContinue) {
    try {
      $pnpmHelp = (& pnpm.cmd install --help) -join "`n"
    } catch {
      $pnpmHelp = ""
    }
  }
  if ($pnpmHelp -match "allow-build") {
    Invoke-DeepChatStep "Installing dependencies with pnpm..." "pnpm.cmd" @("install", "--allow-build=better-sqlite3")
    return
  }
  Invoke-DeepChatStep "Installing dependencies with pnpm 10..." "npx.cmd" @("pnpm@10", "install", "--allow-build=better-sqlite3")
}

function Invoke-DeepChatBuild {
  Assert-DeepChatNode
  Invoke-DeepChatStep "Building production app" "npm.cmd" @("run", "build")
}

function Ensure-DeepChatBuild($Interactive = $true) {
  if (-not (Test-DeepChatBuildReady)) {
    Invoke-DeepChatBuild
    return
  }
  if (-not (Test-DeepChatBuildStale)) {
    Write-DeepChatLine "  Production build is ready." DarkGray
    return
  }
  if (-not $Interactive) {
    Write-DeepChatLine "  Production build already exists. Skipping rebuild." DarkGray
    return
  }
  Write-DeepChatLine "  Source files changed after the last build." Yellow
  Write-DeepChatLine "  S  Start existing production build" Green
  Write-DeepChatLine "  B  Rebuild before starting" Yellow
  Write-DeepChatLine "  Q  Quit" DarkGray
  $choice = Read-Host "  Choose"
  if ($choice -match "^[Bb]") {
    Invoke-DeepChatBuild
  } elseif ($choice -match "^[Qq]") {
    exit 0
  } else {
    Write-DeepChatLine "  Starting existing production build." DarkGray
  }
}

function Test-DeepChatServerLine($Line) {
  if ([string]::IsNullOrWhiteSpace($Line)) { return $false }
  $plain = $Line -replace "`e\[[0-9;]*m", ""
  if ($Line -match "\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b") { return $false }
  if ($plain -match "Next\.js|Local:\s+http|Network:\s+http|Ready in") { return $false }
  if ($plain -match "^\s*(event|wait|ready|compiled|route|rendered|cache|webpack|turbopack)\b") { return $false }
  return $true
}

function Open-DeepChatBrowser($Url) {
  if ($env:DEEPCHAT_NO_BROWSER -eq "1") { return }
  try {
    Start-Process $Url | Out-Null
  } catch {
  }
}

function Write-DeepChatAccessPanel($Port) {
  $lanIp = Get-DeepChatLanAddress
  $localUrl = Get-DeepChatLocalUrl $Port
  $lanUrl = "http://$lanIp`:$Port"
  Clear-Host
  Write-DeepChatLine ""
  Write-DeepChatLine "   ____                  ____ _           _   " Blue
  Write-DeepChatLine "  |  _ \  ___  ___ _ __ / ___| |__   __ _| |_ " Blue
  Write-DeepChatLine "  | | | |/ _ \/ _ \ '_ \ |   | '_ \ / _` | __|" Blue
  Write-DeepChatLine "  | |_| |  __/  __/ |_) | |___| | | | (_| | |_ " Blue
  Write-DeepChatLine "  |____/ \___|\___| .__/ \____|_| |_|\__,_|\__|" Blue
  Write-DeepChatLine "                  |_|                          " Blue
  Write-DeepChatLine ""
  Write-DeepChatLine "  Cross-platform LAN launcher" DarkGray
  Write-DeepChatRule
  Write-DeepChatLine "  Local       $localUrl" Green
  Write-DeepChatLine "  LAN         $lanUrl" Cyan
  Write-DeepChatLine "  Phone       Open the LAN URL from the same Wi-Fi network" Cyan
  Write-DeepChatLine "  Logs        data\logs\deepchat.log" DarkGray
  Write-DeepChatLine "  Bind        $Script:DeepChatHost`:$Port" DarkGray
  Write-DeepChatRule
  Write-DeepChatLine "  QR fallback $lanUrl" Magenta
  Write-DeepChatRule
}

function Start-DeepChatServer($Port) {
  $nextCmd = Join-Path $Script:DeepChatRoot "node_modules\.bin\next.cmd"
  if (-not (Test-Path $nextCmd)) {
    throw "Dependencies are missing. Run scripts\install.ps1 first."
  }
  $localUrl = Get-DeepChatLocalUrl $Port
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $nextCmd
  $psi.Arguments = "start -H $Script:DeepChatHost -p $Port"
  $psi.WorkingDirectory = $Script:DeepChatRoot
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  $process = New-Object System.Diagnostics.Process
  $process.StartInfo = $psi
  $process.EnableRaisingEvents = $true
  $handler = {
    if ($EventArgs.Data -eq $null) { return }
    $line = $EventArgs.Data
    Add-Content -Path $env:DEEPCHAT_LOG_FILE -Value $line
    if (Test-DeepChatServerLine $line) {
      if ($line -match "^\[AI\]") {
        Write-Host $line -ForegroundColor Cyan
      } elseif ($line -match "error|failed|invalid|exception") {
        Write-Host $line -ForegroundColor Red
      } else {
        Write-Host $line -ForegroundColor Gray
      }
    }
  }
  Register-ObjectEvent -InputObject $process -EventName OutputDataReceived -Action $handler | Out-Null
  Register-ObjectEvent -InputObject $process -EventName ErrorDataReceived -Action $handler | Out-Null
  [void]$process.Start()
  $process.BeginOutputReadLine()
  $process.BeginErrorReadLine()
  Start-Sleep -Seconds 3
  if ($process.HasExited) { return $process.ExitCode }
  Open-DeepChatBrowser $localUrl
  $process.WaitForExit()
  return $process.ExitCode
}
