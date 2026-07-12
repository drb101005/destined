export default function StatsPanel({ open, onToggle, stats, tier, transitions, connectionState, roomCode, peerCount, onCopy }) {
  if (!open) {
    return (
      <button className="stats-toggle" onClick={onToggle} type="button">
        [stats]
      </button>
    );
  }

  return (
    <aside className="stats-panel">
      <button className="stats-toggle" onClick={onToggle} type="button">
        [stats]
      </button>
      <div className="stats-panel__content">
        <div className="stats-head">
          <strong>{tier.name}</strong>
          <span>{connectionState}</span>
        </div>
        <div className="grid-2">
          <Stat label="RTT" value={`${Math.round(stats.rttMs || 0)} ms`} />
          <Stat label="Jitter" value={`${Math.round(stats.jitterMs || 0)} ms`} />
          <Stat label="Packet loss" value={`${(stats.packetLossPercent || 0).toFixed(1)}%`} />
          <Stat label="Avail. bitrate" value={`${Math.round(stats.availableBitrateKbps || 0)} kbps`} />
          <Stat label="Signaling RTT" value={`${Math.round(stats.signalingRttMs || 0)} ms`} />
          <Stat label="Peers" value={`${peerCount || 0}`} />
          <Stat label="Room" value={roomCode || '—'} />
          <Stat label="Bytes sent" value={`${Math.round(stats.bytesSent || 0)}`} />
        </div>
        <div className="transition-log">
          {transitions.slice(-10).reverse().map((entry) => (
            <div key={`${entry.at}-${entry.to}`}>
              {new Date(entry.at).toLocaleTimeString()} - {entry.from} → {entry.to}
            </div>
          ))}
        </div>
        <button type="button" className="button button-secondary" onClick={onCopy}>
          Copy stats snapshot
        </button>
      </div>
    </aside>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

