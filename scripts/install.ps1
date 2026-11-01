$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib\deepchat.ps1"

try {
  Initialize-DeepChatRuntime
  Write-DeepChatLine ""
  Write-DeepChatLine "  DeepChat Windows installer" Green
  Write-DeepChatRule
  Assert-DeepChatNode
  Invoke-DeepChatPnpmInstall
  Ensure-DeepChatBuild $false
  $launcherPath = Join-Path $Script:DeepChatRoot "DeepChat.bat"
  $launcher = @(
    "@echo off",
    "setlocal",
    "cd /d ""%~dp0""",
    "powershell.exe -NoProfile -ExecutionPolicy Bypass -File ""%~dp0scripts\launch.ps1""",
    "endlocal"
  )
  Set-Content -Path $launcherPath -Value $launcher -Encoding ASCII
  Write-DeepChatRule
  Write-DeepChatLine "  Installed successfully." Green
  Write-DeepChatLine "  Use DeepChat.bat from the project root to launch." Cyan
  Write-DeepChatLine "  Devices on the same LAN can open the LAN URL shown by the launcher." Cyan
  exit 0
} catch {
  Write-DeepChatLine ""
  Write-DeepChatLine "  Installation failed:" Red
  Write-DeepChatLine "  $($_.Exception.Message)" Red
  exit 1
}
