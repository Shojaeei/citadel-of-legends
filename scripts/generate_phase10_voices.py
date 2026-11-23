"""
Phase 10: Realistic Neural Faction Voice-Over Generator for Citadel of Legends.
Uses Microsoft Neural TTS (via edge-tts), decodes to 44.1kHz PCM via PyAV, and
applies medieval stone-hall acoustics + peak normalization into assets_3d/audio/VO_*.wav.
"""
import asyncio
import io
import math
import os
import struct
import wave
import truststore
truststore.inject_into_ssl()
import av
import edge_tts

OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets_3d", "audio"))
os.makedirs(OUT_DIR, exist_ok=True)
SR = 44100

VOICE_LINES = [
    # Existing 8 upgraded from SAPI to cinema-grade British/Fantasy Neural Voices
    {
        "name": "VO_Intro_Solaris",
        "voice": "en-GB-RyanNeural",
        "rate": "-6%",
        "pitch": "-4Hz",
        "reverb": (0.16, 0.36),
        "text": "Sire! The Shattered Realms burn. King Arthur's Solaris Order stands as the last bastion of light. Fortify the valley, feed the realm, and crush the Dread Citadel across the river!",
    },
    {
        "name": "VO_Intro_Frostbound",
        "voice": "en-GB-SoniaNeural",
        "rate": "-6%",
        "pitch": "-2Hz",
        "reverb": (0.20, 0.42),
        "text": "Warriors of the Frostbound Covenant! The northern glaciers answer Siegfried's horn. Quarry the basalt peaks, awaken the Frost Giants, and shatter the eastern keep!",
    },
    {
        "name": "VO_Intro_Obsidian",
        "voice": "en-GB-ThomasNeural",
        "rate": "-12%",
        "pitch": "-16Hz",
        "reverb": (0.28, 0.52),
        "text": "Children of the Obsidian Scourge! The crimson eclipse rises over the valley. Stoke the Blood Crucible, unleash the Abyss Dragon, and lay waste to every citadel!",
    },
    {
        "name": "VO_Wave_Alert",
        "voice": "en-GB-RyanNeural",
        "rate": "+4%",
        "pitch": "+2Hz",
        "reverb": (0.18, 0.38),
        "text": "To arms, my Lord! Dread raiders are marching across the river bridge! Defend the gatehouse!",
    },
    {
        "name": "VO_Charge_Order",
        "voice": "en-GB-RyanNeural",
        "rate": "+6%",
        "pitch": "+3Hz",
        "reverb": (0.22, 0.44),
        "text": "For honor and glory! All legions, charge across the bridge and storm the enemy citadel!",
    },
    {
        "name": "VO_Building_Complete",
        "voice": "en-GB-SoniaNeural",
        "rate": "+0%",
        "pitch": "+0Hz",
        "reverb": (0.12, 0.28),
        "text": "Construction complete, Sire. Our stronghold grows stronger.",
    },
    {
        "name": "VO_Unit_Recruited",
        "voice": "en-AU-WilliamNeural",
        "rate": "+2%",
        "pitch": "-4Hz",
        "reverb": (0.14, 0.30),
        "text": "Steel is sharp and shields are raised. Ready for battle, my Lord!",
    },
    {
        "name": "VO_Chapter_Victory",
        "voice": "en-GB-SoniaNeural",
        "rate": "-4%",
        "pitch": "+1Hz",
        "reverb": (0.22, 0.45),
        "text": "Victory is ours, Sire! The enemy citadel has fallen, and the realm advances to the next chapter!",
    },
    # 6 brand-new Phase 10 battlefield & stronghold voice cues
    {
        "name": "VO_Defeat_Fallen",
        "voice": "en-GB-ThomasNeural",
        "rate": "-10%",
        "pitch": "-10Hz",
        "reverb": (0.26, 0.50),
        "text": "Our keep has fallen, Sire. Regroup the garrison and reclaim the valley!",
    },
    {
        "name": "VO_Dragon_Unleashed",
        "voice": "en-GB-ThomasNeural",
        "rate": "-8%",
        "pitch": "-14Hz",
        "reverb": (0.30, 0.54),
        "text": "Behold the skies! An ancient Dragon takes wing over the battlefield!",
    },
    {
        "name": "VO_Low_Resources",
        "voice": "en-GB-SoniaNeural",
        "rate": "+2%",
        "pitch": "-1Hz",
        "reverb": (0.12, 0.28),
        "text": "Our coffers run low, my Lord. Gather more timber, stone, and gold!",
    },
    {
        "name": "VO_Under_Attack",
        "voice": "en-GB-RyanNeural",
        "rate": "+6%",
        "pitch": "+2Hz",
        "reverb": (0.18, 0.38),
        "text": "My Lord, our stronghold is under siege! Rally the defenders!",
    },
    {
        "name": "VO_Move_Ack",
        "voice": "en-AU-WilliamNeural",
        "rate": "+4%",
        "pitch": "-2Hz",
        "reverb": (0.12, 0.26),
        "text": "Marching out! By your command, Sire.",
    },
    {
        "name": "VO_Save_Complete",
        "voice": "en-GB-SoniaNeural",
        "rate": "+0%",
        "pitch": "+1Hz",
        "reverb": (0.14, 0.30),
        "text": "The royal chronicles have been inscribed, Sire.",
    },
]


