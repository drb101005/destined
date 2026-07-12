import { useEffect, useRef, useState } from 'react';
import { NetworkMonitor } from '../network/networkMonitor';

export function useNetworkStats({ peerConnection, socket }) {
  const [stats, setStats] = useState({
    rttMs: 0,
    jitterMs: 0,
    packetLossPercent: 0,
    availableBitrateKbps: 0,
    signalingRttMs: 0,
    bytesSent: 0,
    bytesReceived: 0
  });
  const monitorRef = useRef(null);

  useEffect(() => {
    if (!peerConnection) {
      return undefined;
    }

    const monitor = new NetworkMonitor({
      peerConnection,
      socket,
      onUpdate: setStats
    });
    monitorRef.current = monitor;
    monitor.start();

    return () => {
      monitor.stop();
      monitorRef.current = null;
    };
  }, [peerConnection, socket]);

  return stats;
}

