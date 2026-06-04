/**
 * gameLogic.js — Complete Ludo game engine
 *
 * Board: 15×15 grid (rows 0-14, cols 0-14).
 * Uses a 52-cell main track + 4 home stretches (6 cells each) + center.
 *
 * TOKEN POSITION MODEL (simplified):
 *   null                → in base
 *   { steps }:
 *     0-51              → on MAIN_TRACK at index (ENTRY_POSITIONS[player] + steps) % 52
 *     52-57             → on HOME_STRETCH[player][steps - 52]
 *     58                → HOME (center, finished)
 *
 * Color convention:
 *   0 = RED    (top-left corner,     rows 0-5,  cols 0-5)
 *   1 = GREEN  (top-right corner,    rows 0-5,  cols 9-14)
 *   2 = YELLOW (bottom-right corner, rows 9-14, cols 9-14)
 *   3 = BLUE   (bottom-left corner,  rows 9-14, cols 0-5)
 */

// ──────────────────────────────────────────────
// 1. BOARD PATH DEFINITIONS
// ──────────────────────────────────────────────

/** 52-cell outer loop as [row, col] on the 15×15 grid. Clockwise. */
export const MAIN_TRACK = [
  [6, 0],  [6, 1],  [6, 2],  [6, 3],  [6, 4],  [6, 5],   //  0-5   ← Red enters at 0
  [5, 6],  [4, 6],  [3, 6],  [2, 6],  [1, 6],  [0, 6],   //  6-11
  [0, 7],  [0, 8],                                         // 12-13  ← Green enters at 13
  [1, 8],  [2, 8],  [3, 8],  [4, 8],  [5, 8],             // 14-18
  [6, 9],  [6,10],  [6,11],  [6,12],  [6,13],  [6,14],    // 19-24
  [7,14],  [8,14],                                         // 25-26  ← Yellow enters at 26
  [8,13],  [8,12],  [8,11],  [8,10],  [8, 9],             // 27-31
  [9, 8],  [10,8],  [11,8],  [12,8],  [13,8],  [14,8],    // 32-37
  [14,7],  [14,6],                                         // 38-39  ← Blue enters at 39
  [13,6],  [12,6],  [11,6],  [10,6],  [9, 6],             // 40-44
  [8, 5],  [8, 4],  [8, 3],  [8, 2],  [8, 1],  [8, 0],   // 45-50
  [7, 0],                                                 // 51
];

/**
 * Absolute track index where each player's token first lands
 * when it enters from base.
 */
export const ENTRY_POSITIONS = {
  0: 0,    // Red   → MAIN_TRACK[0]  = (6,0)
  1: 13,   // Green → MAIN_TRACK[13] = (0,8)
  2: 26,   // Yellow→ MAIN_TRACK[26] = (8,14)
  3: 39,   // Blue  → MAIN_TRACK[39] = (14,7)
};

/** 6 home-stretch cells per player leading to centre. */
export const HOME_STRETCH = {
  0: [[7,1], [7,2], [7,3], [7,4], [7,5], [7,6]],    // Red   → right along row 7
  1: [[1,7], [2,7], [3,7], [4,7], [5,7], [6,7]],    // Green → down  along col 7
  2: [[7,13],[7,12],[7,11],[7,10],[7,9], [7,8]],     // Yellow→ left  along row 7
  3: [[13,7],[12,7],[11,7],[10,7],[9,7], [8,7]],     // Blue  → up    along col 7
};

export const CENTER_CELL = [7, 7];

/**
 * Safe spots (absolute track indices). Tokens here cannot be captured.
 */
export const SAFE_SPOTS = new Set([
  0,    // Red entry
  8,    // Middle of left column
  13,   // Green entry
  21,   // Middle of top row
  26,   // Yellow entry
  34,   // Middle of right column
  39,   // Blue entry
  47,   // Middle of bottom row
]);

// ──────────────────────────────────────────────
// 2. COLOR HELPERS
// ──────────────────────────────────────────────

