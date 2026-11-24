# Build & Deploy Citadel of Legends (UE 5.8) for Android (supports both x86_64 emulator & arm64 phones)
param(
  [string]$ProjectPath = "D:\UnrealProjects\Xenon\Xenon.uproject",
  [ValidateSet("Development","Shipping")][string]$Config = "Development",
  [ValidateSet("ASTC","Multi","ETC2")][string]$CookFlavor = "ASTC",
  [string]$DeviceId = "",
  [switch]$SkipCook,
  [switch]$AppBundle,
  [switch]$Deploy
)

$ErrorActionPreference = "Stop"
$EngineRoot = "C:\Program Files\Epic Games\UE_5.8"
$RunUAT = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
$SdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA "Android\Sdk" }
$Adb = Join-Path $SdkRoot "platform-tools\adb.exe"
$OutDir = "D:\UnrealProjects\Xenon\Builds\Android"

# Ensure Android SDK / NDK / JDK env vars are exported for UBT/UAT
$env:ANDROID_HOME = $SdkRoot
if (-not $env:NDKROOT -or !(Test-Path $env:NDKROOT)) {
  $ndkDir = Get-ChildItem (Join-Path $SdkRoot "ndk") -Directory -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
  if ($ndkDir) { $env:NDKROOT = $ndkDir.FullName }
}
if (-not $env:JAVA_HOME -or !(Test-Path $env:JAVA_HOME)) {
  $jdk = Get-ChildItem "C:\Program Files\Microsoft\jdk-17*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($jdk) { $env:JAVA_HOME = $jdk.FullName }
}
# Use Windows native OS root certificate store so Gradle wrapper & Maven HTTPS verify cleanly
$env:JAVA_TOOL_OPTIONS = "-Djavax.net.ssl.trustStoreType=Windows-ROOT -Djavax.net.ssl.trustStore=NONE"
Write-Host "ANDROID_HOME=$env:ANDROID_HOME" -ForegroundColor DarkGray
Write-Host "NDKROOT=$env:NDKROOT" -ForegroundColor DarkGray
Write-Host "JAVA_HOME=$env:JAVA_HOME" -ForegroundColor DarkGray

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
  $(if ($SkipCook) { "-skipcook" } else { "-cook" }),
  "-cookflavor=$CookFlavor",
  "-stage",
  "-pak",
  "-archive",
  "-archivedirectory=`"$OutDir`"",
  $(if ($SkipCook) { "-skipbuild" } else { "-build" }),
  "-skipbuildeditor",
  "-package",
  "-utf8output"
)

Write-Host "Running: $RunUAT $($uatArgs -join ' ')"
& $RunUAT @uatArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($Deploy) {
  if (!(Test-Path $Adb)) { throw "adb not found at $Adb" }
  $devLines = & $Adb devices | Select-String "\tdevice$"
  if (!$devLines) {
    Write-Host "No Android device or emulator connected. Boot an emulator or enable USB Debugging." -ForegroundColor Yellow
    exit 3
  }
  if (-not $DeviceId) {
    $DeviceId = ($devLines[0].Line -split "\s+")[0]
  }
  $abi = (& $Adb -s $DeviceId shell getprop ro.product.cpu.abi).Trim()
  Write-Host "Deploying to $DeviceId (ABI: $abi)..." -ForegroundColor Cyan

  $pattern = if ($abi -match "x86_64") { "*x64*" } else { "*arm64*" }
  $installer = Get-ChildItem $OutDir -Recurse -Filter "Install_*$pattern*.bat" | Select-Object -First 1
  if (-not $installer) {
    $installer = Get-ChildItem $OutDir -Recurse -Filter "Install_*.bat" | Select-Object -First 1
  }

  $apk = Get-ChildItem $OutDir -Recurse -Filter "*$pattern*.apk" | Select-Object -First 1
  if (-not $apk) {
    $apk = Get-ChildItem $OutDir -Recurse -Filter "*.apk" | Select-Object -First 1
  }
  if (-not $apk) { throw "No APK found in $OutDir" }

  Write-Host "Installing APK: $($apk.FullName)" -ForegroundColor Green
  & $Adb -s $DeviceId install -r -g $apk.FullName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  # Push OBB if generated (non-bundled builds)
  $obb = Get-ChildItem $OutDir -Recurse -Filter "*.obb" | Select-Object -First 1
  if ($obb) {
    Write-Host "Also found OBB ($($obb.Name)); running UE installer script if available..."
    if ($installer) {
      $env:ANDROID_SERIAL = $DeviceId
      Push-Location $installer.DirectoryName
      try { & cmd /c "`"$($installer.Name)`"" } finally { Pop-Location }
    }
  }
}
