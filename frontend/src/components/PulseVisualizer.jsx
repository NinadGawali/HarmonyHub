import React, { useMemo } from 'react';

const PATTERNS = {
  calm: [0.35, 0.55, 0.42, 0.68, 0.5, 0.32, 0.6, 0.44],
  wave: [0.4, 0.7, 0.52, 0.86, 0.58, 0.8, 0.48, 0.72],
  pulse: [0.55, 0.42, 0.78, 0.62, 0.9, 0.66, 0.48, 0.74],
  burst: [0.3, 0.88, 0.42, 0.94, 0.36, 0.82, 0.5, 0.96],
};

function hashString(value = '') {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export default function PulseVisualizer({ seed = '', variant = 'wave', bars = 8, active = true }) {
  const levels = useMemo(() => {
    const basePattern = PATTERNS[variant] || PATTERNS.wave;
    const shift = seed ? hashString(seed) % basePattern.length : 0;

    return Array.from({ length: bars }).map((_, index) => {
      const base = basePattern[(index + shift) % basePattern.length];
      const wobble = ((hashString(`${seed}-${index}`) % 19) - 9) / 100;
      return Math.max(0.18, Math.min(1, base + wobble));
    });
  }, [bars, seed, variant]);

  return (
    <div className={`pulse-visualizer pulse-visualizer-${variant} ${active ? 'is-active' : ''}`} aria-hidden="true">
      {levels.map((level, index) => (
        <span
          key={`${seed}-${index}`}
          className="pulse-bar"
          style={{
            '--pulse-height': `${Math.round(level * 100)}%`,
            '--pulse-delay': `${index * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
