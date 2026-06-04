/**
 * Toast.jsx — Top-center notification system
 *
 * Displays a queue of toasts that auto-dismiss.
 * Types: info, success, warning, error, capture, win
 *
 * Uses CSS animations for slide-in/slide-out.
 */

import React from 'react';
import { useGame } from '../context/GameContext';

const ICONS = {
  info: 'ℹ️',
  success: '✓',
  warning: '⚠',
  error: '✕',
  capture: '⚔️',
  win: '🏆',
  dice: '🎲',
  home: '🏠',
};

export default function Toast() {
  const { toasts } = useGame();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type || 'info'}`}
          role="status"
          aria-live="polite"
        >
          {t.icon !== false && (
            <span className="toast-icon">{t.icon || ICONS[t.type] || ICONS.info}</span>
          )}
          <span className="toast-message">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
