/**
 * Phase 10: Rich Stereo Medieval Orchestral Soundtrack & Cinematic Fanfares
 * Physical-modeling Karplus-Strong lute/harp, chorused bowed strings, breathy medieval flute,
 * heroic brass horns, war drums/timpani, cathedral bells, and true stereo hall reverb.
 *
 * Outputs 44.1kHz 16-bit Stereo PCM WAVs in assets_3d/audio/:
 *   - BGM_CitadelTheme.wav  (48s seamless stereo peace & stronghold suite, D Dorian)
 *   - BGM_BattleTheme.wav   (36s seamless stereo siege & combat march, D Minor, 128 BPM)
 *   - SFX_Fanfare_Victory.wav (4.8s triumphant brass & chimes victory fanfare)
 *   - SFX_Fanfare_Defeat.wav  (4.5s solemn minor brass & tolling bell defeat lament)
 *   - SFX_DragonRoar.wav      (2.2s mythic dragon roar & wingbeat)
 */
const fs = require('fs');
const path = require('path');

const AUDIO_DIR = path.join(__dirname, '..', 'assets_3d', 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
const SR = 44100;

// Deterministic PRNG for reproducible acoustic textures
let seed = 104729;
function rand() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
}

function writeStereoWav(filePath, left, right) {
  const N = left.length;
  const dataSize = N * 4; // 2 channels * 2 bytes
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);      // PCM
  buf.writeUInt16LE(2, 22);      // Stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28); // ByteRate
  buf.writeUInt16LE(4, 32);      // BlockAlign
  buf.writeUInt16LE(16, 34);     // BitsPerSample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let peak = 1e-6;
  for (let i = 0; i < N; i++) {
    const a = Math.max(Math.abs(left[i]), Math.abs(right[i]));
    if (a > peak) peak = a;
  }
  const norm = peak > 0.88 ? 0.88 / peak : 1.0;

  for (let i = 0; i < N; i++) {
    const l = Math.tanh(left[i] * norm);
    const r = Math.tanh(right[i] * norm);
    buf.writeInt16LE(Math.round(Math.max(-0.98, Math.min(0.98, l)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-0.98, Math.min(0.98, r)) * 32767), 44 + i * 4 + 2);
  }
  fs.writeFileSync(filePath, buf);
  console.log(`  OK ${path.basename(filePath)} (${(N / SR).toFixed(1)}s stereo, ${(buf.length / 1024).toFixed(0)} KB)`);
}

// True stereo Schroeder comb hall reverb with slight L/R decorrelation
function applyStereoHallReverb(inL, inR, wet = 0.30, decay = 0.56, seamlessLoop = false) {
  const N = inL.length;
  const delaysL = [1291, 1607, 1949, 2371];
  const delaysR = [1361, 1693, 2027, 2447];

  function procChan(inp, delays) {
    const out = new Float32Array(N);
    const combs = delays.map(d => new Float32Array(d));
    const idx = new Int32Array(delays.length);
    const lp = new Float32Array(delays.length);
    // Warm up reverb buffer for seamless looping
    const passes = seamlessLoop ? 2 : 1;
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < N; i++) {
        let rev = 0;
        const x = inp[i];
        for (let c = 0; c < delays.length; c++) {
          const d = delays[c];
          const k = idx[c];
          const delayed = combs[c][k];
          lp[c] = lp[c] * 0.38 + delayed * 0.62;
          combs[c][k] = x + lp[c] * decay;
          idx[c] = (k + 1) % d;
          rev += delayed;
        }
        if (pass === passes - 1) {
          out[i] = x * (1.0 - wet * 0.25) + (rev * 0.25) * wet;
        }
      }
    }
    return out;
  }

  return [procChan(inL, delaysL), procChan(inR, delaysR)];
}

