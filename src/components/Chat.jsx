/**
 * Chat.jsx — Simple in-game chat component
 *
 * Renders a scrollable message list with an input bar.
 * Messages from the local user are right-aligned;
 * others are left-aligned with the sender name.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { playClick } from '../utils/sound';

export default function Chat() {
  const { messages, sendChat } = useGame();
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendChat(text);
    setInput('');
    playClick();
  };

  return (
    <div className="chat-container clay-card" style={{ padding: '12px' }}>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>
        💬 Chat
      </div>
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <div className="chat-msg">
            <span className="chat-system">No messages yet...</span>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="chat-msg">
            {msg.system ? (
              <span className="chat-system">{msg.text}</span>
            ) : (
              <>
                <span className="chat-sender" style={{ color: 'var(--color-blue)' }}>
                  {msg.senderName}:
                </span>
                <span>{msg.text}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          className="input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={200}
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          Send
        </button>
      </form>
    </div>
  );
}
