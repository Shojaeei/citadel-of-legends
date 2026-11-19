# Build & Deploy Citadel of Legends (UE 5.8) for Android
param(
  [string]$ProjectPath = "D:\UnrealProjects\Xenon\Xenon.uproject",
  [ValidateSet("Development","Shipping")][string]$Config = "Development",
  [ValidateSet("ASTC","Multi","ETC2")][string]$CookFlavor = "ASTC",
  [switch]$AppBundle,
  [switch]$Deploy
)

$ErrorActionPreference = "Stop"
$EngineRoot = "C:\Program Files\Epic Games\UE_5.8"
$RunUAT = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
$Adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$OutDir = "D:\UnrealProjects\Xenon\Builds\Android"

if (!(Test-Path $ProjectPath)) {
  throw "Project not found at $ProjectPath"
}

if (!(Test-Path (Join-Path $EngineRoot "Engine\Binaries\Android"))) {
  Write-Host "BLOCKED: Unreal Engine 5.8 Android target binaries are not installed." -ForegroundColor Red
  Write-Host "Fix: Close Unreal Editor -> Epic Games Launcher -> UE 5.8 -> Options -> check [Android] -> Apply." -ForegroundColor Yellow
  exit 2
}

if ($AppBundle) {
  Write-Host "Note: For Google Play .aab, enable bEnableBundle=True in Project Settings > Android." -ForegroundColor Cyan
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$uatArgs = @(
  "BuildCookRun",
  "-project=`"$ProjectPath`"",
  "-noP4",
  "-platform=Android",
  "-clientconfig=$Config",
  "-serverconfig=$Config",
  "-cook",
  "-cookflavor=$CookFlavor",
  "-stage",
  "-pak",
  "-archive",
  "-archivedirectory=`"$OutDir`"",
  "-build",
  "-package",
  "-utf8output"
)

Write-Host "Running: $RunUAT $($uatArgs -join ' ')"
& $RunUAT @uatArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Deploy) {
  if (!(Test-Path $Adb)) { throw "adb not found at $Adb" }
  $devs = & $Adb devices | Select-String "\tdevice$"
  if (!$devs) {
    Write-Host "No Android device connected over USB. Enable Developer Options + USB Debugging on your phone." -ForegroundColor Yellow
    exit 3
  }
  $installer = Get-ChildItem $OutDir -Recurse -Filter "Install_*arm64*.bat" | Select-Object -First 1
  if ($installer) {
    Write-Host "Installing via $($installer.FullName)..."
    & cmd /c "`"$($installer.FullName)`""
  } else {
    $apk = Get-ChildItem $OutDir -Recurse -Filter "*.apk" | Select-Object -First 1
    if (!$apk) { throw "No APK found in $OutDir" }
    & $Adb install -r $apk.FullName
  }
}
