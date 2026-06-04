/**
 * CaptureOverlay.jsx — RPG-style capture explosion & home arrival effects
 *
 * Shows an animated burst when a token captures an opponent,
 * and a glowing aura when a token reaches home.
 */

import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';

const COLOR_HEX = {
  red: '#ef476f',
  green: '#3dce8a',
  yellow: '#ffd166',
  blue: '#4d9de0',
};

export default function CaptureOverlay() {
  const { captureEvent, homeEvent, gameState } = useGame();
  const [showCapture, setShowCapture] = useState(null);
  const [showHome, setShowHome] = useState(null);

  useEffect(() => {
    if (captureEvent) {
      setShowCapture({ ...captureEvent, key: Date.now() });
      const t = setTimeout(() => setShowCapture(null), 1200);
      return () => clearTimeout(t);
    }
  }, [captureEvent]);

  useEffect(() => {
    if (homeEvent) {
      setShowHome({ ...homeEvent, key: Date.now() });
      const t = setTimeout(() => setShowHome(null), 1000);
      return () => clearTimeout(t);
    }
  }, [homeEvent]);

  // Calculate pixel position from grid coords
  const getPixelPos = (row, col) => {
    if (!gameState) return { x: 0, y: 0 };
    const boardEl = document.querySelector('.board-grid');
    if (!boardEl) return { x: 50, y: 50 };
    const rect = boardEl.getBoundingClientRect();
    const cellW = rect.width / 15;
    const cellH = rect.height / 15;
    return {
      x: rect.left + col * cellW + cellW / 2,
      y: rect.top + row * cellH + cellH / 2,
    };
  };

  if (!showCapture && !showHome) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 500 }}>
      {/* ── CAPTURE EXPLOSION ── */}
      {showCapture && (() => {
        const pos = getPixelPos(showCapture.row, showCapture.col);
        const atkColor = COLOR_HEX[showCapture.attackerColor] || '#fff';
        const capColor = COLOR_HEX[showCapture.capturedColor] || '#fff';
        return (
          <div key={showCapture.key} style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -50%)',
          }}>
            {/* Ring burst */}
            <div className="capture-ring" style={{
              '--atk-color': atkColor,
              '--cap-color': capColor,
            }} />
            {/* Inner ring */}
            <div className="capture-ring-inner" style={{
              '--atk-color': atkColor,
            }} />
            {/* Sparks */}
            {[...Array(12)].map((_, i) => (
              <div key={i} className="capture-spark" style={{
                '--angle': `${i * 30}deg`,
                '--color': i % 3 === 0 ? capColor : atkColor,
                animationDelay: `${i * 0.03}s`,
              }} />
            ))}
            {/* Flash */}
            <div className="capture-flash" />
            {/* Shockwave */}
            <div className="capture-shockwave" style={{
              '--atk-color': atkColor,
            }} />
            {/* Impact text */}
            <div className="capture-text" style={{ color: atkColor }}>
              ⚡ CAPTURE!
            </div>
          </div>
        );
      })()}

      {/* ── HOME ARRIVAL AURA ── */}
      {showHome && (() => {
        const pos = getPixelPos(showHome.row, showHome.col);
        const hColor = COLOR_HEX[showHome.color] || '#fff';
        return (
          <div key={showHome.key} style={{
            position: 'fixed',
            left: pos.x,
            top: pos.y,
            transform: 'translate(-50%, -50%)',
          }}>
            <div className="home-aura" style={{ '--h-color': hColor }} />
            <div className="home-aura-inner" style={{ '--h-color': hColor }} />
            <div className="home-text" style={{ color: hColor }}>
              🏠 HOME!
            </div>
          </div>
        );
      })()}
    </div>
  );
}
