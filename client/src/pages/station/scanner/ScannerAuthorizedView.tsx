import React from 'react';
import { VerificationResultData } from '../../../types';
import { getAssetUrl } from '../../../services/api';
import {
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Fuel,
  MapPin,
  Maximize2,
  ShieldCheck,
  User,
} from 'lucide-react';

interface ScannerAuthorizedViewProps {
  data: VerificationResultData;
  onContinueToDispense: () => void;
  onCancelScan: () => void;
}

export const ScannerAuthorizedView: React.FC<ScannerAuthorizedViewProps> = ({
  data,
  onContinueToDispense,
  onCancelScan,
}) => {
  const { farmer, authorization } = data;
  const photoUrl = farmer.photoUrl ? getAssetUrl(farmer.photoUrl) : null;

  return (
    <div className="w-full max-w-xl mx-auto p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
      {/* 1. Header Banner */}
      <div className="bg-emerald-500 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-emerald-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
            <CheckCircle2 size={24} className="text-white" />
          </div>
          <div>
            <div className="text-xs font-black tracking-wider uppercase text-emerald-100">
              Identity & Quota Verified
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white leading-tight">
              AUTHORIZED FOR DISPENSING
            </h2>
          </div>
        </div>

        <span className="hidden sm:inline-flex bg-emerald-600/60 border border-emerald-400/40 text-[11px] font-bold px-2.5 py-1 rounded-full text-white shrink-0">
          Valid Authorization
        </span>
      </div>

      {/* 2. Farmer Identity Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3.5">
        <div className="flex items-center gap-3.5">
          {/* Photo / Avatar */}
          <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
            {photoUrl ? (
              <img src={photoUrl} alt={farmer.fullName} className="w-full h-full object-cover" />
            ) : (
              <User size={30} className="text-slate-400" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 truncate">
                {farmer.fullName}
              </h3>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                {farmer.farmerCode}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
              <MapPin size={13} className="text-slate-400 shrink-0" />
              <span className="truncate">{farmer.kebele} {farmer.subCity ? `· ${farmer.subCity}` : ''}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 mt-1.5">
              <ShieldCheck size={14} className="shrink-0" />
              <span>Assigned Station: {authorization.stationName}</span>
            </div>
          </div>
        </div>

        {/* Land Size & Pump Spec Chips */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 block font-medium">Land & Water Source</span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {farmer.landSize ? `${farmer.landSize} ha` : '—'} · {farmer.waterSource || 'Lake Tana'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <span className="text-[11px] text-slate-400 block font-medium">Pump Specification</span>
            <span className="font-bold text-slate-800 truncate block mt-0.5">
              {farmer.pumpFuelType || 'Diesel'} {farmer.pumpHorsepower ? `(${farmer.pumpHorsepower} HP)` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Fuel Quota Summary (3 Distinct High-Contrast Cards) */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {/* Approved Quota */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Approved
          </span>
          <div className="text-lg sm:text-2xl font-black text-slate-800 mt-1">
            {authorization.authorizedLiters}
            <span className="text-xs font-semibold ml-0.5 text-slate-500">L</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Total Cycle</span>
        </div>

        {/* Consumed / Used */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 text-center shadow-2xs">
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Consumed
          </span>
          <div className="text-lg sm:text-2xl font-black text-slate-400 mt-1">
            {authorization.consumedLiters}
            <span className="text-xs font-semibold ml-0.5 text-slate-400">L</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block truncate">Prior Purchases</span>
        </div>

        {/* Remaining Quota (Highlighted) */}
        <div className="bg-blue-50 border-2 border-blue-500 rounded-2xl p-3 sm:p-4 text-center shadow-sm">
          <span className="text-[10px] sm:text-[11px] font-black text-blue-700 uppercase tracking-wider block">
            Available
          </span>
          <div className="text-lg sm:text-2xl font-black text-blue-600 mt-1">
            {authorization.remainingLiters}
            <span className="text-xs font-bold ml-0.5 text-blue-500">L</span>
          </div>
          <span className="text-[10px] font-bold text-blue-600 mt-0.5 block truncate">Ready to Dispense</span>
        </div>
      </div>

      {/* 4. Pricing Strip */}
      <div className="bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl flex items-center justify-between text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <Fuel size={16} className="text-blue-400" />
          <span className="font-semibold text-slate-200">{authorization.fuelType}</span>
        </div>
        <div className="font-mono font-bold text-emerald-400 text-sm">
          {authorization.pricePerLiter} ETB / Liter
        </div>
      </div>

      {/* 5. Primary & Secondary Actions */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={onContinueToDispense}
          disabled={Number(authorization.remainingLiters) <= 0}
          className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <span>CONTINUE TO DISPENSING</span>
          <ArrowRight size={18} />
        </button>

        <button
          type="button"
          onClick={onCancelScan}
          className="w-full py-3 px-4 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-700 border border-slate-200 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
        >
          <RotateCcw size={14} />
          <span>Cancel / Scan Another Farmer</span>
        </button>
      </div>
    </div>
  );
};