export const PLAYER_COLORS = {
  0: { name: 'Red',   css: 'red',   hex: '#ff3355', light: '#ff6688' },
  1: { name: 'Green', css: 'green', hex: '#33ff77', light: '#66ff99' },
  2: { name: 'Yellow',css: 'yellow',hex: '#ffdd33', light: '#ffee66' },
  3: { name: 'Blue',  css: 'blue',  hex: '#3388ff', light: '#66aaff' },
};

// ──────────────────────────────────────────────
// 3. DICE
// ──────────────────────────────────────────────

export function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// ──────────────────────────────────────────────
// 4. INITIAL STATE
// ──────────────────────────────────────────────

export function createInitialState(playerCount = 4) {
  const players = {};
  for (let p = 0; p < playerCount; p++) {
    players[p] = {
      tokens: [null, null, null, null], // null = in base
      homeCount: 0,
      color: p,
    };
  }
  return {
    players,
    currentPlayer: 0,
    diceValue: null,
    diceRolled: false,
    gameOver: false,
    winner: null,
    consecutiveSixes: 0,
    turnPhase: 'roll',   // 'roll' | 'move'
    playerCount,
  };
}

// ──────────────────────────────────────────────
// 5. POSITION HELPERS
// ──────────────────────────────────────────────

/**
 * Convert a token's steps into [row, col] on the 15×15 grid.
 * @param {{ steps: number } | null} token
 * @param {number} playerIndex
 * @returns {[number, number] | null}
 */
export function getTokenCoords(token, playerIndex) {
  if (!token) return null;                         // in base
  if (token.steps >= 58) return CENTER_CELL;       // home
  if (token.steps >= 52) {
    // On home stretch: steps 52 → idx 0, 53 → idx 1, …, 57 → idx 5
    return HOME_STRETCH[playerIndex][token.steps - 52];
  }
  // On main track: absolute index = (entry + steps) % 52
  const absIdx = (ENTRY_POSITIONS[playerIndex] + token.steps) % 52;
  return MAIN_TRACK[absIdx];
}

// ──────────────────────────────────────────────
// 6. MOVE VALIDATION
// ──────────────────────────────────────────────

export function getMovableTokens(state, playerIndex) {
  const player = state.players[playerIndex];
  const dice = state.diceValue;
  const movable = [];
  for (let t = 0; t < 4; t++) {
    if (canMoveToken(state, playerIndex, t, dice)) {
      movable.push(t);
    }
  }
  return movable;
}

export function canMoveToken(state, playerIndex, tokenIndex, dice) {
  const token = state.players[playerIndex].tokens[tokenIndex];

  if (token?.steps >= 58) return false;    // already home
  if (!token) return dice === 6;           // in base, need 6

  const newSteps = token.steps + dice;
  // Cannot overshoot centre (beyond step 58)
  return newSteps <= 58;
}

// ──────────────────────────────────────────────
// 7. CAPTURE
// ──────────────────────────────────────────────

/**
 * Check if a token landing at `steps` captures any opponent.
 * Only applies when token is on the main track (steps 0-51).
 */
function checkCapture(state, playerIndex, steps) {
  if (steps >= 52) return null;   // home stretch / home — no captures
  const absIdx = (ENTRY_POSITIONS[playerIndex] + steps) % 52;
  if (SAFE_SPOTS.has(absIdx)) return null;

  const captures = [];
  for (let p = 0; p < state.playerCount; p++) {
    if (p === playerIndex) continue;
    for (let t = 0; t < 4; t++) {
      const tok = state.players[p].tokens[t];
      if (!tok || tok.steps >= 52) continue;   // not on main track
      const otherAbs = (ENTRY_POSITIONS[p] + tok.steps) % 52;
      if (otherAbs === absIdx) {
        captures.push({ player: p, token: t });
      }
    }
  }
  return captures.length > 0 ? captures : null;
}

// ──────────────────────────────────────────────
// 8. EXECUTE MOVE
// ──────────────────────────────────────────────

