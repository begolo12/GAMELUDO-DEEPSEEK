/**
 * useMultiplayer.js — Custom hook for PeerJS WebRTC networking
 *
 * Handles:
 * - Creating a Peer as Host or Joiner
 * - 5-digit room code management
 * - Reliable data connections (mesh topology — host relays)
 * - Message serialisation / deserialisation
 * - Connection state tracking
 * - Chat messaging
 *
 * Message protocol (JSON over DataChannel):
 *   { type: 'CHAT',         senderId, senderName, text }
 *   { type: 'PLAYER_JOINED', playerId, playerName }
 *   { type: 'PLAYER_LEFT',   playerId }
 *   { type: 'GAME_STATE',    gameState }
 *   { type: 'DICE_ROLL',     playerId, value }
 *   { type: 'TOKEN_MOVE',    playerId, tokenIndex, gameState }
 *   { type: 'GAME_START',    gameState }
 *   { type: 'KEEPALIVE' }
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Peer from 'peerjs';

const ROOM_PREFIX = 'ludo-';

// ─────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────

export default function useMultiplayer() {
  const [peer, setPeer] = useState(null);
  const [peerId, setPeerId] = useState(null);
  const [connections, setConnections] = useState([]);    // array of { id, conn }
  const [roomCode, setRoomCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);           // chat messages
  const [remoteEvents, setRemoteEvents] = useState([]);   // incoming game events

  const connectionsRef = useRef([]);
  const peerRef = useRef(null);
  const messageHandlersRef = useRef(new Map());
  const isHostRef = useRef(false); // Use ref instead of state in callbacks

  // ── Register a handler for incoming remote events ──
  const onRemoteEvent = useCallback((handler) => {
    const id = Symbol();
    messageHandlersRef.current.set(id, handler);
    return () => messageHandlersRef.current.delete(id);
  }, []);

  // ── Generate secure 5-digit room code using crypto ---
  const generateRoomCode = useCallback(() => {
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      // Generate number between 10000 and 99999
      const num = 10000 + (array[0] % 90000);
      return String(num);
    }
    // Fallback for older browsers
    return String(Math.floor(10000 + Math.random() * 90000));
  }, []);

  // ── Cleanup ──
  const cleanup = useCallback(() => {
    connectionsRef.current.forEach(({ conn }) => {
      try { conn.close(); } catch {}
    });
    connectionsRef.current = [];
    setConnections([]);
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPeer(null);
    setPeerId(null);
    setRoomCode(null);
    setIsHost(false);
    setConnected(false);
    setMessages([]);
    setRemoteEvents([]);
  }, []);

  // ── Create a Peer (shared helper) ──
  const createPeer = useCallback((id) => {
    return new Peer(id, {
      // Use default PeerJS cloud server (free tier)
      // No config needed for basic usage
    });
  }, []);

  // ── Handle incoming connection ──
  const handleConnection = useCallback((conn, hostPeerId) => {
    conn.on('open', () => {
      const connInfo = { id: conn.peer, conn };
      connectionsRef.current = [...connectionsRef.current, connInfo];
      setConnections([...connectionsRef.current]);

      // Notify the new peer about existing connections
      if (isHostRef.current) {
        // Send current player list
        broadcast({
          type: 'PLAYER_LIST',
          players: connectionsRef.current.map(c => c.id),
        }, conn);
      }
    });

    conn.on('data', (data) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;

        // Handle CHAT messages
        if (msg.type === 'CHAT') {
          setMessages(prev => [...prev, {
            id: Date.now() + Math.random(),
            senderId: msg.senderId,
            senderName: msg.senderName,
            text: msg.text,
            timestamp: Date.now(),
          }]);
        }
        // For game events, push to remoteEvents queue
        else {
          setRemoteEvents(prev => [...prev, { ...msg, _timestamp: Date.now() }]);
        }

        // Also forward to registered handlers
        messageHandlersRef.current.forEach(handler => handler(msg, conn));
      } catch { /* ignore malformed */ }
    });

    conn.on('close', () => {
      connectionsRef.current = connectionsRef.current.filter(c => c.id !== conn.peer);
      setConnections([...connectionsRef.current]);
      setRemoteEvents(prev => [...prev, {
        type: 'PLAYER_LEFT',
        playerId: conn.peer,
        _timestamp: Date.now(),
      }]);
    });

    conn.on('error', (err) => {
      console.warn('Connection error:', err);
    });
  }, [isHost]);

  // ── HOST: Create room ──
  const createRoom = useCallback(async (playerName = 'Host') => {
    cleanup();
    const code = generateRoomCode();
    const fullId = ROOM_PREFIX + code;

    return new Promise((resolve, reject) => {
      const p = createPeer(fullId);

      p.on('open', (id) => {
        setPeer(p);
        peerRef.current = p;
        setPeerId(id);
        setRoomCode(code);
        setIsHost(true);
        isHostRef.current = true; // Sync ref with state
        setConnected(true);
        setMessages(prev => [...prev, {
          id: 'sys-1',
          system: true,
          text: `Room created! Code: ${code}`,
          timestamp: Date.now(),
        }]);
        resolve(code);
      });

      p.on('connection', (conn) => {
        handleConnection(conn, fullId);
        // Host notifies others
        broadcast({
          type: 'PLAYER_JOINED',
          playerId: conn.peer,
          playerName: `Player ${connectionsRef.current.length + 1}`,
        });
      });

      p.on('error', (err) => {
        setError(err.message);
        reject(err);
      });
    });
  }, [createPeer, generateRoomCode, handleConnection, cleanup]);

  // ── JOIN: Connect to room ──
  const joinRoom = useCallback(async (code, playerName = 'Player') => {
    cleanup();
    const fullId = ROOM_PREFIX + code;
    // Generate random unique peer ID
    let myId;
    if (typeof window !== 'undefined' && window.crypto) {
      const array = new Uint32Array(4);
      window.crypto.getRandomValues(array);
      myId = ROOM_PREFIX + array.join('');
    } else {
      myId = ROOM_PREFIX + Date.now() + Math.random().toString(36).slice(2, 6);
    }

    return new Promise((resolve, reject) => {
      const p = createPeer(myId);
      let settled = false;
      let timeoutId = null;

      const finish = (fn) => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        fn();
      };

      p.on('open', (id) => {
        setPeer(p);
        peerRef.current = p;
        setPeerId(id);
        setIsHost(false);
        isHostRef.current = false; // Joiner is not host

        // Connect to host
        const conn = p.connect(fullId, { reliable: true });

        conn.on('open', () => {
          finish(() => {
            setError(null);
            setRoomCode(code);
            setConnected(true);
            isHostRef.current = false; // Joiner is not host

            const connInfo = { id: conn.peer, conn };
            connectionsRef.current = [connInfo];
            setConnections([connInfo]);

            handleConnection(conn, fullId);

            setMessages(prev => [...prev, {
              id: 'sys-join',
              system: true,
              text: `Joined room ${code}`,
              timestamp: Date.now(),
            }]);

            resolve();
          });
        });

        conn.on('error', (err) => {
          finish(() => {
            setError('Failed to connect: ' + err.message);
            reject(err);
          });
        });

        // Timeout
        timeoutId = setTimeout(() => {
          finish(() => {
            setError('Connection timed out. Check the room code.');
            reject(new Error('Connection timeout'));
          });
        }, 10000);
      });

      p.on('error', (err) => {
        finish(() => {
          setError(err.message);
          reject(err);
        });
      });
    });
  }, [createPeer, handleConnection, cleanup, connected]);

  // ── Broadcast a message to ALL connected peers ──
  const broadcast = useCallback((data, excludeConn = null) => {
    const msgStr = typeof data === 'string' ? data : JSON.stringify(data);
    connectionsRef.current.forEach(({ conn }) => {
      if (conn !== excludeConn && conn.open) {
        try {
          conn.send(msgStr);
        } catch { /* ignore dead connections */ }
      }
    });
  }, []);

  // ── Send chat message ──
  const sendChat = useCallback((text) => {
    const msg = {
      type: 'CHAT',
      senderId: peerId,
      senderName: isHostRef.current ? 'Host' : 'Player',
      text,
      timestamp: Date.now(),
    };
    // Cap messages to prevent unbounded growth
    setMessages(prev => [...prev.slice(-99), { ...msg, id: Date.now() + Math.random() }]);
    broadcast(msg);
  }, [peerId, broadcast]);

  // ── Send game state to all peers ──
  const sendGameState = useCallback((gameState) => {
    broadcast({ type: 'GAME_STATE', gameState });
  }, [broadcast]);

  // ── Send DICE_ROLL event ──
  const sendDiceRoll = useCallback((value) => {
    broadcast({ type: 'DICE_ROLL', playerId: peerId, value });
  }, [peerId, broadcast]);

  // ── Send TOKEN_MOVE event ──
  const sendTokenMove = useCallback((tokenIndex, gameState) => {
    broadcast({ type: 'TOKEN_MOVE', playerId: peerId, tokenIndex, gameState });
  }, [peerId, broadcast]);

  // ── Send GAME_START ──
  const sendGameStart = useCallback((gameState, players) => {
    broadcast({ type: 'GAME_START', gameState, players });
  }, [broadcast]);

  // ── Track connection count (memoised — stable reference) ──
  const playerCount = useMemo(() => connections.length + 1, [connections]);
  const allPeers = useMemo(() => [peerId, ...connections.map(c => c.id)], [peerId, connections]);

  // ── Keepalive interval ──
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      broadcast({ type: 'KEEPALIVE' });
    }, 15000);
    return () => clearInterval(interval);
  }, [connected, broadcast]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    peer,
    peerId,
    roomCode,
    isHost,
    connected,
    error,
    messages,
    connections,
    playerCount,
    allPeers,
    remoteEvents,

    // Actions
    createRoom,
    joinRoom,
    cleanup,
    broadcast,
    sendChat,
    sendGameState,
    sendDiceRoll,
    sendTokenMove,
    sendGameStart,
    onRemoteEvent,
    setMessages,
  };
}
