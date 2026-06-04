# PRD: Ludo Quality of Life & UX Upgrade

**Project:** `c:\Users\irvan\Documents\GAMELUDO-DEEPSEEK\ludo-multiplayer`
**Theme:** Claymorphism
**Stack:** React 18, Vite 5, WebRTC (PeerJS), CSS3

---

## 1. Goals

1. Make the Ludo game feel **alive**: every action must have visible motion.
2. Make the game state **readable**: users can see what just happened, what's about to happen, and what's possible.
3. Reduce cognitive load: less guessing, more obvious affordances.
4. Polish the **micro-interactions** that separate good games from great ones.

## 2. Feature Set (Prioritized)

### P0 — Critical UX (must-have)
- **F1. Per-cell step animation.** When a token moves N steps, animate it cell-by-cell (60-80ms per step) along the path so players can see the journey, not a teleport.
- **F2. Token stacking visualization.** When 2+ tokens share a cell, render them as a visible stack (offset overlap with connector / count badge) so it's obvious the position is contested or combined.
- **F3. Move preview on hover.** Hovering a movable token shows a glowing ghost on the destination cell so the player knows where the token will land.
- **F4. Invalid-move feedback.** If a token click is rejected (e.g. wrong turn, not movable), the token shakes + plays a "deny" tick.

### P1 — Strong QoL
- **F5. Toast notifications.** Brief, top-center toasts for: "Player X rolled 6! Extra turn.", "You captured Blue's token!", "You reached HOME!", "Three 6s — turn forfeited."
- **F6. Progress bars on player panel.** Each player's home progress shown as a thin fill bar (0% → 100%) in their color.
- **F7. Auto-move indicator.** When only 1 token is movable, briefly highlight it with a "auto-move" ring and a small countdown.
- **F8. Consecutive-sixes counter.** Show small dice icons (●●●) on the side so players can see how close they are to losing a turn.

### P2 — Polish
- **F9. Keyboard shortcuts.** `Space` rolls dice. `1`/`2`/`3`/`4` move the corresponding token. `M` mutes.
- **F10. Sound mute toggle.** Persistent setting stored in `localStorage`.
- **F11. Turn timer (soft).** 30s after a roll, the movable tokens start to fade-pulse to nudge the player.
- **F12. Dice history strip.** Last 5 dice rolls visible as small dots in a corner, so players can see the rhythm.

---

## 3. Architecture

### 3.1. State Additions (GameContext)
- `toast: { id, message, type, duration }` — single toast slot.
- `soundEnabled: boolean` — for F10.
- `diceHistory: number[]` — last 5 dice values, for F12.
- `lastMoveAnim: { token, from, to, player }` — for F1.
- `invalidShakeToken: { player, token, key }` — for F4.

### 3.2. Component Changes
- **`Token.jsx`** — accept `stackCount`, `stackIndex`, `isDestinationPreview` props. Add `data-token-id` for targeting.
- **`GameBoard.jsx`** — orchestrate per-step animation; render destination preview layer.
- **New `Toast.jsx`** — top-center, auto-dismiss.
- **New `useToast` hook** — emits and clears toasts.
- **New `DiceHistory.jsx`** — small component on the right panel.
- **`Dice.jsx`** — emit `onRoll` for keyboard handler; show `consecutiveSixes` dots.

### 3.3. Animation Strategy
- **Per-step movement (F1)**: When a token moves N steps, instead of jumping to the final `steps` value, animate the visual position through each intermediate cell with a setTimeout queue (`setTimeout(..., 70 * i)`). Final state matches the real game state. Total duration `N * 70ms`. After animation completes, dispatch real state update.
- **Token stacking (F2)**: Pass `tokensHere.length` to Token via `stackCount`. CSS offsets each token by `stackIndex * 30%`. Add a connector line/ribbon between the top and bottom. For 2+ tokens, the cell gets a subtle pulsing border.
- **Move preview (F3)**: For each movable token, render an absolutely-positioned `.move-preview-dot` at the destination cell with `--color` matching the player. Hovering the token boosts preview opacity.
- **Invalid shake (F4)**: Add `.token-shake` class temporarily (250ms) when click is invalid.

### 3.4. Toast System
- Single global toast at the top of the screen. Uses a `useToast` hook in GameContext.
- Types: `info` (default), `success` (green), `warning` (yellow), `error` (red), `capture` (mixed colors), `win` (gold).
- Auto-dismiss after 2.5s (configurable).
- Stack vertically: max 3 visible at once.

### 3.5. CSS Animations
- `@keyframes token-step` — translate from old cell to new cell. Use `cubic-bezier(0.4, 0, 0.2, 1)`.
- `@keyframes token-shake` — rotate ±10deg, 6 cycles.
- `@keyframes preview-pulse` — scale 1 → 1.2 → 1, infinite.
- `@keyframes toast-in` — slide down from top.
- `@keyframes toast-out` — slide up, fade.

### 3.6. Performance
- Per-step animation should not block input. Use `requestAnimationFrame` + `setTimeout` queues.
- `will-change: transform` on animated tokens to hint the GPU.
- Avoid re-renders: track per-token animation state in a ref.

---

## 4. Rollout Plan

1. **Sprint 1** — Foundation: state additions, Toast system, Toast component, CSS animation library additions. *Verify build + load.*
2. **Sprint 2** — F1 + F2 + F3 + F4 (movement + stack + preview + shake). *Verify in browser.*
3. **Sprint 3** — F5 + F6 + F7 + F8 (toasts, progress bars, auto-move highlight, sixes counter). *Verify in browser.*
4. **Sprint 4** — F9 + F10 + F11 + F12 (keyboard, mute, soft timer, dice history). *Final verification.*

## 5. Out of Scope (this PRD)
- Re-skinning the board (already done).
- Adding multiplayer features beyond existing WebRTC.
- Mobile-only gestures (desktop is the primary target).
- Sound effects library changes.

## 6. Acceptance Criteria

- A token rolling a 6 must visibly traverse each cell, not teleport.
- 2+ tokens on the same cell must look obviously stacked (offset, count badge, pulse).
- Hovering a movable token shows a destination preview ghost.
- Invalid token clicks give clear shake feedback.
- Captures, sixes, and home entries each trigger a brief, readable toast.
- Player panel shows a 0–100% progress bar matching `homeCount / 4 * 100`.
- `Space` rolls the dice; `1/2/3/4` moves the corresponding token (when movable).
- Sound toggle persists across sessions.
- Build is clean: 0 errors, 0 console errors during a full game.

## 7. Risks

- **Animation timing vs. multiplayer sync.** Per-step animation delays the state update, which can desync multiplayer. Mitigation: per-step animation is local only; the dispatched state update is still the final value.
- **Token re-render storms.** Animating 4 tokens across 50 steps in quick succession can thrash React. Mitigation: use refs to track animation state, only re-render the moving token.
- **CSS specificity.** Adding new classes to existing tokens could break existing styles. Mitigation: namespace new classes with `token-` prefix and use additive styles.
