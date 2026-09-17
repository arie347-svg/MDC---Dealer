import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UserProfile,
  ClaimItem,
  DashboardStats,
  MasterDataResponse,
} from './types';
import { GasService, isGasEnvironment } from './services/gasBridge';
import { HeaderProfile } from './components/HeaderProfile';
import { PipelineFilter } from './components/PipelineFilter';
import { ClaimCard } from './components/ClaimCard';
import { ClaimDetailModal } from './components/ClaimDetailModal';
import { ClaimWizard } from './components/ClaimWizard';
import { AuthModal } from './components/AuthModal';
import { ClaimReceiptModal } from './components/ClaimReceiptModal';
import { InstallPrompt } from './components/InstallPrompt';
import {
  calculateDashboardStats,
} from './utils/initialClaims';
import {
  Plus,
  RefreshCw,
  Search,
  LayoutGrid,
  List,
  AlertTriangle,
  AlertCircle,
  FolderOpen,
  X,
  ExternalLink,
  LogOut,
  Loader2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const STORAGE_SESSION_AUTH = 'mdc_mobile_session_auth';
const STORAGE_VIEW_MODE = 'mdc_mobile_view_mode';
const STORAGE_MASTER_DATA = 'mdc_master_data_cache';

export const App: React.FC = () => {
  // Authentication & Profile State (Tidak lagi menyimpan kredensial di localStorage)
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(() => {
    // Bersihkan cache lama di localStorage secara proaktif agar Spreadsheet menjadi Single Source of Truth
    try {
      localStorage.removeItem('mdc_mobile_session_user');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mdc_claims_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
    return Boolean(sessionStorage.getItem(STORAGE_SESSION_AUTH));
  });
  const [sessionVerifyError, setSessionVerifyError] = useState<string | null>(null);

  // Master Data & Claims State
  const [masterData, setMasterData] = useState<MasterDataResponse>({
    success: false,
    transporterList: [],
    motorList: [],
    partList: [],
    kerusakanList: [],
    penyebabList: [],
  });

  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    draft: 0,
    kirimMD: 0,
    prosesMD: 0,
    kirimDealer: 0,
    selesai: 0,
    alertDraft: false,
  });

  // View & UI Filters
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'CARDS' | 'SIMPLE'>(() => {
    return (localStorage.getItem(STORAGE_VIEW_MODE) as 'CARDS' | 'SIMPLE') || 'CARDS';
  });
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataFetchError, setDataFetchError] = useState<string | null>(null);
  const [liveTime, setLiveTime] = useState<string>('');

  // Modals & Navigation Views
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [draftToContinue, setDraftToContinue] = useState<ClaimItem | null>(null);
  const [selectedClaimForDetail, setSelectedClaimForDetail] = useState<ClaimItem | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [submittedReceiptClaim, setSubmittedReceiptClaim] = useState<ClaimItem | null>(null);

  // Live Digital Clock (WIB)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = now.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      setLiveTime(`${dateStr} • ${timeStr} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Master Data & User Claims secara optimal, paralel, dan spreadsheet sebagai Single Source of Truth
  const fetchAllData = useCallback(async (currentUser: UserProfile, forceRefreshMaster = false) => {
    setIsLoadingData(true);
    setDataFetchError(null);

    try {
      // 1. Cek cache Master Data di sessionStorage
      let cachedMaster: MasterDataResponse | null = null;
      if (!forceRefreshMaster) {
        try {
          const raw = sessionStorage.getItem(STORAGE_MASTER_DATA);
          if (raw) cachedMaster = JSON.parse(raw);
        } catch (_) {}
      }

      // 2. Siapkan promises untuk dieksekusi secara paralel
      const claimsPromise = GasService.getRecentClaims(currentUser.kodeAhm);
      const masterPromise =
        cachedMaster && cachedMaster.motorList && cachedMaster.motorList.length > 0
          ? Promise.resolve(cachedMaster)
          : GasService.getMasterDataKlaim();

      // Jalankan paralel: menghemat 50-70% waktu tunggu jaringan
      const [claimsRes, mData] = await Promise.all([claimsPromise, masterPromise]);

      // Pasang Master Data
      if (mData && mData.success && mData.motorList && mData.motorList.length > 0) {
        setMasterData(mData);
        try {
          sessionStorage.setItem(STORAGE_MASTER_DATA, JSON.stringify(mData));
        } catch (_) {}
      }

      // Pasang Claims: Murni bersumber dari Spreadsheet
      if (claimsRes && Array.isArray(claimsRes.data)) {
        setClaims(claimsRes.data);
        // Hitung statistik dashboard instan di client
        setDashboardStats(calculateDashboardStats(claimsRes.data));
      } else {
        setClaims([]);
        setDashboardStats(calculateDashboardStats([]));
      }
    } catch (err: any) {
      console.warn('[MDC] Sinkronisasi notice:', err?.message || err);
      setDataFetchError(err?.message || 'Gagal menyinkronkan data dengan spreadsheet.');
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  // Verifikasi Sesi Real-Time ke Backend Google Apps Script / Sheet Users_Mobile
  useEffect(() => {
    const verifySessionRealtime = async () => {
      const storedAuth = sessionStorage.getItem(STORAGE_SESSION_AUTH);
      if (!storedAuth) {
        setIsVerifyingSession(false);
        return;
      }

      try {
        const { email, kodeAhm } = JSON.parse(storedAuth);
        if (!email || !kodeAhm) {
          sessionStorage.removeItem(STORAGE_SESSION_AUTH);
          setIsVerifyingSession(false);
          return;
        }

        // Pemanggilan fungsi verifikasi real-time ke server/spreadsheet backend
        const res = await GasService.loginUser(email, kodeAhm);
        if (res && res.status === 'SUCCESS' && res.user) {
          setUser(res.user);
        } else {
          // Tolak akses masuk secara mutlak jika tidak ditemukan di Users_Mobile
          sessionStorage.removeItem(STORAGE_SESSION_AUTH);
          setUser(null);
          setSessionVerifyError(
            res?.message ||
              'Akses Ditolak: Akun Anda tidak ditemukan pada lembar basis data Users_Mobile.'
          );
        }
      } catch (err: any) {
        console.warn('[MDC] Gagal verifikasi sesi real-time:', err);
        sessionStorage.removeItem(STORAGE_SESSION_AUTH);
        setUser(null);
        setSessionVerifyError('Gagal memverifikasi akun ke server backend. Silakan login kembali.');
      } finally {
        setIsVerifyingSession(false);
      }
    };

    verifySessionRealtime();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAllData(user);
    }
  }, [user, fetchAllData]);

  // Auth Handlers (Bebas localStorage untuk data akun/kredensial)
  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setSessionVerifyError(null);
    sessionStorage.setItem(
      STORAGE_SESSION_AUTH,
      JSON.stringify({ email: loggedInUser.email, kodeAhm: loggedInUser.kodeAhm })
    );
    try {
      localStorage.removeItem('mdc_mobile_session_user');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mdc_claims_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
    setClaims([]);
    setDashboardStats(calculateDashboardStats([]));
    fetchAllData(loggedInUser);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = () => {
    setShowLogoutConfirm(false);
    setUser(null);
    sessionStorage.removeItem(STORAGE_SESSION_AUTH);
    sessionStorage.removeItem(STORAGE_MASTER_DATA);
    try {
      localStorage.removeItem('mdc_mobile_session_user');
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('mdc_claims_')) {
          localStorage.removeItem(key);
        }
      }
    } catch (_) {}
    setClaims([]);
    setDashboardStats(calculateDashboardStats([]));
  };

  const handleToggleViewMode = (mode: 'CARDS' | 'SIMPLE') => {
    setViewMode(mode);
    localStorage.setItem(STORAGE_VIEW_MODE, mode);
  };

  // Filter & Search Engine
  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      // 1. Filter by Status
      if (activeFilter !== 'ALL') {
        if (claim.status.toLowerCase() !== activeFilter.toLowerCase()) {
          return false;
        }
      }

      // 2. Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSj = claim.noSj?.toLowerCase().includes(q);
        const matchDriver = claim.sopirPJ?.toLowerCase().includes(q);
        const matchNopol = claim.nopolPJ?.toLowerCase().includes(q);
        const matchPart = claim.items?.some(
          (item) =>
            item.namaPart?.toLowerCase().includes(q) ||
            item.tipe?.toLowerCase().includes(q) ||
            item.noMesin?.toLowerCase().includes(q) ||
            item.noRangka?.toLowerCase().includes(q)
        );
        return matchSj || matchDriver || matchNopol || matchPart;
      }

      return true;
    });
  }, [claims, activeFilter, searchQuery]);

  // Master data readiness & syncing flags
  const isMasterReady = Boolean(masterData?.success && masterData?.motorList && masterData.motorList.length > 0);
  const isSyncingMaster = isLoadingData || !isMasterReady;

  // Claim Wizard Handlers
  const handleOpenNewClaim = () => {
    if (isSyncingMaster) return;
    setDraftToContinue(null);
    setIsWizardOpen(true);
  };

  const handleEditDraft = (draftClaim: ClaimItem) => {
    setDraftToContinue(draftClaim);
    setIsWizardOpen(true);
  };

  const handleSubmitSuccess = (_idKlaim: string, status: string, claimItem?: ClaimItem) => {
    setIsWizardOpen(false);
    setDraftToContinue(null);

    // Confetti celebration
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 },
    });

    // Jika klaim berstatus "Dikirim ke MD", munculkan layar Resi Pengiriman Layar Penuh
    if (status === 'Dikirim ke MD' && claimItem) {
      setSubmittedReceiptClaim(claimItem);
    }

    if (claimItem) {
      setClaims((prev) => {
        const filtered = prev.filter((c) => c.idKlaim !== claimItem.idKlaim && c.noSj !== claimItem.noSj);
        const updated = [claimItem, ...filtered];
        setDashboardStats(calculateDashboardStats(updated));
        return updated;
      });
    }

    if (user) {
      fetchAllData(user, false);
    }
  };

  // Dealer Konfirmasi Selesai Handler
  const handleConfirmFinish = async (idKlaim: string) => {
    if (window.confirm('Konfirmasi bahwa suku cadang telah Anda terima di Dealer dalam kondisi baik?')) {
      try {
        if (user) {
          const updatedClaims = claims.map((c) =>
            c.idKlaim === idKlaim
              ? {
                  ...c,
                  status: 'Selesai',
                  tglSelesai:
                    new Date().toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    }) + ' (Diterima Dealer)',
                }
              : c
          );
          setClaims(updatedClaims);
          setDashboardStats(calculateDashboardStats(updatedClaims));
        }

        const res = await GasService.dealerKonfirmasiSelesai(idKlaim);
        if (res && res.success) {
          setSelectedClaimForDetail(null);
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.5 },
          });
          if (user) {
            fetchAllData(user, false);
          }
        }
      } catch (err: any) {
        alert(err?.message || 'Gagal mengonfirmasi serah terima part.');
      }
    }
  };

  // IF VERIFYING SESSION ON APP LOAD: TAMPILKAN SPLASH SCREEN VERIFIKASI REAL-TIME
  if (isVerifyingSession) {
    return (
      <div className="h-full min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-gradient-to-b from-[#3a0609] via-[#220406] to-[#0d0102] text-white font-sans antialiased">
        <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-b from-red-500 to-red-700 p-0.5 shadow-lg shadow-red-950/80 flex items-center justify-center mb-3 animate-pulse">
          <div className="w-full h-full rounded-full bg-white flex items-center justify-center p-1.5 overflow-hidden">
            <img
              src="https://lh3.googleusercontent.com/d/1fGSO4NT-xEfj0W_jeRSmfQUe1RC2_yq1"
              alt="MDC Pin"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-red-500 mb-2" />
        <p className="text-xs font-semibold text-white/90">Memverifikasi Akun Real-Time...</p>
        <p className="text-[10px] text-white/50 mt-0.5">Memeriksa status di basis data Users_Mobile</p>
      </div>
    );
  }

  // IF NOT AUTHENTICATED: SHOW AUTH MODAL
  if (!user) {
    return (
      <>
        <AuthModal
          onLoginSuccess={handleLoginSuccess}
          externalErrorMessage={sessionVerifyError}
        />
        <InstallPrompt isAuthScreen={true} />
      </>
    );
  }

  // IF CLAIM WIZARD IS ACTIVE
  if (isWizardOpen) {
    return (
      <ClaimWizard
        user={user}
        masterData={masterData}
        initialDraft={draftToContinue}
        onCancel={() => {
          setIsWizardOpen(false);
          setDraftToContinue(null);
        }}
        onSubmitSuccess={handleSubmitSuccess}
      />
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-slate-950 text-white flex justify-center selection:bg-red-500 selection:text-white overflow-hidden font-sans">
      {/* Mobile Shell Frame */}
      <div className="w-full max-w-md bg-gradient-to-b from-slate-950 via-neutral-950 to-slate-950 h-full max-h-[100dvh] shadow-2xl relative border-x border-white/5 flex flex-col overflow-hidden">
        
        {/* ======================================================== */}
        {/* 1. TOP FIXED SECTION (HEADER MERAH + STATUS + SEARCH + TITLE) */}
        {/* Non-scrollable (flex-shrink-0) */}
        {/* ======================================================== */}
        <div className="flex-shrink-0 z-20 bg-slate-950/95 border-b border-white/5 shadow-md">
          {/* Header Profile Section (Header Berwarna Merah) */}
          <HeaderProfile user={user} liveTime={liveTime} onLogout={handleLogout} />

          {/* Backend Connection Notice if running outside GAS */}
          {!isGasEnvironment() && (
            <div className="mx-4 mt-2 p-2 rounded-xl bg-amber-950/70 border border-amber-500/40 shadow-sm flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-amber-200 leading-tight">
                <strong className="text-white block font-semibold text-[11px]">Koneksi Data Siap Digunakan</strong>
                Data klaim tersimpan otomatis di perangkat & siap disinkronkan langsung ke Spreadsheet saat dibuka via Web App GAS.
              </div>
            </div>
          )}

          {/* Backend Error Banner if GAS fetch failed */}
          {isGasEnvironment() && dataFetchError && (
            <div className="mx-4 mt-2 p-2 rounded-xl bg-red-950/80 border border-red-500/50 shadow-sm flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-red-200 leading-tight">
                <strong className="text-white block font-semibold text-[11px]">Sinkronisasi Spreadsheet</strong>
                {dataFetchError}
              </div>
            </div>
          )}

          {/* 24-Hour Draft Alert Banner */}
          {dashboardStats.alertDraft && (
            <div className="mx-4 mt-2 p-2 rounded-xl bg-red-950/80 border border-red-500/50 shadow-sm shadow-red-900/30 flex items-start gap-2 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-red-200 leading-tight">
                <strong className="text-white block font-semibold text-[11px]">Peringatan Batas Waktu Draft!</strong>
                Terdapat klaim berstatus DRAFT titipan yang mendekati atau telah melampaui batas waktu 24 jam.
              </div>
            </div>
          )}

          {/* Pipeline Filter Status Alur Klaim */}
          <PipelineFilter
            stats={dashboardStats}
            activeFilter={activeFilter}
            onFilterChange={(st) => setActiveFilter(st)}
          />

          {/* Search Bar & View Mode Toggles */}
          <div className="px-4 py-1.5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SJ, Sopir, Part, Tipe Motor..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/10 border border-white/15 text-[11px] text-white placeholder:text-white/40 outline-none focus:border-red-500 transition-colors font-normal"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                if (user) fetchAllData(user, true);
              }}
              title="Sinkronkan dengan Spreadsheet"
              className={`p-1.5 rounded-xl border border-white/15 bg-white/10 hover:bg-white/20 active:scale-95 text-white/80 transition-all ${
                isLoadingData ? 'animate-spin text-red-400' : ''
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <div className="flex rounded-xl bg-black/40 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => handleToggleViewMode('CARDS')}
                title="Tampilan Kartu Lengkap"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'CARDS'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('SIMPLE')}
                title="Tampilan Ringkas"
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'SIMPLE'
                    ? 'bg-red-600 text-white shadow'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Claims List Header: Judul Daftar Pengajuan Klaim (Tetap tidak bergerak) */}
          <div className="px-4 py-1.5 flex items-center justify-between border-t border-white/5 bg-white/[0.02]">
            <span className="text-[11px] font-semibold text-white/90 uppercase tracking-wide">
              {activeFilter === 'ALL' ? 'Daftar Pengajuan Klaim' : `Status: ${activeFilter}`}{' '}
              <span className="text-amber-400 font-mono">({filteredClaims.length})</span>
            </span>
            {searchQuery && (
              <span className="text-[10px] text-white/50 italic">Hasil pencarian</span>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* 2. SCROLLABLE CARDS SECTION                              */}
        {/* The ONLY section that scrolls! (flex-1 overflow-y-auto)  */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto px-4 py-2.5 min-h-0 space-y-2.5 overscroll-contain">
          {filteredClaims.length > 0 ? (
            filteredClaims.map((claim) => (
              <ClaimCard
                key={claim.idKlaim}
                claim={claim}
                viewMode={viewMode}
                onClick={() => setSelectedClaimForDetail(claim)}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-white/5 border border-white/10 my-4">
              <FolderOpen className="w-10 h-10 text-white/30 mb-2" />
              <p className="text-xs font-semibold text-white/80">Belum Ada Data Klaim</p>
              <p className="text-[11px] text-white/50 mt-1 max-w-[240px]">
                {activeFilter !== 'ALL'
                  ? `Tidak ada pengajuan klaim dengan status "${activeFilter}".`
                  : searchQuery
                  ? 'Tidak ada klaim yang cocok dengan kata kunci pencarian.'
                  : 'Belum ada pengajuan klaim cacat unit dari dealer Anda.'}
              </p>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* 3. FIXED FOOTER BAR WITH ROUNDED BUTTON                  */}
        {/* Persistent at bottom, with rounded/circular button       */}
        {/* ======================================================== */}
        <div className="flex-shrink-0 z-30 bg-neutral-950/95 backdrop-blur-md border-t border-white/10 px-4 py-3 shadow-[0_-8px_20px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onClick={handleOpenNewClaim}
            disabled={isSyncingMaster}
            className={`w-full py-3 px-5 rounded-full text-white text-xs font-semibold shadow-lg border flex items-center justify-center gap-2.5 transition-all ${
              isSyncingMaster
                ? 'bg-slate-800/80 border-white/10 text-white/50 cursor-not-allowed opacity-75 shadow-none'
                : 'bg-gradient-to-r from-red-600 via-red-500 to-red-600 hover:brightness-110 active:scale-[0.98] shadow-red-950/80 border-red-400/40 cursor-pointer'
            }`}
          >
            {isSyncingMaster ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                <span className="tracking-wide text-white/80">
                  {isLoadingData ? 'Menyelaraskan Data...' : 'Memuat Data Master...'}
                </span>
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 shadow-inner">
                  <Plus className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="tracking-wide">Ajukan Klaim Cacat Unit</span>
              </>
            )}
          </button>
        </div>

        {/* Fullscreen Digital Receipt Modal */}
        <ClaimReceiptModal
          claim={submittedReceiptClaim}
          user={user}
          onClose={() => setSubmittedReceiptClaim(null)}
        />

        {/* Detail Modal */}
        <ClaimDetailModal
          claim={selectedClaimForDetail}
          user={user}
          isOpen={!!selectedClaimForDetail}
          onClose={() => setSelectedClaimForDetail(null)}
          onEditDraft={handleEditDraft}
          onConfirmFinish={handleConfirmFinish}
          onPreviewPhoto={(url, title) => setPreviewPhoto({ url, title })}
        />

        {/* Fullscreen Photo Lightbox */}
        {previewPhoto && (
          <div
            onClick={() => setPreviewPhoto(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-lg w-full overflow-hidden rounded-2xl bg-black border border-white/20 shadow-2xl"
            >
              <div className="flex items-center justify-between p-3 border-b border-white/10 text-white">
                <h4 className="text-xs font-bold truncate pr-4">{previewPhoto.title}</h4>
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(null)}
                  className="p-1.5 rounded-full bg-white/10 text-white/80 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="max-h-[70vh] overflow-hidden flex items-center justify-center bg-black/50 p-2">
                <img
                  src={previewPhoto.url}
                  referrerPolicy="no-referrer"
                  alt={previewPhoto.title}
                  className="max-h-[68vh] w-auto object-contain rounded-lg"
                />
              </div>

              <div className="p-2.5 text-center border-t border-white/10">
                <a
                  href={previewPhoto.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-amber-300 hover:underline inline-flex items-center gap-1 font-semibold"
                >
                  Buka Gambar di Tab Baru <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Modal Konfirmasi Logout Kustom */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-xs overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-b from-neutral-900 via-slate-900 to-red-950 p-6 shadow-2xl text-white text-center ring-1 ring-white/10">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center mb-3 shadow-lg shadow-red-950/60">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Keluar dari Akun?
              </h3>
              <p className="text-xs text-white/70 mb-5 leading-relaxed">
                Sesi akun MDC Mobile Anda akan diakhiri dan dialihkan kembali ke layar awal.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:scale-95 text-xs font-semibold text-white/80 transition-all border border-white/15 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={executeLogout}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:brightness-110 active:scale-95 text-xs font-bold text-white shadow-md shadow-red-950/80 transition-all cursor-pointer"
                >
                  Ya, Keluar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* In-App PWA Install Prompt for Authenticated Users */}
        <InstallPrompt isAuthScreen={false} />
      </div>
    </div>
  );
};

export default App;
