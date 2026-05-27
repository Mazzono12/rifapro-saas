import { useEffect, useState } from 'react';
import type { Purchase } from '../types';

export function usePurchasePolling(purchaseId: string | undefined, interval = 6000) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) return;

    let consecutiveErrors = 0;
    let attempts = 0;

    const nextInterval = () => {
      const baseInterval = Math.max(interval, 6000);
      if (consecutiveErrors > 0) return Math.min(20000, baseInterval + consecutiveErrors * 3000);
      if (attempts > 8) return Math.min(15000, baseInterval * 2);
      return baseInterval;
    };

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/checkout/orders/${purchaseId}/status`);
        if (!res.ok) throw new Error('Falha ao buscar status do pedido');
        const data = await res.json();
        const nextPurchase = data.purchase || data;
        consecutiveErrors = 0;
        attempts += 1;
        setPurchase(nextPurchase);
        
        if (nextPurchase.status === 'paid' || nextPurchase.status === 'cancelled' || data.status === 'expired') {
            return true; // stop polling
        }
        return false;
      } catch (err: any) {
        consecutiveErrors += 1;
        setError(err.message);
        return false;
      }
    };

    let timeoutId: NodeJS.Timeout;
    
    // Initial check
    checkStatus();

    const poll = async () => {
      const stop = await checkStatus();
      if (!stop) {
        timeoutId = setTimeout(poll, nextInterval());
      }
    };

    timeoutId = setTimeout(poll, nextInterval());

    return () => clearTimeout(timeoutId);
  }, [purchaseId, interval]);

  return { purchase, error };
}
