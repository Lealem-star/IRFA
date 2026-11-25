import React from 'react';
import { FuelTransaction } from '../../../types';
import { printReceiptDocument } from '../../../utils/print';
import {
  CheckCircle2,
  Printer,
  RotateCcw,
  Fuel,
  MapPin,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';

interface ScannerReceiptViewProps {
  receipt: FuelTransaction;
  remainingLiters: number;
  operatorUsername?: string;
  onScanNext: () => void;
}

export const ScannerReceiptView: React.FC<ScannerReceiptViewProps> = ({
  receipt,
  remainingLiters,
  operatorUsername,
  onScanNext,
}) => {
  const handlePrint = () => {
    printReceiptDocument(
      receipt.receiptNumber,
      receipt.farmer?.fullName,
      receipt.farmer?.farmerCode
    );
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 space-y-4 animate-fade-in">
      {/* 1. Success Banner */}
      <div className="bg-emerald-600 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-600/20 text-center space-y-1.5">
        <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 size={26} className="text-white" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-emerald-100">
            Transaction Complete
          </div>
          <h2 className="text-base sm:text-lg font-black tracking-tight text-white mt-0.5">
            DISPENSING COMPLETED SUCCESSFULLY
          </h2>
        </div>
      </div>

      {/* 2. Official Government Styled Digital Receipt */}
      <div id="printable-card" className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-xs">
        {/* Bureau & System Header */}
        <div className="text-center pb-3.5 border-b border-dashed border-slate-200 flex flex-col items-center">
          <img
            src="/branding/dfcs-logo.png"
            alt="DFCS Logo"
            className="w-12 h-12 object-contain mb-1.5"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
            }}
          />
          <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
            የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ
          </h3>
          <p className="text-[11px] font-bold text-blue-900 mt-0.5">
            Bahir Dar City Administration Office of Agriculture
          </p>
          <div className="text-[10px] font-semibold text-slate-400 mt-0.5 uppercase tracking-wider">
            Official Fuel Coupon Dispensing Receipt
          </div>
          <div className="mt-2 inline-block px-3 py-1 bg-slate-100 rounded-md font-mono font-black text-xs text-blue-700">
            #{receipt.receiptNumber}
          </div>
        </div>

        {/* Transaction Summary Table */}
        <div className="space-y-2 text-xs divide-y divide-slate-100">
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Station:</span>
            <span className="font-bold text-slate-900 text-right">{receipt.fuelStation?.name || 'Tana Energy Station'}</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Beneficiary:</span>
            <div className="text-right">
              <span className="font-bold text-slate-900 block">{receipt.farmer?.fullName}</span>
              <span className="text-[10px] font-mono text-slate-400 block">{receipt.farmer?.farmerCode}</span>
            </div>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Fuel Type:</span>
            <span className="font-bold text-slate-900">{receipt.fuelType?.name || 'Diesel'}</span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Volume Dispensed:</span>
            <span className="font-mono font-black text-base text-blue-600">
              {receipt.quantityLiters} Liters
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Regulated Price:</span>
            <span className="font-mono text-slate-700">{receipt.pricePerLiter} ETB / L</span>
          </div>

          <div className="flex justify-between items-center py-2 bg-slate-50 px-2.5 rounded-xl border border-slate-100">
            <span className="font-black text-slate-900 text-sm">Total Amount Paid:</span>
            <span className="font-mono font-black text-base sm:text-lg text-emerald-700">
              {receipt.totalAmount} ETB
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-500 font-medium">Remaining Quota Balance:</span>
            <span className="font-bold text-slate-900 font-mono">{remainingLiters} Liters</span>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-3 border-t border-dashed border-slate-200 text-[10px] text-slate-400 flex flex-col items-center gap-0.5 text-center">
          <div>
            Date: {new Date(receipt.transactionDate).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
          </div>
          <div>Authorized Station Operator: {operatorUsername || 'station'}</div>
        </div>
      </div>

      {/* 3. Actions */}
      <div className="space-y-2 pt-1">
        {/* Primary Action: New Farmer */}
        <button
          type="button"
          onClick={onScanNext}
          className="w-full py-4 px-6 bg-slate-900 hover:bg-black active:scale-[0.99] text-white rounded-2xl font-black text-sm tracking-wide shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw size={18} />
          <span>NEW FARMER / SCAN NEXT QR</span>
        </button>

        {/* Secondary Action: Print Receipt */}
        <button
          type="button"
          onClick={handlePrint}
          className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <Printer size={15} />
          <span>Print Official Receipt</span>
        </button>
      </div>
    </div>
  );
};
