/**
 * AmbientParticles.jsx — Floating background particles
 *
 * Renders small colored dots that float gently in the background
 * for a premium atmospheric effect.
 */

import React, { useMemo } from 'react';

const COLORS = ['#6644ff', '#3388ff', '#33ff77', '#ff3355', '#ffdd33'];

export default function AmbientParticles({ count = 12 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${2 + Math.random() * 4}px`,
      color: COLORS[i % COLORS.length],
      duration: `${6 + Math.random() * 10}s`,
      delay: `${Math.random() * 8}s`,
      opacity: 0.1 + Math.random() * 0.2,
      opacity2: 0.2 + Math.random() * 0.3,
    }));
  }, [count]);

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="ambient-particle"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${parseInt(p.size) * 2}px ${p.color}`,
            '--duration': p.duration,
            '--delay': p.delay,
            '--opacity': p.opacity,
            '--opacity2': p.opacity2,
          }}
        />
      ))}
    </div>
  );
}
