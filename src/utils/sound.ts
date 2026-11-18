// Zero-dependency Web Audio API Background Audio Manager & Mechanical Crane Synthesizer
// Provides:
// 1. Ambient Cityscape Soundscape (distant traffic rumble, passing vehicle whooshes, melodic birds chirping)
// 2. Mechanical Tower Crane Audio (slewing jib motor, hoist cable winch, heavy structural drop thud & grapple release)
// 3. Tactile UI & 3-Axis Rotation Servo Feedback with global Mute / Unmute toggle

type MuteListener = (muted: boolean) => void;

class CityAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private isAmbientRunning = false;
  private birdTimerId: number | null = null;
  private trafficNodes: AudioNode[] = [];
  private listeners = new Set<MuteListener>();

  public enabled = true;
  public isMuted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.isMuted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = 0.38;
        this.ambientGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.85;
        this.sfxGain.connect(this.masterGain);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended' && !this.isMuted) {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public subscribe(listener: MuteListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((fn) => fn(this.isMuted));
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.enabled = !muted;

    const ctx = this.getContext();
    if (ctx && this.masterGain) {
      const now = ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 1, now, 0.04);
    }

    if (!muted) {
      this.startAmbientCityscape();
    } else {
      this.stopBirdScheduler();
    }

    this.notifyListeners();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Called on first pointer/keyboard interaction to unlock Web Audio and start ambient city sounds
   */
  public ensureAmbientStarted(): void {
    if (this.isMuted) return;
    this.startAmbientCityscape();
  }

  /**
   * Starts the continuous procedural distant traffic rumble, passing cars, and birds chirping
   */
  public startAmbientCityscape(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain) return;

    if (!this.isAmbientRunning) {
      this.isAmbientRunning = true;

      // Build a 5-second seamless brown/pink noise buffer for urban traffic ambience
      const sampleRate = ctx.sampleRate;
      const bufferLength = sampleRate * 5;
      const noiseBuffer = ctx.createBuffer(1, bufferLength, sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.025 * white) / 1.025;
        lastOut = output[i];
        output[i] *= 0.35;
      }

      // 1. Distant City Traffic Bed (Low-pass filtered warm urban hum)
      const trafficSource = ctx.createBufferSource();
      trafficSource.buffer = noiseBuffer;
      trafficSource.loop = true;

      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 185;

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0.24;

      trafficSource.connect(lowpass);
      lowpass.connect(rumbleGain);
      rumbleGain.connect(this.ambientGain);
      trafficSource.start();

      // 2. Passing Boulevard Vehicles (Bandpass filter swept by a slow LFO)
      const whooshSource = ctx.createBufferSource();
      whooshSource.buffer = noiseBuffer;
      whooshSource.loop = true;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 340;
      bandpass.Q.value = 1.6;

      const whooshGain = ctx.createGain();
      whooshGain.gain.value = 0.09;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.16; // ~6 second vehicle pass cycle
      const lfoFilterDepth = ctx.createGain();
      lfoFilterDepth.gain.value = 140;
      lfo.connect(lfoFilterDepth);
      lfoFilterDepth.connect(bandpass.frequency);

      const lfoAmpDepth = ctx.createGain();
      lfoAmpDepth.gain.value = 0.055;
      lfo.connect(lfoAmpDepth);
      lfoAmpDepth.connect(whooshGain.gain);

      whooshSource.connect(bandpass);
      bandpass.connect(whooshGain);
      whooshGain.connect(this.ambientGain);

      whooshSource.start();
      lfo.start();

      this.trafficNodes = [
        trafficSource,
        lowpass,
        rumbleGain,
        whooshSource,
        bandpass,
        whooshGain,
        lfo,
      ];
    }

    this.startBirdScheduler();
  }

  private startBirdScheduler(): void {
    if (this.birdTimerId !== null || typeof window === 'undefined') return;

    const scheduleNextChirp = () => {
      const delayMs = 1800 + Math.random() * 2600;
      this.birdTimerId = window.setTimeout(() => {
        this.birdTimerId = null;
        if (!this.isMuted) {
          this.playBirdChirpCluster();
          scheduleNextChirp();
        }
      }, delayMs);
    };

    // Play an initial gentle bird chirp shortly after unmuting
    this.birdTimerId = window.setTimeout(() => {
      this.birdTimerId = null;
      if (!this.isMuted) {
        this.playBirdChirpCluster();
        scheduleNextChirp();
      }
    }, 600);
  }

  private stopBirdScheduler(): void {
    if (this.birdTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.birdTimerId);
      this.birdTimerId = null;
    }
  }

  /**
   * Synthesizes a natural 2-to-4 syllable melodic bird tweet in the urban park trees / sky
   */
  private playBirdChirpCluster(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.ambientGain) return;

    const syllables = 2 + Math.floor(Math.random() * 3);
    const basePitch = 2500 + Math.random() * 1100;
    const now = ctx.currentTime;

    for (let i = 0; i < syllables; i++) {
      const start = now + i * (0.095 + Math.random() * 0.045);
      const duration = 0.065 + Math.random() * 0.035;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const f1 = basePitch + (i % 2 === 0 ? 0 : 320);
      const f2 = f1 + 650 + Math.random() * 450;
      const f3 = f1 + 180;

      osc.frequency.setValueAtTime(f1, start);
      osc.frequency.exponentialRampToValueAtTime(f2, start + duration * 0.55);
      osc.frequency.exponentialRampToValueAtTime(f3, start + duration);

      gain.gain.setValueAtTime(0.0005, start);
      gain.gain.linearRampToValueAtTime(0.042, start + duration * 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);

      osc.connect(gain);
      gain.connect(this.ambientGain);

      osc.start(start);
      osc.stop(start + duration + 0.01);
    }
  }

  /**
   * Mechanical Tower Crane Slewing Motor & Trolley Roll (Step A & Step D)
   */
  public playCraneSlew(durationSec = 0.34): void {
    this.ensureAmbientStarted();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const motorOsc = ctx.createOscillator();
    const gearOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    motorOsc.type = 'sawtooth';
    gearOsc.type = 'triangle';

    motorOsc.frequency.setValueAtTime(92, now);
    motorOsc.frequency.linearRampToValueAtTime(128, now + durationSec * 0.35);
    motorOsc.frequency.linearRampToValueAtTime(104, now + durationSec);

    gearOsc.frequency.setValueAtTime(184, now);
    gearOsc.frequency.linearRampToValueAtTime(256, now + durationSec * 0.35);
    gearOsc.frequency.linearRampToValueAtTime(208, now + durationSec);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.04);
    gain.gain.setValueAtTime(0.065, now + Math.max(0.05, durationSec - 0.06));
    gain.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    motorOsc.connect(filter);
    gearOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    motorOsc.start(now);
    gearOsc.start(now);
    motorOsc.stop(now + durationSec + 0.02);
    gearOsc.stop(now + durationSec + 0.02);
  }

  /**
   * Mechanical Tower Crane Hoist Cable Winch (Step B lowering & Step C lifting)
   */
  public playCraneWinch(direction: 'down' | 'up', durationSec = 0.28): void {
    this.ensureAmbientStarted();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const winchOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    winchOsc.type = 'triangle';
    const startFreq = direction === 'up' ? 145 : 235;
    const endFreq = direction === 'up' ? 255 : 150;

    winchOsc.frequency.setValueAtTime(startFreq, now);
    winchOsc.frequency.exponentialRampToValueAtTime(endFreq, now + durationSec);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, now);
    filter.Q.value = 1.8;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    winchOsc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    winchOsc.start(now);
    winchOsc.stop(now + durationSec + 0.02);

    // Subtle mechanical cable drum ratchet clicks
    const clicks = 4;
    for (let i = 0; i < clicks; i++) {
      const clickTime = now + (i * durationSec) / clicks;
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'square';
      clickOsc.frequency.setValueAtTime(direction === 'up' ? 680 + i * 45 : 620 - i * 35, clickTime);
      clickGain.gain.setValueAtTime(0.022, clickTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0005, clickTime + 0.022);
      clickOsc.connect(clickGain);
      clickGain.connect(this.sfxGain);
      clickOsc.start(clickTime);
      clickOsc.stop(clickTime + 0.025);
    }
  }

  /**
   * Heavy Structural Block Landing Thud & Grapple Unlatch (Step E)
   */
  public playCraneDropThud(): void {
    this.ensureAmbientStarted();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;

    // 1. Deep structural concrete/steel impact thud
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(98, now);
    subOsc.frequency.exponentialRampToValueAtTime(34, now + 0.22);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.22, now + 0.012);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(now);
    subOsc.stop(now + 0.25);

    // 2. Metallic grapple hook unlatch clank
    const clankOsc = ctx.createOscillator();
    const clankGain = ctx.createGain();
    clankOsc.type = 'triangle';
    clankOsc.frequency.setValueAtTime(540, now + 0.03);
    clankOsc.frequency.exponentialRampToValueAtTime(290, now + 0.11);

    clankGain.gain.setValueAtTime(0.001, now + 0.03);
    clankGain.gain.linearRampToValueAtTime(0.075, now + 0.04);
    clankGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.12);

    clankOsc.connect(clankGain);
    clankGain.connect(this.sfxGain);
    clankOsc.start(now + 0.03);
    clankOsc.stop(now + 0.13);
  }

  public playToggle(
    isVisibleNow: boolean,
    coords: [number, number, number]
  ): void {
    this.ensureAmbientStarted();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();

    const coordOffset =
      (coords[0] + 1) * 35 + (coords[1] + 1) * 70 + (coords[2] + 1) * 20;
    const baseFreq = isVisibleNow ? 520 + coordOffset : 420 + coordOffset;

    osc.type = 'sine';
    harmonic.type = 'triangle';

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(
      isVisibleNow ? baseFreq * 1.25 : baseFreq * 0.78,
      now + 0.14
    );

    harmonic.frequency.setValueAtTime(baseFreq * 2.0, now);
    harmonic.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);

    osc.connect(gain);
    harmonic.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    harmonic.start(now);
    osc.stop(now + 0.17);
    harmonic.stop(now + 0.17);
  }

  public playHover(): void {
    this.ensureAmbientStarted();
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx || !this.sfxGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.035);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.025, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playPuzzleSolved(): void {
    this.ensureAmbientStarted();
    if (this.isMuted) return;
    const ctx = this.getContext();
    const sfxGain = this.sfxGain;
    if (!ctx || !sfxGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);

      osc.connect(gain);
      gain.connect(sfxGain);

      osc.start(now);
      osc.stop(now + 0.46);
    });
  }
}

export const soundFX = new CityAudioManager();
