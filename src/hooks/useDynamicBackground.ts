import { useEffect } from 'react';

export function useDynamicBackground(elementId: string) {
  useEffect(() => {
    const el = document.getElementById(elementId);
    if (!el) return;

    // Base container styles
    el.style.position = 'fixed';
    el.style.top = '0';
    el.style.left = '0';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.zIndex = '-50';
    el.style.pointerEvents = 'none';
    el.style.overflow = 'hidden';
    el.style.background = '#000000';

    return () => {
      el.innerHTML = '';
    };
  }, [elementId]);
}
