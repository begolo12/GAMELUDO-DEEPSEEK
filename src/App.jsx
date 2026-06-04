/**
 * App.jsx — Root component
 *
 * Manages screen navigation:
 *   'lobby' → Host / Join screen
 *   'game'  → Game board with dice, chat, tokens
 *
 * Wraps everything in GameProvider for global state.
 */

import React from 'react';
import { GameProvider, useGame } from './context/GameContext';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import AmbientParticles from './components/AmbientParticles';
import Toast from './components/Toast';
import SoundToggle from './components/SoundToggle';

function AppContent() {
  const { screen } = useGame();

  return (
    <>
      <AmbientParticles count={15} />
      <Toast />
      <SoundToggle />
      {screen === 'lobby' && <Lobby />}
      {screen === 'game' && <GameBoard />}
    </>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
}
