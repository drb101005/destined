import { useEffect, useRef } from 'react';

export default function VideoTile({ label, stream, muted = false, accent = 'neutral', statusText = '' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) {
      return;
    }

    if (stream) {
      node.srcObject = stream;
      node.play().catch(() => {
        // Some browsers defer autoplay until the stream has active tracks.
      });
    } else {
      node.srcObject = null;
    }
  }, [stream]);

  return (
    <figure className={`video-tile ${accent}`}>
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      {!stream ? <div className="video-empty">No video yet</div> : null}
      {statusText ? <div className="video-status">{statusText}</div> : null}
      <figcaption>{label}</figcaption>
    </figure>
  );
}
