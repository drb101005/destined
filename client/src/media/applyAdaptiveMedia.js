/*
 * Applies tier changes to WebRTC senders and local media tracks.
 */
export async function applyAdaptiveMedia(peerConnection, localStream, tier, { noiseSuppressionEnabled = true } = {}) {
  if (!peerConnection || !tier) {
    return;
  }

  const videoTrack = localStream?.getVideoTracks?.()[0];
  const audioTrack = localStream?.getAudioTracks?.()[0];
  const senderVideo = peerConnection.getSenders().find((sender) => sender.track?.kind === 'video');
  const senderAudio = peerConnection.getSenders().find((sender) => sender.track?.kind === 'audio');

  if (videoTrack) {
    try {
      if (tier.video.enabled) {
        videoTrack.enabled = true;
        await videoTrack.applyConstraints({
          width: { ideal: tier.video.width, max: tier.video.width },
          height: { ideal: tier.video.height, max: tier.video.height },
          frameRate: { ideal: tier.video.frameRate, max: tier.video.frameRate }
        });
      } else {
        videoTrack.enabled = false;
      }
    } catch {
      // Browsers can reject constraints when already close to the target.
    }
  }

  if (senderVideo) {
    const parameters = senderVideo.getParameters();
    parameters.degradationPreference = tier.video.enabled ? 'maintain-framerate' : 'maintain-resolution';
    parameters.encodings = parameters.encodings || [{}];
    parameters.encodings[0].maxBitrate = tier.video.maxBitrateKbps > 0 ? tier.video.maxBitrateKbps * 1000 : 0;
    try {
      await senderVideo.setParameters(parameters);
    } catch {
      // Ignore browsers that reject unsupported encodings during renegotiation.
    }
  }

  if (senderAudio) {
    const parameters = senderAudio.getParameters();
    parameters.encodings = parameters.encodings || [{}];
    parameters.encodings[0].maxBitrate = tier.audio.maxBitrateKbps > 0 ? tier.audio.maxBitrateKbps * 1000 : undefined;
    parameters.encodings[0].dtx = !!tier.audio.dtx;
    parameters.encodings[0].fec = !!tier.audio.fec;
    try {
      await senderAudio.setParameters(parameters);
    } catch {
      // Fallback to the browser defaults if the encoder refuses the hint.
    }
  }

  if (audioTrack) {
    try {
      audioTrack.enabled = true;
      await audioTrack.applyConstraints({
        noiseSuppression: noiseSuppressionEnabled,
        echoCancellation: true,
        autoGainControl: true
      });
    } catch {
      // No-op if the track doesn't support these constraints.
    }
  }
}
