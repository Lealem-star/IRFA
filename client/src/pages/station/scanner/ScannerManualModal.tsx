import React, { useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface ScannerManualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
  isLoading: boolean;
}

export const ScannerManualModal: React.FC<ScannerManualModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isLoading) return;
    onSubmit(code.trim());
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 m-0">Manual Verification</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Farmer Code, Card Serial, or QR Token *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter Farmer ID or Card Serial (e.g. FR-XXXXX)"
                className="w-full pl-9 pr-3 py-2.5 border-2 border-slate-200 focus:border-blue-600 focus:outline-none rounded-xl text-xs sm:text-sm font-mono text-slate-900 bg-slate-50 focus:bg-white"
              />
              <Search size={15} className="absolute left-3 top-3.5 text-slate-400" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports official Farmer IDs, plastic card serial numbers, and encrypted QR tokens.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-1/3 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!code.trim() || isLoading}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <span>Verify Record</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
