import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  note: string;
  icon: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, note, icon }) => {
  return (
    <div className="bg-white border border-gov-line rounded-[13px] p-[17px_18px] shadow-[0_2px_6px_rgba(20,40,70,0.025)] flex flex-col justify-between">
      <div className="flex justify-between items-start text-gov-muted text-xs font-medium">
        <span>{title}</span>
        <span className="bg-[#eef3ff] text-gov-blue p-2 rounded-[9px] flex items-center justify-center">
          {icon}
        </span>
      </div>
      <div>
        <div className="text-[25px] font-bold text-gov-ink my-2 tracking-tight">{value}</div>
        <div className="text-[11px] text-gov-muted">{note}</div>
      </div>
    </div>
  );
};
