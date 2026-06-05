/**
 * GameContext.jsx — Global state provider for Ludo Multiplayer
 *
 * Manages:
 * - Game state (board, tokens, turns, etc.)
 * - Player assignments
 * - Screen navigation (lobby ↔ game)
 * - Coordination between local game logic and multiplayer networking
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import {
  createInitialState, executeMove, rollDiceForCurrent,
  getMovableTokens, getAIMove, getTokenCoords,
  ENTRY_POSITIONS, MAIN_TRACK, PLAYER_COLORS, SAFE_SPOTS,
  TOKENS_PER_PLAYER, HOME_ENTRY_STEP, MAX_CONSECUTIVE_SIXES, MAIN_TRACK_LENGTH,
} from '../utils/gameLogic';
import { playDiceRoll, playMove, playCapture, playHomeEntry, playWin, playNotification } from '../utils/sound';
import useMultiplayer from '../hooks/useMultiplayer';

// ── Context ──
const GameContext = createContext(null);

// ── Action types ──
const ACTIONS = {
  SET_SCREEN: 'SET_SCREEN',
  SET_PLAYER_NAME: 'SET_PLAYER_NAME',
  SET_BOT_COUNT: 'SET_BOT_COUNT',
  SET_GAME_STATE: 'SET_GAME_STATE',
  SET_GAME_STARTED: 'SET_GAME_STARTED',
  SET_ROOM_CODE: 'SET_ROOM_CODE',
  SET_PLAYERS_LIST: 'SET_PLAYERS_LIST',
  SET_LOADING: 'SET_LOADING',
  SET_BOT_THINKING: 'SET_BOT_THINKING',
  SET_CAPTURE_EVENT: 'SET_CAPTURE_EVENT',
  CLEAR_CAPTURE_EVENT: 'CLEAR_CAPTURE_EVENT',
  SET_HOME_EVENT: 'SET_HOME_EVENT',
  CLEAR_HOME_EVENT: 'CLEAR_HOME_EVENT',
  PUSH_TOAST: 'PUSH_TOAST',
  POP_TOAST: 'POP_TOAST',
  PUSH_DICE_HISTORY: 'PUSH_DICE_HISTORY',
  SET_SOUND_ENABLED: 'SET_SOUND_ENABLED',
  TRIGGER_INVALID_SHAKE: 'TRIGGER_INVALID_SHAKE',
  SET_ANIMATING_TOKEN: 'SET_ANIMATING_TOKEN',
  RESET: 'RESET',
};

const BOT_NAMES = ['🤖 Bot-AI', '🤖 Bot-Beta', '🤖 Bot-Gamma'];

// ── Toast helper ──
let toastIdCounter = 0;
function makeToastId() { return `t-${Date.now()}-${++toastIdCounter}`; }

// ── Initial state ──
const initialState = {
  screen: 'lobby',
  playerName: '',
  gameState: null,
  gameStarted: false,
  players: [],
  isHost: false,
  roomCode: null,
  loading: false,
  botCount: 0,
  botThinking: false,
  captureEvent: null,     // { attackerColor, capturedColor, x, y } for RPG capture animation
  homeEvent: null,        // { color, x, y } for token reaching home
  toasts: [],             // [{ id, message, type, duration }]
  diceHistory: [],        // last 5 dice values
  soundEnabled: (typeof window !== 'undefined' && localStorage.getItem('ludo-sound-enabled') !== 'false'),
  invalidShake: null,     // { player, token, key } for shake animation on rejected click
  animatingToken: null,   // { player, token, totalSteps, currentStep } for per-step movement
};

function gameReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_SCREEN:
      return { ...state, screen: action.payload };
    case ACTIONS.SET_PLAYER_NAME:
      return { ...state, playerName: action.payload };
    case ACTIONS.SET_BOT_COUNT:
      return { ...state, botCount: action.payload };
    case ACTIONS.SET_GAME_STATE:
      return { ...state, gameState: action.payload };
    case ACTIONS.SET_GAME_STARTED:
      return { ...state, gameStarted: action.payload };
    case ACTIONS.SET_ROOM_CODE:
      return { ...state, roomCode: action.payload };
    case ACTIONS.SET_PLAYERS_LIST:
      return { ...state, players: action.payload };
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
    case ACTIONS.SET_BOT_THINKING:
      return { ...state, botThinking: action.payload };
    case ACTIONS.SET_CAPTURE_EVENT:
      return { ...state, captureEvent: action.payload };
    case ACTIONS.CLEAR_CAPTURE_EVENT:
      return { ...state, captureEvent: null };
    case ACTIONS.SET_HOME_EVENT:
      return { ...state, homeEvent: action.payload };
    case ACTIONS.CLEAR_HOME_EVENT:
      return { ...state, homeEvent: null };
    case ACTIONS.PUSH_TOAST: {
      const toast = {
        id: action.payload.id || makeToastId(),
        message: action.payload.message,
        type: action.payload.type || 'info',
        duration: action.payload.duration || 2500,
        icon: action.payload.icon,
      };
      return { ...state, toasts: [...state.toasts, toast].slice(-3) };
    }
    case ACTIONS.POP_TOAST:
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    case ACTIONS.PUSH_DICE_HISTORY: {
      const newHist = [...state.diceHistory, action.payload].slice(-5);
      return { ...state, diceHistory: newHist };
    }
    case ACTIONS.SET_SOUND_ENABLED: {
      if (typeof window !== 'undefined') {
        localStorage.setItem('ludo-sound-enabled', action.payload ? 'true' : 'false');
      }
      return { ...state, soundEnabled: action.payload };
    }
    case ACTIONS.TRIGGER_INVALID_SHAKE:
      return { ...state, invalidShake: { ...action.payload, key: Date.now() } };
    case ACTIONS.SET_ANIMATING_TOKEN:
      return { ...state, animatingToken: action.payload };
    case ACTIONS.RESET:
      return { ...initialState, playerName: state.playerName };
    default:
      return state;
  }
}

// ── Helper: Build merged players array ──
function buildPlayerList(humans, botCount) {
  const list = [];
  // Humans first
  humans.forEach((h, i) => {
    list.push({ id: h.id, name: h.name || `Player ${i}`, color: i, isBot: false });
  });
  // Bots fill remaining slots
  for (let b = 0; b < botCount && list.length < TOKENS_PER_PLAYER; b++) {
    const idx = list.length;
    list.push({ id: `bot-${b}`, name: BOT_NAMES[b] || `Bot ${b + 1}`, color: idx, isBot: true });
  }
  return list;
}

/**
 * Validate remote game state before accepting it
 * Prevents malicious or corrupted state synchronization
 */
