import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';

const disableZoom = () => {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const prevent = (e: Event) => {
    e.preventDefault();
  };

  if (isTouch) {
    window.addEventListener('gesturestart', prevent, { passive: false });
    window.addEventListener('gesturechange', prevent, { passive: false });
    window.addEventListener('gestureend', prevent, { passive: false });

    document.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches && e.touches.length > 1) e.preventDefault();
      },
      { passive: false }
    );

    let lastTouchEnd = 0;
    document.addEventListener(
      'touchend',
      (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) e.preventDefault();
        lastTouchEnd = now;
      },
      { passive: false }
    );
  }

  window.addEventListener(
    'wheel',
    (e) => {
      if ('ctrlKey' in e && e.ctrlKey) e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener('keydown', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    if (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0') e.preventDefault();
  });
};

disableZoom();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => null);
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