// Mix a mono note buffer into stereo L/R with pan in [-1, +1] and optional wrap-around for loops
function mixNote(L, R, startSec, monoBuf, gain, pan = 0.0, loopWrap = false) {
  const N = L.length;
  const startIdx = Math.floor(startSec * SR);
  const gL = gain * Math.cos((pan + 1) * Math.PI * 0.25);
  const gR = gain * Math.sin((pan + 1) * Math.PI * 0.25);
  for (let i = 0; i < monoBuf.length; i++) {
    let dst = startIdx + i;
    if (loopWrap) {
      dst = ((dst % N) + N) % N;
    } else if (dst < 0 || dst >= N) {
      continue;
    }
    L[dst] += monoBuf[i] * gL;
    R[dst] += monoBuf[i] * gR;
  }
}

// Physical-modeling Karplus-Strong plucked lute/harp string
function synthPluck(freq, durSec, brightness = 0.55) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  const period = Math.max(8, Math.round(SR / freq));
  const ring = new Float32Array(period);
  // Warm low-passed pluck excitation
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const r = rand();
    prev = prev * (1 - brightness) + r * brightness;
    ring[i] = prev;
  }
  // Remove DC offset from ring
  let mean = 0;
  for (let i = 0; i < period; i++) mean += ring[i];
  mean /= period;
  for (let i = 0; i < period; i++) ring[i] -= mean;

  const damp = 0.9965 - Math.min(0.008, freq * 0.000004);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const cur = ring[p];
    const nxt = ring[(p + 1) % period];
    ring[p] = (cur + nxt) * 0.5 * damp;
    const env = Math.min(1, i / 120) * (i > n - 800 ? (n - i) / 800 : 1);
    out[i] = cur * env;
    p = (p + 1) % period;
  }
  return out;
}

// Warm bowed orchestral string (chorused detuned harmonics + slow vibrato + bow attack)
function synthStrings(freq, durSec, attackSec = 0.35, releaseSec = 0.55) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  const detunes = [0.9965, 1.0, 1.0038];
  const ph = [0, 1.2, 2.5];
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = Math.min(1.0, t / attackSec);
    const r = t > durSec - releaseSec ? Math.max(0, (durSec - t) / releaseSec) : 1.0;
    const env = a * a * r;
    const vib = 1.0 + 0.004 * Math.sin(2 * Math.PI * 5.2 * t) * Math.min(1, t / 0.6);
    let s = 0;
    for (let v = 0; v < 3; v++) {
      const f = freq * detunes[v] * vib;
      ph[v] += (2 * Math.PI * f) / SR;
      // Rich bowed saw-like harmonic blend
      s += Math.sin(ph[v]) * 0.50 + Math.sin(ph[v] * 2) * 0.28 + Math.sin(ph[v] * 3) * 0.14 + Math.sin(ph[v] * 4) * 0.08;
    }
    lp = lp * 0.72 + (s * 0.33) * 0.28;
    out[i] = lp * env;
  }
  return out;
}

// Breathy wooden medieval flute / recorder
function synthFlute(freq, durSec) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  let ph = 0, bLP = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = Math.min(1.0, t / 0.09);
    const r = t > durSec - 0.14 ? Math.max(0, (durSec - t) / 0.14) : 1.0;
    const env = a * r;
    const vib = 1.0 + 0.0055 * Math.sin(2 * Math.PI * 5.6 * t) * Math.min(1, t / 0.35);
    ph += (2 * Math.PI * freq * vib) / SR;
    bLP = bLP * 0.85 + rand() * 0.15;
    const tone = Math.sin(ph) * 0.78 + Math.sin(ph * 2) * 0.17 + Math.sin(ph * 3) * 0.05;
    out[i] = (tone + bLP * 0.09) * env;
  }
  return out;
}

// Heroic orchestral brass / French horn
function synthBrass(freq, durSec, attackSec = 0.12, brightness = 1.0) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  let ph = 0;
  const harms = [1.0, 0.88, 0.74, 0.56, 0.42, 0.30, 0.20, 0.12];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = Math.min(1.0, t / attackSec);
    const r = t > durSec - 0.25 ? Math.max(0, (durSec - t) / 0.25) : 1.0;
    const env = a * r;
    const bend = 1.0 - 0.015 * Math.exp(-t * 14.0) + 0.0025 * Math.sin(2 * Math.PI * 5.0 * t);
    ph += (2 * Math.PI * freq * bend) / SR;
    let s = 0;
    for (let h = 0; h < harms.length; h++) {
      const k = h + 1;
      const open = Math.pow(Math.max(0.05, env), 0.28 * k) * (h > 2 ? brightness : 1.0);
      s += harms[h] * open * Math.sin(ph * k);
    }
    out[i] = s * 0.28 * env;
  }
  return out;
}

