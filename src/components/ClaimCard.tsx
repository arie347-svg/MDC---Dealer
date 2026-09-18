import React, { useState, useRef, useEffect } from 'react';
import { ClaimItem } from '../types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Wrench,
  ChevronRight,
  FileEdit,
  MessageSquare,
  ChevronDown,
} from 'lucide-react';
import { hitungAktualHariKerja, hitungEstimasiSelesai } from '../utils/slaCalculator';

interface ClaimCardProps {
  claim: ClaimItem;
  viewMode: 'CARDS' | 'SIMPLE';
  currentUserRole?: string;
  onClick: () => void;
}

interface ContactOption {
  label: string;
  phone: string;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({ claim, viewMode, currentUserRole, onClick }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const motorSummary = React.useMemo(() => {
    if (claim.items && claim.items.length > 0) {
      const uniqueMotors = Array.from(new Set(claim.items.map((i) => i.tipe).filter(Boolean)));
      const motorName = uniqueMotors.join(', ') || claim.tipeMotor || 'BEAT STREET';
      const partCount = claim.items.length;
      return `${motorName} - ${partCount} part`;
    }
    const fallbackMotor = claim.tipeMotor || 'BEAT STREET';
    return `${fallbackMotor} - 1 part`;
  }, [claim.items, claim.tipeMotor]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-400/30 whitespace-nowrap">
            <FileEdit className="w-2.5 h-2.5" /> Draft
          </span>
        );
      case 'Dikirim ke MD':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 whitespace-nowrap">
            Dikirim ke MD
          </span>
        );
      case 'Proses di MD':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
            <Wrench className="w-2.5 h-2.5" /> Proses di MD
          </span>
        );
      case 'Dikirim ke Dealer':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 whitespace-nowrap">
            Kirim ke Dealer
          </span>
        );
      case 'Selesai':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
            <CheckCircle2 className="w-2.5 h-2.5" /> Selesai
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-gray-400/30 whitespace-nowrap">
            {status}
          </span>
        );
    }
  };

  // Logika Matriks Kontak & Hak Akses Role
  const getAvailableContacts = (): ContactOption[] => {
    const status = (claim.status || '').trim().toLowerCase();
    const role = (currentUserRole || '').trim().toLowerCase();
    const contacts: ContactOption[] = [];

    const isPdiMan = role === 'pdi man';
    const isRepairman = role === 'repairman' || role === 'repairmen';
    const isKepalaGudang = role === 'kepala gudang';

    // 1. STATUS DRAFT: Tidak ada menu/tombol kontak yang muncul sama sekali
    if (status.includes('draft')) {
      return [];
    }

    const pengurusPhone = claim.kontakPengurusKembali || claim.kontakPengurusPJ || '';
    const repairmanPhone = claim.kontakRepairman || '';
    const pdiPhone = claim.noHpPdi || '';

    // 2. STATUS "DIKIRIM KE MD"
    // Kontak: "Ekspedisi" & "Repairman"
    // Hak Akses: HANYA role "PDI Man"
    if (status.includes('dikirim ke md')) {
      if (isPdiMan) {
        if (pengurusPhone) contacts.push({ label: 'Ekspedisi', phone: pengurusPhone });
        if (repairmanPhone) contacts.push({ label: 'Repairman', phone: repairmanPhone });
      }
      return contacts;
    }

    // 3. STATUS "PROSES DI MD"
    // Kontak: "Repairman"
    // Hak Akses: HANYA role "PDI Man" dan "Kepala Gudang"
    if (status.includes('proses di md')) {
      if (isPdiMan || isKepalaGudang) {
        if (repairmanPhone) contacts.push({ label: 'Repairman', phone: repairmanPhone });
      }
      return contacts;
    }

    // 4. STATUS "DIKIRIM KE DEALER"
    // Kontak:
    // - "Ekspedisi": dapat dilihat oleh "Repairman", "Kepala Gudang", dan "PDI Man"
    // - "PDI Man": HANYA dapat dilihat oleh "Repairman" dan "Kepala Gudang"
    if (status.includes('dikirim ke dealer')) {
      if (isRepairman || isKepalaGudang || isPdiMan) {
        if (pengurusPhone) contacts.push({ label: 'Ekspedisi', phone: pengurusPhone });
      }
      if (isRepairman || isKepalaGudang) {
        if (pdiPhone) contacts.push({ label: 'PDI Man', phone: pdiPhone });
      }
      return contacts;
    }

    // Status lainnya (misal: "Selesai", "Ditolak"): tidak menampilkan kontak
    return [];
  };

  const availableContacts = getAvailableContacts();

  const handleWhatsAppAction = (phone: string, targetName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const message = encodeURIComponent(`Halo ${targetName}, terkait pengajuan klaim MDC Mobile ${claim.idKlaim}...`);
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
    setIsDropdownOpen(false);
  };

  const isSelesai = (claim.status || '').toLowerCase() === 'selesai';
  const isDraft = (claim.status || '').toLowerCase() === 'draft';
  const aktualHari = isSelesai ? hitungAktualHariKerja(claim.rawDate || claim.tgl, claim.tglSelesai) : 0;
  const targetLeadtimeHari = 7; // Target standar SLA perbaikan AHM/MD
  const estSelesai = !isSelesai && !isDraft ? hitungEstimasiSelesai(claim.rawDate || claim.tgl) : '';
  const tglPengajuan = claim.tgl ? claim.tgl.split(' ')[0] : '-';
  const driverName = claim.sopirPJ || claim.sopirKembali || claim.namaSopir || '-';
  const transporterName = claim.transporterPJ || claim.transporterKembali || 'Transporter';

  // 1. MODE LIST (TAMPILAN DAFTAR - Ringkas, padat & efisien secara vertikal)
  if (viewMode === 'SIMPLE') {
    return (
      <div
        onClick={onClick}
        className="group relative flex items-center justify-between p-2.5 mb-1.5 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.99] border border-white/15 backdrop-blur-md shadow-xs transition-all cursor-pointer text-white"
      >
        {/* Sisi Kiri: Nama motor + jumlah part di atas, Sopir + Transporter di bawah */}
        <div className="min-w-0 flex-1 pr-3">
          <h4 className="font-bold text-xs text-white tracking-wide truncate">
            {motorSummary}
          </h4>
          <p className="text-[11px] text-white/60 truncate mt-0.5">
            {driverName} • {transporterName}
          </p>
        </div>

        {/* Sisi Kanan: Status di atas, Estimasi / Leadtime di bawah */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0 text-right">
          {getStatusBadge(claim.status)}
          <div className="text-[10px]">
            {isSelesai ? (
              <span className="text-emerald-300 font-semibold font-mono">
                Leadtime {aktualHari}/{targetLeadtimeHari} Hari
              </span>
            ) : isDraft ? (
              <span className="text-white/50 italic">Draft</span>
            ) : (
              <span className="text-amber-300 font-mono">
                Est: <strong className="text-white font-mono">{estSelesai}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 2. MODE GRID (TAMPILAN KOTAK - Dilengkapi Kontak WhatsApp & Tautan "Detail >")
  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl p-3.5 mb-2.5 bg-gradient-to-b from-white/12 to-white/5 hover:from-white/15 hover:to-white/8 active:scale-[0.99] border border-white/20 backdrop-blur-md shadow-md transition-all cursor-pointer text-white"
    >
      {/* Baris Atas: Ringkasan Motor & Status Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="font-bold text-xs text-white tracking-wide truncate flex-1">
          {motorSummary}
        </h4>
        <div className="flex-shrink-0">{getStatusBadge(claim.status)}</div>
      </div>

      {/* Baris Tengah: Info Sopir + Transporter & Leadtime / Estimasi Selesai */}
      <div className="flex items-center justify-between text-[11px] text-white/70 py-1.5 border-t border-white/10">
        <div className="min-w-0 flex-1 pr-2 truncate">
          <span className="text-white/60">Sopir: </span>
          <strong className="text-white/90">{driverName}</strong>
          <span className="text-white/40 mx-1">•</span>
          <span className="text-white/70">{transporterName}</span>
        </div>

        <div className="text-right flex-shrink-0">
          {isSelesai ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300 font-mono">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Leadtime {aktualHari}/{targetLeadtimeHari} Hari
            </span>
          ) : isDraft ? (
            <span className="inline-flex items-center gap-1 text-white/50 italic">
              <Clock className="w-3 h-3" /> Draft
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-amber-300 font-mono">
              <Clock className="w-3 h-3 text-amber-400" />
              Est: <strong className="text-white font-mono">{estSelesai}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Operasional MD info banner jika sedang dalam perbaikan */}
      {claim.status === 'Proses di MD' && (
        <div className="mt-2 rounded-xl bg-black/30 border border-white/10 p-2 flex items-center justify-between text-[11px]">
          <div className="truncate pr-2">
            <span className="text-white/60">Perbaikan: </span>
            <strong className="text-amber-300">{claim.mdJenisPerbaikan || 'Pengerjaan Teknis'}</strong>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${claim.mdValidasiRepairman === 'Valid' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300'}`}>
            {claim.mdValidasiRepairman === 'Valid' ? 'QC Valid' : 'Pengerjaan'}
          </span>
        </div>
      )}

      {/* Baris Bawah: Tanggal Pengajuan & Aksi (Kontak WhatsApp & Tautan Detail >) */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/10 text-[10px]">
        <div className="flex items-center gap-1 text-white/60">
          <Calendar className="w-3 h-3 text-red-400" />
          <span>{tglPengajuan}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" ref={dropdownRef}>
          {/* Tombol Dropdown Kontak WhatsApp Interaktif */}
          {availableContacts.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDropdownOpen(!isDropdownOpen);
                }}
                className="py-1 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[10px] font-semibold flex items-center gap-1 shadow transition-all cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>Kontak</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-slate-950/95 backdrop-blur-md border border-white/20 shadow-2xl p-1.5 z-40 space-y-1">
                  <div className="px-2.5 py-1 text-[9px] font-bold tracking-wider text-amber-300 uppercase border-b border-white/10">
                    Hubungi via WhatsApp
                  </div>
                  <div className="p-0.5 space-y-1">
                    {availableContacts.map((c, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => handleWhatsAppAction(c.phone, c.label, e)}
                        className="w-full px-2.5 py-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 active:scale-[0.98] border border-white/10 hover:border-emerald-500/30 text-white transition-all flex items-center justify-between gap-2 group/item cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-white/90 group-hover/item:text-white truncate">
                          {c.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/20 flex-shrink-0">
                          <MessageSquare className="w-2.5 h-2.5" />
                          Chat
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Teks Tautan "Detail >" */}
          <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-0.5 text-amber-400 hover:text-amber-300 font-semibold group-hover:translate-x-0.5 transition-transform cursor-pointer"
          >
            <span>Detail &gt;</span>
          </button>
        </div>
      </div>
    </div>
  );
};