/* ==========================================================================
   Citadel of Legends: Shattered Realms - Web Audio Procedural Synthesizer
   ========================================================================== */

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.musicInterval = null;
        this.currentFaction = 'solaris';
        this.isUnlocked = false;
        this.ambientNodes = [];
        this.soundscapeInterval = null;

        // Mixer state (0..1). Persisted by SettingsManager via setVolumes().
        this.volumes = { master: 0.8, sfx: 0.9, music: 0.6 };
        this.masterGain = null;
        this.sfxGain = null;
        this.musicGain = null;
        this.suspendedForAd = false;

        // Auto unlock on first user gesture
        const unlock = () => {
            if (!this.ctx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) this.ctx = new AudioContext();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().then(() => {
                    this.isUnlocked = true;
                });
            } else if (this.ctx) {
                this.isUnlocked = true;
            }
        };

        if (typeof window === 'undefined' || !window.addEventListener) return;
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
        window.addEventListener('touchstart', unlock, { once: true });
    }

    init() {
        if (!this.ctx && typeof window !== 'undefined') {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.ctx = new AudioContext();
        }
        if (this.ctx && !this.masterGain) this.buildMixer();
        if (this.ctx && this.ctx.state === 'suspended' && !this.suspendedForAd) {
            this.ctx.resume();
        }
    }

    /** Master -> destination; SFX and Music/Ambient buses -> master. */
    buildMixer() {
        const ctx = this.ctx;
        this.masterGain = ctx.createGain();
        this.sfxGain = ctx.createGain();
        this.musicGain = ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.musicGain.connect(this.masterGain);
        this.masterGain.connect(ctx.destination);
        this.applyVolumes();
    }

    applyVolumes() {
        if (!this.ctx || !this.masterGain) return;
        const now = this.ctx.currentTime;
        this.masterGain.gain.setTargetAtTime(this.enabled ? this.volumes.master : 0, now, 0.05);
        this.sfxGain.gain.setTargetAtTime(this.volumes.sfx, now, 0.05);
        this.musicGain.gain.setTargetAtTime(this.volumes.music, now, 0.05);
    }

    static clampVolume(v) {
        const n = Number(v);
        return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
    }

    setVolume(bus, value) {
        if (!Object.prototype.hasOwnProperty.call(this.volumes, bus)) return false;
        this.volumes[bus] = SoundEngine.clampVolume(value);
        this.applyVolumes();
        return true;
    }

    setVolumes(vols = {}) {
        for (const k of Object.keys(this.volumes)) {
            if (vols[k] !== undefined) this.volumes[k] = SoundEngine.clampVolume(vols[k]);
        }
        this.applyVolumes();
    }

    sfxOut() {
        return this.sfxGain || this.ctx.destination;
    }

    musicOut() {
        return this.musicGain || this.ctx.destination;
    }

    /** Portal ad SDKs require all game audio to be muted while an ad plays. */
    muteForAd(muted) {
        this.suspendedForAd = !!muted;
        if (!this.ctx) return;
        try {
            if (muted) this.ctx.suspend();
            else this.ctx.resume();
        } catch (e) { /* ignore */ }
    }

    _noiseBuffer(seconds = 2) {
        const len = Math.floor(this.ctx.sampleRate * seconds);
        const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        // Brown-ish noise: softer than white, better for wind / hum beds.
        let last = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + 0.02 * white) / 1.02;
            data[i] = last * 3.5;
        }
        return buffer;
    }

    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.stopAmbient();
        } else {
            this.startAmbientMusic(this.currentFaction);
        }
        this.applyVolumes();
        return this.enabled;
    }

    stopAmbient() {
        if (this.musicInterval) clearInterval(this.musicInterval);
        if (this.soundscapeInterval) clearInterval(this.soundscapeInterval);
        this.musicInterval = null;
        this.soundscapeInterval = null;
        this.ambientNodes.forEach(n => {
            try { n.stop(); } catch (e) { /* already stopped */ }
        });
        this.ambientNodes = [];
    }

    playClick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.sfxOut());
        osc.start(now);
        osc.stop(now + 0.05);
    }

    playCoin() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(987.77, now); // B5
        osc2.frequency.setValueAtTime(1318.51, now + 0.06); // E6

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxOut());

        osc1.start(now);
        osc1.stop(now + 0.08);
        osc2.start(now + 0.06);
        osc2.stop(now + 0.35);
    }

    playBuild() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Low stone impact
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.2);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxOut());

        osc.start(now);
        osc.stop(now + 0.22);

        // Accompanying hammer tap
        setTimeout(() => this.playAnvil(0.25), 60);
    }

    playChop() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(500, now);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxOut());

        osc.start(now);
        osc.stop(now + 0.14);
    }

    playAnvil(vol = 0.4) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        // Dual resonant strike
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(1240, now);
        osc1.frequency.exponentialRampToValueAtTime(620, now + 0.35);

        osc2.frequency.setValueAtTime(1860, now);
        osc2.frequency.exponentialRampToValueAtTime(930, now + 0.2);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxOut());

        osc1.start(now);
        osc1.stop(now + 0.38);
        osc2.start(now);
        osc2.stop(now + 0.25);
    }

    playSwordClash() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const bufferSize = Math.floor(this.ctx.sampleRate * 0.16);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2800, now);
        filter.Q.setValueAtTime(7, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.55, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxOut());

        noise.start(now);
    }

    playBowTwang() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

        osc.connect(gain);
        gain.connect(this.sfxOut());

        osc.start(now);
        osc.stop(now + 0.18);
    }

    playDragonRoar() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;

        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        subOsc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.linearRampToValueAtTime(35, now + 0.9);

        subOsc.frequency.setValueAtTime(55, now);
        subOsc.frequency.linearRampToValueAtTime(25, now + 0.9);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);
        filter.frequency.linearRampToValueAtTime(250, now + 0.9);

        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.95);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxOut());

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 0.95);
        subOsc.stop(now + 0.95);
    }

    playWarning() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(185, now);
        osc.frequency.setValueAtTime(175, now + 0.1);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.sfxOut());

        osc.start(now);
        osc.stop(now + 0.3);
    }

    playHorn() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'triangle';
        osc1.frequency.setValueAtTime(146.83, now); // D3
        osc1.frequency.linearRampToValueAtTime(164.81, now + 0.15); // E3
        osc2.frequency.setValueAtTime(220.00, now); // A3

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.85);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxOut());

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.85);
        osc2.stop(now + 0.85);
    }

    playHeal() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc.connect(gain);
                gain.connect(this.sfxOut());
                osc.start(now);
                osc.stop(now + 0.45);
            }, idx * 60);
        });
    }

    playShatter() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.exponentialRampToValueAtTime(25, now + 0.4);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);

        osc.connect(gain);
        gain.connect(this.sfxOut());
        osc.start(now);
        osc.stop(now + 0.45);
    }

    playCheer() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        const chords = [523.25, 659.25, 783.99]; // C5 major triad
        chords.forEach((freq, idx) => {
            setTimeout(() => {
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
                osc.connect(gain);
                gain.connect(this.sfxOut());
                osc.start(now);
                osc.stop(now + 0.6);
            }, idx * 70);
        });
    }

    startAmbientMusic(faction = 'solaris') {
        this.currentFaction = faction;
        this.stopAmbient();
        if (!this.enabled) return;

        let notes;
        if (faction === 'solaris') {
            // Arthurian Lute (C Major Pentatonic)
            notes = [130.81, 146.83, 164.81, 196.00, 220.00, 261.63, 329.63];
        } else if (faction === 'frost') {
            // Nordic Frost Strings (D Minor Pentatonic)
            notes = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66];
        } else {
            // Gothic Transylvanian Modal (A Harmonic Minor)
            notes = [110.00, 123.47, 130.81, 164.81, 174.61, 207.65, 220.00];
        }

        this.musicInterval = setInterval(() => {
            if (!this.enabled || !this.ctx) return;
            try {
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = faction === 'obsidian' ? 'sawtooth' : 'sine';
                const note = notes[Math.floor(Math.random() * notes.length)];
                osc.frequency.setValueAtTime(note, now);

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(faction === 'obsidian' ? 350 : 800, now);

                const vol = faction === 'obsidian' ? 0.025 : 0.04;
                gain.gain.setValueAtTime(vol, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.musicOut());

                osc.start(now);
                osc.stop(now + 2.8);
            } catch (e) {}
        }, 2800);

        this.startSoundscape(faction);
    }

    /**
     * Procedural faction soundscapes on the Music/Ambient bus:
     *  Solaris  - wind through pines, birdsong, distant abbey chimes
     *  Frost    - howling arctic wind, glacial creaks, campfire crackle
     *  Obsidian - subterranean hum, bubbling pitch cauldrons, wolf howls
     */
    startSoundscape(faction) {
        this.init();
        if (!this.ctx || !this.enabled) return;
        const ctx = this.ctx;
        try {
            // Continuous bed layer
            const bed = ctx.createBufferSource();
            bed.buffer = this._noiseBuffer(3);
            bed.loop = true;
            const bedFilter = ctx.createBiquadFilter();
            const bedGain = ctx.createGain();
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            if (faction === 'frost') {
                bedFilter.type = 'bandpass';
                bedFilter.frequency.value = 700;
                bedFilter.Q.value = 1.4;
                bedGain.gain.value = 0.10;
                lfo.frequency.value = 0.12;
                lfoGain.gain.value = 450; // sweeping howl
                lfoGain.connect(bedFilter.frequency);
            } else if (faction === 'obsidian') {
                bedFilter.type = 'lowpass';
                bedFilter.frequency.value = 160;
                bedGain.gain.value = 0.12;
                lfo.frequency.value = 0.08;
                lfoGain.gain.value = 0.04;
                lfoGain.connect(bedGain.gain);
                // Sub drone for the subterranean hum
                const drone = ctx.createOscillator();
                const droneGain = ctx.createGain();
                drone.type = 'sine';
                drone.frequency.value = 55;
                droneGain.gain.value = 0.035;
                drone.connect(droneGain);
                droneGain.connect(this.musicOut());
                drone.start();
                this.ambientNodes.push(drone);
            } else {
                bedFilter.type = 'bandpass';
                bedFilter.frequency.value = 450;
                bedFilter.Q.value = 0.7;
                bedGain.gain.value = 0.05;
                lfo.frequency.value = 0.18;
                lfoGain.gain.value = 0.03;
                lfoGain.connect(bedGain.gain);
            }
            lfo.connect(lfoGain);
            bed.connect(bedFilter);
            bedFilter.connect(bedGain);
            bedGain.connect(this.musicOut());
            bed.start();
            lfo.start();
            this.ambientNodes.push(bed, lfo);
        } catch (e) { /* audio graph unsupported */ }

        // Sporadic event layer
        this.soundscapeInterval = setInterval(() => {
            if (!this.enabled || !this.ctx) return;
            const r = Math.random();
            try {
                if (faction === 'solaris') {
                    if (r < 0.55) this.playBirdsong();
                    else if (r < 0.7) this.playChime();
                } else if (faction === 'frost') {
                    if (r < 0.35) this.playCreak();
                    else if (r < 0.8) this.playCrackle();
                } else {
                    if (r < 0.5) this.playBubble();
                    else if (r < 0.62) this.playWolfHowl();
                }
            } catch (e) {}
        }, 1700);
    }

    _tone(type, f0, f1, dur, vol, delay = 0, out = this.musicOut()) {
        const now = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, now);
        if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, now + dur);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(vol, now + Math.min(0.05, dur / 3));
        gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(gain);
        gain.connect(out);
        osc.start(now);
        osc.stop(now + dur + 0.02);
        return osc;
    }

    playBirdsong() {
        const base = 2200 + Math.random() * 1600;
        const chirps = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < chirps; i++) {
            this._tone('sine', base, base * (1.2 + Math.random() * 0.4), 0.08, 0.025, i * 0.11);
        }
    }

    playChime() {
        const f = [523.25, 659.25, 783.99][Math.floor(Math.random() * 3)];
        [1, 2.76, 5.4].forEach((m, i) => this._tone('sine', f * m, f * m, 3.5 - i, 0.02 / (i + 1)));
    }

    playCreak() {
        const osc = this._tone('sawtooth', 70 + Math.random() * 40, 40, 0.6, 0.02);
        return osc;
    }

    playCrackle() {
        const n = 3 + Math.floor(Math.random() * 6);
        for (let i = 0; i < n; i++) {
            const now = this.ctx.currentTime + Math.random() * 0.8;
            const len = Math.floor(this.ctx.sampleRate * 0.012);
            const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let k = 0; k < len; k++) d[k] = (Math.random() * 2 - 1) * (1 - k / len);
            const src = this.ctx.createBufferSource();
            src.buffer = buf;
            const g = this.ctx.createGain();
            g.gain.value = 0.05;
            const hp = this.ctx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = 1500;
            src.connect(hp);
            hp.connect(g);
            g.connect(this.musicOut());
            src.start(now);
        }
    }

    playBubble() {
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            const f = 180 + Math.random() * 220;
            this._tone('sine', f, f * 2.2, 0.09, 0.03, i * 0.15 + Math.random() * 0.1);
        }
    }

    playWolfHowl() {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const vib = this.ctx.createOscillator();
        const vibGain = this.ctx.createGain();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(380, now);
        osc.frequency.linearRampToValueAtTime(720, now + 0.9);
        osc.frequency.linearRampToValueAtTime(520, now + 2.6);
        vib.frequency.value = 5.5;
        vibGain.gain.value = 9;
        vib.connect(vibGain);
        vibGain.connect(osc.frequency);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.03, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        osc.connect(gain);
        gain.connect(this.musicOut());
        osc.start(now);
        vib.start(now);
        osc.stop(now + 2.9);
        vib.stop(now + 2.9);
    }

    /** Short faction motif used by the marketing site's lore explorer. */
    previewFaction(faction) {
        this.init();
        if (!this.ctx) return;
        const scales = {
            solaris: [261.63, 329.63, 392.00, 523.25],
            frost: [293.66, 349.23, 440.00, 587.33],
            obsidian: [220.00, 261.63, 311.13, 415.30]
        };
        const seq = scales[faction] || scales.solaris;
        seq.forEach((f, i) => this._tone(faction === 'obsidian' ? 'sawtooth' : 'triangle', f, f, 0.5, 0.06, i * 0.18, this.sfxOut()));
    }
}

const Sound = new SoundEngine();

if (typeof globalThis !== 'undefined') {
    globalThis.SoundEngine = SoundEngine;
    globalThis.Sound = Sound;
}
