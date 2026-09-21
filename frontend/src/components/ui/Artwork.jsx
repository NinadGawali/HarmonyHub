import React, { useState } from 'react';
import { Music2 } from 'lucide-react';
import styles from './Artwork.module.css';

// Hue derived from text, so tracks without cover art still get a stable, distinct tile.
const hueFor = (text = '') => [...text].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) % 360, 17);

export default function Artwork({ src, alt = '', seed = '', size = 48, radius = 'md', className = '' }) {
  // Remember which src failed, so a new src gets a fresh attempt.
  const [failedSrc, setFailedSrc] = useState(null);
  const failed = failedSrc !== null && failedSrc === src;
  const dimensions = { width: size, height: size };

  if (!src || failed) {
    const hue = hueFor(seed);
    return (
      <span
        className={`${styles.art} ${styles[radius]} ${styles.fallback} ${className}`}
        style={{
          ...dimensions,
          background: `linear-gradient(135deg, hsl(${hue} 70% 42%), hsl(${(hue + 60) % 360} 70% 28%))`
        }}
        aria-hidden="true"
      >
        <Music2 size={Math.max(14, Math.round(size * 0.38))} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={`${styles.art} ${styles[radius]} ${className}`}
      style={dimensions}
      onError={() => setFailedSrc(src)}
    />
  );
}

// 2x2 mosaic of the first four covers, or a single cover when there are fewer.
export function ArtworkMosaic({ tracks = [], seed = '', size = 160 }) {
  const covers = [...new Set(tracks.map((track) => track.image).filter(Boolean))].slice(0, 4);

  if (covers.length < 4) {
    return <Artwork src={covers[0]} seed={seed} size={size} radius="lg" />;
  }

  return (
    <span className={`${styles.mosaic} ${styles.lg}`} style={{ width: size, height: size }} aria-hidden="true">
      {covers.map((cover) => <img key={cover} src={cover} alt="" loading="lazy" />)}
    </span>
  );
}