// Deep war drum / Taiko / Timpani hit
function synthDrum(baseFreq, durSec, punch = 1.0) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  let ph = 0, lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = baseFreq * (1.0 + 0.85 * Math.exp(-t * 28.0));
    ph += (2 * Math.PI * f) / SR;
    const env = Math.min(1, t / 0.004) * Math.exp(-t * (6.5 / Math.max(0.4, durSec)));
    lp = lp * 0.84 + rand() * 0.16;
    const skin = lp * Math.exp(-t * 24.0) * 0.55 * punch;
    out[i] = (Math.sin(ph) * 0.85 + Math.sin(ph * 1.59) * 0.22 + skin) * env;
  }
  return out;
}

// Cathedral chime / bronze bell
function synthBell(freq, durSec) {
  const n = Math.floor(SR * durSec);
  const out = new Float32Array(n);
  const ratios = [1.0, 2.0, 2.40, 3.0, 4.18, 5.43];
  const amps   = [0.65, 0.35, 0.25, 0.18, 0.11, 0.06];
  const decs   = [1.1, 1.8, 2.4, 3.2, 4.5, 6.0];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const atk = Math.min(1, t / 0.004);
    let s = 0;
    for (let k = 0; k < ratios.length; k++) {
      s += amps[k] * Math.sin(2 * Math.PI * freq * ratios[k] * t) * Math.exp(-t * decs[k]);
    }
    out[i] = s * atk * 0.55;
  }
  return out;
}

const NOTE = {
  D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, Bb2: 116.54, C3: 130.81,
  D3: 146.83, E3: 164.81, F3: 174.61, Fs3: 185.00, G3: 196.00, A3: 220.00, Bb3: 233.08, B3: 246.94, C4: 261.63,
  D4: 293.66, E4: 329.63, F4: 349.23, Fs4: 369.99, G4: 392.00, A4: 440.00, Bb4: 466.16, B4: 493.88, C5: 523.25,
  D5: 587.33, E5: 659.25, F5: 698.46, Fs5: 739.99, G5: 783.99, A5: 880.00,
};

