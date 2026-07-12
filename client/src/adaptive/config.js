/*
 * Adaptive tier thresholds and hysteresis settings.
 * Keep the decision engine tunable from one place.
 */
export const ADAPTIVE_CONFIG = {
  sampleWindow: 5,
  tiers: [
    {
      name: 'HD Video',
      video: { enabled: true, width: 1280, height: 720, frameRate: 30, maxBitrateKbps: 2200 },
      audio: { maxBitrateKbps: 48, dtx: false, fec: false },
      thresholds: { rtt: 150, packetLoss: 1, bandwidth: 1500 }
    },
    {
      name: 'SD Video',
      video: { enabled: true, width: 640, height: 360, frameRate: 20, maxBitrateKbps: 1200 },
      audio: { maxBitrateKbps: 40, dtx: false, fec: false },
      thresholds: { rtt: 300, packetLoss: 3, bandwidth: 500 }
    },
    {
      name: 'Low Video',
      video: { enabled: true, width: 426, height: 240, frameRate: 10, maxBitrateKbps: 400 },
      audio: { maxBitrateKbps: 36, dtx: false, fec: false },
      thresholds: { rtt: 450, packetLoss: 6, bandwidth: 150 }
    },
    {
      name: 'Audio-only',
      video: { enabled: false, width: 0, height: 0, frameRate: 0, maxBitrateKbps: 0 },
      audio: { maxBitrateKbps: 32, dtx: false, fec: true },
      thresholds: { rtt: 600, packetLoss: 10, bandwidth: 40 }
    },
    {
      name: 'Ultra-compressed voice',
      video: { enabled: false, width: 0, height: 0, frameRate: 0, maxBitrateKbps: 0 },
      audio: { maxBitrateKbps: 10, dtx: true, fec: true },
      thresholds: { rtt: 900, packetLoss: 20, bandwidth: 15 }
    },
    {
      name: 'Text / voice-message fallback',
      video: { enabled: false, width: 0, height: 0, frameRate: 0, maxBitrateKbps: 0 },
      audio: { maxBitrateKbps: 0, dtx: true, fec: false },
      thresholds: { rtt: Infinity, packetLoss: Infinity, bandwidth: 0 }
    }
  ],
  hysteresis: {
    downgradeSamples: 2,
    upgradeSamples: 4
  }
};

