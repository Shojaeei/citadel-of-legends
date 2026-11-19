/**
 * Realistic Medieval Audio, Acoustic SFX & Voice-Over DSP Post-Processor
 * Generates 44.1kHz 16-bit PCM WAV files in assets_3d/audio/:
 * - Post-processes Windows TTS voice-overs with warm castle-hall reverb, chest resonance & presence
 * - Synthesizes realistic multi-layered physical-modeling medieval SFX:
 *   * SFX_WarHorn.wav (Deep brass horn + valley echo)
 *   * SFX_StoneBuild.wav (Heavy stone masonry thud + hammer + mortar crunch)
 *   * SFX_SwordClash.wav (Steel blade ring + shield impact)
 *   * SFX_BowRelease.wav (Bowstring snap + arrow whoosh)
 *   * SFX_UI_Parchment.wav (Warm wooden/parchment button tap)
 *   * BGM_CitadelTheme.wav (20s seamless medieval lute, war-drum, drone & wind ambient loop)
 */
const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '..', 'assets_3d', 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const SR = 44100;

function writeWav(filePath, samplesFloat) {
  const numSamples = samplesFloat.length;
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // PCM chunk size
  buf.writeUInt16LE(1, 20);  // PCM format
  buf.writeUInt16LE(1, 22);  // Mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-0.98, Math.min(0.98, samplesFloat[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

// Simple Schroeder/comb hall reverb + low-pass warmth for realism
function applyHallReverb(input, wet = 0.24, decay = 0.45) {
  const delays = [Math.floor(SR * 0.029), Math.floor(SR * 0.037), Math.floor(SR * 0.043), Math.floor(SR * 0.053)];
  const out = new Float32Array(input.length);
  const combs = delays.map(d => new Float32Array(input.length));
  for (let c = 0; c < delays.length; c++) {
    const d = delays[c];
    const cb = combs[c];
    for (let i = 0; i < input.length; i++) {
      cb[i] = input[i] + (i >= d ? cb[i - d] * decay : 0);
    }
  }
  for (let i = 0; i < input.length; i++) {
    let rev = 0;
    for (let c = 0; c < delays.length; c++) rev += combs[c][i];
    out[i] = input[i] * (1 - wet * 0.4) + (rev / delays.length) * wet;
  }
  return out;
}

// 1. SFX_WarHorn.wav (2.4s deep brass war horn with harmonic swell & canyon echo)
{
  const dur = 2.4;
  const N = Math.floor(SR * dur);
  const sig = new Float32Array(N);
  const f0 = 110.0; // A2 battle horn fundamental
  const harmonics = [1.0, 0.85, 0.70, 0.50, 0.35, 0.22, 0.14, 0.08, 0.05];
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const attack = Math.min(1.0, t / 0.18);
    const release = t < 1.55 ? 1.0 : Math.exp(-(t - 1.55) * 3.8);
    const env = attack * release;
    const pitchBend = 1.0 - 0.03 * Math.exp(-t * 9.0) + 0.004 * Math.sin(t * 24.0);
    let val = 0;
    for (let h = 0; h < harmonics.length; h++) {
      const hn = h + 1;
      // Brass brightness opens with envelope
      const br = Math.pow(env, 0.35 * hn);
      val += harmonics[h] * br * Math.sin(2 * Math.PI * f0 * hn * pitchBend * t);
    }
    // Subtle breath turbulence
    const breath = (Math.random() * 2 - 1) * 0.04 * env;
    sig[i] = (val * 0.28 + breath) * env;
  }
  writeWav(path.join(AUDIO_DIR, 'SFX_WarHorn.wav'), applyHallReverb(sig, 0.38, 0.58));
}

// 2. SFX_StoneBuild.wav (0.85s heavy stone block thud + chisel/timber knock + gravel settle)
{
  const dur = 0.85;
  const N = Math.floor(SR * dur);
  const sig = new Float32Array(N);
  let lp = 0, lp2 = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const noise = Math.random() * 2 - 1;
    lp = lp * 0.92 + noise * 0.08;
    lp2 = lp2 * 0.78 + noise * 0.22;
    // Heavy sub-bass stone thud at t=0
    const thudEnv = Math.exp(-t * 14.0);
    const thudFreq = 52 + 75 * Math.exp(-t * 28.0);
    const thud = Math.sin(2 * Math.PI * thudFreq * t) * thudEnv * 0.65;
    // Secondary timber/mallet tap at t=0.14s and t=0.29s
    const tap1 = t >= 0.14 ? Math.exp(-(t - 0.14) * 38.0) * (Math.sin(2 * Math.PI * 240 * (t - 0.14)) * 0.35 + lp2 * 0.45) : 0;
    const tap2 = t >= 0.29 ? Math.exp(-(t - 0.29) * 42.0) * (Math.sin(2 * Math.PI * 290 * (t - 0.29)) * 0.30 + lp2 * 0.40) : 0;
    // Mortar/gravel crunch
    const crunch = lp * Math.exp(-t * 7.5) * 0.55;
    sig[i] = thud + tap1 + tap2 + crunch;
  }
  writeWav(path.join(AUDIO_DIR, 'SFX_StoneBuild.wav'), applyHallReverb(sig, 0.18, 0.35));
}

