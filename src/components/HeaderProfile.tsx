import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { LogOut, Building2, MapPin, Shield, Smartphone } from 'lucide-react';

interface HeaderProfileProps {
  user: UserProfile;
  liveTime: string;
  onLogout: () => void;
}

export const HeaderProfile: React.FC<HeaderProfileProps> = ({ user, liveTime, onLogout }) => {
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isMedia = window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches;
      const isIosStandalone = (window.navigator as any).standalone === true;
      return isMedia || isIosStandalone;
    };
    setIsStandalone(checkStandalone());
  }, []);

  const handleOpenInstall = () => {
    window.dispatchEvent(new CustomEvent('open-pwa-install'));
  };

  // Informasi identitas dealer akurat
  const namaDealer = user?.namaDealer || 'Daya Adicipta Motora';
  const kodeDealer = user?.kodeDealer || 'EGKHSH';
  const rawKota = user?.kota || 'Bandung';
  const kotaFormatted = rawKota.toLowerCase().startsWith('kota') || rawKota.toLowerCase().startsWith('kab')
    ? rawKota
    : `Kota ${rawKota}`;
  const asalGudang = user?.sentraDistribusi || 'Baros';

  return (
    <div className="relative overflow-hidden rounded-b-3xl bg-gradient-to-br from-red-600 via-red-700 to-red-900 text-white p-4 shadow-xl border-b border-white/20">
      {/* Background Decorative Pattern */}
      <div className="absolute -top-12 -right-12 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-black/20 rounded-full blur-xl pointer-events-none" />

      {/* Top Row: User Avatar / MDC Logo & Logout */}
      <div className="relative flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo MDC */}
          <div className="relative flex-shrink-0 w-11 h-11 rounded-2xl bg-white/15 border border-white/30 backdrop-blur-md p-1.5 flex items-center justify-center shadow-md overflow-hidden">
            <img
              src="/icon-192.png"
              alt="Logo MDC"
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent) {
                  const fallback = parent.querySelector('.mdc-text-logo');
                  if (fallback) fallback.classList.remove('hidden');
                }
              }}
            />
            <span className="mdc-text-logo hidden text-[11px] font-black tracking-wider text-white font-mono">
              MDC
            </span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-red-700 shadow-xs" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-white/75 font-medium">Selamat Datang,</span>
              <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-full bg-black/25 text-amber-300 font-semibold border border-amber-300/30">
                <Shield className="w-2.5 h-2.5" /> PDI Man
              </span>
            </div>
            <h2 className="text-sm font-bold text-white truncate leading-tight tracking-wide">
              {user?.nama || 'PDI Man Dealer'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isStandalone && (
            <button
              type="button"
              onClick={handleOpenInstall}
              title="Pasang MDC Mobile ke Layar HP"
              className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 active:scale-95 border border-amber-300/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Pasang App</span>
            </button>
          )}

          <button
            type="button"
            onClick={onLogout}
            title="Keluar dari Akun"
            className="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 border border-white/25 transition-all text-white/90 hover:text-white flex-shrink-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Frosted Dealer Badge Card */}
      <div className="relative rounded-2xl bg-black/25 backdrop-blur-md border border-white/15 p-2.5 text-xs shadow-inner">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 truncate text-white/95 font-semibold">
            <Building2 className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="truncate">{namaDealer}</span>
          </div>
          <span className="flex-shrink-0 text-[10px] px-2 py-0.5 rounded-lg bg-white/20 font-mono font-bold tracking-wider text-white border border-white/30">
            {kodeDealer}
          </span>
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/80 pt-1.5 border-t border-white/10">
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-red-300" />
            <span>Kota: <strong className="text-white">{kotaFormatted}</strong></span>
          </div>
          <div>
            <span>Asal Gudang: <strong className="text-amber-300 font-bold">{asalGudang}</strong></span>
          </div>
        </div>
      </div>

      {/* Live Time Bar */}
      <div className="mt-2 text-right">
        <span className="text-[10px] font-mono tracking-wider text-white/70 bg-black/20 px-2 py-0.5 rounded-full">
          {liveTime}
        </span>
      </div>
    </div>
  );
};
