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
  Share,
  PlusSquare,
  X,
  Laptop,
} from 'lucide-react';

interface InstallPromptProps {
  isAuthScreen?: boolean;
}

export type DevicePlatform = 'ios' | 'android' | 'desktop';

const detectPlatform = (): DevicePlatform => {
  if (typeof window === 'undefined') return 'desktop';
  try {
    const ua = (window.navigator?.userAgent || '').toLowerCase();
    const platform = (window.navigator?.platform || '').toLowerCase();

    // Deteksi iOS (iPhone, iPad, iPod, dan iPadOS Safari dengan touch point)
    const isIos =
      /iphone|ipad|ipod/.test(ua) ||
      (platform === 'macintel' && (window.navigator?.maxTouchPoints || 0) > 1);

    if (isIos) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'desktop';
  } catch (_) {
    return 'desktop';
  }
};

export const InstallPrompt: React.FC<InstallPromptProps> = ({ isAuthScreen = true }) => {
  const [platform, setPlatform] = useState<DevicePlatform>('android');
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
    setPlatform(detectPlatform());

    const checkStrictStandalone = () => {
      try {
        const isStandaloneMedia =
          window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches;
        const isIosStandalone = (window.navigator as any).standalone === true;
        const isAndroidApp = document.referrer.includes('android-app://');

        return Boolean(isStandaloneMedia || isIosStandalone || isAndroidApp);
      } catch (_) {
        return false;
      }
    };

    const runningInApp = checkStrictStandalone();
    setIsStandalone(runningInApp);

    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    setIsInIframe(inIframe);

    if (runningInApp) {
      setShowPrompt(false);
      return;
    }

    try {
      const isDismissed = sessionStorage.getItem('mdc_browser_fallback_active') === 'true';
      if (!isDismissed && isAuthScreen) {
        setShowPrompt(true);
      }
    } catch (_) {}

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
      if (!checkStrictStandalone()) {
        try {
          if (!sessionStorage.getItem('mdc_browser_fallback_active')) {
            setShowPrompt(true);
          }
        } catch (_) {}
      }
    };

    const handleAppInstalled = () => {
      setHasInstalled(true);
      setDeferredPrompt(null);
      if (typeof window !== 'undefined') {
        (window as any).deferredInstallPrompt = null;
      }
      try {
        localStorage.setItem('mdc_pwa_installed', 'true');
      } catch (_) {}
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
          try {
            localStorage.setItem('mdc_pwa_installed', 'true');
          } catch (_) {}
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
    try {
      sessionStorage.setItem('mdc_browser_fallback_active', 'true');
    } catch (_) {}
    setShowPrompt(false);
  };

  const isIosDevice = platform === 'ios';
  const isDesktopDevice = platform === 'desktop';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[390px] overflow-hidden rounded-3xl border border-red-500/35 bg-gradient-to-b from-[#240c0f] via-[#1a0709] to-[#0d0102] p-4 sm:p-5 shadow-2xl text-white ring-1 ring-white/10 text-center">
        
        {/* Tombol Tutup Cepat (Close X) */}
        <button
          type="button"
          onClick={handleContinueInBrowser}
          className="absolute top-3.5 right-3.5 z-20 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors cursor-pointer"
          title="Tutup banner dan lanjut di browser"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ornamen Ambient Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {hasInstalled ? (
          /* ======================================================== */
          /* KONDISI: APLIKASI TELAH BERHASIL DIPASANG               */
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
              Ikon <strong>MDC Mobile</strong> telah berhasil ditambahkan ke Layar Utama perangkat Anda. Disarankan segera membukanya melalui ikon di layar utama untuk performa kamera & pemindaian barcode terbaik.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleContinueInBrowser}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5 text-white/70" />
                <span>Buka / Lanjutkan di Browser</span>
              </button>
            </div>
          </div>
        ) : isIosDevice ? (
          /* ======================================================== */
          /* PANDUAN VISUAL KHUSUS iOS (SAFARI APPLE)                */
          /* ======================================================== */
          <div className="space-y-3 animate-in fade-in duration-200 text-left">
            {/* Logo Pin MDC */}
            <div className="text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 p-0.5 shadow-xl shadow-red-950/80 mb-2">
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
                    className="w-10 h-10 object-contain drop-shadow"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] uppercase tracking-wider font-semibold">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Panduan iOS Safari</span>
              </div>

              <h3 className="text-sm font-bold text-white tracking-normal mt-1">
                Pasang MDC Mobile di iPhone / iPad
              </h3>
              <p className="text-[11px] text-white/70 leading-snug mt-0.5">
                Tambahkan ke Layar Utama melalui browser Safari dengan 3 langkah mudah:
              </p>
            </div>

            {/* Langkah-langkah Visual iOS */}
            <div className="space-y-2 p-2.5 rounded-2xl bg-black/40 border border-white/10 text-white/90">
              {/* Langkah 1 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-400/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-sky-400">
                  <Share className="w-4 h-4" />
                </div>
                <div className="text-[11px] leading-tight flex-1">
                  <strong className="text-white block font-semibold">1. Ketuk Tombol Bagikan</strong>
                  <span className="text-white/65 text-[10px]">
                    Tekan ikon <strong>Bagikan (Share)</strong> di bilah bawah Safari ponsel Anda.
                  </span>
                </div>
              </div>

              {/* Langkah 2 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-amber-400">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div className="text-[11px] leading-tight flex-1">
                  <strong className="text-white block font-semibold">2. Pilih Tambahkan ke Layar Utama</strong>
                  <span className="text-white/65 text-[10px]">
                    Gulir opsi menu ke bawah, lalu pilih <strong>Add to Home Screen</strong>.
                  </span>
                </div>
              </div>

              {/* Langkah 3 */}
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0 mt-0.5 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-[11px] leading-tight flex-1">
                  <strong className="text-white block font-semibold">3. Ketuk "Tambah" (Add) di Kanan Atas</strong>
                  <span className="text-white/65 text-[10px]">
                    Ikon aplikasi MDC Mobile siap digunakan dari Layar Utama Anda.
                  </span>
                </div>
              </div>
            </div>

            {/* Aksi Fallback Lanjut di Browser */}
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleContinueInBrowser}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white/90 hover:text-white active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/10"
              >
                <Globe className="w-3.5 h-3.5 text-white/60" />
                <span>Tetap Lanjutkan di Browser</span>
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* TAMPILAN UTAMA: ANDROID & DESKTOP (NATIVE PROMPT)       */
          /* ======================================================== */
          <div className="space-y-2.5">
            {/* Logo Pin Bergerak */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-600 via-red-500 to-amber-500 p-0.5 shadow-xl shadow-red-950/80 mb-1 animate-bounce duration-1000">
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

            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] uppercase tracking-wider font-semibold">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>{isDesktopDevice ? 'PWA Desktop Ready' : 'Aplikasi Resmi PDI Man'}</span>
            </div>

            <h3 className="text-base font-bold text-white tracking-normal">
              {isDesktopDevice ? 'Pasang MDC Mobile di Komputer' : 'Pasang MDC Mobile di HP'}
            </h3>

            <p className="text-[11px] text-white/70 leading-snug px-1">
              Pasang ke {isDesktopDevice ? 'perangkat komputer' : 'Layar Utama HP'} untuk akses cepat tanpa bilah alamat browser, notifikasi, dan performa pemindaian barcode optimal.
            </p>

            {/* Poin Keunggulan PWA */}
            <div className="py-2 px-3 rounded-xl bg-black/40 border border-white/10 text-left space-y-1 text-[11px] text-white/85">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span>Layar penuh rapi tanpa URL address bar</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Akses instan 1-ketuk langsung ke sistem</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                <span>Kamera scanner barcode lebih responsif</span>
              </div>
            </div>

            {/* Aksi 1: Tombol Pasang Native */}
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
                ) : isDesktopDevice ? (
                  <Laptop className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span>
                  {isDesktopDevice ? 'Pasang Sekarang ke Komputer' : 'Pasang Sekarang ke HP'}
                </span>
              </button>

              {/* Aksi 2: Tombol Fallback Lanjut di Browser */}
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