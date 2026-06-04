/**
 * SoundToggle.jsx — Floating button to mute/unmute game sounds
 *
 * Reads from and writes to GameContext.soundEnabled.
 * State persists to localStorage.
 */

import React from 'react';
import { useGame } from '../context/GameContext';

export default function SoundToggle() {
  const { soundEnabled, toggleSound } = useGame();

  return (
    <button
      className={`sound-toggle ${soundEnabled ? '' : 'muted'}`}
      onClick={toggleSound}
      title={soundEnabled ? 'Mute sounds (M)' : 'Unmute sounds (M)'}
      aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
    >
      {soundEnabled ? '🔊' : '🔇'}
    </button>
  );
}
