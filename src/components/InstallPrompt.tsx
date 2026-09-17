import React, { useState, useEffect } from 'react';
import {
  Download,
  Share,
  Sparkles,
  CheckCircle2,
  Smartphone,
  ShieldCheck,
  Zap,
  Globe,
  ArrowRight,
  Info,
  ExternalLink,
  Copy,
  Check,
  MoreVertical,
  X,
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
  const [isIos, setIsIos] = useState<boolean>(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState<boolean>(false);
  const [isInIframe, setIsInIframe] = useState<boolean>(false);
  const [hasInstalled, setHasInstalled] = useState<boolean>(false);
  const [showManualGuide, setShowManualGuide] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  useEffect(() => {
    // 1. Deteksi apakah sedang aktif dalam mode PWA Standalone di HP
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

    // 2. Deteksi apakah berjalan di dalam iFrame (Preview sandbox)
    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    // Jika sudah di dalam aplikasi PWA HP asli, jangan tampilkan prompt
    if (runningInApp) {
      setShowPrompt(false);
      return;
    }

    // Periksa apakah pengguna sebelumnya sudah memilih "Lanjutkan di Browser" untuk sesi ini
    const isDismissed = sessionStorage.getItem('mdc_browser_fallback_active') === 'true';
    if (!isDismissed && isAuthScreen) {
      setShowPrompt(true);
    }

    // 3. Deteksi perangkat iOS & In-App Browser (WhatsApp, Telegram, IG, dsb)
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIos(/iphone|ipad|ipod/.test(ua));
    setIsInAppBrowser(/fbav|instagram|line|micromessenger|telegram|whatsapp|wv/.test(ua));

    // Periksa apakah event prompt sudah ditangkap oleh script di index.html
    if ((window as any).deferredInstallPrompt) {
      setDeferredPrompt((window as any).deferredInstallPrompt);
    }

    const handlePwaReady = () => {
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
      }
    };

    // 4. Tangkap event instalasi browser Chrome/Android
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      (window as any).deferredInstallPrompt = e;
      setDeferredPrompt(e);
      if (!checkStrictStandalone() && !sessionStorage.getItem('mdc_browser_fallback_active')) {
        setShowPrompt(true);
      }
    };

    // 5. Tangkap event aplikasi berhasil dipasang
    const handleAppInstalled = () => {
      setHasInstalled(true);
      setDeferredPrompt(null);
      (window as any).deferredInstallPrompt = null;
      localStorage.setItem('mdc_pwa_installed', 'true');
    };

    // 6. Listener untuk pemicuan manual dari tombol Header/Pengaturan
    const handleOpenManual = () => {
      setShowPrompt(true);
    };

    window.addEventListener('pwa-prompt-ready', handlePwaReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('open-pwa-install', handleOpenManual);

    return () => {
      window.removeEventListener('pwa-prompt-ready', handlePwaReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('open-pwa-install', handleOpenManual);
    };
  }, [isAuthScreen]);

  // Sembunyikan prompt jika mode standalone aktif atau user memilih mode browser
  if (isStandalone || !showPrompt) {
    return null;
  }

  // Tombol Utama: Pasang Aplikasi ke Layar HP
  const handleInstallClick = async () => {
    const promptEvent =
      deferredPrompt ||
      (typeof window !== 'undefined' ? (window as any).deferredInstallPrompt : null);

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
        setShowManualGuide(true);
      }
    } else {
      // Jika prompt otomatis belum tersedia atau di iOS / iFrame / In-App browser
      setShowManualGuide(true);
    }
  };

  // Tombol Buka Tab Baru (Sangat krusial jika di dalam iFrame AI Studio)
  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Salin Tautan Aplikasi
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (_) {}
  };

  // Tombol Cadangan: Lanjutkan di Browser tanpa terblokir
  const handleContinueInBrowser = () => {
    sessionStorage.setItem('mdc_browser_fallback_active', 'true');
    setShowPrompt(false);
    setShowManualGuide(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-[370px] overflow-hidden rounded-3xl border border-red-500/35 bg-gradient-to-b from-[#240c0f] via-[#1a0709] to-[#0d0102] p-4 sm:p-5 shadow-2xl text-white ring-1 ring-white/10 text-center">
        
        {/* Ornamen Ambient Glow */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-600/25 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Tombol Tutup Silang di Kanan Atas */}
        <button
          type="button"
          onClick={handleContinueInBrowser}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors cursor-pointer"
          title="Tutup & Lanjut di Browser"
        >
          <X className="w-4 h-4" />
        </button>

        {hasInstalled ? (
          /* ======================================================== */
          /* KONDISI 1: APLIKASI TELAH BERHASIL DIPASANG              */
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

            <p className="text-xs text-white/75 leading-relaxed">
              Ikon <strong>MDC Mobile</strong> telah ditambahkan ke Layar Utama ponsel Anda. Buka dari ikon tersebut untuk mode layar penuh, atau lanjutkan sesi ini di browser.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleContinueInBrowser}
                className="w-full py-2 px-3 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-white/15"
              >
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Buka Formulir Sekarang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : showManualGuide ? (
          /* ======================================================== */
          /* KONDISI 2: PANDUAN VISUAL INSTALASI MANUAL (IOS/CHROME)  */
          /* ======================================================== */
          <div className="space-y-3 text-left animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 border-b border-white/15 pb-2.5">
              <div className="w-8 h-8 rounded-xl bg-red-600/30 border border-red-500/40 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {isIos ? 'Panduan Pasang iPhone' : 'Panduan Pasang Android'}
                </h4>
                <p className="text-[10px] text-white/60">
                  {isIos ? 'Browser Safari (Apple iOS)' : 'Browser Google Chrome'}
                </p>
              </div>
            </div>

            {isInIframe && (
              <div className="p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 text-[11px] text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Jendela Preview Terdeteksi</span>
                </div>
                <p className="text-[10px] leading-relaxed text-amber-200/90">
                  Browser melarang instalasi otomatis di dalam frame preview. Buka di tab baru browser untuk mengaktifkan instalasi instan.
                </p>
                <button
                  type="button"
                  onClick={handleOpenInNewTab}
                  className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka di Tab Baru / Browser Asli</span>
                </button>
              </div>
            )}

            {isIos ? (
              <div className="space-y-2 text-xs text-white/90">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-white">Ketuk tombol Bagikan</span>
                    <p className="text-[11px] text-white/70 flex items-center gap-1 mt-0.5">
                      Ikon <Share className="w-3.5 h-3.5 text-sky-400 inline" /> di bilah menu bawah Safari.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-white">Tambah ke Layar Utama</span>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Gulir ke bawah dan pilih opsi <strong>"Tambah ke Layar Utama" (+)</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-white">Selesai & Buka</span>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Ketuk <strong>Tambah</strong> di pojok kanan atas. Ikon aplikasi akan muncul di layar iPhone.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-xs text-white/90">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <span className="font-semibold text-white">Menu Titik Tiga Browser</span>
                    <p className="text-[11px] text-white/70 flex items-center gap-1 mt-0.5">
                      Ketuk menu <MoreVertical className="w-3.5 h-3.5 text-amber-400 inline" /> di pojok kanan atas Chrome.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <span className="font-semibold text-white">Pilih Instal / Tambah</span>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Pilih menu <strong>"Instal Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-red-500/30 text-red-300 flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <span className="font-semibold text-white">Konfirmasi Instal</span>
                    <p className="text-[11px] text-white/70 mt-0.5">
                      Tekan tombol <strong>Instal</strong> pada dialog konfirmasi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Aksi Tambahan: Salin Tautan & Kembali */}
            <div className="pt-2 space-y-2">
              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-98 text-white font-medium text-xs border border-white/15 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-bold">Tautan Berhasil Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-white/70" />
                    <span>Salin Link (Buka di Chrome)</span>
                  </>
                )}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualGuide(false)}
                  className="flex-1 py-1.5 px-3 text-xs text-white/70 hover:text-white rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-center"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleContinueInBrowser}
                  className="flex-1 py-1.5 px-3 text-xs text-amber-300 hover:text-amber-200 font-medium rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-center"
                >
                  Lanjut di Browser
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /* KONDISI 3: TAMPILAN UTAMA PROMPT INSTALASI                */
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

            {/* Peringatan Khusus WhatsApp / In-App Browser */}
            {isInAppBrowser && (
              <div className="p-2 rounded-xl bg-amber-950/60 border border-amber-500/40 text-[10px] text-amber-200 text-left flex items-start gap-1.5">
                <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Anda membuka link di dalam obrolan chat. Jika tombol pasang tidak merespons, gunakan menu titik tiga (⋮) &gt; <strong>Buka di Chrome/Safari</strong>.
                </span>
              </div>
            )}

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

            {/* Aksi 1: Tombol Pasang Utama */}
            <div className="pt-1 space-y-2">
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:brightness-110 active:scale-98 text-white font-bold text-xs shadow-lg shadow-red-950 border border-red-400/40 flex items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden"
              >
                {deferredPrompt && (
                  <span className="absolute top-1 right-2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                  </span>
                )}
                <Download className="w-4 h-4" />
                <span>
                  {deferredPrompt
                    ? 'Pasang Sekarang ke HP (1-Ketuk)'
                    : isIos
                    ? 'Petunjuk Pasang di iPhone'
                    : 'Pasang Sekarang ke HP'}
                </span>
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
