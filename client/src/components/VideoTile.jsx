export default function VideoTile({ label, stream, muted = false, accent = 'neutral' }) {
  return (
    <figure className={`video-tile ${accent}`}>
      <video
        ref={(node) => {
          if (node && stream && node.srcObject !== stream) {
            node.srcObject = stream;
          }
        }}
        autoPlay
        playsInline
        muted={muted}
      />
      <figcaption>{label}</figcaption>
    </figure>
  );
}