// ============================================================================
// 1. BGM_CitadelTheme.wav — 48s Stereo Medieval Stronghold Suite (D Dorian, 80 BPM)
// ============================================================================
console.log('Synthesizing Phase 10 stereo orchestral tracks & fanfares...');
{
  const dur = 48.0; // 16 bars at 80 BPM (3.0s per 4/4 bar -> 0.75s per beat)
  const beat = 0.75;
  const N = Math.floor(SR * dur);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  // 16-bar noble D Dorian chord progression:
  // A (bars 0-7):  Dm  | C   | G   | Dm  | F   | C   | Am  | Dm
  // B (bars 8-15): Bb  | C   | Dm  | Am  | G   | F   | C   | A(sus/m) -> Dm
  const chords = [
    ['D2', 'D3', 'A3', 'F4'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'G3', 'B3', 'D4'], ['D2', 'A3', 'D4', 'F4'],
    ['F2', 'F3', 'C4', 'A4'], ['C3', 'G3', 'E4', 'G4'], ['A2', 'E3', 'A3', 'C4'], ['D2', 'A3', 'D4', 'F4'],
    ['Bb2', 'F3', 'Bb3', 'D4'], ['C3', 'G3', 'C4', 'E4'], ['D2', 'A3', 'D4', 'F4'], ['A2', 'E3', 'A3', 'C4'],
    ['G2', 'G3', 'B3', 'D4'], ['F2', 'F3', 'A3', 'C4'], ['C3', 'G3', 'C4', 'E4'], ['A2', 'E3', 'A3', 'E4'],
  ];

  for (let bar = 0; bar < 16; bar++) {
    const tBar = bar * 4 * beat;
    const ch = chords[bar];
    // Lush bowed string pads (spread across stereo field)
    mixNote(L, R, tBar, synthStrings(NOTE[ch[0]], 3.3, 0.55, 0.65), 0.22, -0.25, true);
    mixNote(L, R, tBar, synthStrings(NOTE[ch[1]], 3.3, 0.65, 0.65), 0.16,  0.30, true);
    mixNote(L, R, tBar, synthStrings(NOTE[ch[2]], 3.3, 0.75, 0.65), 0.14, -0.45, true);
    mixNote(L, R, tBar, synthStrings(NOTE[ch[3]], 3.3, 0.85, 0.65), 0.11,  0.48, true);

    // Physical-modeled Karplus-Strong lute arpeggio (8 eighth-notes per bar)
    const arpOrder = [1, 2, 3, 2, 1, 3, 2, 3];
    for (let s = 0; s < 8; s++) {
      const f = NOTE[ch[arpOrder[s]]] * (s === 5 ? 2.0 : 1.0);
      const tNote = tBar + s * (beat * 0.5);
      mixNote(L, R, tNote, synthPluck(f, 1.35, 0.52), 0.19 * (s % 2 === 0 ? 1.0 : 0.78), -0.35 + (s % 3) * 0.12, true);
    }

    // Soft medieval frame drum heartbeat
    mixNote(L, R, tBar, synthDrum(62, 0.55, 0.45), 0.16, 0.0, true);
    mixNote(L, R, tBar + 2.5 * beat, synthDrum(88, 0.30, 0.35), 0.09, 0.15, true);
  }

  // Expressive wooden flute melody (Section A bars 2-7 & Section B bars 8-15)
  const fluteNotes = [
    // Bars 2-7 (lyrical valley theme)
    [2.0, 'D5', 1.5], [3.5, 'C5', 0.5], [4.0, 'A4', 2.0],
    [6.0, 'G4', 1.0], [7.0, 'A4', 1.0], [8.0, 'C5', 1.5], [9.5, 'D5', 0.5], [10.0, 'A4', 2.0],
    [12.0, 'F4', 1.0], [13.0, 'G4', 1.0], [14.0, 'A4', 1.5], [15.5, 'G4', 0.5],
    [16.0, 'A4', 2.0], [18.0, 'C5', 1.0], [19.0, 'D5', 1.0],
    [20.0, 'E5', 2.0], [22.0, 'D5', 1.0], [23.0, 'C5', 1.0],
    [24.0, 'A4', 2.5], [26.5, 'G4', 1.5], [28.0, 'D4', 3.5],
    // Bars 8-15 (noble soaring French horn & flute duet)
    [32.0, 'D5', 1.5], [33.5, 'E5', 0.5], [34.0, 'F5', 2.0],
    [36.0, 'E5', 1.5], [37.5, 'D5', 0.5], [38.0, 'C5', 2.0],
    [40.0, 'D5', 2.0], [42.0, 'A4', 2.0],
    [44.0, 'C5', 1.5], [45.5, 'B4', 0.5], [46.0, 'A4', 2.0],
    [48.0, 'B4', 1.5], [49.5, 'A4', 0.5], [50.0, 'G4', 2.0],
    [52.0, 'A4', 1.5], [53.5, 'G4', 0.5], [54.0, 'F4', 2.0],
    [56.0, 'G4', 2.0], [58.0, 'A4', 1.5], [59.5, 'G4', 0.5],
    [60.0, 'E4', 3.5],
  ];
  for (const [bIdx, nName, bDur] of fluteNotes) {
    mixNote(L, R, bIdx * beat, synthFlute(NOTE[nName], bDur * beat), 0.17, 0.28, true);
  }

  // Warm distant noble French Horn counter-calls on bars 8, 10, 12, 14
  const hornCalls = [
    [32.0, 'Bb3', 3.6], [36.0, 'C4', 3.6], [40.0, 'D4', 3.6], [44.0, 'C4', 3.6],
    [48.0, 'B3', 3.6],  [52.0, 'A3', 3.6], [56.0, 'G3', 3.6], [60.0, 'A3', 3.6],
  ];
  for (const [bIdx, nName, bDur] of hornCalls) {
    mixNote(L, R, bIdx * beat, synthBrass(NOTE[nName], bDur * beat, 0.35, 0.65), 0.16, -0.30, true);
  }

  // Soft valley breeze texture
  let wL = 0, wR = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    wL = wL * 0.988 + rand() * 0.012;
    wR = wR * 0.988 + rand() * 0.012;
    const swell = 0.025 + 0.012 * Math.sin(2 * Math.PI * (t / 12.0));
    L[i] += wL * swell;
    R[i] += wR * swell;
  }

  const [revL, revR] = applyStereoHallReverb(L, R, 0.36, 0.58, true);
  writeStereoWav(path.join(AUDIO_DIR, 'BGM_CitadelTheme.wav'), revL, revR);
}