export function executeMove(state, playerIndex, tokenIndex) {
  const newState = JSON.parse(JSON.stringify(state));
  const player = newState.players[playerIndex];
  const token = player.tokens[tokenIndex];
  const dice = newState.diceValue;

  let captured = null;

  if (!token) {
    // ── Enter from base ──
    player.tokens[tokenIndex] = { steps: 0 };
    captured = checkCapture(newState, playerIndex, 0);
  } else {
    // ── Move forward on track / home stretch ──
    const newSteps = token.steps + dice;
    if (newSteps > 58) {
      // Cannot overshoot — invalid move (validation should prevent)
      return state;
    }
    player.tokens[tokenIndex] = { steps: newSteps };

    if (newSteps >= 58) {
      player.homeCount++;
    } else if (newSteps < 52) {
      // Still on main track — check capture
      captured = checkCapture(newState, playerIndex, newSteps);
    }
    // steps 52-57 = home stretch, no captures possible
  }

  // ── Apply captures ──
  if (captured) {
    for (const cap of captured) {
      newState.players[cap.player].tokens[cap.token] = null;
    }
  }

  // ── Advance turn ──
  if (dice === 6) {
    newState.consecutiveSixes++;
    if (newState.consecutiveSixes >= 3) {
      // Three consecutive 6's — lose turn
      newState.consecutiveSixes = 0;
      advanceTurn(newState);
    } else {
      // Roll again
      newState.diceValue = null;
      newState.diceRolled = false;
      newState.turnPhase = 'roll';
    }
  } else {
    newState.consecutiveSixes = 0;
    advanceTurn(newState);
  }

  // ── Win check ──
  if (player.homeCount >= 4) {
    newState.gameOver = true;
    newState.winner = playerIndex;
  }

  return newState;
}

/**
 * Roll dice for current player. Returns new state.
 * If no token can move, the turn is forfeited automatically.
 */
export function rollDiceForCurrent(state) {
  const newState = JSON.parse(JSON.stringify(state));
  const value = rollDice();
  newState.diceValue = value;
  newState.diceRolled = true;

  const movable = getMovableTokens(newState, newState.currentPlayer);

  if (movable.length === 0) {
    // No token can move — auto-advance turn
    if (value === 6) {
      newState.consecutiveSixes++;
      if (newState.consecutiveSixes >= 3) {
        newState.consecutiveSixes = 0;
        advanceTurn(newState);
        return newState;
      }
    }
    newState.consecutiveSixes = 0;
    advanceTurn(newState);
    return newState;
  }

  newState.turnPhase = 'move';
  return newState;
}

function advanceTurn(state) {
  state.currentPlayer = (state.currentPlayer + 1) % state.playerCount;
  state.diceValue = null;
  state.diceRolled = false;
  state.turnPhase = 'roll';
}

// ──────────────────────────────────────────────
// 9. CELL TYPE LOOKUP (for rendering)
// ──────────────────────────────────────────────

export function getCellType(row, col) {
  if (row === 7 && col === 7) return 'center';

  // Home stretches
  for (const [player, stretch] of Object.entries(HOME_STRETCH)) {
    for (const [r, c] of stretch) {
      if (r === row && c === col) return `home-stretch-${PLAYER_COLORS[player].css}`;
    }
  }

  // Main track
  for (let i = 0; i < MAIN_TRACK.length; i++) {
    if (MAIN_TRACK[i][0] === row && MAIN_TRACK[i][1] === col) {
      return SAFE_SPOTS.has(i) ? 'safe' : 'path';
    }
  }

  // Bases (corners)
  if (row <= 5 && col <= 5) return 'base-red';
  if (row <= 5 && col >= 9) return 'base-green';
  if (row >= 9 && col >= 9) return 'base-yellow';
  if (row >= 9 && col <= 5) return 'base-blue';

  return null;
}

/**
 * Get the 4 base-spot coordinates where a player's tokens
 * sit inside their coloured corner.
 */
