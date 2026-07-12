import { describe, expect, it } from 'vitest';
import { createAdaptiveState, decideTier } from '../decision';

describe('adaptive decision engine', () => {
  it('keeps HD on healthy stats', () => {
    const state = createAdaptiveState('HD Video');
    const result = decideTier(
      { rttMs: 60, jitterMs: 4, packetLossPercent: 0.2, availableBitrateKbps: 3000 },
      state
    );

    expect(result.tier.name).toBe('HD Video');
  });

  it('degrades after repeated bad samples', () => {
    let state = createAdaptiveState('HD Video');
    let result;

    for (let i = 0; i < 2; i += 1) {
      result = decideTier(
        { rttMs: 380, jitterMs: 20, packetLossPercent: 5, availableBitrateKbps: 180 },
        state
      );
      state = result.state;
    }

    expect(result.tier.name).toBe('Low Video');
    expect(result.transitions.length).toBeGreaterThan(0);
  });

  it('recovers cautiously after repeated good samples', () => {
    let state = createAdaptiveState('Audio-only');
    let result;

    for (let i = 0; i < 4; i += 1) {
      result = decideTier(
        { rttMs: 70, jitterMs: 5, packetLossPercent: 0.3, availableBitrateKbps: 2600 },
        state
      );
      state = result.state;
    }

    expect(result.tier.name).toBe('HD Video');
  });
});
