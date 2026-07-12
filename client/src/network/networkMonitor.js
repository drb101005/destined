/*
 * Polls WebRTC stats and Socket.IO heartbeat latency.
 */
export class NetworkMonitor {
  constructor({ peerConnection, socket, onUpdate, intervalMs = 1500, windowSize = 5 }) {
    this.peerConnection = peerConnection;
    this.socket = socket;
    this.onUpdate = onUpdate;
    this.intervalMs = intervalMs;
    this.windowSize = windowSize;
    this.samples = [];
    this.timer = null;
    this.heartbeatTimer = null;
    this.latestHeartbeat = null;
    this.lastTickAt = null;
    this.previousByteCounts = null;
  }

  start() {
    if (this.timer) {
      return;
    }

    this.tick();
    this.timer = window.setInterval(() => this.tick(), this.intervalMs);
    this.heartbeatTimer = window.setInterval(() => this.heartbeat(), 3000);
  }

  stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  async heartbeat() {
    if (!this.socket?.connected) {
      return;
    }

    const started = performance.now();
    await new Promise((resolve) => {
      this.socket.emit('heartbeat:ping', {}, () => {
        this.latestHeartbeat = Math.round(performance.now() - started);
        resolve();
      });
    });
  }

  async tick() {
    if (!this.peerConnection) {
      return;
    }

    const stats = await this.peerConnection.getStats();
    const values = this.extractStats(stats);
    const now = performance.now();
    const elapsedSeconds = this.lastTickAt ? Math.max((now - this.lastTickAt) / 1000, 0.001) : 0;
    this.lastTickAt = now;

    if (this.previousByteCounts && elapsedSeconds > 0) {
      values.sendingAudioKbps = ((values.bytesSentAudio - this.previousByteCounts.bytesSentAudio) * 8) / elapsedSeconds / 1000;
      values.sendingVideoKbps = ((values.bytesSentVideo - this.previousByteCounts.bytesSentVideo) * 8) / elapsedSeconds / 1000;
      values.receivingAudioKbps = ((values.bytesReceivedAudio - this.previousByteCounts.bytesReceivedAudio) * 8) / elapsedSeconds / 1000;
      values.receivingVideoKbps = ((values.bytesReceivedVideo - this.previousByteCounts.bytesReceivedVideo) * 8) / elapsedSeconds / 1000;
    }

    this.previousByteCounts = {
      bytesSentAudio: values.bytesSentAudio,
      bytesSentVideo: values.bytesSentVideo,
      bytesReceivedAudio: values.bytesReceivedAudio,
      bytesReceivedVideo: values.bytesReceivedVideo
    };

    this.samples.push(values);
    this.samples = this.samples.slice(-this.windowSize);
    this.onUpdate(this.smoothSamples());
  }

