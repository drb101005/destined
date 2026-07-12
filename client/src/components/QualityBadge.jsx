export default function QualityBadge({ tier, onForceTier, activeForceTier }) {
  return (
    <div className={`quality-badge quality-${tier.name.replace(/\s+/g, '-').toLowerCase()}`}>
      <strong>{tier.name}</strong>
      <select value={activeForceTier || ''} onChange={(event) => onForceTier(event.target.value || null)}>
        <option value="">Automatic</option>
        <option value="HD Video">Force HD Video</option>
        <option value="SD Video">Force SD Video</option>
        <option value="Low Video">Force Low Video</option>
        <option value="Audio-only">Force Audio-only</option>
        <option value="Ultra-compressed voice">Force Ultra-voice</option>
        <option value="Text / voice-message fallback">Force Text fallback</option>
      </select>
    </div>
  );
}

