import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  badge?: string;
  subtext?: string;
  icon?: ReactNode;
  valueColor?: string;
  trend?: {
    value: string;
    isUp?: boolean;
  };
}

export default function StatCard({ label, value, badge, subtext, icon, valueColor, trend }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white/90 backdrop-blur-xl p-5 border border-white/60 shadow-[0_12px_30px_-8px_rgba(30,58,31,0.06)] flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-[#434936] font-bold">{label}</span>
        {icon && (
          <div className="h-8 w-8 rounded-xl bg-[#f5f3f0] text-[#1e3a1f] flex items-center justify-center">
            {icon}
          </div>
        )}
        {badge && !icon && (
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-[#c9ecc4] text-[#4e6c4c] rounded-full">
            {badge}
          </span>
        )}
      </div>

      <div className="my-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl lg:text-3xl font-bold tracking-tight ${valueColor || 'text-[#1b1c1a]'}`}>
            {value}
          </span>
          {trend && (
            <span className={`text-xs font-bold flex items-center ${trend.isUp ? 'text-[#84b817]' : 'text-amber-600'}`}>
              {trend.isUp ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        {subtext && <p className="text-xs text-[#434936] mt-0.5 font-medium">{subtext}</p>}
      </div>

      <div className="w-full pt-1">
        <div className="h-1.5 w-full bg-[#efeeeb] rounded-full overflow-hidden flex">
          <div className="h-full bg-[#84b817] rounded-full" style={{ width: '78%' }} />
        </div>
      </div>
    </div>
  );
}
  