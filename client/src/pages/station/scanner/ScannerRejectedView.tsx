import React from 'react';
import {
  AlertTriangle,
  RotateCcw,
  Search,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

interface ScannerRejectedViewProps {
  rejectionReason: string;
  attemptedCode?: string;
  onScanAnother: () => void;
  onOpenManualEntry: () => void;
}

export const ScannerRejectedView: React.FC<ScannerRejectedViewProps> = ({
  rejectionReason,
  attemptedCode,
  onScanAnother,
  onOpenManualEntry,
}) => {
  return (
    <div className="w-full max-w-md mx-auto p-4 sm:p-6 space-y-4 animate-fade-in">
      {/* 1. Rejection Alert Header */}
      <div className="bg-red-500 text-white rounded-2xl p-5 shadow-lg shadow-red-500/20 text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto shadow-inner">
          <AlertTriangle size={30} className="text-white" />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-widest text-red-100">
            Access Blocked
          </div>
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
            VERIFICATION REJECTED
          </h2>
        </div>
      </div>

      {/* 2. Specific Backend Reason Card */}
      <div className="bg-white border-2 border-red-200 rounded-2xl p-5 shadow-xs space-y-3.5">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Reason for Rejection
            </h4>
            <p className="text-sm font-bold text-red-700 mt-1 leading-snug">
              {rejectionReason || 'The scanned card is not authorized for fuel distribution.'}
            </p>
          </div>
        </div>

        {attemptedCode && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
            <span className="text-slate-500">Scanned Identifier:</span>
            <span className="font-mono font-bold text-slate-800">{attemptedCode}</span>
          </div>
        )}

        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
          <HelpCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
          <span>
            If the farmer believes this is an error, advise them to visit the Bahir Dar Agriculture
            Office to resolve eligibility or station assignment.
          </span>
        </div>
      </div>

      {/* 3. Operational Actions */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={onScanAnother}
          className="w-full py-3.5 px-4 bg-slate-900 hover:bg-black active:scale-[0.99] text-white rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw size={16} />
          <span>SCAN ANOTHER FARMER</span>
        </button>

        <button
          type="button"
          onClick={onOpenManualEntry}
          className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <Search size={15} />
          <span>Enter ID Manually</span>
        </button>
      </div>
    </div>
  );
};
