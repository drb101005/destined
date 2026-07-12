import { useEffect, useMemo, useRef, useState } from 'react';

export function usePeerConnection({ socket, roomCode, localStream, onRemoteStream, onConnectionStateChange }) {
  const peerConnectionRef = useRef(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [connectionState, setConnectionState] = useState('new');
  const [negotiationTick, setNegotiationTick] = useState(0);

  const iceServers = useMemo(
    () => {
      const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
      const turnUrl = import.meta.env.VITE_TURN_SERVER_URL;
      const turnUsername = import.meta.env.VITE_TURN_USERNAME;
      const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

      if (turnUrl) {
        servers.push({
          urls: turnUrl,
          username: turnUsername,
          credential: turnCredential
        });
      }

      return servers;
    },
    []
  );

  useEffect(() => {
    if (!socket || !roomCode) {
      return undefined;
    }

    const peerConnection = new RTCPeerConnection({
      iceServers,
      bundlePolicy: 'max-bundle'
    });

    peerConnectionRef.current = peerConnection;
    setPeerConnection(peerConnection);

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        onRemoteStream?.(stream);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      setConnectionState(peerConnection.connectionState);
      onConnectionStateChange?.(peerConnection.connectionState);
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal:ice', { roomCode, candidate: event.candidate });
      }
    };

    const senders = [];
    localStream?.getTracks().forEach((track) => {
      senders.push(peerConnection.addTrack(track, localStream));
    });

    const createOffer = async () => {
      if (peerConnection.signalingState !== 'stable') {
        return;
      }
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal:offer', { roomCode, sdp: peerConnection.localDescription });
    };

    const handleOffer = async ({ sdp }) => {
      if (peerConnection.signalingState !== 'stable') {
        return;
      }
      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      socket.emit('signal:answer', { roomCode, sdp: peerConnection.localDescription });
    };

    const handleAnswer = async ({ sdp }) => {
      if (peerConnection.signalingState === 'have-local-offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIce = async ({ candidate }) => {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch {
        // Ignore transient ICE candidate races.
      }
    };

    socket.on('signal:offer', handleOffer);
    socket.on('signal:answer', handleAnswer);
    socket.on('signal:ice', handleIce);

    return () => {
      socket.off('signal:offer', handleOffer);
      socket.off('signal:answer', handleAnswer);
      socket.off('signal:ice', handleIce);
      peerConnection.close();
      peerConnectionRef.current = null;
      setPeerConnection(null);
    };
  }, [iceServers, localStream, onConnectionStateChange, onRemoteStream, roomCode, socket]);

  const requestNegotiation = async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection || !socket) {
      return;
    }

    if (peerConnection.signalingState === 'stable') {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      socket.emit('signal:offer', { roomCode, sdp: peerConnection.localDescription });
      setNegotiationTick((value) => value + 1);
    }
  };

  return { peerConnection, connectionState, requestNegotiation, negotiationTick };
}