export function getBaseTokenPositions(playerIndex) {
  const corners = [
    { r: 1, c: 1 }, { r: 1, c: 4 },
    { r: 4, c: 1 }, { r: 4, c: 4 },
  ];
  const offsets = [
    { r: 0, c: 0 },   // Red    (rows 0-5, cols 0-5)
    { r: 0, c: 9 },   // Green  (rows 0-5, cols 9-14)
    { r: 9, c: 9 },   // Yellow (rows 9-14, cols 9-14)
    { r: 9, c: 0 },   // Blue   (rows 9-14, cols 0-5)
  ];
  const o = offsets[playerIndex];
  return corners.map(c => [o.r + c.r, o.c + c.c]);
}

// ──────────────────────────────────────────────
// 10. AI (Bot) — Smart move selection
// ──────────────────────────────────────────────

/**
 * Pick the best move for a bot player using heuristic scoring.
 *
 * Priority (highest → lowest):
 *   1. Capture an opponent token
 *   2. Move a token that's already on the home stretch (closer to centre)
 *   3. Enter home stretch from the main track
 *   4. Bring a new token out of base (requires rolling 6)
 *   5. Move the token that is farthest ahead on the main track
 *   6. Land on a safe spot if possible
 *   7. Random fallback
 *
 * @param {object} state        — Current game state
 * @param {number} playerIndex  — Bot player index
 * @returns {number|null}       — Index of the token to move, or null
 */
export function getAIMove(state, playerIndex) {
  const movable = getMovableTokens(state, playerIndex);
  if (movable.length === 0) return null;
  if (movable.length === 1) return movable[0];

  const player = state.players[playerIndex];
  const dice = state.diceValue;
  let bestToken = movable[0];
  let bestScore = -9999;

  for (const t of movable) {
    let score = 0;
    const token = player.tokens[t];

    // ── Token is in base — rolling 6 to enter ──
    if (!token) {
      // Bringing a token out is always good if we have fewer than 4 out
      const onTrack = player.tokens.filter(tok => tok !== null && tok.steps < 58).length;
      score += 25;
      // Better to bring out if we have few tokens on the board
      score += (3 - onTrack) * 5;
      if (onTrack === 0) score += 10; // First token is extra important
    }
    //
    // ── Token is on the board ──
    else {
      const newSteps = token.steps + dice;

      // --- PRIORITY 1: Capture opponent ---
      if (token.steps < 52 && newSteps < 52) {
        const newAbs = (ENTRY_POSITIONS[playerIndex] + newSteps) % 52;
        if (!SAFE_SPOTS.has(newAbs)) {
          for (let p = 0; p < state.playerCount; p++) {
            if (p === playerIndex) continue;
            for (let ot = 0; ot < 4; ot++) {
              const otok = state.players[p].tokens[ot];
              if (otok && otok.steps < 52) {
                const oAbs = (ENTRY_POSITIONS[p] + otok.steps) % 52;
                if (oAbs === newAbs) {
                  score += 150; // Capture!
                }
              }
            }
          }
        }
      }

      // --- PRIORITY 2: Reaching home (winning move) ---
      if (newSteps >= 58) {
        score += 200;
      }
      // --- Moving forward on home stretch ---
      else if (token.steps >= 52) {
        score += 60;
        score += (58 - newSteps) * 4; // Closer to centre = better
      }
      // --- Entering home stretch ---
      else if (newSteps >= 52) {
        score += 50;
      }

      // --- Progress heuristic (farther tokens are generally better) ---
      score += token.steps * 0.3;

      // --- Safe spot landing ---
      if (newSteps < 52) {
        const newAbs = (ENTRY_POSITIONS[playerIndex] + newSteps) % 52;
        if (SAFE_SPOTS.has(newAbs)) {
          score += 12;
        }
      }

      // --- Slight randomness to make bot behaviour varied ---
      score += Math.random() * 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestToken = t;
    }
  }

  return bestToken;
}

/**
 * Simple random fallback (used if AI scoring fails).
 */
export function pickRandomMove(state) {
  const movable = getMovableTokens(state, state.currentPlayer);
  if (movable.length === 0) return null;
  return movable[Math.floor(Math.random() * movable.length)];
}
