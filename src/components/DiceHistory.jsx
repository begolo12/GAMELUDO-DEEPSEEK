/**
 * DiceHistory.jsx — Strip showing the last 5 dice rolls
 *
 * Displayed in the right panel alongside the dice.
 * Highlights sixes with a yellow color.
 */

import React from 'react';

export default function DiceHistory({ history = [] }) {
  const slots = [4, 3, 2, 1, 0]; // newest on left
  const items = slots.map(i => history[history.length - 1 - i] ?? null);

  return (
    <div className="dice-history" title="Last 5 dice rolls">
      <div className="dice-history-title">🎲 History</div>
      <div className="dice-history-list">
        {items.map((val, idx) => (
          <div
            key={idx}
            className={`dice-history-item ${val === null ? 'empty' : val === 6 ? 'six' : ''}`}
          >
            {val === null ? '·' : val}
          </div>
        ))}
      </div>
    </div>
  );
}
