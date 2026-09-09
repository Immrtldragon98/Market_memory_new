import { PropsWithChildren, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { apiRequest } from '../../services/api';

const MIN_CAPTURE_GAP_MS = 60_000;

export function MarketSamplingProvider({ children }: PropsWithChildren) {
  const state = useRef<AppStateStatus>(AppState.currentState);
  const lastCapture = useRef<Record<string, number>>({});

  useEffect(() => {
    const capture = async (context: 'app_foreground' | 'app_background') => {
      const now = Date.now();
      if (now - (lastCapture.current[context] ?? 0) < MIN_CAPTURE_GAP_MS) return;
      lastCapture.current[context] = now;
      try {
        await apiRequest('/api/price-samples/tracked', {
          method: 'POST',
          body: JSON.stringify({ context, max_assets: 10 }),
        });
      } catch {
        // Sampling is enrichment. It must never block app navigation or crash a signed-out session.
      }
    };

    void capture('app_foreground');

    const subscription = AppState.addEventListener('change', (nextState) => {
      const previous = state.current;
      state.current = nextState;

      if (nextState === 'active' && previous !== 'active') {
        void capture('app_foreground');
      } else if (previous === 'active' && nextState !== 'active') {
        void capture('app_background');
      }
    });

    return () => subscription.remove();
  }, []);

  return children;
}
