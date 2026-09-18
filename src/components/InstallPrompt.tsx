import React, { useState, useEffect } from 'react';
import {
  Download,
  Sparkles,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface InstallPromptProps {
  isAuthScreen?: boolean;
}

export const InstallPrompt: React.FC<InstallPromptProps> = ({ isAuthScreen = true }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(() => {
    if (typeof window !== 'undefined' && (window as any).deferredInstallPrompt) {
      return (window as any).deferredInstallPrompt;
    }
    return null;
  });
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [hasInstalled, setHasInstalled] = useState<boolean>(false);
  const [isPrompting, setIsPrompting] = useState<boolean>(false);

  useEffect(() => {
    const checkStrictStandalone = () => {
      const isStandaloneMedia =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      const isAndroidApp = document.referrer.includes('android-app://');

      return isStandaloneMedia || isIosStandalone || isAndroidApp;
    };

    const runningInApp = checkStrictStandalone();
    setIsStandalone(runningInApp);

    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    if (runningInApp) {
      setShowPrompt(false);
      return;
    }

    const isDismissed = sessionStorage.getItem('mdc_browser_fallback_active') === 'true';
    if (!isDismissed && isAuthScreen) {
      setShowPrompt(true);
    }

    if (typeof window !== 'undefined' && (window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
    }

    const handlePwaReady = (e?: any) => {
      const prompt = e?.detail || (typeof window !== 'undefined' ? (window as any).deferredInstallPrompt : null);
      if (prompt) {
        setDeferredPrompt(prompt);
      }
    };

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
      if (!checkStrictStandalone() && !sessionStorage.getItem('mdc_browser_fallback_active')) {
        setShowPrompt(true);
      }
    };

    const handleAppInstalled = () => {
      setHasInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') {
        (window as any).deferredInstallPrompt = null;
      }
      localStorage.setItem('mdc_pwa_installed', 'true');
    };

    const handleOpenManual = () => {
      setShowPrompt(true);
    };

    window.addEventListener('pwa-prompt-ready', handlePwaReady);
    window.addEventListener('pwa-installed', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-pwa-install', handleOpenManual);

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePwaReady);
      window.removeEventListener('pwa-installed', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install', handleOpenManual);
    };
  }, [isAuthScreen]);

  if (isStandalone || !showPrompt) {
    return null;
  }

  const handleInstallClick = async () => {
    let promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined' ? (window as any).deferredInstallPrompt : null);

    if (!promptEvent && typeof window !== 'undefined') {
      setIsPrompting(true);
      promptEvent = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 800);
        const onReady = (e: any) => {
          clearTimeout(timer);
          window.removeEventListener('pwa-prompt-ready', onReady);
          window.removeEventListener('beforeinstallprompt', onReady);
          resolve(e?.detail || (window as any).deferredInstallPrompt || e);
        };
        window.addEventListener('pwa-prompt-ready', onReady, { once: true });
        window.addEventListener('beforeinstallprompt', onReady, { once: true });
        if ((window as any).deferredInstallPrompt) {
          clearTimeout(timer);
          resolve((window as any).deferredInstallPrompt);
        }
      });
      setIsPrompting(false);
    }

    if (promptEvent && typeof promptEvent.prompt === 'function') {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        if (choice && choice.outcome === 'accepted') {
          setHasInstalled(true);
          localStorage.setItem('mdc_pwa_installed', 'true');
        }
        setDeferredPrompt(null);
        if (typeof window !== 'undefined') {
          (window as any).deferredInstallPrompt = null;
        }
      } catch (err) {
        console.warn('[PWA] Kesalahan pemanggilan prompt native:', err);
      }
      return;
    }

    if (isInIframe && typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
      return;
    }
  };

  const handleContinueInBrowser = () => {
    sessionStorage.setItem('mdc_browser_fallback_active', 'true');
    setShowPrompt(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[370px] overflow-hidden rounded-3xl border border-red-500/35 bg-gradient-to-b from-[#240c0f] via-[#1a0709] to-[#0d0102] p-4 sm:p-5 shadow-2xl text-white ring-1 ring-white/10 text-center">
        
        {/* Ornamen Ambient Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {hasInstalled ? (
          /* ======================================================== */
          /* KONDISI: APLIKASI TELAH BERHASIL DIPASANG (TETAP DI TEMPAT)*/
          /* ======================================================== */
          <div className="space-y-3 animate-in zoom-in-95 duration-200 py-2">
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 bg-red-600/30 rounded-full animate-ping opacity-30" />
              <div className="w-18 h-18 rounded-3xl bg-gradient-to-tr from-red-600 to-amber-500 p-0.5 shadow-2xl shadow-red-950 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                  <Smartphone className="w-9 h-9 text-red-500 animate-pulse" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center text-white">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <h3 className="text-base font-bold text-white tracking-wide">
              Aplikasi Berhasil Dipasang
            </h3>

            <p className="text-xs text-white/75 leading-relaxed px-1">
              Ikon <strong>MDC Mobile</strong> telah berhasil ditambahkan ke Layar Utama ponsel Anda. Disarankan segera menggunakan aplikasi melalui ikon di layar utama perangkat Anda untuk performa terbaik.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleContinueInBrowser}
                className="w-full py-1.5 px-2 text-[11px] font-normal text-white/60 hover:text-amber-300 active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-white/50" />
                <span>Lanjutkan di browser</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* TAMPILAN UTAMA BANNER INSTALASI                          */
          /* ======================================================== */
          <div className="space-y-2.5">
            {/* Logo Pin Bergerak */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 p-0.5 shadow-xl shadow-red-950/80 mb-2 animate-bounce duration-1000">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center overflow-hidden">
                <img
                  src="/icon-192.png"
                  onError={(e) => {
                    (e.target as HTMLElement).setAttribute(
                      'src',
                      'https://lh3.googleusercontent.com/d/1fGSO4NT-xEfj0W_jeRSmfQUe1RC2_yq1'
                    );
                  }}
                  alt="MDC Mobile Logo"
                  className="w-11 h-11 object-contain drop-shadow"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] uppercase tracking-wider font-medium">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Aplikasi Resmi PDI Man</span>
            </div>

            <h3 className="text-base font-bold text-white tracking-normal">
              Pasang MDC Mobile di HP
            </h3>

            <p className="text-[11px] text-white/70 leading-snug px-1">
              Dianjurkan memasang ke Layar Utama HP untuk akses cepat tanpa address bar dan kamera scanner barcode yang responsif.
            </p>

            {/* Poin Keunggulan PWA */}
            <div className="py-2 px-3 rounded-xl bg-black/40 border border-white/10 text-left space-y-1 text-[11px] text-white/85">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Layar penuh rapi tanpa URL bar</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Akses instan 1-ketuk dari layar HP</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>Kamera barcode optimal & stabil</span>
              </div>
            </div>

            {/* Aksi 1: Tombol Pasang Utama (Langsung Memasang ke HP) */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                disabled={isPrompting}
                onClick={handleInstallClick}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:brightness-110 active:scale-98 text-white font-bold text-xs shadow-lg shadow-red-950 border border-red-400/40 flex items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden disabled:opacity-80"
              >
                {deferredPrompt && (
                  <span className="absolute top-1 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                )}
                {isPrompting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>Pasang Sekarang ke HP</span>
              </button>

              {/* Aksi 2: Tombol Fallback (Tetap Lanjut di Browser) */}
              <button
                type="button"
                onClick={handleContinueInBrowser}
                className="w-full py-1.5 px-2 text-[11px] font-normal text-white/60 hover:text-amber-300 active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-white/50" />
                <span>Tetap lanjutkan di browser</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};