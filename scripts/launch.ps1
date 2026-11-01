$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\deepchat.ps1"

try {
  Initialize-DeepChatRuntime
  $port = Get-DeepChatPort
  Write-DeepChatAccessPanel $port
  if (Test-DeepChatPortBusy $port) {
    $ownerPid = Get-DeepChatPortOwnerPid $port
    $ownerText = if ($ownerPid) { " by PID $ownerPid" } else { "" }
    Write-DeepChatLine "  Port $port is already running$ownerText." Yellow
    Write-DeepChatLine "  O  Open current server" Cyan
    Write-DeepChatLine "  R  Restart server" Green
    Write-DeepChatLine "  P  Use another port" Yellow
    Write-DeepChatLine "  Q  Quit" DarkGray
    $choice = Read-Host "  Choose"
    if ($choice -match "^[Oo]") {
      Open-DeepChatBrowser (Get-DeepChatLocalUrl $port)
      exit 0
    }
    if ($choice -match "^[Pp]") {
      $nextPort = Read-Host "  Port"
      if ($nextPort -notmatch "^\d+$") { throw "Port must be a number." }
      $port = [int]$nextPort
      $env:DEEPCHAT_PORT = "$port"
      Write-DeepChatAccessPanel $port
    } elseif ($choice -match "^[Rr]") {
      Stop-DeepChatPortOwner $port
    } else {
      exit 0
    }
    if (Test-DeepChatPortBusy $port) {
      throw "Port $port is still busy."
    }
  }
  if (-not (Test-DeepChatDependenciesReady)) {
    Invoke-DeepChatPnpmInstall
  }
  Ensure-DeepChatBuild $true
  Write-DeepChatLine "  Starting DeepChat..." Green
  Write-DeepChatLine ""
  $exitCode = Start-DeepChatServer $port
  Write-DeepChatLine ""
  Write-DeepChatLine "  DeepChat stopped with exit code $exitCode." Yellow
  Read-Host "  Press Enter to close this launcher"
  exit $exitCode
} catch {
  Write-DeepChatLine ""
  Write-DeepChatLine "  DeepChat launcher failed:" Red
  Write-DeepChatLine "  $($_.Exception.Message)" Red
  Write-DeepChatLine ""
  Read-Host "  Press Enter to close this launcher"
  exit 1
}
