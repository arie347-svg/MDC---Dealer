import React from 'react';
import { DashboardStats } from '../types';
import { FileEdit, Send, Wrench, Truck, CheckCircle2 } from 'lucide-react';

interface PipelineFilterProps {
  stats: DashboardStats;
  activeFilter: string;
  onFilterChange: (status: string) => void;
}

export const PipelineFilter: React.FC<PipelineFilterProps> = ({
  stats,
  activeFilter,
  onFilterChange,
}) => {
  const cards = [
    {
      id: 'Draft',
      label: 'Draft',
      count: stats.draft,
      icon: FileEdit,
      colorClass: 'text-slate-200',
      activeBorder: 'border-slate-400 bg-slate-800/80',
      isSiren: stats.alertDraft || stats.draft > 0,
    },
    {
      id: 'Dikirim ke MD',
      label: 'Dikirim ke MD',
      count: stats.kirimMD,
      icon: Send,
      colorClass: 'text-sky-400',
      activeBorder: 'border-sky-500 bg-sky-950/60',
      isSiren: false,
    },
    {
      id: 'Proses di MD',
      label: 'Proses di MD',
      count: stats.prosesMD,
      icon: Wrench,
      colorClass: 'text-amber-400',
      activeBorder: 'border-amber-500 bg-amber-950/60',
      isSiren: false,
    },
    {
      id: 'Dikirim ke Dealer',
      label: 'Kirim ke Dealer',
      count: stats.kirimDealer,
      icon: Truck,
      colorClass: 'text-indigo-300',
      activeBorder: 'border-indigo-500 bg-indigo-950/60',
      isSiren: false,
    },
    {
      id: 'Selesai',
      label: 'Selesai',
      count: stats.selesai,
      icon: CheckCircle2,
      colorClass: 'text-emerald-400',
      activeBorder: 'border-emerald-500 bg-emerald-950/60',
      isSiren: false,
    },
  ];

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-white/90 tracking-wide uppercase">
          Status Alur Klaim
        </h3>
        {activeFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => onFilterChange('ALL')}
            className="text-[11px] font-semibold text-amber-400 hover:underline"
          >
            Tampilkan Semua
          </button>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5">
        {/* Top 3 items take 2 columns each */}
        {cards.slice(0, 3).map((item) => {
          const isActive = activeFilter === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={`col-span-2 relative flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-200 border backdrop-blur-md ${
                isActive
                  ? `${item.activeBorder} shadow-lg ring-2 ring-red-500/50 scale-[1.02]`
                  : 'border-white/10 bg-white/10 hover:bg-white/15'
              } ${item.isSiren && item.id === 'Draft' ? 'animate-pulse ring-2 ring-red-500 bg-red-950/40' : ''}`}
            >
              {item.isSiren && item.id === 'Draft' && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
              )}

              <span className={`text-base font-black tracking-tight ${item.colorClass}`}>
                {item.count}
              </span>
              <div className="flex items-center gap-1 mt-0.5 text-white/80">
                <Icon className="w-2.5 h-2.5" />
                <span className="text-[10px] font-semibold leading-tight truncate">
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}

        {/* Bottom 2 items take 3 columns each */}
        {cards.slice(3, 5).map((item) => {
          const isActive = activeFilter === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={`col-span-3 relative flex items-center justify-center gap-2 p-2 rounded-xl transition-all duration-200 border backdrop-blur-md ${
                isActive
                  ? `${item.activeBorder} shadow-lg ring-2 ring-red-500/50 scale-[1.02]`
                  : 'border-white/10 bg-white/10 hover:bg-white/15'
              }`}
            >
              <span className={`text-base font-black tracking-tight ${item.colorClass}`}>
                {item.count}
              </span>
              <div className="flex items-center gap-1 text-white/80">
                <Icon className="w-3 h-3" />
                <span className="text-[11px] font-semibold leading-tight">
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