// ============================================================================
// 2. BGM_BattleTheme.wav — 36s Stereo Siege & Battle March (D Minor, 128 BPM)
// ============================================================================
{
  const beat = 60.0 / 128.0; // 0.46875s -> 4 beats = 1.875s -> 16 bars = 30.0s! Let's do 16 bars = 30.0s exact!
  const bars = 16;
  const dur = bars * 4 * beat; // 30.0s crisp loop
  const N = Math.floor(SR * dur);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  const prog = [
    ['D2', 'D3', 'A3', 'F4'], ['D2', 'D3', 'A3', 'F4'], ['Bb2', 'F3', 'Bb3', 'D4'], ['C3', 'G3', 'C4', 'E4'],
    ['D2', 'D3', 'A3', 'F4'], ['G2', 'G3', 'Bb3', 'D4'], ['Bb2', 'F3', 'Bb3', 'D4'], ['A2', 'E3', 'A3', 'C4'],
    ['D2', 'D3', 'A3', 'F4'], ['F2', 'F3', 'C4', 'A4'], ['C3', 'G3', 'C4', 'E4'], ['G2', 'G3', 'Bb3', 'D4'],
    ['Bb2', 'F3', 'Bb3', 'D4'], ['G2', 'G3', 'Bb3', 'D4'], ['A2', 'E3', 'A3', 'E4'], ['A2', 'A3', 'C4', 'E4'],
  ];

  for (let bar = 0; bar < bars; bar++) {
    const tBar = bar * 4 * beat;
    const ch = prog[bar];
    const rootF = NOTE[ch[0]];
    const fifthF = rootF * 1.5;

    // Thunderous Taiko / war-drum pattern
    mixNote(L, R, tBar + 0.0 * beat, synthDrum(52, 0.55, 1.2), 0.42, 0.0, true);
    mixNote(L, R, tBar + 1.5 * beat, synthDrum(76, 0.30, 0.9), 0.26, -0.25, true);
    mixNote(L, R, tBar + 2.0 * beat, synthDrum(56, 0.45, 1.1), 0.36, 0.0, true);
    mixNote(L, R, tBar + 3.0 * beat, synthDrum(92, 0.25, 0.8), 0.24, 0.28, true);
    mixNote(L, R, tBar + 3.5 * beat, synthDrum(82, 0.22, 0.9), 0.26, -0.20, true);

    // Driving 8th-note spiccato low strings ostinato (chugging battle engine!)
    for (let e = 0; e < 8; e++) {
      const f = (e === 3 || e === 6) ? fifthF * 2.0 : rootF * 2.0;
      const accent = (e % 2 === 0) ? 0.26 : 0.17;
      mixNote(L, R, tBar + e * 0.5 * beat, synthPluck(f, 0.32, 0.78), accent, (e % 2 === 0) ? -0.45 : 0.45, true);
    }

    // Dark tense string chords
    mixNote(L, R, tBar, synthStrings(NOTE[ch[1]], 1.95, 0.16, 0.28), 0.20, -0.35, true);
    mixNote(L, R, tBar, synthStrings(NOTE[ch[2]], 1.95, 0.18, 0.28), 0.17,  0.35, true);
  }

  // Aggressive heroic French Horn & Brass siege fanfare phrases
  const brassMelody = [
    [0.0, 'D4', 1.5], [1.5, 'D4', 0.5], [2.0, 'F4', 1.0], [3.0, 'E4', 1.0],
    [4.0, 'D4', 2.0], [6.0, 'A3', 2.0],
    [8.0, 'Bb3', 1.5], [9.5, 'C4', 0.5], [10.0, 'D4', 2.0],
    [12.0, 'C4', 1.5], [13.5, 'E4', 0.5], [14.0, 'G4', 2.0],
    [16.0, 'F4', 2.0], [18.0, 'D4', 1.0], [19.0, 'F4', 1.0],
    [20.0, 'G4', 2.0], [22.0, 'F4', 1.0], [23.0, 'E4', 1.0],
    [24.0, 'D4', 2.0], [26.0, 'F4', 1.0], [27.0, 'D4', 1.0],
    [28.0, 'E4', 3.6],
    // Second 8 bars: higher heroic octave surge
    [32.0, 'A4', 1.5], [33.5, 'A4', 0.5], [34.0, 'G4', 1.0], [35.0, 'F4', 1.0],
    [36.0, 'A4', 2.0], [38.0, 'F4', 2.0],
    [40.0, 'G4', 1.5], [41.5, 'F4', 0.5], [42.0, 'E4', 2.0],
    [44.0, 'G4', 1.5], [45.5, 'F4', 0.5], [46.0, 'D4', 2.0],
    [48.0, 'F4', 2.0], [50.0, 'D4', 2.0],
    [52.0, 'G4', 2.0], [54.0, 'Bb4', 2.0],
    [56.0, 'A4', 3.5], [60.0, 'E4', 3.5],
  ];
  for (const [bIdx, nName, bDur] of brassMelody) {
    mixNote(L, R, bIdx * beat, synthBrass(NOTE[nName], bDur * beat, 0.09, 1.15), 0.30, -0.18, true);
    // Octave-below doubling horn for cinematic weight
    mixNote(L, R, bIdx * beat, synthBrass(NOTE[nName] * 0.5, bDur * beat, 0.12, 0.75), 0.22, 0.22, true);
  }

  const [revL, revR] = applyStereoHallReverb(L, R, 0.28, 0.50, true);
  writeStereoWav(path.join(AUDIO_DIR, 'BGM_BattleTheme.wav'), revL, revR);
}

