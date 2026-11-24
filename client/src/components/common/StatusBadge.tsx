import React from 'react';

interface StatusBadgeProps {
  status: string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, size = 'sm' }) => {
  const norm = (status || '').toUpperCase();

  let colorClass = 'text-gray-700 bg-gray-100'; // Default gray

  if (['ACTIVE', 'ELIGIBLE', 'APPROVED', 'CARD ISSUED', 'SUCCESS', 'COMPLETED', 'RECORDED', 'VERIFIED'].includes(norm)) {
    colorClass = 'text-[#117a54] bg-[#e5f7ef]';
  } else if (['UNDER_REVIEW', 'REVIEW', 'PENDING', 'PENDING TRADE', 'PARTIAL', 'PARTIALLY_APPROVED', 'PLANNED'].includes(norm)) {
    colorClass = 'text-[#9c650d] bg-[#fff3d8]';
  } else if (['SUBMITTED', 'ACTIVE_AUTH', 'DIESEL', 'ASSIGNED'].includes(norm)) {
    colorClass = 'text-[#2458d3] bg-[#eaf0ff]';
  } else if (['SUSPENDED', 'INELIGIBLE', 'REJECTED', 'BLOCKED', 'LOST', 'DEACTIVATED', 'EXHAUSTED', 'VOIDED'].includes(norm)) {
    colorClass = 'text-[#b12c39] bg-[#fdecef]';
  }

  const displayText = label || status.replace(/_/g, ' ');

  return (
    <span
      className={`inline-block font-semibold rounded-full capitalize whitespace-nowrap ${
        size === 'sm' ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${colorClass}`}
    >
      {displayText}
    </span>
  );
};
