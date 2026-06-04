/**
 * WinScreen.jsx — Victory overlay with confetti celebration
 *
 * Shows when a player wins. Displays the winner's color
 * with a neon glow, trophy animation, and canvas-confetti burst.
 */

import React, { useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { PLAYER_COLORS } from '../utils/gameLogic';

export default function WinScreen() {
  const { gameState, players, resetGame, peerId } = useGame();
  const confettiDone = useRef(false);

  const winner = gameState?.winner;
  const winnerColor = winner !== null && winner !== undefined ? PLAYER_COLORS[winner] : null;
  const winnerPlayer = winner !== null && winner !== undefined ? players[winner] : null;
  const amWinner = winnerPlayer?.id === peerId;

  // Fire confetti on mount
  useEffect(() => {
    if (!winner || confettiDone.current) return;

    confettiDone.current = true;

    // Dynamically import canvas-confetti
    import('canvas-confetti').then((mod) => {
      const confetti = mod.default || mod;

      // Fire multiple bursts
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 4,
          angle: 60 + Math.random() * 60,
          spread: 60 + Math.random() * 40,
          origin: { x: Math.random(), y: Math.random() * 0.6 },
          colors: winnerColor ? [winnerColor.hex, '#ffffff', '#8888ff'] : ['#ffd700', '#ffffff'],
          startVelocity: 20 + Math.random() * 20,
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      frame();

      // Big burst at start
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        colors: winnerColor ? [winnerColor.hex, '#ffffff', '#8888ff'] : ['#ffd700', '#ffffff'],
      });
    });
  }, [winner, winnerColor]);

  if (!gameState?.gameOver || winner === null || winner === undefined) return null;

  return (
    <div className="win-overlay">
      <div className="win-card clay-card">
        <div className="win-trophy">🏆</div>
        <h1 style={{ color: winnerColor?.hex || '#ffd700' }}>
          {amWinner ? 'You Win!' : `${winnerColor?.name || 'Player'} Wins!`}
        </h1>
        <p>
          {amWinner
            ? 'Congratulations! You conquered the board!'
            : `${winnerColor?.name || 'Player'} has taken the crown!`}
        </p>
        <button className="btn btn-primary" onClick={resetGame}>
          Play Again
        </button>
      </div>
    </div>
  );
}
