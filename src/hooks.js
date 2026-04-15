import { useEffect, useRef, useState, useCallback } from 'react';

// Intersection Observer hook for scroll reveal
export function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold, rootMargin: '0px 0px -60px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visible];
}

// Countdown timer hook
export function useCountdown(endTime) {
  const [timeLeft, setTimeLeft] = useState(calcTimeLeft(endTime));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(calcTimeLeft(endTime)), 1000);
    return () => clearInterval(id);
  }, [endTime]);

  return timeLeft;
}

function calcTimeLeft(endTime) {
  const diff = new Date(endTime) - Date.now();
  if (diff <= 0) return { h: 0, m: 0, s: 0, total: 0, pct: 0 };
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
    total: diff,
    pct: 0, // caller can compute
  };
}

// Scroll progress hook
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handle = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return progress;
}

// Format price
export function formatPrice(n) {
  if (n === undefined || n === null) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

// Debounce
export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
