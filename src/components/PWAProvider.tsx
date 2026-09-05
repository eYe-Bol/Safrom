'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface PWAContextType {
  isOnline: boolean;
  canInstall: boolean;
  promptInstall: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isOnline: true,
  canInstall: false,
  promptInstall: () => {},
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    // Online / Offline Detection
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Register Service Worker in production
      if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((reg) => console.log('[PWA] Service Worker registered:', reg.scope))
            .catch((err) => console.warn('[PWA] Service Worker registration failed:', err));
        });
      }

      // App Install Prompt Event
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setCanInstall(true);
      });

      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <PWAContext.Provider value={{ isOnline, canInstall, promptInstall }}>
      {/* Offline Status Top Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 text-center text-[12px] font-bold sticky top-0 z-[9999] shadow-md flex items-center justify-center gap-2">
          <span>⚡</span>
          <span>
            Offline Counter Mode active: POS is running on local cache. Sales will sync automatically once internet reconnects.
          </span>
        </div>
      )}

      {/* Install App To Counter Banner */}
      {canInstall && !installDismissed && (
        <div className="fixed bottom-4 right-4 z-50 bg-[var(--color-ink)] text-white p-3.5 rounded-2xl shadow-2xl border border-[var(--color-gold)] max-w-sm flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Safrom" className="w-8 h-8 object-contain rounded-lg" />
            <div>
              <div className="text-[12px] font-bold text-white">Install Safrom POS</div>
              <div className="text-[10px] text-white/70">Add to Counter Home Screen for 1-tap launch</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={promptInstall}
              className="px-2.5 py-1.5 bg-[var(--color-gold)] text-white text-[11px] font-bold rounded-lg hover:opacity-90 cursor-pointer shadow-xs"
            >
              Install
            </button>
            <button
              onClick={() => setInstallDismissed(true)}
              className="text-white/50 hover:text-white text-[14px] p-1 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {children}
    </PWAContext.Provider>
  );
}

export const usePWA = () => useContext(PWAContext);