def decode_mp3_to_float_mono(mp3_bytes: bytes) -> list[float]:
    container = av.open(io.BytesIO(mp3_bytes), format="mp3")
    resampler = av.audio.resampler.AudioResampler(format="flt", layout="mono", rate=SR)
    samples = []
    for frame in container.decode(audio=0):
        out_frames = resampler.resample(frame)
        for of in out_frames:
            raw = bytes(of.planes[0])
            count = len(raw) // 4
            samples.extend(struct.unpack(f"<{count}f", raw))
    # Flush resampler
    for of in resampler.resample(None):
        raw = bytes(of.planes[0])
        count = len(raw) // 4
        samples.extend(struct.unpack(f"<{count}f", raw))
    container.close()
    return samples


def apply_medieval_acoustics(samples: list[float], wet: float, decay: float) -> list[float]:
    # Add short reverb tail (0.45s) so hall decay doesn't clip
    tail = int(SR * 0.45)
    n = len(samples) + tail
    padded = samples + [0.0] * tail

    # 3-tap Schroeder comb hall reverb with slight low-pass warmth
    delays = [int(SR * 0.023), int(SR * 0.037), int(SR * 0.053)]
    combs = [[0.0] * n for _ in delays]
    for c_idx, d in enumerate(delays):
        cb = combs[c_idx]
        lp = 0.0
        for i in range(n):
            fb = cb[i - d] * decay if i >= d else 0.0
            lp = lp * 0.35 + fb * 0.65
            cb[i] = padded[i] + lp

    out = [0.0] * n
    inv_c = 1.0 / len(delays)
    dry_gain = 1.0 - wet * 0.25
    peak = 1e-6
    for i in range(n):
        rev = (combs[0][i] + combs[1][i] + combs[2][i]) * inv_c
        v = padded[i] * dry_gain + rev * wet
        # Gentle warmth soft-clip
        v = math.tanh(v * 1.08)
        out[i] = v
        av_v = abs(v)
        if av_v > peak:
            peak = av_v

    # Peak normalize to -1.5 dBFS (~0.84)
    scale = 0.84 / peak
    out = [x * scale for x in out]

    # Trim trailing silence below -55 dB (leaving 80ms pad)
    end = n
    thresh = 0.0018
    while end > SR // 4 and abs(out[end - 1]) < thresh:
        end -= 1
    end = min(n, end + int(SR * 0.08))
    return out[:end]


def write_wav_16bit_mono(path: str, samples: list[float]):
    pcm = bytearray(len(samples) * 2)
    for i, s in enumerate(samples):
        clamped = max(-0.99, min(0.99, s))
        struct.pack_into("<h", pcm, i * 2, int(round(clamped * 32767)))
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(bytes(pcm))


async def synth_one(item: dict):
    comm = edge_tts.Communicate(
        item["text"],
        voice=item["voice"],
        rate=item["rate"],
        pitch=item["pitch"],
    )
    chunks = []
    async for msg in comm.stream():
        if msg["type"] == "audio":
            chunks.append(msg["data"])
    mp3_bytes = b"".join(chunks)
    if not mp3_bytes:
        raise RuntimeError(f"Empty neural audio stream for {item['name']}")
    raw = decode_mp3_to_float_mono(mp3_bytes)
    wet, decay = item["reverb"]
    processed = apply_medieval_acoustics(raw, wet=wet, decay=decay)
    out_path = os.path.join(OUT_DIR, f"{item['name']}.wav")
    write_wav_16bit_mono(out_path, processed)
    dur = len(processed) / SR
    print(f"  OK {item['name']}.wav ({dur:.2f}s, {os.path.getsize(out_path):,} bytes) [{item['voice']}]")


async def main():
    print(f"Synthesizing {len(VOICE_LINES)} neural voice-over tracks into {OUT_DIR} ...")
    for item in VOICE_LINES:
        await synth_one(item)
    print("All Phase 10 neural voices generated cleanly!")


if __name__ == "__main__":
    asyncio.run(main())