function validateGameState(gameState) {
  if (!gameState || typeof gameState !== 'object') return false;
  
  // Check required fields exist
  const requiredFields = ['players', 'currentPlayer', 'diceValue', 'diceRolled', 
                          'gameOver', 'winner', 'consecutiveSixes', 'turnPhase', 'playerCount'];
  for (const field of requiredFields) {
    if (!(field in gameState)) return false;
  }
  
  // Check player count consistency
  const { players, playerCount } = gameState;
  if (!Number.isInteger(playerCount)) return false;
  const playerIds = Object.keys(players || {});
  const actualCount = playerIds.length;
  if (actualCount !== playerCount || actualCount < 2 || actualCount > TOKENS_PER_PLAYER) return false;
  
  // Validate currentPlayer is within bounds
  if (!Number.isInteger(gameState.currentPlayer) || gameState.currentPlayer < 0 || gameState.currentPlayer >= playerCount) return false;

  // Validate dice and turn phase
  const validDice = gameState.diceValue === null || (Number.isInteger(gameState.diceValue) && gameState.diceValue >= 1 && gameState.diceValue <= 6);
  if (!validDice) return false;
  if (!['roll', 'move'].includes(gameState.turnPhase)) return false;
  if (typeof gameState.diceRolled !== 'boolean') return false;
  if (gameState.turnPhase === 'move' && gameState.diceValue === null) return false;
  if (gameState.turnPhase === 'roll' && gameState.diceRolled && gameState.diceValue === null) return false;
  if (typeof gameState.gameOver !== 'boolean') return false;
  if (!(gameState.winner === null || (Number.isInteger(gameState.winner) && gameState.winner >= 0 && gameState.winner < playerCount))) return false;
  
  // Validate consecutiveSixes
  if (!Number.isInteger(gameState.consecutiveSixes) || gameState.consecutiveSixes < 0 || gameState.consecutiveSixes >= MAX_CONSECUTIVE_SIXES) return false;

  const mainOccupancy = new Map();
  
  // Validate each player has exactly 4 tokens
  for (const playerId of playerIds) {
    const p = Number(playerId);
    if (!Number.isInteger(p) || p < 0 || p >= playerCount) return false;
    const player = players[playerId];
    if (!player || !player.tokens || !Array.isArray(player.tokens) || player.tokens.length !== TOKENS_PER_PLAYER) {
      return false;
    }
    if (!Number.isInteger(player.homeCount) || player.homeCount < 0 || player.homeCount > TOKENS_PER_PLAYER) return false;

    // Verify homeCount matches tokens in home and token steps stay legal.
    let homeCountCorrect = 0;
    for (const token of player.tokens) {
      if (token === null) continue;
      if (!token || typeof token !== 'object') return false;
      if (!Number.isInteger(token.steps) || token.steps < 0 || token.steps > HOME_ENTRY_STEP) return false;
      if (token.steps >= HOME_ENTRY_STEP) homeCountCorrect++;

      if (token.steps < MAIN_TRACK_LENGTH) {
        const absIdx = (ENTRY_POSITIONS[p] + token.steps) % MAIN_TRACK_LENGTH;
        const key = String(absIdx);
        if (!mainOccupancy.has(key)) mainOccupancy.set(key, new Set());
        mainOccupancy.get(key).add(p);
      }
    }
    if (homeCountCorrect !== player.homeCount) return false;
  }

  // Non-safe cells cannot contain mixed-color occupancy.
  for (const [absIdx, owners] of mainOccupancy.entries()) {
    if (owners.size > 1 && !SAFE_SPOTS.has(Number(absIdx))) return false;
  }
  
  return true;
}

