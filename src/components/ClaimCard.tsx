import React from 'react';
import { ClaimItem } from '../types';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Wrench,
  ChevronRight,
  AlertOctagon,
  FileEdit,
} from 'lucide-react';
import { hitungAktualHariKerja, hitungEstimasiSelesai } from '../utils/slaCalculator';

interface ClaimCardProps {
  claim: ClaimItem;
  viewMode: 'CARDS' | 'SIMPLE';
  onClick: () => void;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({ claim, viewMode, onClick }) => {
  const motorSummary = React.useMemo(() => {
    if (!claim.items || claim.items.length === 0) return 'Unit Motor • 0 Part';
    const uniqueMotors = Array.from(new Set(claim.items.map((i) => i.tipe).filter(Boolean)));
    return `${uniqueMotors.join(', ') || 'Motor'} • ${claim.items.length} Part`;
  }, [claim.items]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Draft':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-300 border border-slate-400/30">
            <FileEdit className="w-2.5 h-2.5" /> Draft
          </span>
        );
      case 'Dikirim ke MD':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
            Dikirim ke MD
          </span>
        );
      case 'Proses di MD':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
            <Wrench className="w-2.5 h-2.5" /> Proses di MD
          </span>
        );
      case 'Dikirim ke Dealer':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
            Kirim ke Dealer
          </span>
        );
      case 'Selesai':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <CheckCircle2 className="w-2.5 h-2.5" /> Selesai
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-300 border border-gray-400/30">
            {status}
          </span>
        );
    }
  };

  // SIMPLE ROW VIEW
  if (viewMode === 'SIMPLE') {
    return (
      <div
        onClick={onClick}
        className="group relative flex items-center justify-between p-3 mb-2 rounded-xl bg-white/10 hover:bg-white/15 active:scale-[0.99] border border-white/15 backdrop-blur-md shadow-sm transition-all cursor-pointer text-white"
      >
        <div className="min-w-0 flex-1 pr-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono text-xs font-bold text-amber-400">#{claim.noSj}</span>
            <span className="text-xs text-white/80 truncate">• {motorSummary}</span>
          </div>
          <p className="text-[11px] text-white/60 truncate mt-0.5">
            {claim.sopirPJ || '-'} ({claim.nopolPJ || '-'})
          </p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {getStatusBadge(claim.status)}
          <span className="text-[10px] text-white/50 font-mono">
            {claim.tgl ? claim.tgl.split(' ')[0] : '-'}
          </span>
        </div>
      </div>
    );
  }

  // DETAILED CARD VIEW
  const isSelesai = claim.status.toLowerCase() === 'selesai';
  const isDraft = claim.status.toLowerCase() === 'draft';
  const aktualHari = isSelesai ? hitungAktualHariKerja(claim.rawDate || claim.tgl, claim.tglSelesai) : 0;
  const estSelesai = !isSelesai && !isDraft ? hitungEstimasiSelesai(claim.rawDate || claim.tgl) : '';

  return (
    <div
      onClick={onClick}
      className="group relative rounded-2xl p-3.5 mb-2.5 bg-gradient-to-b from-white/12 to-white/5 hover:from-white/15 hover:to-white/8 active:scale-[0.99] border border-white/20 backdrop-blur-md shadow-md transition-all cursor-pointer text-white"
    >
      {/* Top row: Motor summary & status badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 mr-1.5">
            SJ #{claim.noSj}
          </span>
          <h4 className="inline font-bold text-xs text-white tracking-wide truncate">
            {motorSummary}
          </h4>
        </div>
        <div className="flex-shrink-0">{getStatusBadge(claim.status)}</div>
      </div>

      {/* Middle row: Dates & SLA */}
      <div className="flex items-center justify-between text-[11px] text-white/70 pt-2 border-t border-white/10">
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 text-red-400" />
          <span>{claim.tgl ? claim.tgl.split(' ')[0] : '-'}</span>
        </div>

        <div className="text-right">
          {isSelesai ? (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Aktual {aktualHari} Hari ({aktualHari <= 7 ? 'SLA OK' : 'Lewat SLA'})
            </span>
          ) : isDraft ? (
            <span className="inline-flex items-center gap-1 text-white/50 italic">
              <Clock className="w-3 h-3" /> Draft (Belum Dikirim)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-amber-300">
              <Clock className="w-3 h-3 text-amber-400" />
              Est. Selesai: <strong className="text-white">{estSelesai}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Operasional MD info banner if in process */}
      {claim.status === 'Proses di MD' && (
        <div className="mt-2.5 rounded-xl bg-black/30 border border-white/10 p-2 flex items-center justify-between text-[11px]">
          <div className="truncate pr-2">
            <span className="text-white/60">Perbaikan: </span>
            <strong className="text-amber-300">{claim.mdJenisPerbaikan || 'Pengerjaan Teknis'}</strong>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${claim.mdValidasiRepairman === 'Valid' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-amber-500/20 text-amber-300'}`}>
            {claim.mdValidasiRepairman === 'Valid' ? 'QC Valid' : 'Pengerjaan'}
          </span>
        </div>
      )}

      {/* Driver info */}
      <div className="flex items-center justify-between mt-2 pt-1.5 text-[10px] text-white/50">
        <span className="truncate">
          Driver: <strong className="text-white/80">{claim.sopirPJ || '-'}</strong> ({claim.nopolPJ || '-'})
        </span>
        <div className="flex items-center gap-0.5 text-amber-400 font-semibold group-hover:translate-x-0.5 transition-transform">
          <span>Detail</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </div>
  );
};