  extractStats(report) {
    const inbound = [];
    const outbound = [];
    const candidatePairs = [];
    let availableOutgoingBitrate = null;
    let rtt = null;
    let jitter = null;
    let packetsLost = null;
    let packetsReceived = 0;
    let packetsSent = 0;
    let candidateType = 'unknown';
    let bytesSentAudio = 0;
    let bytesSentVideo = 0;
    let bytesReceivedAudio = 0;
    let bytesReceivedVideo = 0;
    let videoCodec = 'unknown';
    let audioCodec = 'unknown';

    report.forEach((stat) => {
      if (stat.type === 'candidate-pair' && stat.state === 'succeeded' && stat.nominated) {
        candidatePairs.push(stat);
        availableOutgoingBitrate = stat.availableOutgoingBitrate ? stat.availableOutgoingBitrate / 1000 : availableOutgoingBitrate;
        rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : rtt;
        if (stat.localCandidateId) {
          const candidate = report.get(stat.localCandidateId);
          candidateType = candidate?.candidateType || candidateType;
        }
      }

      if (stat.type === 'remote-inbound-rtp' && stat.kind === 'audio') {
        rtt = stat.roundTripTime ? stat.roundTripTime * 1000 : rtt;
      }

      if (stat.type === 'inbound-rtp') {
        inbound.push(stat);
        packetsLost += stat.packetsLost || 0;
        packetsReceived += stat.packetsReceived || 0;
        jitter = stat.jitter ? stat.jitter * 1000 : jitter;
        if (stat.kind === 'audio') {
          bytesReceivedAudio += stat.bytesReceived || 0;
        }
        if (stat.kind === 'video') {
          bytesReceivedVideo += stat.bytesReceived || 0;
        }
        if (stat.codecId) {
          const codec = report.get(stat.codecId);
          if (codec?.mimeType?.includes('audio')) {
            audioCodec = codec.mimeType.split('/')[1]?.toUpperCase() || audioCodec;
          }
          if (codec?.mimeType?.includes('video')) {
            videoCodec = codec.mimeType.split('/')[1]?.toUpperCase() || videoCodec;
          }
        }
      }

      if (stat.type === 'outbound-rtp') {
        outbound.push(stat);
        packetsSent += stat.packetsSent || 0;
        if (stat.kind === 'audio') {
          bytesSentAudio += stat.bytesSent || 0;
        }
        if (stat.kind === 'video') {
          bytesSentVideo += stat.bytesSent || 0;
        }
        if (stat.codecId) {
          const codec = report.get(stat.codecId);
          if (codec?.mimeType?.includes('audio')) {
            audioCodec = codec.mimeType.split('/')[1]?.toUpperCase() || audioCodec;
          }
          if (codec?.mimeType?.includes('video')) {
            videoCodec = codec.mimeType.split('/')[1]?.toUpperCase() || videoCodec;
          }
        }
      }
    });

    const totalPackets = packetsReceived + packetsLost + packetsSent;
    const packetLossPercent = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0;

    return {
      rttMs: rtt ?? this.latestHeartbeat ?? 0,
      jitterMs: jitter ?? 0,
      packetLossPercent,
      availableBitrateKbps: availableOutgoingBitrate ?? 0,
      candidatePairs,
      inbound,
      outbound,
      candidateType,
      bytesSentAudio,
      bytesSentVideo,
      bytesReceivedAudio,
      bytesReceivedVideo,
      sendingAudioKbps: 0,
      sendingVideoKbps: 0,
      receivingAudioKbps: 0,
      receivingVideoKbps: 0,
      videoCodec,
      audioCodec,
      signalingRttMs: this.latestHeartbeat ?? 0,
      bytesSent: outbound.reduce((sum, stat) => sum + (stat.bytesSent || 0), 0),
      bytesReceived: inbound.reduce((sum, stat) => sum + (stat.bytesReceived || 0), 0)
    };
  }

  smoothSamples() {
    const pick = (key) => {
      const values = this.samples.map((sample) => sample[key]).filter((value) => Number.isFinite(value));
      if (!values.length) {
        return 0;
      }

      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    const latest = this.samples[this.samples.length - 1] || {};
    return {
      ...latest,
      rttMs: pick('rttMs'),
      jitterMs: pick('jitterMs'),
      packetLossPercent: pick('packetLossPercent'),
      availableBitrateKbps: pick('availableBitrateKbps'),
      signalingRttMs: pick('signalingRttMs'),
      bytesSent: pick('bytesSent'),
      bytesReceived: pick('bytesReceived'),
      sendingAudioKbps: pick('sendingAudioKbps'),
      sendingVideoKbps: pick('sendingVideoKbps'),
      receivingAudioKbps: pick('receivingAudioKbps'),
      receivingVideoKbps: pick('receivingVideoKbps'),
      candidateType: latest.candidateType || 'unknown',
      videoCodec: latest.videoCodec || 'unknown',
      audioCodec: latest.audioCodec || 'unknown'
    };
  }
}
