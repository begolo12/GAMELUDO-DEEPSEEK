/**
 * Token.jsx — A single Ludo token on the board
 *
 * Renders a colored circle at the given grid position.
 * Supports:
 *   - Pulse/glow animation when it's the player's turn
 *   - Click-to-move affordance with hover preview
 *   - Stack visualization when multiple tokens share a cell
 *   - Shake animation on invalid click
 *   - Per-step movement animation via class toggle
 *   - Auto-move ring when bot is the only movable option
 */

import React, { useEffect, useState } from 'react';

export default function Token({
  playerIndex,
  tokenIndex,
  isActive,
  isClickable,
  isInBase,
  isHome,
  stackIndex = 0,
  stackCount = 1,
  invalidShakeKey = null,
  isAutoMove = false,
  isAnimating = false,
  onClick,
  onHover,
  onUnhover,
}) {
  const colorClass = ['token-red', 'token-green', 'token-yellow', 'token-blue'][playerIndex] || 'token-red';
  const [isShaking, setIsShaking] = useState(false);

  // Trigger shake animation when invalidShakeKey changes
  useEffect(() => {
    if (invalidShakeKey) {
      setIsShaking(true);
      const t = setTimeout(() => setIsShaking(false), 450);
      return () => clearTimeout(t);
    }
  }, [invalidShakeKey]);

  const classNames = [
    'token',
    colorClass,
    isActive ? 'token-active' : '',
    isClickable ? 'token-clickable' : '',
    isInBase ? 'token-in-base' : '',
    isHome ? 'token-home' : '',
    isAnimating ? 'token-animating' : '',
    isShaking ? 'token-shake' : '',
    isAutoMove ? 'token-auto-move' : '',
    `token-stack-${stackIndex}`,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      onClick={isClickable ? onClick : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onUnhover}
      onTouchStart={onHover}
      role="button"
      tabIndex={isClickable ? 0 : -1}
      aria-disabled={!isClickable}
      aria-label={`Player ${playerIndex + 1} token ${tokenIndex + 1}${isClickable ? ', movable' : ''}`}
      onKeyDown={(e) => {
        if (!isClickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      title={`Player ${playerIndex + 1} — Token ${tokenIndex + 1}`}
      style={{
        cursor: isClickable ? 'pointer' : 'default',
        // Slight random offset for tokens in base (overridden by stack class if both apply)
        ...(isInBase && stackCount === 1 ? {
          transform: `translate(${(tokenIndex % 2) * 20 - 10}%, ${Math.floor(tokenIndex / 2) * 20 - 10}%)`,
        } : {}),
      }}
    >
      {tokenIndex + 1}
      {stackCount > 1 && (
        <span className="token-stack-count">{stackCount}</span>
      )}
    </div>
  );
}
