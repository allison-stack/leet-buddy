export async function playTimerPing(): Promise<void> {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state === 'suspended') {
      try { await ctx.resume(); } catch { /* ignore */ }
    }

    const peakGain = 0.18;
    const tones: Array<{ freq: number; offset: number; dur: number }> = [
      { freq: 880, offset: 0, dur: 0.12 },
      { freq: 1318.5, offset: 0.10, dur: 0.18 },
    ];

    const t0 = ctx.currentTime;
    let maxRelEnd = 0;
    for (const t of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = t.freq;
      const start = t0 + t.offset;
      const end = start + t.dur;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peakGain, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end);
      if (t.offset + t.dur > maxRelEnd) maxRelEnd = t.offset + t.dur;
    }

    setTimeout(() => { void ctx.close(); }, maxRelEnd * 1000 + 200);
  } catch {
    /* ignore audio failures */
  }
}
