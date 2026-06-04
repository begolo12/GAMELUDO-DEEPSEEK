/**
 * Lobby.jsx — Host / Join screen with glassmorphism
 *
 * Two cards side-by-side:
 * 1. Host: Create a new room → shows room code
 * 2. Join: Enter a 5-digit code to join
 *
 * Once connected, shows player list and a Start button (host only).
 * Includes a simple chat before the game starts.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { playClick, playNotification } from '../utils/sound';

// ── Player colour dots ──
const COLOR_DOTS = ['#ef476f', '#3dce8a', '#ffd166', '#4d9de0'];

export default function Lobby() {
  const {
    playerName, setPlayerName,
    hostRoom, joinRoom,
    roomCode, isHost, connected,
    playerCount, loading, error,
    messages, sendChat,
    startGame,
    players, allPeers, peerId,
    botCount, setBotCount,
    effectivePlayerCount, botThinking,
  } = useGame();

  const [joinCode, setJoinCode] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState('');

  // Sync name input
  useEffect(() => {
    if (nameInput || playerName) {
      setNameInput(playerName || '');
    }
  }, [playerName]);

  const handleHost = useCallback(async () => {
    const name = nameInput.trim() || 'Host';
    setPlayerName(name);
    setLocalError('');
    try {
      await hostRoom(name);
      playClick();
    } catch (err) {
      setLocalError(err.message || 'Failed to create room');
    }
  }, [nameInput, setPlayerName, hostRoom]);

  const handleJoin = useCallback(async () => {
    const code = joinCode.trim();
    if (code.length !== 5 || !/^\d{5}$/.test(code)) {
      setLocalError('Room code must be exactly 5 digits');
      return;
    }
    const name = nameInput.trim() || 'Player';
    setPlayerName(name);
    setLocalError('');
    try {
      await joinRoom(code, name);
      playClick();
    } catch (err) {
      setLocalError(err.message || 'Failed to join room');
    }
  }, [joinCode, nameInput, setPlayerName, joinRoom]);

  const handleCopyCode = useCallback(() => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [roomCode]);

  const handleStart = useCallback(() => {
    if (effectivePlayerCount < 2) {
      setLocalError('Need at least 2 players to start');
      return;
    }
    startGame();
    playClick();
  }, [effectivePlayerCount, startGame]);

  // Chat input for lobby
  const [chatInput, setChatInput] = useState('');
  const handleChat = useCallback((e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim());
    setChatInput('');
  }, [chatInput, sendChat]);

  return (
    <div className="lobby-container">
      {/* Hero Title */}
      <div className="lobby-title">🎲 LUDO</div>
      <p className="lobby-subtitle">Multiplayer — Peer-to-Peer</p>
      <div className="lobby-tagline">Roll · Race · Conquer</div>

      {/* Error message */}
      {(error || localError) && (
        <div style={{
          background: 'rgba(255, 51, 85, 0.15)',
          border: '1px solid rgba(255, 51, 85, 0.3)',
          color: '#ff6688',
          padding: '10px 20px',
          borderRadius: 8,
          fontSize: '0.9rem',
          maxWidth: 500,
          textAlign: 'center',
        }}>
          ⚠ {error || localError}
        </div>
      )}

      {/* If not connected: show Host & Join cards */}
      {!connected && (
        <>
          {/* Player Name Input */}
          <div style={{ width: '100%', maxWidth: 380 }}>
            <input
              className="input"
              placeholder="Enter your name..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={20}
              style={{ textAlign: 'center', fontSize: '1.1rem' }}
            />
          </div>

          <div className="lobby-cards">
            {/* HOST CARD */}
            <div className="lobby-card clay-card">
              <h2>🎪 Host Game</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                Create a room and invite friends
              </p>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleHost}
                disabled={loading}
              >
                {loading ? 'Creating...' : '🎯 Create Room'}
              </button>
            </div>

            {/* JOIN CARD */}
            <div className="lobby-card clay-card">
              <h2>🔗 Join Game</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                Enter the 5-digit room code
              </p>
              <div className="input-group">
                <input
                  className="input"
                  placeholder="0 0 0 0 0"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  maxLength={5}
                  style={{ textAlign: 'center', fontSize: '1.5rem', fontFamily: 'var(--font-display)', letterSpacing: '8px' }}
                />
                <button
                  className="btn btn-success"
                  style={{ width: '100%' }}
                  onClick={handleJoin}
                  disabled={loading || joinCode.length !== 5}
                >
                  {loading ? 'Connecting...' : '🚀 Join'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Connected: show room info & player list */}
      {connected && (
        <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Room Code Display */}
          {isHost && (
            <div className="clay-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                📍 Room Code
              </div>
              <div className="room-code-display">{roomCode}</div>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12, fontSize: '0.85rem' }}
                onClick={handleCopyCode}
              >
                {copied ? '✅ Copied!' : '📋 Copy Code'}
              </button>
            </div>
          )}

          {!isHost && (
            <div className="clay-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                📍 Connected to Room
              </div>
              <div className="room-code-display" style={{ fontSize: '1.5rem', letterSpacing: 4 }}>{roomCode}</div>
            </div>
          )}

          {/* Player List */}
          <div className="clay-card">
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', marginBottom: 12 }}>
              👥 Players ({players.length}/4)
            </h2>
            <div className="player-list">
              {players.map((p, i) => (
                <div key={p.id} className="player-item">
                  <div className="color-dot" style={{ background: COLOR_DOTS[i % 4] }} />
                  <span className="player-name">
                    {p.name}
                    {p.id === peerId ? ' (You)' : ''}
                  </span>
                  {p.isBot && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>🤖 BOT</span>}
                  {i === 0 && !p.isBot && <span className="host-badge">HOST</span>}
                </div>
              ))}
              {/* Empty slots */}
              {Array.from({ length: 4 - players.length }, (_, i) => (
                <div key={`empty-${i}`} className="player-item" style={{ opacity: 0.3 }}>
                  <div className="color-dot" style={{ background: '#333' }} />
                  <span className="player-name" style={{ fontStyle: 'italic' }}>Empty slot</span>
                </div>
              ))}
            </div>

            {/* ── Bot Count Controller (host only) ── */}
            {isHost && connected && (
              <div className="bot-controller">
                <span className="bot-controller-label">🤖 Bot Players</span>
                <div className="bot-controller-buttons">
                  <button
                    className="bot-btn"
                    onClick={() => setBotCount(botCount - 1)}
                    disabled={botCount <= 0}
                    aria-label="Remove bot"
                  >
                    −
                  </button>
                  <span className="bot-count-value">{botCount}</span>
                  <button
                    className="bot-btn"
                    onClick={() => setBotCount(botCount + 1)}
                    disabled={botCount >= 3 || players.length >= 4}
                    aria-label="Add bot"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Start button — host only */}
            {isHost && (
              <button
                className="btn btn-success"
                style={{ width: '100%', marginTop: 12 }}
                onClick={handleStart}
                disabled={effectivePlayerCount < 2}
              >
                {effectivePlayerCount < 2
                  ? 'Need more players...'
                  : `🎮 Start Game (${effectivePlayerCount} players)`}
              </button>
            )}

            {!isHost && (
              <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Waiting for host to start...
              </div>
            )}
          </div>

          {/* Lobby Chat */}
          <div className="clay-card" style={{ padding: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
              💬 Lobby Chat
            </div>
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 8,
              padding: 10,
              height: 120,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              marginBottom: 8,
              border: '1px solid var(--glass-border)',
            }}>
              {messages.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  No messages yet
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} style={{ fontSize: '0.85rem', lineHeight: 1.3 }}>
                  {msg.system ? (
                    <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{msg.text}</span>
                  ) : (
                    <>
                      <strong style={{ color: 'var(--color-blue)' }}>{msg.senderName}:</strong>{' '}
                      {msg.text}
                    </>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleChat} style={{ display: 'flex', gap: 6 }}>
              <input
                className="input"
                placeholder="Say hi..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                maxLength={200}
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
