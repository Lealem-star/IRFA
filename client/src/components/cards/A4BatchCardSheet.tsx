import React from 'react';
import { Farmer } from '../../types';
import { FarmerDigitalIdCard } from './FarmerDigitalIdCard';

interface A4BatchCardSheetProps {
  farmers: Farmer[];
  qrMap: Record<string, string>;
  side?: 'front' | 'back' | 'both';
}

export const A4BatchCardSheet: React.FC<A4BatchCardSheetProps> = ({
  farmers,
  qrMap,
  side = 'front',
}) => {
  return (
    <div id="printable-batch-sheet" className="a4-sheet-container bg-white p-[8mm] shadow-lg print:shadow-none print:p-0">
      {/* Cut guide header for print preview only */}
      <div className="hidden print:block text-[8pt] font-mono text-gray-500 pb-[3mm] border-b border-gray-300 mb-[4mm]">
        <span>Digital Fuel Coupon System · Bahir Dar City Administration Office of Agriculture (A4 Cut Sheet)</span>
        <span className="float-right">{new Date().toLocaleDateString()}</span>
      </div>

      {/* 2-Column Grid of 85.60 mm x 53.98 mm Cards */}
      <div className="grid grid-cols-2 gap-x-[6mm] gap-y-[5mm] justify-items-center">
        {farmers.map((farmer, idx) => {
          const qrDataUrl = qrMap[farmer.id] || '';
          return (
            <div
              key={farmer.id || idx}
              className="batch-card-cell relative border border-dashed border-gray-400 p-[1mm] rounded-[4mm] bg-white"
            >
              {/* Corner Cut Marks */}
              <div className="absolute top-[-1.5mm] left-[-1.5mm] w-[3mm] h-[3mm] border-t-2 border-l-2 border-gray-500 pointer-events-none" />
              <div className="absolute top-[-1.5mm] right-[-1.5mm] w-[3mm] h-[3mm] border-t-2 border-r-2 border-gray-500 pointer-events-none" />
              <div className="absolute bottom-[-1.5mm] left-[-1.5mm] w-[3mm] h-[3mm] border-b-2 border-l-2 border-gray-500 pointer-events-none" />
              <div className="absolute bottom-[-1.5mm] right-[-1.5mm] w-[3mm] h-[3mm] border-b-2 border-r-2 border-gray-500 pointer-events-none" />

              <FarmerDigitalIdCard
                farmer={farmer}
                qrDataUrl={qrDataUrl}
                side={side === 'both' ? 'front' : side}
                mode="print"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