// ── Provider ──
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const mp = useMultiplayer();
  const stateRef = useRef(state);
  stateRef.current = state;
  const botTimerRef = useRef(null);
  const animTimersRef = useRef([]);     // per-step animation timers

  // ── Compute effective humans list from WebRTC ──
  const humanCount = mp.allPeers?.length ?? 0;

  // Build merged player list whenever allPeers or botCount changes
  useEffect(() => {
    if (state.gameStarted) return; // Don't override during gameplay — host's list is authoritative
    const peers = mpRef.current.allPeers || [];
    const humans = peers.map((id, i) => ({
      id,
      name: i === 0 ? (stateRef.current.playerName || 'Host') : `Player ${i}`,
    }));
    const merged = buildPlayerList(humans, stateRef.current.botCount);
    dispatch({ type: ACTIONS.SET_PLAYERS_LIST, payload: merged });
  }, [mp.allPeers, state.botCount, state.gameStarted]);

  // Total effective players (humans + bots, at least 2 for the game to start)
  const effectivePlayerCount = Math.max(2, Math.min(4, humanCount + state.botCount));

  // ── Stable refs for values that change every render ──
  const mpRef = useRef(mp);
  mpRef.current = mp;
  const botThinkingRef = useRef(state.botThinking);
  botThinkingRef.current = state.botThinking;

  // ── Handle remote events from WebRTC ──
  const lastRemoteEventTime = useRef(0);
  const REMOTE_EVENT_RATE_LIMIT_MS = 100; // Rate limit remote events

  useEffect(() => {
    const unsub = mpRef.current.onRemoteEvent((msg, conn) => {
      // Rate limit: ignore events that come too quickly
      const now = Date.now();
      if (now - lastRemoteEventTime.current < REMOTE_EVENT_RATE_LIMIT_MS) return;
      lastRemoteEventTime.current = now;

      if (msg.type === 'GAME_STATE') {
        // Clients may accept validated host snapshots. Host ignores client state payloads.
        if (!mpRef.current.isHost && validateGameState(msg.gameState)) {
          dispatch({ type: ACTIONS.SET_GAME_STATE, payload: msg.gameState });
        }
      }
      if (msg.type === 'DICE_ROLL') {
        playDiceRoll();
      }
      if (msg.type === 'GAME_START') {
        if (!mpRef.current.isHost && validateGameState(msg.gameState)) {
          dispatch({ type: ACTIONS.SET_GAME_STATE, payload: msg.gameState });
          dispatch({ type: ACTIONS.SET_GAME_STARTED, payload: true });
          dispatch({ type: ACTIONS.SET_SCREEN, payload: 'game' });
          if (msg.players) {
            dispatch({ type: ACTIONS.SET_PLAYERS_LIST, payload: msg.players });
          }
          playNotification();
        }
      }
      if (msg.type === 'TOKEN_MOVE') {
        if (!mpRef.current.isHost && validateGameState(msg.gameState)) {
          dispatch({ type: ACTIONS.SET_GAME_STATE, payload: msg.gameState });
        }
      }
      if (msg.type === 'PLAYER_JOINED' || msg.type === 'PLAYER_LEFT') {
        playNotification();
      }
    });
    return unsub;
  }, []); // stable — mpRef used inside

  // ── Actions ──

  const setPlayerName = useCallback((name) => {
    dispatch({ type: ACTIONS.SET_PLAYER_NAME, payload: name });
  }, []);

  /** Host creates a room */
  const hostRoom = useCallback(async (name) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      const code = await mpRef.current.createRoom(name || stateRef.current.playerName || 'Host');
      dispatch({ type: ACTIONS.SET_ROOM_CODE, payload: code });
      dispatch({ type: ACTIONS.SET_PLAYER_NAME, payload: name || 'Host' });
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    } catch (err) {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      throw err;
    }
  }, []);

  /** Player joins a room */
  const joinRoom = useCallback(async (code, name) => {
    dispatch({ type: ACTIONS.SET_LOADING, payload: true });
    try {
      await mpRef.current.joinRoom(code, name || stateRef.current.playerName || 'Player');
      dispatch({ type: ACTIONS.SET_ROOM_CODE, payload: code });
      dispatch({ type: ACTIONS.SET_PLAYER_NAME, payload: name || 'Player' });
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
    } catch (err) {
      dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      throw err;
    }
  }, []);

  // ── Set bot count (host only) ──
  const setBotCount = useCallback((count) => {
    dispatch({ type: ACTIONS.SET_BOT_COUNT, payload: Math.max(0, Math.min(3, count)) });
  }, []);

  // ── Push a toast (auto-dismiss) ──
  const pushToast = useCallback((message, type = 'info', duration = 2500, icon = null) => {
    const id = makeToastId();
    dispatch({ type: ACTIONS.PUSH_TOAST, payload: { message, type, duration, icon, id } });
    // Schedule removal using the actual id we assigned
    setTimeout(() => {
      dispatch({ type: ACTIONS.POP_TOAST, payload: id });
    }, duration);
  }, []);

  // ── Toggle sound on/off ──
  const toggleSound = useCallback(() => {
    dispatch({ type: ACTIONS.SET_SOUND_ENABLED, payload: !stateRef.current.soundEnabled });
  }, []);

  // ── Trigger shake on a token (for invalid clicks) ──
  const triggerInvalidShake = useCallback((player, token) => {
    dispatch({ type: ACTIONS.TRIGGER_INVALID_SHAKE, payload: { player, token } });
  }, []);

  /** Start the game (host only) — includes bots */
  const startGame = useCallback(() => {
    const total = effectivePlayerCount;
    if (total < 2) return;

    const gameState = createInitialState(total);
    dispatch({ type: ACTIONS.SET_GAME_STATE, payload: gameState });
    dispatch({ type: ACTIONS.SET_GAME_STARTED, payload: true });
    dispatch({ type: ACTIONS.SET_SCREEN, payload: 'game' });
    mpRef.current.sendGameStart(gameState, stateRef.current.players);
    playNotification();
  }, [effectivePlayerCount]);

  /** Roll dice for current player (human only — bots auto-roll) */
  const rollDiceAction = useCallback(() => {
    const gs = stateRef.current.gameState;
    if (!gs || gs.gameOver) return;

    const currentIdx = gs.currentPlayer;
    const playerInfo = stateRef.current.players[currentIdx];
    if (!playerInfo || playerInfo.isBot) return;

    const myId = mpRef.current.peerId;
    if (playerInfo.id !== myId) return;
    if (gs.turnPhase !== 'roll') return;

    playDiceRoll();

    const newState = rollDiceForCurrent(gs);
    const rolledValue = newState.lastDiceRoll ?? newState.diceValue;
    dispatch({ type: ACTIONS.SET_GAME_STATE, payload: newState });
    dispatch({ type: ACTIONS.PUSH_DICE_HISTORY, payload: rolledValue });
    // Send the actual rolled value to peers, even when turn auto-passes.
    mpRef.current.sendDiceRoll(rolledValue);
    mpRef.current.sendGameState(newState);

    // ── Toast for special dice results ──
    if (newState.lastRollForfeitedByThreeSixes) {
      pushToast('Three 6s in a row! Turn forfeited.', 'warning', 3000);
    } else if (rolledValue === 6 && !newState.lastRollHadNoMove) {
      const sixes = newState.consecutiveSixes;
      pushToast(`Rolled a 6! ${sixes === 2 ? '⚠️ Watch out — one more and turn ends!' : 'Roll again.'}`, 'dice', 2200, '🎯');
    } else if (newState.lastRollHadNoMove) {
      pushToast(`Rolled ${rolledValue}. No movable tokens. Turn passes.`, 'info', 1800, '⏭️');
    }
  }, [pushToast]);

  /** Move a token (human only) */
  const moveToken = useCallback((tokenIndex) => {
    const gs = stateRef.current.gameState;
    if (!gs || gs.gameOver) return;
    if (gs.turnPhase !== 'move') return;

    const currentIdx = gs.currentPlayer;
    const playerInfo = stateRef.current.players[currentIdx];
    if (!playerInfo || playerInfo.isBot) return;

    const myId = mpRef.current.peerId;
    if (playerInfo.id !== myId) return;

    const movable = getMovableTokens(gs, currentIdx);
    if (!movable.includes(tokenIndex)) {
      // Invalid move — shake the token briefly
      dispatch({ type: ACTIONS.TRIGGER_INVALID_SHAKE, payload: { player: currentIdx, token: tokenIndex } });
      return;
    }

    const startTok = gs.players[currentIdx].tokens[tokenIndex];
    const newSteps = startTok ? startTok.steps + gs.diceValue : 0;

    const newState = executeMove(gs, currentIdx, tokenIndex);
    const moveMeta = newState.lastMove || {};
    const capturedList = moveMeta.captured || [];
    const reachedHome = Boolean(moveMeta.reachedHome);

    // ── Trigger RPG capture animation ──
    if (capturedList.length > 0) {
      playCapture();
      const capAbs = (ENTRY_POSITIONS[currentIdx] + newSteps) % 52;
      const [row, col] = MAIN_TRACK[capAbs];
      const capColor = PLAYER_COLORS[capturedList[0].player]?.css || 'red';
      const atkColor = PLAYER_COLORS[currentIdx]?.css || 'blue';
      dispatch({
        type: ACTIONS.SET_CAPTURE_EVENT,
        payload: { attackerColor: atkColor, capturedColor: capColor, row, col }
      });
      // Clear after animation
      setTimeout(() => dispatch({ type: ACTIONS.CLEAR_CAPTURE_EVENT }), 1200);
      const capName = PLAYER_COLORS[capturedList[0].player]?.name || 'Opponent';
      pushToast(`Captured ${capName}'s token! Extra roll.`, 'capture', 2200);
    }

    // ── Trigger home arrival animation ──
    if (reachedHome) {
      playHomeEntry();
      const coords = getTokenCoords({ steps: Math.min(newSteps, 58) }, currentIdx);
      if (coords) {
        const color = PLAYER_COLORS[currentIdx]?.css || 'red';
        dispatch({
          type: ACTIONS.SET_HOME_EVENT,
          payload: { color, row: coords[0], col: coords[1] }
        });
        setTimeout(() => dispatch({ type: ACTIONS.CLEAR_HOME_EVENT }), 1000);
        pushToast('Reached HOME! Extra roll.', 'home', 2000, '🏠');
      }
    }

    // Sounds for normal move
    if (!newState.gameOver && capturedList.length === 0 && !reachedHome) {
      playMove();
    }

    if (newState.gameOver) {
      playWin();
      pushToast(`${PLAYER_COLORS[currentIdx]?.name || 'Player'} wins!`, 'win', 5000, '🏆');
    }

    // ── F1 Per-step movement animation ──
    // Compute the path the token will traverse
    const startInBase = !startTok;
    const startSteps = startTok?.steps ?? -1;
    const diceVal = gs.diceValue;
    const path = [];
    if (startInBase) {
      // Token enters the board at steps 0
      path.push(0);
    } else {
      for (let i = 1; i <= diceVal; i++) {
        path.push(startSteps + i);
      }
    }

    // Cancel any in-flight animations for this player
    animTimersRef.current.forEach(t => clearTimeout(t));
    animTimersRef.current = [];

    if (path.length <= 1) {
      // Single-step move (e.g., entering from base) — no animation needed
      dispatch({ type: ACTIONS.SET_GAME_STATE, payload: newState });
    } else {
      // Multi-step — animate through each cell
      const STEP_MS = 110;
      const animKey = { player: currentIdx, token: tokenIndex, total: path.length, current: 0 };
      dispatch({ type: ACTIONS.SET_ANIMATING_TOKEN, payload: animKey });

      path.forEach((steps, i) => {
        const isLast = i === path.length - 1;
        const timer = setTimeout(() => {
          const cur = stateRef.current.gameState;
          if (!cur) return;

          if (isLast) {
            // Final state with all side effects (captures, home, turn advance)
            dispatch({ type: ACTIONS.SET_GAME_STATE, payload: newState });
            dispatch({ type: ACTIONS.SET_ANIMATING_TOKEN, payload: null });
          } else {
            // Intermediate state — token at the next step, captures NOT applied yet
            // (players is an object keyed by index — use spread, not .map)
            const newPlayers = { ...cur.players };
            const oldP = newPlayers[currentIdx];
            const newTokens = [...oldP.tokens];
            newTokens[tokenIndex] = { steps, justMoved: false };
            newPlayers[currentIdx] = { ...oldP, tokens: newTokens };
            dispatch({
              type: ACTIONS.SET_GAME_STATE,
              payload: {
                ...cur,
                players: newPlayers,
                turnPhase: 'animating',
                animatingToken: { ...animKey, current: i + 1 },
              },
            });
          }
        }, i * STEP_MS);
        animTimersRef.current.push(timer);
      });
    }

    mpRef.current.sendTokenMove(tokenIndex, newState);
  }, [pushToast]);

  // ────────────────────────────────────────────────
  // AUTO-MOVE ENGINE (Human)
  // ────────────────────────────────────────────────
  // After rolling, if exactly 1 token is movable,
  // auto-move it after a brief pause so the user
  // can see the dice result.
  const autoMoveTimerRef = useRef(null);
  useEffect(() => {
    const gs = stateRef.current.gameState;
    if (!gs || gs.gameOver || gs.turnPhase !== 'move') return;

    const currentIdx = gs.currentPlayer;
    const playerInfo = stateRef.current.players[currentIdx];
    // Only for humans
    if (!playerInfo || playerInfo.isBot) return;

    const myId = mpRef.current.peerId;
    if (playerInfo.id !== myId) return;

    const movable = getMovableTokens(gs, currentIdx);

    if (movable.length === 1) {
      // Auto-move the only movable token after a short delay
      if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
      autoMoveTimerRef.current = setTimeout(() => {
        moveToken(movable[0]);
      }, 350);
    }

    return () => {
      if (autoMoveTimerRef.current) clearTimeout(autoMoveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameState]);

  /** Send a chat message */
  const sendChat = useCallback((text) => {
    mpRef.current.sendChat(text);
  }, []);

  /** Reset the game */
  const resetGame = useCallback(() => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    dispatch({ type: ACTIONS.RESET });
    mpRef.current.cleanup();
    // Clear animation timers
    animTimersRef.current.forEach(t => clearTimeout(t));
    animTimersRef.current = [];
    // Return to lobby screen
    dispatch({ type: ACTIONS.SET_SCREEN, payload: 'lobby' });
  }, []);

  // ────────────────────────────────────────────────
  // BOT AUTO-PLAY ENGINE
  // ────────────────────────────────────────────────
  // Uses refs internally so the effect only depends on
  // `gameState` — avoids the cleanup-clears-timeout bug.
  useEffect(() => {
    const gs = stateRef.current.gameState;
    if (!gs || gs.gameOver || botThinkingRef.current) return;
    if (gs.turnPhase !== 'roll' && gs.turnPhase !== 'move') return;

    const currentIdx = gs.currentPlayer;
    const playerInfo = stateRef.current.players[currentIdx];
    if (!playerInfo?.isBot) return;

    // Flag bot as thinking (prevents re-entry)
    dispatch({ type: ACTIONS.SET_BOT_THINKING, payload: true });

    botTimerRef.current = setTimeout(() => {
      const latest = stateRef.current.gameState;
      const latestMp = mpRef.current;
      if (!latest || latest.gameOver) {
        dispatch({ type: ACTIONS.SET_BOT_THINKING, payload: false });
        return;
      }

      if (latest.turnPhase === 'roll') {
        // Bot rolls dice
        playDiceRoll();
        const newState = rollDiceForCurrent(latest);
        const rolledValue = newState.lastDiceRoll ?? newState.diceValue;
        dispatch({ type: ACTIONS.SET_GAME_STATE, payload: newState });
        dispatch({ type: ACTIONS.PUSH_DICE_HISTORY, payload: rolledValue });
        latestMp.sendDiceRoll(rolledValue);
        latestMp.sendGameState(newState);
        dispatch({ type: ACTIONS.SET_BOT_THINKING, payload: false });

        // ── Bot roll toasts (silent — bots don't toast for their own rolls unless notable) ──
        const botName = stateRef.current.players[currentIdx]?.name || 'Bot';
        if (newState.lastRollForfeitedByThreeSixes) {
          pushToast(`${botName} rolled three 6s! Turn forfeited.`, 'warning', 2800);
        } else if (newState.lastRollHadNoMove) {
          pushToast(`${botName} rolled ${rolledValue}. No moves.`, 'info', 1600, '⏭️');
        }
      } else if (latest.turnPhase === 'move') {
        // Bot picks best move
        const chosen = getAIMove(latest, currentIdx);
        if (chosen === null) {
          dispatch({ type: ACTIONS.SET_BOT_THINKING, payload: false });
          return;
        }

        const botStartTok = latest.players[currentIdx].tokens[chosen];
        const botNewSteps = botStartTok ? botStartTok.steps + latest.diceValue : 0;
        const newState = executeMove(latest, currentIdx, chosen);
        const botMoveMeta = newState.lastMove || {};
        const botCaptured = botMoveMeta.captured || [];
        const botReachedHome = Boolean(botMoveMeta.reachedHome);

        // Capture animation
        if (botCaptured.length > 0) {
          playCapture();
          const capAbs = (ENTRY_POSITIONS[currentIdx] + botNewSteps) % 52;
          const [row, col] = MAIN_TRACK[capAbs];
          const capColor = PLAYER_COLORS[botCaptured[0].player]?.css || 'red';
          const atkColor = PLAYER_COLORS[currentIdx]?.css || 'blue';
          dispatch({ type: ACTIONS.SET_CAPTURE_EVENT, payload: { attackerColor: atkColor, capturedColor: capColor, row, col } });
          setTimeout(() => dispatch({ type: ACTIONS.CLEAR_CAPTURE_EVENT }), 1200);
          const capName = PLAYER_COLORS[botCaptured[0].player]?.name || 'Opponent';
          pushToast(`Bot captured ${capName}'s token! Extra roll.`, 'capture', 2200);
        }

        // Home animation
        if (botReachedHome) {
          playHomeEntry();
          const botHomeCoords = getTokenCoords({ steps: Math.min(botNewSteps, 58) }, currentIdx);
          if (botHomeCoords) {
            const hColor = PLAYER_COLORS[currentIdx]?.css || 'red';
            dispatch({ type: ACTIONS.SET_HOME_EVENT, payload: { color: hColor, row: botHomeCoords[0], col: botHomeCoords[1] } });
            setTimeout(() => dispatch({ type: ACTIONS.CLEAR_HOME_EVENT }), 1000);
            pushToast('Bot reached HOME! Extra roll.', 'home', 1800, '🏠');
          }
        }

        // Normal move sound
        if (!newState.gameOver && botCaptured.length === 0 && !botReachedHome) playMove();

        if (newState.gameOver) {
          playWin();
          const botName = stateRef.current.players[currentIdx]?.name || 'Bot';
          pushToast(`${botName} wins!`, 'win', 5000, '🏆');
        }

        // ── F1 Per-step movement animation (bot) ──
        const botStartInBase = !botStartTok;
        const botStartSteps = botStartTok?.steps ?? -1;
        const botPath = [];
        if (botStartInBase) {
          botPath.push(0);
        } else {
          for (let i = 1; i <= latest.diceValue; i++) {
            botPath.push(botStartSteps + i);
          }
        }

        animTimersRef.current.forEach(t => clearTimeout(t));
        animTimersRef.current = [];

        if (botPath.length <= 1) {
          dispatch({ type: ACTIONS.SET_GAME_STATE, payload: newState });
        } else {
          const STEP_MS = 110;
          const animKey = { player: currentIdx, token: chosen, total: botPath.length, current: 0 };
          dispatch({ type: ACTIONS.SET_ANIMATING_TOKEN, payload: animKey });

          botPath.forEach((steps, i) => {
            const isLast = i === botPath.length - 1;
            const timer = setTimeout(() => {
              const cur = stateRef.current.gameState;
              if (!cur) return;

              if (isLast) {
                dispatch({ type: ACTIONS.SET_GAME_STATE, payload: newState });
                dispatch({ type: ACTIONS.SET_ANIMATING_TOKEN, payload: null });
              } else {
                const newPlayers = { ...cur.players };
                const oldP = newPlayers[currentIdx];
                const newTokens = [...oldP.tokens];
                newTokens[chosen] = { steps, justMoved: false };
                newPlayers[currentIdx] = { ...oldP, tokens: newTokens };
                dispatch({
                  type: ACTIONS.SET_GAME_STATE,
                  payload: {
                    ...cur,
                    players: newPlayers,
                    turnPhase: 'animating',
                    animatingToken: { ...animKey, current: i + 1 },
                  },
                });
              }
            }, i * STEP_MS);
            animTimersRef.current.push(timer);
          });
        }

        latestMp.sendTokenMove(chosen, newState);
        dispatch({ type: ACTIONS.SET_BOT_THINKING, payload: false });
      }
    }, 80); // 80ms — near-instant, barely noticeable

    return () => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.gameState]); // ONLY gameState — mp & botThinking via refs

  const value = {
    ...state,
    ...mp,
    setPlayerName,
    hostRoom,
    joinRoom,
    startGame,
    rollDice: rollDiceAction,
    moveToken,
    sendChat,
    resetGame,
    setBotCount,
    effectivePlayerCount,
    pushToast,
    toggleSound,
    triggerInvalidShake,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}

export default GameContext;
