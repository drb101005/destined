import { useState } from 'react';

export default function ChatPanel({ messages, onSendMessage, onSendVoiceNote, onToggleTextFallback, modeName }) {
  const [message, setMessage] = useState('');

  return (
    <section className="chat-panel">
      <div className="chat-panel__head">
        <h2>Chat</h2>
        <span>{modeName}</span>
      </div>
      <div className="chat-log">
        {messages.map((entry) => (
          <div key={entry.id} className={`chat-bubble ${entry.kind}`}>
            <span className="chat-meta">{entry.kind}</span>
            <p>{entry.text}</p>
          </div>
        ))}
      </div>
      <form
        className="chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim()) {
            return;
          }
          onSendMessage(message.trim());
          setMessage('');
        }}
      >
        <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type a message" />
        <button className="button" type="submit">Send</button>
      </form>
      <div className="chat-actions">
        <button className="button button-secondary" type="button" onClick={onSendVoiceNote}>
          Voice note
        </button>
        <button className="button button-secondary" type="button" onClick={onToggleTextFallback}>
          Toggle fallback
        </button>
      </div>
    </section>
  );
}