// ============================================================================
// 3. SFX_Fanfare_Victory.wav — 4.8s Triumphant D-Major Brass & Chimes Fanfare
// ============================================================================
{
  const dur = 4.8;
  const N = Math.floor(SR * dur);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  // Timpani crescendo roll -> triumphant downbeat
  for (let k = 0; k < 7; k++) {
    mixNote(L, R, 0.04 + k * 0.085, synthDrum(73.42, 0.28, 0.7), 0.12 + k * 0.04, 0.0);
  }
  mixNote(L, R, 0.72, synthDrum(73.42, 1.1, 1.2), 0.50, 0.0);
  mixNote(L, R, 1.95, synthDrum(73.42, 1.4, 1.2), 0.55, 0.0);

  // Rising brass fanfare: A4 -> D5 -> E5 -> Fs5 -> A5 (majestic D major chord!)
  const notes = [
    [0.10, 'A4', 0.28, 0.32], [0.40, 'A4', 0.28, 0.35],
    [0.72, 'D5', 0.55, 0.44], [1.30, 'E5', 0.30, 0.42], [1.62, 'Fs5', 0.30, 0.45],
    [1.95, 'A5', 2.30, 0.48],
  ];
  for (const [t0, nn, d, g] of notes) {
    mixNote(L, R, t0, synthBrass(NOTE[nn], d, 0.07, 1.25), g, -0.22);
    mixNote(L, R, t0, synthBrass(NOTE[nn] * 0.5, d, 0.09, 0.90), g * 0.78, 0.25);
  }
  // Full D Major sustained brass & string triad on climax
  mixNote(L, R, 1.95, synthBrass(NOTE.D4, 2.35, 0.14, 1.0), 0.36, -0.35);
  mixNote(L, R, 1.95, synthBrass(NOTE.Fs4, 2.35, 0.14, 1.0), 0.32,  0.35);
  mixNote(L, R, 1.95, synthStrings(NOTE.D5, 2.45, 0.22, 0.7), 0.26, 0.0);
  // Bright cathedral bells
  mixNote(L, R, 0.72, synthBell(NOTE.D5, 2.2), 0.24, 0.40);
  mixNote(L, R, 1.95, synthBell(NOTE.A5, 2.6), 0.28, -0.40);
  mixNote(L, R, 2.15, synthBell(NOTE.D5, 2.4), 0.22, 0.35);

  const [revL, revR] = applyStereoHallReverb(L, R, 0.38, 0.62, false);
  writeStereoWav(path.join(AUDIO_DIR, 'SFX_Fanfare_Victory.wav'), revL, revR);
}

