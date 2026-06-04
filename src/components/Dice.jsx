/**
 * Dice.jsx — Animated dice with 2D pip faces + spin settle
 *
 * Uses a simpler but more reliable approach than 3D CSS cube:
 * - Shows a single SVG face with pip patterns
 * - On roll: rapid cycling through random faces + 3D spin animation
 * - On settle: lands on the result with bounce
 * - Pure CSS transitions (no 3D transform bugs)
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { playClick } from '../utils/sound';

// ── Pip layouts: [row, col] 0-indexed in a 3x3 grid ──
const PIPS = {
  1: [[1, 1]],
  2: [[0, 2], [2, 0]],
  3: [[0, 2], [1, 1], [2, 0]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function PipFace({ value, size = 60 }) {
  const dots = PIPS[value] || [];
  const dotSize = Math.max(6, size * 0.12);
  const half = size / 2;
  const pad = size * 0.07;
  const cellSize = (size - pad * 2) / 3;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <linearGradient id="diceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#3a3a5a" />
          <stop offset="100%" stopColor="#1a1a3a" />
        </linearGradient>
        <filter id="pipGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="white" floodOpacity="0.4" />
        </filter>
      </defs>
      {/* Dice body */}
      <rect x="2" y="2" width={size - 4} height={size - 4} rx="10" ry="10"
        fill="url(#diceGrad)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
      {/* Inner glow */}
      <rect x="5" y="5" width={size - 10} height={size - 10} rx="8" ry="8"
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      {/* Pips */}
      {dots.map(([r, c]) => (
        <circle key={`${r}-${c}`}
          cx={pad + c * cellSize + cellSize / 2}
          cy={pad + r * cellSize + cellSize / 2}
          r={dotSize}
          fill="white"
          filter="url(#pipGlow)"
        />
      ))}
    </svg>
  );
}

export default function Dice() {
  const { gameState, rollDice: rollAction, players, peerId, botThinking } = useGame();
  const [animating, setAnimating] = useState(false);
  const [displayFace, setDisplayFace] = useState(1);
  const animRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const currentPlayer = gameState?.currentPlayer ?? 0;
  const currentPlayerInfo = players[currentPlayer];
  const currentPlayerId = currentPlayerInfo?.id;
  const isBotTurn = currentPlayerInfo?.isBot || false;
  const isMyTurn = currentPlayerId === peerId && !isBotTurn && gameState?.turnPhase === 'roll' && !botThinking;
  const realValue = gameState?.diceValue;

  // Sync display face with real value (when not animating)
  useEffect(() => {
    if (!animating && realValue && realValue >= 1 && realValue <= 6) {
      setDisplayFace(realValue);
    }
  }, [realValue, animating]);

  const handleRoll = useCallback(() => {
    if (!isMyTurn || animating) return;
    if (gameState?.turnPhase !== 'roll') return;

    playClick();
    setAnimating(true);

    // Rapidly cycle through faces for visual effect
    let cycleCount = 0;
    const MAX_CYCLES = 10;
    animRef.current = setInterval(() => {
      if (!mountedRef.current) { clearInterval(animRef.current); return; }
      setDisplayFace(Math.floor(Math.random() * 6) + 1);
      cycleCount++;
      if (cycleCount >= MAX_CYCLES) {
        clearInterval(animRef.current);
        animRef.current = null;
        // Execute the actual roll — this dispatches new state
        rollAction();
        setAnimating(false);
      }
    }, 60);
  }, [isMyTurn, animating, gameState, rollAction]);

  return (
    <div className="dice-container clay-card" style={{ padding: '16px' }}>
      <div className="dice-label">🎲 Roll Dice</div>

      <div
        className={`dice-wrapper ${animating ? 'dice-animating' : ''} ${isMyTurn ? 'dice-ready' : ''}`}
        onClick={handleRoll}
        title={isMyTurn ? 'Click to roll!' : 'Wait for your turn'}
      >
        <div className="dice-inner">
          <PipFace value={displayFace} size={60} />
        </div>
      </div>

      {/* Result text */}
      {realValue && !animating && (
        <div className="dice-result" style={{
          color: `var(--color-${['red','green','yellow','blue'][currentPlayer]})`,
          animation: 'fade-in 0.3s ease',
          fontWeight: 700,
        }}>
          🎯 {realValue} {isBotTurn ? '(auto)' : ''}
        </div>
      )}

      {/* Turn hints */}
      {!botThinking && isMyTurn && gameState?.turnPhase === 'roll' && (
        <div className="dice-click-hint" style={{
          animation: 'turn-pulse 1.5s ease-in-out infinite',
          color: 'var(--color-blue)',
          fontWeight: 600,
        }}>
          👆 Tap to roll
        </div>
      )}

      {isBotTurn && gameState?.turnPhase === 'roll' && (
        <div className="dice-click-hint" style={{ color: 'var(--color-yellow)' }}>
          🤖 Bot is thinking...
        </div>
      )}

      {!isMyTurn && !isBotTurn && gameState?.turnPhase === 'roll' && (
        <div className="dice-click-hint" style={{ color: 'var(--text-muted)' }}>
          Waiting for {players[currentPlayer]?.name || 'opponent'}...
        </div>
      )}

      {gameState?.turnPhase === 'move' && !animating && (
        <div className="dice-click-hint" style={{
          color: isMyTurn ? 'var(--color-green)' : 'var(--text-muted)',
          fontWeight: isMyTurn ? 600 : 400,
        }}>
          {isMyTurn ? '👆 Select a token to move' : `Waiting for ${players[currentPlayer]?.name || 'opponent'}...`}
        </div>
      )}
    </div>
  );
}
