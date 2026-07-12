import { useEffect, useRef, useState } from 'react';
import { createAdaptiveState, decideTier, getTierByIndex, getTierIndexByName } from '../adaptive/decision';

export function useAdaptiveTier(stats, { forceTierName = null } = {}) {
  const [adaptiveState, setAdaptiveState] = useState(() => createAdaptiveState(forceTierName || 'HD Video'));
  const [tier, setTier] = useState(() => getTierByIndex(adaptiveState.currentTierIndex));
  const [transitionLog, setTransitionLog] = useState([]);
  const previousForceTier = useRef(forceTierName);

  useEffect(() => {
    if (previousForceTier.current !== forceTierName) {
      previousForceTier.current = forceTierName;
      setAdaptiveState((current) => ({
        ...current,
        forcedTierIndex: forceTierName ? getTierIndexByName(forceTierName) : null
      }));
    }
  }, [forceTierName]);

  useEffect(() => {
    if (!stats) {
      return;
    }

    setAdaptiveState((current) => {
      const result = decideTier(stats, current);
      if (result.transitions.length) {
        setTransitionLog((log) =>
          [...log, ...result.transitions].slice(-10)
        );
      }
      setTier(result.tier);
      return result.state;
    });
  }, [stats]);

  return {
    tier,
    adaptiveState,
    transitionLog
  };
}
