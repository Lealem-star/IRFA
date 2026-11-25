import React from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';

interface ScannerDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFarmer: (code: string) => void;
}

export const ScannerDemoModal: React.FC<ScannerDemoModalProps> = ({
  isOpen,
  onClose,
  onSelectFarmer,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/60">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 m-0">Demo Shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Demo Options */}
        <div className="p-4 space-y-2.5 text-xs">
          <p className="text-[11px] text-slate-500 mb-2">
            Quickly simulate beneficiary scanning for evaluation and government presentations:
          </p>

          {/* Scenario 1: Active Authorized Farmer */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectFarmer('FR-00124');
            }}
            className="w-full p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 text-left transition-all active:scale-[0.99] flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={16} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-slate-900 truncate">
                  Abebe Tesfaye (FR-00124)
                </div>
                <div className="text-[11px] text-emerald-800 font-semibold mt-0.5">
                  Authorized · 70 L Available
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-emerald-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Scenario 2: Suspended Farmer */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectFarmer('FR-00127');
            }}
            className="w-full p-3.5 rounded-xl border border-red-200 bg-red-50/60 hover:bg-red-50 text-left transition-all active:scale-[0.99] flex items-center justify-between group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle size={16} />
              </div>
              <div className="min-w-0">
                <div className="font-extrabold text-slate-900 truncate">
                  Suspended Farmer (FR-00127)
                </div>
                <div className="text-[11px] text-red-700 font-semibold mt-0.5">
                  Rejected · Account Suspended
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-red-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="py-1.5 px-3 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
