import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

function hashToSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function AudioWaveform({
  seed,
  bars = 44,
  className,
  height = 44,
}: {
  seed: string;
  bars?: number;
  height?: number;
  className?: string;
}) {
  const amplitudes = useMemo(() => {
    const s = hashToSeed(seed);
    const rnd = mulberry32(s);
    const a: number[] = [];

    for (let i = 0; i < bars; i++) {
      // Create a smooth-ish shape (deterministic, no audio decoding)
      const base = 0.15 + rnd() * 0.85;
      const wave = 0.45 + 0.55 * Math.sin((i / bars) * Math.PI * 2);
      const v = Math.min(1, Math.max(0.08, base * wave));
      a.push(v);
    }

    // Add a slightly stronger "center" to feel like speech
    const center = Math.floor(bars / 2);
    for (let i = 0; i < bars; i++) {
      const dist = Math.abs(i - center) / (bars / 2);
      const boost = 1 - Math.min(1, dist);
      a[i] = Math.min(1, a[i] * (0.7 + 0.6 * boost));
    }

    return a;
  }, [seed, bars]);

  return (
    <div
      className={cn(
        'flex items-center gap-[2px] rounded-xl bg-white/60 dark:bg-gray-900/40 border border-slate-200/70 dark:border-white/10 px-3',
        className
      )}
      style={{ height }}
      aria-hidden="true"
    >
      {amplitudes.map((v, idx) => (
        <div
          key={idx}
          className="w-[3px] rounded-full bg-gradient-to-b from-emerald-400/90 via-emerald-300/70 to-emerald-500/40 dark:from-emerald-400/70 dark:via-emerald-300/50 dark:to-emerald-500/30"
          style={{ height: `${Math.max(8, Math.round(v * (height - 14)))}px` }}
        />
      ))}
    </div>
  );
}