// ============================================================================
// 4. SFX_Fanfare_Defeat.wav — 4.5s Solemn Minor Brass & Cathedral Bell Lament
// ============================================================================
{
  const dur = 4.5;
  const N = Math.floor(SR * dur);
  const L = new Float32Array(N);
  const R = new Float32Array(N);

  mixNote(L, R, 0.05, synthBell(NOTE.D3, 3.8), 0.38, 0.0);
  mixNote(L, R, 0.15, synthBrass(NOTE.F4, 0.95, 0.18, 0.65), 0.34, -0.20);
  mixNote(L, R, 1.05, synthBrass(NOTE.E4, 0.95, 0.18, 0.60), 0.32, -0.15);
  mixNote(L, R, 1.95, synthBrass(NOTE.D4, 2.20, 0.22, 0.55), 0.36,  0.10);
  mixNote(L, R, 1.95, synthStrings(NOTE.D2, 2.30, 0.35, 0.90), 0.34, -0.30);
  mixNote(L, R, 1.95, synthStrings(NOTE.A2, 2.30, 0.35, 0.90), 0.28,  0.30);
  mixNote(L, R, 1.95, synthDrum(52, 1.4, 0.7), 0.38, 0.0);

  const [revL, revR] = applyStereoHallReverb(L, R, 0.42, 0.66, false);
  writeStereoWav(path.join(AUDIO_DIR, 'SFX_Fanfare_Defeat.wav'), revL, revR);
}

// ============================================================================
// 5. SFX_DragonRoar.wav — 2.2s Mythic Dragon Roar & Heavy Wingbeat
// ============================================================================
{
  const dur = 2.2;
  const N = Math.floor(SR * dur);
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  let ph1 = 0, ph2 = 0, nLP = 0, nBP = 0;
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const env = Math.min(1, t / 0.16) * (t < 1.1 ? 1.0 : Math.exp(-(t - 1.1) * 3.2));
    // Sweeping guttural chest roar + harmonic growl modulation
    const fBase = 68 + 52 * Math.sin(Math.min(1, t / 0.8) * Math.PI) + 18 * Math.sin(2 * Math.PI * 22 * t);
    ph1 += (2 * Math.PI * fBase) / SR;
    ph2 += (2 * Math.PI * (fBase * 2.37)) / SR;
    const rawN = rand();
    nLP = nLP * 0.86 + rawN * 0.14;
    nBP = nBP * 0.70 + (rawN - nLP) * 0.30;
    const growl = Math.tanh((Math.sin(ph1) * 0.9 + Math.sin(ph2) * 0.55 + nLP * 0.7) * 2.2);
    const screech = nBP * Math.sin(2 * Math.PI * (340 - 110 * t) * t) * 0.45;
    // Heavy wing-whoosh swell at t=0.0..0.45s
    const wing = nLP * Math.sin(Math.min(1, t / 0.45) * Math.PI) * (t < 0.45 ? 0.55 : 0);
    L[i] = (growl * 0.42 + screech * 0.30) * env + wing * 0.45;
    R[i] = (growl * 0.42 - screech * 0.25) * env + wing * 0.35;
  }
  const [revL, revR] = applyStereoHallReverb(L, R, 0.40, 0.60, false);
  writeStereoWav(path.join(AUDIO_DIR, 'SFX_DragonRoar.wav'), revL, revR);
}

console.log('All Phase 10 stereo orchestral tracks & fanfares generated cleanly!');
