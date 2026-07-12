/*
 * Pure adaptive tier decision logic with hysteresis.
 */
import { ADAPTIVE_CONFIG } from './config';

export const TIER_NAMES = ADAPTIVE_CONFIG.tiers.map((tier) => tier.name);

function fitsTier(stats, tier) {
  const rtt = Number.isFinite(stats.rttMs) ? stats.rttMs : Infinity;
  const loss = Number.isFinite(stats.packetLossPercent) ? stats.packetLossPercent : Infinity;
  const bandwidth = Number.isFinite(stats.availableBitrateKbps) ? stats.availableBitrateKbps : 0;
  const { rtt: maxRtt, packetLoss: maxLoss, bandwidth: minBandwidth } = tier.thresholds;

  if (tier.name === 'Text / voice-message fallback') {
    return rtt > 900 || loss > 20 || bandwidth < 15;
  }

  return rtt <= maxRtt && loss <= maxLoss && bandwidth >= minBandwidth;
}

export function getTierIndexByName(name) {
  const index = TIER_NAMES.indexOf(name);
  return index === -1 ? 0 : index;
}

export function getTierByIndex(index) {
  return ADAPTIVE_CONFIG.tiers[Math.max(0, Math.min(index, ADAPTIVE_CONFIG.tiers.length - 1))];
}

export function createAdaptiveState(initialTierName = 'HD Video') {
  return {
    currentTierIndex: getTierIndexByName(initialTierName),
    degradeStreak: 0,
    upgradeStreak: 0,
    forcedTierIndex: null,
    transitions: [],
    lastDecisionAt: null
  };
}

export function decideTier(stats, state) {
  if (state.forcedTierIndex !== null && state.forcedTierIndex !== undefined) {
    const forcedTier = getTierByIndex(state.forcedTierIndex);
    return {
      state: {
        ...state,
        currentTierIndex: state.forcedTierIndex,
        degradeStreak: 0,
        upgradeStreak: 0,
        lastDecisionAt: Date.now()
      },
      tier: forcedTier,
      transitions: []
    };
  }

  const currentTierIndex = state.currentTierIndex;
  const desiredTierIndex = ADAPTIVE_CONFIG.tiers.findIndex((tier) => fitsTier(stats, tier));
  const normalizedDesiredIndex =
    desiredTierIndex === -1 ? ADAPTIVE_CONFIG.tiers.length - 1 : desiredTierIndex;
  const now = Date.now();

  let nextTierIndex = currentTierIndex;
  let degradeStreak = state.degradeStreak;
  let upgradeStreak = state.upgradeStreak;
  const transitions = [];

  if (normalizedDesiredIndex > currentTierIndex) {
    degradeStreak += 1;
    upgradeStreak = 0;
    if (degradeStreak >= ADAPTIVE_CONFIG.hysteresis.downgradeSamples) {
      nextTierIndex = normalizedDesiredIndex;
      degradeStreak = 0;
      transitions.push({
        from: getTierByIndex(currentTierIndex).name,
        to: getTierByIndex(nextTierIndex).name,
        at: now,
        reason: 'network degraded'
      });
    }
  } else if (normalizedDesiredIndex < currentTierIndex) {
    upgradeStreak += 1;
    degradeStreak = 0;
    if (upgradeStreak >= ADAPTIVE_CONFIG.hysteresis.upgradeSamples) {
      nextTierIndex = normalizedDesiredIndex;
      upgradeStreak = 0;
      transitions.push({
        from: getTierByIndex(currentTierIndex).name,
        to: getTierByIndex(nextTierIndex).name,
        at: now,
        reason: 'network recovered'
      });
    }
  } else {
    degradeStreak = 0;
    upgradeStreak = 0;
  }

  return {
    state: {
      ...state,
      currentTierIndex: nextTierIndex,
      degradeStreak,
      upgradeStreak,
      lastDecisionAt: now,
      transitions: [...state.transitions, ...transitions].slice(-10)
    },
    tier: getTierByIndex(nextTierIndex),
    transitions
  };
}
