import { useMemo } from 'react';

export default function ConnectionSetup({
  serverUrl,
  setServerUrl,
  roomCode,
  setRoomCode,
  password,
  setPassword,
  onConnect,
  status
}) {
  const normalizedRoom = useMemo(() => roomCode.toUpperCase().replace(/[^A-Z0-9-]/g, ''), [roomCode]);

  return (
    <section className="setup-card">
      <div className="setup-copy">
        <p className="eyebrow">Adaptive calling</p>
        <h1>Keep the call alive when the network gets rough.</h1>
        <p>
          Enter the signaling server, room code, and optional room password, then join the room.
        </p>
      </div>
      <div className="setup-form">
        <label>
          Server URL
          <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} placeholder="http://localhost:3001" />
        </label>
        <label>
          Room code
          <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="MANGO-42" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="optional shared secret" />
        </label>
        <button className="button" type="button" onClick={() => onConnect(normalizedRoom)}>
          {status === 'connected' ? 'Join room' : 'Connect'}
        </button>
        <p className="setup-status">Socket: {status}</p>
      </div>
    </section>
  );
}

