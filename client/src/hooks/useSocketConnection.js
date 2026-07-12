import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

export function useSocketConnection(serverUrl) {
  const [socket, setSocket] = useState(null);
  const [status, setStatus] = useState('idle');

  const normalizedUrl = useMemo(() => String(serverUrl || '').trim(), [serverUrl]);

  useEffect(() => {
    if (!normalizedUrl) {
      return undefined;
    }

    const nextSocket = io(normalizedUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    setSocket(nextSocket);
    setStatus('connecting');

    nextSocket.on('connect', () => {
      console.log('connected');
      setStatus('connected');
    });
    nextSocket.on('disconnect', () => setStatus('disconnected'));
    nextSocket.on('connect_error', () => setStatus('error'));

    return () => {
      nextSocket.disconnect();
      setSocket(null);
      setStatus('idle');
    };
  }, [normalizedUrl]);

  return { socket, status };
}

