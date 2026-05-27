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

    // Premium Monochrome / Glass Mesh Gradient Blobs
    const blob1 = document.createElement('div');
    const blob2 = document.createElement('div');
    const blob3 = document.createElement('div');

    const setupBlob = (blob: HTMLDivElement, bg: string, size: string, blur: string) => {
      blob.style.position = 'absolute';
      blob.style.width = size;
      blob.style.height = size;
      blob.style.borderRadius = '50%';
      blob.style.background = bg;
      blob.style.filter = `blur(${blur})`;
      blob.style.transform = 'translate(-50%, -50%)'; 
      blob.style.willChange = 'transform';
      blob.style.opacity = '0.6';
    };

    setupBlob(blob1, 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)', '60vw', '100px');
    setupBlob(blob2, 'radial-gradient(circle, rgba(120,120,130,0.04) 0%, transparent 60%)', '50vw', '80px');
    setupBlob(blob3, 'radial-gradient(circle, rgba(255,255,255,0.02) 0%, transparent 70%)', '70vw', '120px');

    el.appendChild(blob1);
    el.appendChild(blob2);
    el.appendChild(blob3);

    let start = Date.now();
    let animationFrame: number;

    const animate = () => {
      const now = Date.now();
      const t = (now - start) * 0.0003; // Even slower, more elegant movement

      const w = window.innerWidth;
      const h = window.innerHeight;

      // Smooth, slow, organic motion
      const x1 = w * 0.3 + Math.sin(t * 0.8) * (w * 0.2);
      const y1 = h * 0.4 + Math.cos(t * 0.6) * (h * 0.2);
      
      const x2 = w * 0.7 + Math.cos(t * 0.5) * (w * 0.3);
      const y2 = h * 0.6 + Math.sin(t * 0.7) * (h * 0.2);
      
      const x3 = w * 0.5 + Math.sin(t * 0.4) * (w * 0.3);
      const y3 = h * 0.5 + Math.cos(t * 0.3) * (h * 0.3);

      blob1.style.transform = `translate(calc(${x1}px - 50%), calc(${y1}px - 50%))`;
      blob2.style.transform = `translate(calc(${x2}px - 50%), calc(${y2}px - 50%))`;
      blob3.style.transform = `translate(calc(${x3}px - 50%), calc(${y3}px - 50%))`;

      animationFrame = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      el.innerHTML = '';
    };
  }, [elementId]);
}
