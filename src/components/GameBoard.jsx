/**
 * GameBoard.jsx — The 15×15 Ludo board with tokens, paths, and controls
 *
 * Renders:
 * - The CSS Grid board with colored cells
 * - Tokens positioned on the grid (with stack visualization)
 * - Player info sidebar (with progress bars)
 * - Dice component
 * - In-game chat
 * - Dice history strip
 * - Sixes counter
 * - Move preview overlay (hover-driven)
 * - Per-step movement animation
 * - Keyboard shortcuts (Space=roll, 1-4=move)
 */

import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import {
  getCellType,
  getTokenCoords,
  getMovableTokens,
  getBaseTokenPositions,
  MAIN_TRACK,
  HOME_STRETCH,
  SAFE_SPOTS,
  PLAYER_COLORS,
  CENTER_CELL,
  ENTRY_POSITIONS,
  getAIMove,
} from '../utils/gameLogic';
import Token from './Token';
import Dice from './Dice';
import Chat from './Chat';
import WinScreen from './WinScreen';
import CaptureOverlay from './CaptureOverlay';
import DiceHistory from './DiceHistory';
import { playClick } from '../utils/sound';

// ── Cell class name helper ──
function cellClassName(row, col) {
  const type = getCellType(row, col);
  if (!type) return 'board-cell';
  const typeMap = {
    'path': 'cell-path',
    'safe': 'cell-safe',
    'center': 'cell-center',
    'base-red': 'cell-base-red',
    'base-green': 'cell-base-green',
    'base-yellow': 'cell-base-yellow',
    'base-blue': 'cell-base-blue',
    'home-stretch-red': 'cell-home-stretch-red',
    'home-stretch-green': 'cell-home-stretch-green',
    'home-stretch-yellow': 'cell-home-stretch-yellow',
    'home-stretch-blue': 'cell-home-stretch-blue',
  };
  return `board-cell ${typeMap[type] || ''}`;
}

// ── Compute destination coords for a token given current steps and dice value ──
function computeDestCoords(currentToken, playerIndex, dice, playerCount) {
  if (!currentToken) {
    // Entering board at entry position
    return MAIN_TRACK[ENTRY_POSITIONS[playerIndex]];
  }
  const newSteps = currentToken.steps + dice;
  if (newSteps >= 58) return CENTER_CELL;
  if (newSteps >= 52) {
    return HOME_STRETCH[playerIndex][newSteps - 52];
  }
  const absIdx = (ENTRY_POSITIONS[playerIndex] + newSteps) % 52;
  return MAIN_TRACK[absIdx];
}

function computePreviewPath(currentToken, playerIndex, dice) {
  if (!Number.isInteger(dice) || dice < 1) return [];
  if (!currentToken) return [MAIN_TRACK[ENTRY_POSITIONS[playerIndex]]];

  const cells = [];
  const start = currentToken.steps;
  const end = Math.min(58, start + dice);
  for (let step = start + 1; step <= end; step++) {
    if (step >= 58) cells.push(CENTER_CELL);
    else if (step >= 52) cells.push(HOME_STRETCH[playerIndex][step - 52]);
    else cells.push(MAIN_TRACK[(ENTRY_POSITIONS[playerIndex] + step) % 52]);
  }
  return cells;
}

