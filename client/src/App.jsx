import { useEffect, useMemo, useRef, useState } from 'react';
import ChatPanel from './components/ChatPanel';
import ConnectionSetup from './components/ConnectionSetup';
import QualityBadge from './components/QualityBadge';
import StatsPanel from './components/StatsPanel';
import VideoTile from './components/VideoTile';
import { ADAPTIVE_CONFIG } from './adaptive/config';
import { useAdaptiveTier } from './hooks/useAdaptiveTier';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useNetworkStats } from './hooks/useNetworkStats';
import { usePeerConnection } from './hooks/usePeerConnection';
import { useSocketConnection } from './hooks/useSocketConnection';
import { applyAdaptiveMedia } from './media/applyAdaptiveMedia';

const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export default function App() {
  const [serverUrl, setServerUrl] = useLocalStorage('destined:serverUrl', DEFAULT_SERVER_URL);
  const [roomCode, setRoomCode] = useLocalStorage('destined:roomCode', 'MANGO-42');
  const [password, setPassword] = useLocalStorage('destined:roomPassword', '');
  const [statsOpen, setStatsOpen] = useLocalStorage('destined:statsOpen', true);
  const [forceTierName, setForceTierName] = useLocalStorage('destined:forceTierName', '');
  const [joinState, setJoinState] = useState('idle');
  const [roomInfo, setRoomInfo] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [messages, setMessages] = useState([]);
  const [manualTextFallback, setManualTextFallback] = useState(false);
  const [noiseSuppressionEnabled, setNoiseSuppressionEnabled] = useState(true);
  const [connectionState, setConnectionState] = useState('new');
  const [speaking, setSpeaking] = useState(false);
  const negotiationRequestedRef = useRef(false);
  const videoPreviewRef = useRef(null);
  const recorderRef = useRef(null);

  const { socket, status: socketStatus } = useSocketConnection(serverUrl);

  const { peerConnection, requestNegotiation } = usePeerConnection({
    socket,
    roomCode: roomInfo?.roomCode || '',
    localStream,
    onRemoteStream: setRemoteStream,
    onConnectionStateChange: setConnectionState
  });

  const stats = useNetworkStats({ peerConnection, socket });
  const { tier, transitionLog } = useAdaptiveTier(stats, { forceTierName: forceTierName || null });

  useEffect(() => {
    if (!localStream || !videoPreviewRef.current) {
      return;
    }

    videoPreviewRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handlePeerJoined = async () => {
      await requestNegotiation();
    };

    const handleChatMessage = (payload) => {
      setMessages((current) => [
        ...current,
        {
          id: `${payload.createdAt}-${payload.peerId}`,
          kind: 'remote',
          text: payload.message
        }
      ]);
    };

    const handleVoiceMessage = (payload) => {
      setMessages((current) => [
        ...current,
        {
          id: `${payload.createdAt}-${payload.peerId}`,
          kind: 'voice',
          text: `Voice note from ${payload.peerId.slice(0, 6)} (${Math.round((payload.data?.length || 0) / 1024)} KB)`
        }
      ]);
    };

    const handlePeerLeft = (payload) => {
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-${payload.peerId}`,
          kind: 'system',
          text: `Peer ${payload.peerId.slice(0, 6)} left the room`
        }
      ]);
      setRoomInfo((current) =>
        current
          ? {
              ...current,
              peerCount: Math.max(0, (current.peerCount || 1) - 1)
            }
          : current
      );
    };

    socket.on('peer:joined', handlePeerJoined);
    socket.on('chat:message', handleChatMessage);
    socket.on('voice:message', handleVoiceMessage);
    socket.on('peer:left', handlePeerLeft);

    return () => {
      socket.off('peer:joined', handlePeerJoined);
      socket.off('chat:message', handleChatMessage);
      socket.off('voice:message', handleVoiceMessage);
      socket.off('peer:left', handlePeerLeft);
    };
  }, [requestNegotiation, socket]);

  useEffect(() => {
    if (roomInfo?.peerCount > 1 && peerConnection && !negotiationRequestedRef.current) {
      negotiationRequestedRef.current = true;
      requestNegotiation();
    }

    if (roomInfo?.peerCount <= 1) {
      negotiationRequestedRef.current = false;
    }
  }, [peerConnection, requestNegotiation, roomInfo?.peerCount]);

  useEffect(() => {
    if (!peerConnection || !localStream) {
      return;
    }

    applyAdaptiveMedia(peerConnection, localStream, tier, { noiseSuppressionEnabled });
  }, [localStream, noiseSuppressionEnabled, peerConnection, tier]);

  useEffect(() => {
    if (!localStream) {
      return;
    }

    const shouldGateAudio =
      !speaking && (tier.name === 'Audio-only' || tier.name === 'Ultra-compressed voice');
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !shouldGateAudio;
    });
  }, [localStream, speaking, tier.name]);

  useEffect(() => {
    if (!localStream) {
      return undefined;
    }

    const audioContext = new window.AudioContext();
    const source = audioContext.createMediaStreamSource(localStream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      const rms = Math.sqrt(buffer.reduce((sum, value) => {
        const normalized = (value - 128) / 128;
        return sum + normalized * normalized;
      }, 0) / buffer.length);
      setSpeaking(rms > 0.06);
      requestAnimationFrame(tick);
    };

    tick();

    return () => {
      source.disconnect();
      analyser.disconnect();
      audioContext.close();
    };
  }, [localStream]);

  const isFallbackMode = manualTextFallback || tier.name === 'Text / voice-message fallback';
  const peerCount = roomInfo?.peerCount || (connectionState === 'connected' ? 2 : 0);

  const startCall = async (normalizedRoomCode) => {
    if (!socket) {
      setJoinState('socket not ready');
      return;
    }

    try {
      setJoinState('requesting media');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: true
      });
      setLocalStream(stream);

      const roomJoin = await new Promise((resolve) => {
        socket.emit(
          'room:join',
          { roomCode: normalizedRoomCode, password },
          (response) => resolve(response)
        );
      });

      if (!roomJoin.ok) {
        stream.getTracks().forEach((track) => track.stop());
        setJoinState(roomJoin.error || 'join failed');
        return;
      }

      setRoomInfo(roomJoin);
      setJoinState(`joined as ${roomJoin.peerId}`);
      setMessages((current) => [
        ...current,
        { id: `room-${Date.now()}`, kind: 'system', text: `Joined room ${roomJoin.roomCode}` }
      ]);
      if (roomJoin.peerCount > 1) {
        await requestNegotiation();
      }
    } catch (error) {
      setJoinState(error.message || 'media error');
    }
  };

  const sendMessage = (text) => {
    if (!socket || !roomInfo) {
      return;
    }

    socket.emit('chat:message', {
      roomCode: roomInfo.roomCode,
      message: text
    });
    setMessages((current) => [
      ...current,
      {
        id: `${Date.now()}-local`,
        kind: 'local',
        text
      }
    ]);
  };

  const sendVoiceNote = async () => {
    if (!localStream || !socket || !roomInfo) {
      return;
    }

    const recorder = new MediaRecorder(localStream, { mimeType: 'audio/webm;codecs=opus' });
    recorderRef.current = recorder;
    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const base64 = await blobToBase64(blob);
      socket.emit('voice:message', {
        roomCode: roomInfo.roomCode,
        chunkId: `voice-${Date.now()}`,
        data: base64
      });
    };

    recorder.start();
    setTimeout(() => recorder.state !== 'inactive' && recorder.stop(), 2500);
  };

  const copyStats = async () => {
    const snapshot = {
      roomCode: roomInfo?.roomCode,
      connectionState,
      socketStatus,
      tier,
      stats,
      transitionLog,
      peerCount,
      speaking,
      manualTextFallback,
      timestamp: new Date().toISOString()
    };

    await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
  };

  const tiles = useMemo(
    () => [
      { label: 'Local', stream: localStream, muted: true, accent: 'local' },
      { label: 'Remote', stream: remoteStream, muted: false, accent: 'remote' }
    ],
    [localStream, remoteStream]
  );

  if (!roomInfo) {
    return (
      <main className="page-shell">
        <ConnectionSetup
          serverUrl={serverUrl}
          setServerUrl={setServerUrl}
          roomCode={roomCode}
          setRoomCode={setRoomCode}
          password={password}
          setPassword={setPassword}
          onConnect={startCall}
          status={socketStatus}
        />
      </main>
    );
  }

  return (
    <main className="call-layout">
      <header className="call-header">
        <div>
          <p className="eyebrow">Room {roomInfo.roomCode}</p>
          <h1>Adaptive low-bandwidth call</h1>
        </div>
        <div className="header-actions">
          <QualityBadge tier={tier} onForceTier={setForceTierName} activeForceTier={forceTierName} />
          <div className="status-pill">
            <span className={`status-dot status-${socketStatus}`} />
            <span>{socketStatus}</span>
          </div>
        </div>
      </header>

      <section className="video-grid">
        {tiles.map((tile) => (
          <VideoTile key={tile.label} {...tile} />
        ))}
        <div className="call-notice">
          <strong>Mode:</strong> {tier.name}
          <p>{isFallbackMode ? 'Using chat / voice notes fallback.' : speaking ? 'Speaking detected.' : 'Listening for speech.'}</p>
        </div>
      </section>

      <section className="dashboard">
        <ChatPanel
          messages={messages}
          onSendMessage={sendMessage}
          onSendVoiceNote={sendVoiceNote}
          onToggleTextFallback={() => setManualTextFallback((value) => !value)}
          modeName={tier.name}
        />
        <div className="controls-card">
          <div className="controls-row">
            <button className="button button-secondary" type="button" onClick={() => setRoomInfo(null)}>
              Leave room
            </button>
            <button className="button button-secondary" type="button" onClick={() => setStatsOpen((value) => !value)}>
              {statsOpen ? 'Hide nerd stats' : 'Show nerd stats'}
            </button>
          </div>
          <div className="control-stack">
            <label>
              Server URL
              <input value={serverUrl} onChange={(event) => setServerUrl(event.target.value)} />
            </label>
            <label>
              Room code
              <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} />
            </label>
          </div>
          <div className="control-stack">
            <button className="button button-secondary" type="button" onClick={() => localStream?.getAudioTracks().forEach((track) => (track.enabled = !track.enabled))}>
              Mute audio
            </button>
            <button className="button button-secondary" type="button" onClick={() => localStream?.getVideoTracks().forEach((track) => (track.enabled = !track.enabled))}>
              Disable video
            </button>
            <button className="button button-secondary" type="button" onClick={() => setNoiseSuppressionEnabled((value) => !value)}>
              Noise suppression: {noiseSuppressionEnabled ? 'on' : 'off'}
            </button>
            <button className="button button-danger" type="button" onClick={() => {
              localStream?.getTracks().forEach((track) => track.stop());
              setLocalStream(null);
              setRemoteStream(null);
              setRoomInfo(null);
              setMessages([]);
            }}>
              Hang up
            </button>
          </div>
        </div>
      </section>

      <StatsPanel
        open={statsOpen}
        onToggle={() => setStatsOpen((value) => !value)}
        stats={stats}
        tier={tier}
        transitions={transitionLog}
        connectionState={connectionState}
        roomCode={roomInfo.roomCode}
        peerCount={peerCount}
        onCopy={copyStats}
      />
      <video ref={videoPreviewRef} className="hidden-preview" autoPlay playsInline muted />
    </main>
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
