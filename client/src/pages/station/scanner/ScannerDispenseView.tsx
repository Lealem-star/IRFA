import React, { useState } from 'react';
import { VerificationResultData } from '../../../types';
import {
  Flame,
  ArrowLeft,
  Receipt,
  Minus,
  Plus,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface ScannerDispenseViewProps {
  data: VerificationResultData;
  onSubmitDispense: (liters: number, notes: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  submissionError: string | null;
}

export const ScannerDispenseView: React.FC<ScannerDispenseViewProps> = ({
  data,
  onSubmitDispense,
  onCancel,
  isSubmitting,
  submissionError,
}) => {
  const { farmer, authorization } = data;
  const remainingLiters = Number(authorization.remainingLiters);
  const unitPrice = Number(authorization.pricePerLiter);

  // Initial preset: 50L or max remaining
  const [liters, setLiters] = useState<number>(() => {
    return remainingLiters >= 50 ? 50 : remainingLiters > 0 ? remainingLiters : 0;
  });
  const [notes, setNotes] = useState('');

  const totalAmount = (liters * unitPrice).toFixed(2);
  const isValid = liters > 0 && liters <= remainingLiters && !isNaN(liters);

  const handleQuickSelect = (qty: number) => {
    const safeQty = Math.min(qty, remainingLiters);
    setLiters(safeQty);
  };

  const handleStep = (delta: number) => {
    const next = Math.max(1, Math.min(remainingLiters, liters + delta));
    setLiters(next);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    onSubmitDispense(liters, notes);
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4 sm:p-6 space-y-4 animate-fade-in">
      {/* 1. Header with Compact Farmer Context */}
      <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-md flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase font-black tracking-wider text-blue-400">
            Dispensing To Beneficiary
          </div>
          <div className="text-sm sm:text-base font-extrabold text-white truncate mt-0.5">
            {farmer.fullName}
          </div>
          <div className="text-xs text-slate-400 font-mono">{farmer.farmerCode}</div>
        </div>

        <div className="text-right shrink-0 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
          <div className="text-[10px] text-blue-300 font-bold uppercase">Authorized</div>
          <div className="text-base sm:text-lg font-black text-emerald-400">
            {remainingLiters} <span className="text-xs font-semibold">L</span>
          </div>
        </div>
      </div>

      {/* Submission Error Banner if any */}
      {submissionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>{submissionError}</span>
        </div>
      )}

      {/* 2. Dispensing Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        {/* Quick Volume Selection Chips */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Quick Volume Selection
          </label>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[10, 20, 30, 50].map((qty) => {
              const disabled = qty > remainingLiters;
              const isSelected = liters === qty;
              return (
                <button
                  key={qty}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleQuickSelect(qty)}
                  className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-extrabold transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : disabled
                      ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  {qty} L
                </button>
              );
            })}

            {/* Max / Full Quota Chip */}
            <button
              type="button"
              onClick={() => handleQuickSelect(remainingLiters)}
              className={`py-2 px-1 rounded-xl text-xs sm:text-sm font-extrabold transition-all border cursor-pointer ${
                liters === remainingLiters
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-200'
              }`}
            >
              Max ({remainingLiters}L)
            </button>
          </div>
        </div>

        {/* Volume Stepper & Numeric Input */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Volume to Dispense (Liters) *
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleStep(-5)}
              disabled={liters <= 1 || isSubmitting}
              className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Minus size={20} />
            </button>

            <div className="relative flex-1">
              <input
                type="number"
                inputMode="decimal"
                min="1"
                max={remainingLiters}
                step="any"
                required
                value={liters || ''}
                onChange={(e) => setLiters(parseFloat(e.target.value) || 0)}
                className="w-full h-12 px-4 text-center font-mono font-black text-2xl text-slate-900 border-2 border-slate-300 focus:border-blue-600 focus:outline-none rounded-xl bg-slate-50 shadow-inner"
              />
              <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">
                Liters
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleStep(5)}
              disabled={liters >= remainingLiters || isSubmitting}
              className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center font-bold disabled:opacity-30 cursor-pointer shrink-0"
            >
              <Plus size={20} />
            </button>
          </div>
          {liters > remainingLiters && (
            <p className="text-[11px] text-red-600 font-semibold mt-1">
              Exceeds farmer's remaining authorization balance ({remainingLiters} L)
            </p>
          )}
        </div>

        {/* Live Total Calculation Card */}
        <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Total Amount to Collect
            </span>
            <div className="text-xs text-slate-500 mt-0.5">
              {liters || 0} L × {unitPrice.toFixed(2)} ETB/L
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono text-blue-700">
            {totalAmount} <span className="text-xs font-bold">ETB</span>
          </div>
        </div>

        {/* Notes (Jerrycan ID) */}
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            Operator Notes / Container ID (Optional)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Dispensed into 2 standard yellow containers"
            className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Recording Dispensing...</span>
              </>
            ) : (
              <>
                <Receipt size={18} />
                <span>CONFIRM DISPENSING & ISSUE RECEIPT</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <ArrowLeft size={14} />
            <span>Back to Authorization Summary</span>
          </button>
        </div>
      </form>
    </div>
  );
};
