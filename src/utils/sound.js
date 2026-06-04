/**
 * sound.js — Web Audio API synthetic sound effects
 *
 * All sounds are generated procedurally — no audio files needed.
 * Uses AudioContext with oscillators and gain envelopes.
 *
 * Sound can be globally muted via localStorage 'ludo-sound-enabled'.
 */

let audioCtx = null;

/** Lazily create the AudioContext (must be from user gesture) */
function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/** Check if sound is enabled (default: true) */
function isSoundEnabled() {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('ludo-sound-enabled') !== 'false';
}

/**
 * Play a tone with given parameters.
 * @param {number} freq      — frequency in Hz
 * @param {string} type      — oscillator type (sine, square, triangle, sawtooth)
 * @param {number} duration  — seconds
 * @param {number} volume    — 0-1
 * @param {number} [delay=0] — seconds to wait before playing
 */
function playTone(freq, type, duration, volume, delay = 0) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

    gain.gain.setValueAtTime(volume * 0.3, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + delay);
    osc.stop(ctx.currentTime + delay + duration);
  } catch { /* silent */ }
}

/** Play a short ascending arpeggio — dice roll complete */
export function playDiceRoll() {
  if (!isSoundEnabled()) return;
  const ctx = getCtx();
  const now = ctx.currentTime;
  // Noise burst simulating dice rattle
  for (let i = 0; i < 6; i++) {
    const freq = 200 + Math.random() * 600;
    playTone(freq, 'square', 0.04, 0.15, i * 0.04);
  }
  // Final "thud"
  playTone(120, 'sine', 0.15, 0.5, 0.3);
  playTone(180, 'sine', 0.1, 0.3, 0.32);
}

/** Short ascending beep — token moved successfully */
export function playMove() {
  if (!isSoundEnabled()) return;
  playTone(440, 'sine', 0.08, 0.3, 0);
  playTone(554, 'sine', 0.08, 0.3, 0.06);
  playTone(659, 'sine', 0.12, 0.3, 0.12);
}

/** Descending buzz — token captured */
export function playCapture() {
  if (!isSoundEnabled()) return;
  playTone(400, 'sawtooth', 0.1, 0.3, 0);
  playTone(300, 'sawtooth', 0.1, 0.3, 0.08);
  playTone(200, 'sawtooth', 0.15, 0.3, 0.16);
}

/** Bright rising chime — token reached home */
export function playHomeEntry() {
  if (!isSoundEnabled()) return;
  playTone(523, 'sine', 0.12, 0.3, 0);
  playTone(659, 'sine', 0.12, 0.3, 0.1);
  playTone(784, 'sine', 0.12, 0.3, 0.2);
  playTone(1047, 'sine', 0.2, 0.4, 0.3);
}

/** Triumphant fanfare — player wins */
export function playWin() {
  if (!isSoundEnabled()) return;
  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    playTone(freq, 'sine', 0.2, 0.4, i * 0.12);
  });
  // Extra sparkle
  playTone(1568, 'sine', 0.3, 0.3, 0.8);
  playTone(2093, 'sine', 0.4, 0.2, 1.0);
}

/** Short click — button press or UI interaction */
export function playClick() {
  if (!isSoundEnabled()) return;
  playTone(800, 'square', 0.03, 0.2, 0);
}

/** Low boop — player joined/left lobby */
export function playNotification() {
  if (!isSoundEnabled()) return;
  playTone(350, 'sine', 0.1, 0.2, 0);
  playTone(440, 'sine', 0.1, 0.2, 0.1);
}