export default function GameBoard() {
  const {
    gameState,
    players,
    peerId,
    moveToken,
    rollDice,
    gameStarted,
    botThinking,
    diceHistory,
    invalidShake,
    animatingToken,
    resetGame,
  } = useGame();

  // ── Hover preview state ──
  const [hoveredToken, setHoveredToken] = useState(null); // { player, token }

  // ── Derive data from game state ──
  const gs = gameState;
  const currentPlayer = gs?.currentPlayer ?? 0;
  const currentPlayerInfo = players[currentPlayer];
  const currentPlayerId = currentPlayerInfo?.id;
  const isBotTurn = currentPlayerInfo?.isBot || false;
  const isMyTurn = currentPlayerId === peerId && !isBotTurn;
  const movableTokens = gs && isMyTurn && gs.turnPhase === 'move'
    ? getMovableTokens(gs, currentPlayer)
    : [];
  const isAutoMove = isMyTurn && gs?.turnPhase === 'move' && movableTokens.length === 1;

  // ── Build token map: { "row,col": [{ player, token, state }] } ──
  const tokenMap = useMemo(() => {
    const map = {};
    if (!gs) return map;

    for (let p = 0; p < gs.playerCount; p++) {
      const player = gs.players[p];
      for (let t = 0; t < 4; t++) {
        const tok = player.tokens[t];
        let coords = null;
        let inBase = false;
        let isHome = false;

        if (tok === null) {
          // In base — get base token position
          const basePositions = getBaseTokenPositions(p);
          coords = basePositions[t];
          inBase = true;
        } else if (tok.steps >= 58) {
          coords = CENTER_CELL;
          isHome = true;
        } else {
          coords = getTokenCoords(tok, p);
        }

        if (coords) {
          const key = `${coords[0]},${coords[1]}`;
          if (!map[key]) map[key] = [];
          map[key].push({
            player: p,
            token: t,
            inBase,
            isHome,
            isMovable: movableTokens.includes(t) && p === currentPlayer,
          });
        }
      }
    }
    return map;
  }, [gs, movableTokens, currentPlayer]);

  // ── Build set of cells that have multiple tokens (for stack-pulse class) ──
  const stackCells = useMemo(() => {
    const set = new Set();
    Object.entries(tokenMap).forEach(([key, list]) => {
      if (list.length > 1) set.add(key);
    });
    return set;
  }, [tokenMap]);

  // ── Handle token click ──
  const handleTokenClick = useCallback((playerIdx, tokenIdx) => {
    if (!isMyTurn) return;
    if (gs?.turnPhase !== 'move') return;
    if (playerIdx !== currentPlayer) return;
    if (!movableTokens.includes(tokenIdx)) return;
    playClick();
    setHoveredToken(null);
    moveToken(tokenIdx);
  }, [isMyTurn, gs, currentPlayer, movableTokens, moveToken]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    if (!gs) return;
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === ' ' || e.code === 'Space') {
        if (isMyTurn && gs.turnPhase === 'roll') {
          e.preventDefault();
          rollDice();
        }
      } else if (e.key >= '1' && e.key <= '4') {
        const idx = parseInt(e.key, 10) - 1;
        if (isMyTurn && gs.turnPhase === 'move' && movableTokens.includes(idx)) {
          e.preventDefault();
          handleTokenClick(currentPlayer, idx);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [gs, isMyTurn, movableTokens, currentPlayer, rollDice, handleTokenClick]);

  // ── If no game state, show placeholder ──
  if (!gs) {
    return (
      <div className="game-container">
        <div className="clay-card" style={{ padding: '32px', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Waiting for game...</h2>
          <p style={{ color: 'var(--text-muted)' }}>The host will start the game shortly.</p>
        </div>
      </div>
    );
  }

  // ── Compute hover-preview destination ──
  let previewCoords = null;
  let previewColor = null;
  let previewStrong = false;
  let previewPath = [];
  if (hoveredToken && isMyTurn && gs.turnPhase === 'move' && movableTokens.includes(hoveredToken.token)) {
    const tok = gs.players[hoveredToken.player].tokens[hoveredToken.token];
    previewCoords = computeDestCoords(tok, hoveredToken.player, gs.diceValue, gs.playerCount);
    previewPath = computePreviewPath(tok, hoveredToken.player, gs.diceValue);
    previewColor = PLAYER_COLORS[hoveredToken.player]?.hex;
    previewStrong = true;
  }
  const actionText = isBotTurn
    ? `${players[currentPlayer]?.name || 'Bot'} sedang jalan...`
    : isMyTurn && gs.turnPhase === 'roll'
      ? 'Giliran kamu: tekan Roll atau Space'
      : isMyTurn && gs.turnPhase === 'move'
        ? `Pilih token bergerak ${gs.diceValue} langkah`
        : `Menunggu ${players[currentPlayer]?.name || 'pemain lain'}`;

  return (
    <div className="game-container">
      <WinScreen />
      <CaptureOverlay />

      {/* Header */}
      <div className="game-header">
        <span className="game-title">🎲 Ludo</span>
        <div className="turn-indicator">
          <span style={{ opacity: 0.6 }}>Turn</span>
          <div
            className="turn-dot"
            style={{ background: PLAYER_COLORS[currentPlayer]?.hex || '#888' }}
          />
          <span style={{ color: PLAYER_COLORS[currentPlayer]?.hex || '#888' }}>
            {players[currentPlayer]?.name || PLAYER_COLORS[currentPlayer]?.name || `P${currentPlayer + 1}`}
            {currentPlayerId === peerId ? ' (You)' : ''}
            {isBotTurn ? ' 🤖' : ''}
          </span>
          {botThinking && <span className="turn-thinking">🧠 thinking...</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => resetGame({ keepRoom: true, clearSession: false })}>Stop Game</button>
          <button className="btn btn-danger" onClick={() => resetGame()}>Leave Game</button>
        </div>
        {gs.consecutiveSixes > 0 && (
          <div className="sixes-counter" title={`Consecutive sixes: ${gs.consecutiveSixes}/3`}>
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`six-dot ${i < gs.consecutiveSixes ? (gs.consecutiveSixes >= 2 ? 'warn' : 'active') : ''}`}
              />
            ))}
          </div>
        )}
        <div className="action-banner" aria-live="polite">
          {actionText}
        </div>
      </div>

      {/* Main layout */}
      <div className="game-layout">
        {/* Player info panel (left) */}
        <div className="player-panel">
          {Array.from({ length: gs.playerCount }, (_, i) => {
            const player = gs.players[i];
            const color = PLAYER_COLORS[i];
            const isActive = i === currentPlayer;
            const homeCount = player?.homeCount ?? 0;
            const pInfo = players[i];
            const progressPct = Math.min(100, (homeCount / 4) * 100);
            return (
              <div
                key={i}
                className={`player-info ${isActive ? 'active-turn' : ''}`}
                style={{ color: color?.hex, borderColor: isActive ? color?.hex : 'transparent' }}
              >
                <div className="pi-color" style={{ background: color?.hex }} />
                <span className="pi-name">
                  {pInfo?.name || color?.name || `P${i + 1}`}
                </span>
                {pInfo?.isBot && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>🤖</span>}
                <span className={`pi-home-count ${homeCount === 4 ? 'full' : ''}`}>
                  🏠 {homeCount}/4
                </span>
                {/* Consecutive sixes indicator */}
                {gs?.currentPlayer === i && gs?.consecutiveSixes > 0 && (
                  <div className="sixes-indicator">
                    {'🎲'.repeat(gs.consecutiveSixes)}
                    {gs.consecutiveSixes >= 2 && <span style={{ color: '#ff3333', marginLeft: 4 }}>⚠️</span>}
                  </div>
                )}
                <div className="pi-progress" aria-hidden="true">
                  <div className="pi-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* ── BOARD ── */}
        <div className="board-wrapper">
          <div className="board-grid">
            {Array.from({ length: 15 }, (_, row) =>
              Array.from({ length: 15 }, (_, col) => {
                const key = `${row},${col}`;
                const tokensHere = tokenMap[key] || [];
                const cellType = getCellType(row, col);
                const isStack = stackCells.has(key);
                const isPreview = previewCoords && previewCoords[0] === row && previewCoords[1] === col;
                const previewTrailIndex = previewPath.findIndex(([r, c]) => r === row && c === col);

                const baseClass = cellClassName(row, col);
                const finalClass = isStack ? `${baseClass} cell-has-stack` : baseClass;

                return (
                  <div
                    key={key}
                    className={finalClass}
                    style={{
                      ...(cellType === 'safe' ? {
                        boxShadow: 'inset 0 0 8px rgba(255,255,255,0.15)',
                      } : {}),
                    }}
                  >
                    {previewTrailIndex >= 0 && !isPreview && (
                      <div
                        className="move-preview-trail"
                        style={{ color: previewColor, animationDelay: `${previewTrailIndex * 45}ms` }}
                      />
                    )}
                    {isPreview && (
                      <div
                        className={`move-preview ${previewStrong ? 'move-preview-strong' : ''}`}
                        style={{ color: previewColor }}
                      />
                    )}

                    {tokensHere.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'grid',
                        gridTemplateColumns: tokensHere.length > 1 ? '1fr 1fr' : '1fr',
                        gridTemplateRows: tokensHere.length > 2 ? '1fr 1fr' : '1fr',
                        padding: '2px',
                        gap: '1px',
                      }}>
                        {tokensHere.map((tok, idx) => {
                          const tokenKey = `${tok.player}-${tok.token}`;
                          const isThisShaking = invalidShake &&
                            invalidShake.player === tok.player &&
                            invalidShake.token === tok.token;
                          return (
                            <Token
                              key={tokenKey}
                              playerIndex={tok.player}
                              tokenIndex={tok.token}
                              isActive={tok.isMovable}
                              isClickable={tok.isMovable}
                              isInBase={tok.inBase}
                              isHome={tok.isHome}
                              stackIndex={idx}
                              stackCount={tokensHere.length}
                              invalidShakeKey={isThisShaking ? invalidShake?.key : null}
                              isAutoMove={isAutoMove && tok.isMovable}
                              isAnimating={animatingToken?.player === tok.player && animatingToken?.token === tok.token}
                              onClick={() => handleTokenClick(tok.player, tok.token)}
                              onHover={() => tok.isMovable && setHoveredToken({ player: tok.player, token: tok.token })}
                              onUnhover={() => setHoveredToken(prev =>
                                prev && prev.player === tok.player && prev.token === tok.token ? null : prev
                              )}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right panel: dice + history + chat */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 140 }}>
          <Dice />
          <DiceHistory history={diceHistory || []} />
          <Chat />
          {isMyTurn && gs.turnPhase === 'roll' && (
            <div style={{ textAlign: 'center', fontSize: '0.7rem' }}>
              Press <span className="kbd-hint">Space</span> to roll
            </div>
          )}
          {isMyTurn && gs.turnPhase === 'move' && movableTokens.length > 0 && (
            <div style={{ textAlign: 'center', fontSize: '0.7rem' }}>
              <span className="kbd-hint">1</span>·<span className="kbd-hint">2</span>·<span className="kbd-hint">3</span>·<span className="kbd-hint">4</span> to move
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
