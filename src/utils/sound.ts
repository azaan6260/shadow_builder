// Zero-dependency Web Audio API synthesizer for tactile glass puzzle feedback

class SoundEffects {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playToggle(isVisibleNow: boolean, coords: [number, number, number]): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harmonic = ctx.createOscillator();
    const gain = ctx.createGain();

    // Pitch varies subtly by spatial coordinate so each cube has a crystalline acoustic signature
    const coordOffset = (coords[0] + 1) * 35 + (coords[1] + 1) * 70 + (coords[2] + 1) * 20;
    const baseFreq = isVisibleNow ? 520 + coordOffset : 420 + coordOffset;

    osc.type = 'sine';
    harmonic.type = 'triangle';

    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(isVisibleNow ? baseFreq * 1.25 : baseFreq * 0.78, now + 0.14);

    harmonic.frequency.setValueAtTime(baseFreq * 2.0, now);
    harmonic.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.16);

    osc.connect(gain);
    harmonic.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    harmonic.start(now);
    osc.stop(now + 0.17);
    harmonic.stop(now + 0.17);
  }

  public playHover(): void {
    const ctx = this.getContext();
    if (!ctx) return;

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
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playPuzzleSolved(): void {
    const ctx = this.getContext();
    if (!ctx) return;

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
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.46);
    });
  }
}

export const soundFX = new SoundEffects();
