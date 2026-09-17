import React, { useState } from 'react';
import { ClaimItem, UserProfile } from '../types';
import {
  X,
  Share2,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  generateLkuatPdf,
  generateLkuatPdfBlob,
  getLkuatPdfFilename,
} from '../utils/lkuatGenerator';

interface ClaimReceiptModalProps {
  claim: ClaimItem | null;
  user?: UserProfile | null;
  onClose: () => void;
}

export const ClaimReceiptModal: React.FC<ClaimReceiptModalProps> = ({
  claim,
  user,
  onClose,
}) => {
  const [copiedText, setCopiedText] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!claim) return null;

  const kodeHurufDealer =
    claim.kodeDealer || user?.kodeDealer || 'DEALER';

  const totalParts = claim.items?.length || 0;
  // Hitung jumlah unit motor unik
  const uniqueMotors = new Set(
    (claim.items || []).map((it) => it.noMesin || it.tipe || '1')
  );
  const motorCount = uniqueMotors.size || 1;

  const handleCopyId = () => {
    navigator.clipboard.writeText(claim.idKlaim);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Handler Bagikan File PDF LKUAT
  const handleShareLkuatPdf = async () => {
    setIsSharing(true);
    try {
      const filename = getLkuatPdfFilename(claim, user);
      const pdfBlob = await generateLkuatPdfBlob(claim, user);
      const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });

      // Coba bagikan file PDF via Web Share API
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          title: `LKUAT - ${claim.noSj}`,
          files: [pdfFile],
        });
        return;
      } else if (navigator.share) {
        // Fallback share text bila share file tidak didukung
        await navigator.share({
          title: `LKUAT #${claim.noSj}`,
          text: `Dokumen LKUAT Klaim No SJ #${claim.noSj} (${claim.namaDealer}) - Status: Dikirim ke MD`,
        });
        return;
      }

      // Fallback unduh otomatis jika Web Share API tidak tersedia
      const doc = await generateLkuatPdf(claim, user);
      doc.save(filename);
      setToastMessage('Dokumen LKUAT PDF berhasil diunduh!');
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.warn('Share LKUAT Error:', err);
      // Fallback download manual jika share error
      try {
        const doc = await generateLkuatPdf(claim, user);
        doc.save(getLkuatPdfFilename(claim, user));
        setToastMessage('Dokumen LKUAT PDF berhasil diunduh!');
        setTimeout(() => setToastMessage(null), 3500);
      } catch (_) {
        setToastMessage('Gagal menyiapkan dokumen PDF.');
        setTimeout(() => setToastMessage(null), 3000);
      }
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-in fade-in duration-200">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 left-4 right-4 z-50 p-3 rounded-xl bg-slate-900 text-white border border-slate-700 text-xs text-center font-medium shadow-2xl animate-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Kartu Resi Bersih Putih Pas 1 Layar Tanpa Scroll */}
      <div className="w-full max-w-sm h-auto max-h-[96dvh] flex flex-col justify-between overflow-hidden bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-3xl p-5 relative select-none">
        
        {/* Tombol Tutup (X) di Pojok Kanan Atas */}
        <button
          type="button"
          onClick={onClose}
          title="Tutup Resi"
          className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Bagian Atas: CUKUP Icon Checklist Hijau Saja */}
        <div className="flex flex-col items-center pt-1 pb-2">
          <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-600 shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mt-2">
            Resi Pengiriman Digital
          </span>
        </div>

        {/* Kotak Fisik Lembar Struk (Teks Hitam di atas Putih Clean) */}
        <div className="rounded-2xl bg-slate-50/80 border border-slate-200 p-3.5 space-y-2.5 my-1">
          
          {/* Header Resi: ID Klaim & Salin ID */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider block">
                ID Pengajuan Klaim
              </span>
              <span className="text-xs font-mono font-extrabold text-slate-900">
                {claim.idKlaim}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyId}
              className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 active:scale-95 text-[10px] font-bold text-slate-700 border border-slate-200 flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            >
              {copiedText ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span className="text-emerald-600">Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-slate-500" />
                  <span>Salin</span>
                </>
              )}
            </button>
          </div>

          {/* Rincian Ringkas Data Klaim */}
          <div className="space-y-1.5 text-[11px]">
            {/* Status & Waktu */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                DIKIRIM KE MD
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Waktu Kirim</span>
              <span className="font-semibold text-slate-800 text-right">{claim.tgl}</span>
            </div>

            {/* Garis Putus-putus Pemisah */}
            <div className="border-t border-dashed border-slate-300 my-1" />

            {/* Identitas Dealer: Kode Dealer (HURUF) & Nama Dealer */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Kode Dealer</span>
              <span className="font-black text-red-600 tracking-wider text-xs font-mono">
                {kodeHurufDealer}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Nama Dealer</span>
              <span className="font-bold text-slate-900 truncate max-w-[190px] text-right">
                {claim.namaDealer}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">No. Surat Jalan</span>
              <span className="font-mono font-bold text-slate-900">
                {claim.noSj}
              </span>
            </div>

            {/* Garis Putus-putus Pemisah */}
            <div className="border-t border-dashed border-slate-300 my-1" />

            {/* Info Sopir & Transporter Pengembalian */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sopir / Nopol</span>
              <span className="font-medium text-slate-800 truncate max-w-[190px] text-right">
                {claim.sopirKembali || claim.sopirPJ || '-'} •{' '}
                <strong className="font-mono">{claim.nopolKembali || claim.nopolPJ || '-'}</strong>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Transporter</span>
              <span className="font-bold text-slate-900">
                {claim.transporterKembali || claim.transporterPJ || '-'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500">Total Part Cacat</span>
              <span className="font-extrabold text-slate-900">
                {totalParts} Part <span className="font-normal text-slate-500">({motorCount} Unit)</span>
              </span>
            </div>
          </div>

          {/* Watermark Garis Pengesahan */}
          <div className="pt-2 border-t border-slate-200 text-center">
            <span className="text-[9px] text-slate-400 font-mono block">
              Tercatat Resmi di MDC • Dokumen LKUAT Diterbitkan
            </span>
          </div>
        </div>

        {/* Footer: HANYA SATU TOMBOL "Bagikan Dokumen LKUAT (PDF)" */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleShareLkuatPdf}
            disabled={isSharing}
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-98 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg disabled:opacity-60"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>Menyiapkan PDF LKUAT...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-red-400" />
                <Share2 className="w-4 h-4 text-amber-300" />
                <span>Bagikan Dokumen LKUAT (PDF)</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
