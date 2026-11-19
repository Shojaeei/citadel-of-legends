# Generates the 8 placeholder voice-over lines with Windows System.Speech TTS.
# Output: assets_3d/audio/VO_*.wav  (then import into UE /Game/Audio).
# NOTE: Placeholder quality. Planned replacement: neural TTS (Phase 10).
param(
  [string]$OutDir = (Join-Path $PSScriptRoot "..\assets_3d\audio")
)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

$lines = @(
  @{ Name="VO_Intro_Solaris";     Voice="Microsoft David Desktop"; Rate=-1; Text="Sire! The Shattered Realms burn. King Arthur's Solaris Order stands as the last bastion of light. Fortify the valley, feed the realm, and crush the Dread Citadel across the river!" },
  @{ Name="VO_Intro_Frostbound";  Voice="Microsoft Zira Desktop";  Rate=-1; Text="Warriors of the Frostbound Covenant! The northern glaciers answer Siegfried's horn. Quarry the basalt peaks, awaken the Frost Giants, and shatter the eastern keep!" },
  @{ Name="VO_Intro_Obsidian";    Voice="Microsoft David Desktop"; Rate=-2; Text="Children of the Obsidian Scourge! The crimson eclipse rises over Transylvania. Stoke the Blood Crucible, unleash the Abyss Dragon, and lay waste to the valley!" },
  @{ Name="VO_Wave_Alert";        Voice="Microsoft David Desktop"; Rate=0;  Text="To arms, my Lord! Dread raiders are marching across the river bridge! Defend the gatehouse!" },
  @{ Name="VO_Charge_Order";      Voice="Microsoft David Desktop"; Rate=0;  Text="For honor and glory! All legions, charge across the bridge and storm the enemy citadel!" },
  @{ Name="VO_Building_Complete"; Voice="Microsoft Zira Desktop";  Rate=0;  Text="Construction complete, Sire." },
  @{ Name="VO_Unit_Recruited";    Voice="Microsoft David Desktop"; Rate=0;  Text="Ready for battle, my Lord!" },
  @{ Name="VO_Chapter_Victory";   Voice="Microsoft Zira Desktop";  Rate=-1; Text="Victory is ours, Sire! The realm advances to the next chapter!" }
)

foreach ($item in $lines) {
  $synth.SelectVoice($item.Voice)
  $synth.Rate = $item.Rate
  $synth.SetOutputToWaveFile((Join-Path $OutDir "$($item.Name).wav"))
  $synth.Speak($item.Text)
}
$synth.Dispose()
Write-Output "Generated $($lines.Count) voice lines in $OutDir"
