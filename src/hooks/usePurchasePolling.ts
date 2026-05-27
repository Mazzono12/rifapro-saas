import { useEffect, useState } from 'react';
import type { Purchase } from '../types';

export function usePurchasePolling(purchaseId: string | undefined, interval = 3000) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!purchaseId) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/checkout/orders/${purchaseId}/status`);
        if (!res.ok) throw new Error('Falha ao buscar status do pedido');
        const data = await res.json();
        const nextPurchase = data.purchase || data;
        setPurchase(nextPurchase);
        
        if (nextPurchase.status === 'paid' || nextPurchase.status === 'cancelled' || data.status === 'expired') {
            return true; // stop polling
        }
        return false;
      } catch (err: any) {
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
        timeoutId = setTimeout(poll, interval);
      }
    };

    timeoutId = setTimeout(poll, interval);

    return () => clearTimeout(timeoutId);
  }, [purchaseId, interval]);

  return { purchase, error };
}