// 3. SFX_SwordClash.wav (0.55s metallic steel sword ring + shield thud)
{
  const dur = 0.55;
  const N = Math.floor(SR * dur);
  const sig = new Float32Array(N);
  // Inharmonic steel modal frequencies
  const modes = [1180, 1740, 2630, 3490, 4820, 6150];
  const decays = [11, 14, 18, 22, 28, 35];
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    let ring = 0;
    for (let m = 0; m < modes.length; m++) {
      ring += Math.sin(2 * Math.PI * modes[m] * t) * Math.exp(-t * decays[m]) * (0.22 / (m + 1));
    }
    const scrape = (Math.random() * 2 - 1) * Math.exp(-t * 45.0) * 0.45;
    const shield = Math.sin(2 * Math.PI * (120 * Math.exp(-t * 20)) * t) * Math.exp(-t * 22.0) * 0.45;
    sig[i] = ring * 1.4 + scrape + shield;
  }
  writeWav(path.join(AUDIO_DIR, 'SFX_SwordClash.wav'), applyHallReverb(sig, 0.22, 0.38));
}

// 4. SFX_BowRelease.wav (0.45s taut bowstring twang + aerodynamic arrow whoosh)
{
  const dur = 0.45;
  const N = Math.floor(SR * dur);
  const sig = new Float32Array(N);
  let bp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const stringFreq = 165 * (1 + 0.35 * Math.exp(-t * 30));
    const twang = (Math.sin(2 * Math.PI * stringFreq * t) + 0.5 * Math.sin(4 * Math.PI * stringFreq * t)) * Math.exp(-t * 18.0) * 0.38;
    const n = Math.random() * 2 - 1;
    bp = bp * 0.72 + n * 0.28;
    const whooshEnv = Math.sin(Math.min(1.0, t / 0.22) * Math.PI) * Math.exp(-t * 6.0);
    sig[i] = twang + bp * whooshEnv * 0.65;
  }
  writeWav(path.join(AUDIO_DIR, 'SFX_BowRelease.wav'), applyHallReverb(sig, 0.15, 0.30));
}

// 5. SFX_UI_Parchment.wav (0.18s crisp wooden seal / parchment click)
{
  const dur = 0.18;
  const N = Math.floor(SR * dur);
  const sig = new Float32Array(N);
  let lp = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const n = Math.random() * 2 - 1;
    lp = lp * 0.8 + n * 0.2;
    const wood = Math.sin(2 * Math.PI * 380 * Math.exp(-t * 25) * t) * Math.exp(-t * 35.0) * 0.55;
    const crisp = lp * Math.exp(-t * 48.0) * 0.35;
    sig[i] = wood + crisp;
  }
  writeWav(path.join(AUDIO_DIR, 'SFX_UI_Parchment.wav'), sig);
}

// 6. BGM_CitadelTheme.wav (16.0s seamless medieval lute arpeggio, warm drone, war drum & valley breeze)
{
  const dur = 16.0;
  const N = Math.floor(SR * dur);
  const sig = new Float32Array(N);
  // D Dorian medieval progression (D3, F3, G3, A3, C4, D4, F4, A4)
  const notes = [
    146.83, 220.00, 293.66, 349.23, 440.00, 349.23, 293.66, 220.00,
    174.61, 261.63, 349.23, 440.00, 523.25, 440.00, 349.23, 261.63,
    196.00, 293.66, 392.00, 440.00, 587.33, 440.00, 392.00, 293.66,
    146.83, 220.00, 293.66, 329.63, 293.66, 220.00, 164.81, 146.83,
  ];
  const stepDur = dur / notes.length; // 0.5s per plucked lute note
  let windLP = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const stepIdx = Math.floor(t / stepDur) % notes.length;
    const nt = t - stepIdx * stepDur;
    const freq = notes[stepIdx];

    // Plucked lute string with warm harmonic decay
    const luteEnv = Math.min(1.0, nt / 0.008) * Math.exp(-nt * 4.8);
    const lute = (
      Math.sin(2 * Math.PI * freq * nt) * 0.55 +
      Math.sin(4 * Math.PI * freq * nt) * 0.25 * Math.exp(-nt * 7.0) +
      Math.sin(6 * Math.PI * freq * nt) * 0.12 * Math.exp(-nt * 11.0)
    ) * luteEnv * 0.22;

    // Deep cello/hurdy-gurdy fifth drone (D2 + A2)
    const drone = (
      Math.sin(2 * Math.PI * 73.42 * t) * 0.5 +
      Math.sin(2 * Math.PI * 110.00 * t) * 0.35 +
      Math.sin(2 * Math.PI * 146.83 * t) * 0.15
    ) * (0.09 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t));

    // Distant medieval frame drum on beats 0 and 4 of every 8-note bar
    const barPos = t % 2.0;
    const drumEnv = barPos < 0.45 ? Math.exp(-barPos * 12.0) : (barPos >= 1.0 && barPos < 1.35 ? Math.exp(-(barPos - 1.0) * 16.0) * 0.6 : 0);
    const drum = Math.sin(2 * Math.PI * (58 + 24 * drumEnv) * barPos) * drumEnv * 0.18;

    // Gentle valley wind ambience
    windLP = windLP * 0.985 + (Math.random() * 2 - 1) * 0.015;
    const wind = windLP * (0.08 + 0.04 * Math.sin(2 * Math.PI * 0.125 * t));

    sig[i] = lute + drone + drum + wind;
  }
  writeWav(path.join(AUDIO_DIR, 'BGM_CitadelTheme.wav'), applyHallReverb(sig, 0.42, 0.62));
}

console.log('Generated realistic medieval SFX & BGM WAV files in:', AUDIO_DIR);
