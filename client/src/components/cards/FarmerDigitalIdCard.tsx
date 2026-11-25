import React from 'react';
import { Farmer, FarmerCard } from '../../types';
import { User, AlertCircle, ShieldCheck } from 'lucide-react';
import { getAssetUrl } from '../../services/api';

interface FarmerDigitalIdCardProps {
  farmer: Farmer;
  card?: FarmerCard | null;
  qrDataUrl: string;
  side?: 'front' | 'back' | 'both';
  mode?: 'preview' | 'print';
}

export const FarmerDigitalIdCard: React.FC<FarmerDigitalIdCardProps> = ({
  farmer,
  card,
  qrDataUrl,
  side = 'both',
  mode = 'preview',
}) => {
  const activeCard = card || farmer.cards?.find((c) => c.status === 'ACTIVE') || farmer.cards?.[0];
  const cardSerial = activeCard?.cardSerialNumber || `BD-CARD-PENDING-${farmer.farmerCode}`;
  const isSuspended = farmer.eligibilityStatus === 'SUSPENDED';
  const isCardActive = activeCard?.status === 'ACTIVE' && farmer.eligibilityStatus === 'ELIGIBLE' && farmer.isActive;
  const statusLabel = isSuspended
    ? 'SUSPENDED'
    : !farmer.isActive
    ? 'INACTIVE'
    : activeCard?.status || 'ACTIVE';

  const statusBg =
    statusLabel === 'ACTIVE'
      ? 'bg-emerald-600 text-white'
      : statusLabel === 'SUSPENDED'
      ? 'bg-red-600 text-white'
      : 'bg-gray-600 text-white';

  const issueDateFormatted = activeCard?.issuedAt
    ? new Date(activeCard.issuedAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  const expiryDateFormatted = activeCard?.expiresAt
    ? new Date(activeCard.expiresAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '1 Year from Issue';

  // Photo URL resolution
  const photoUrl = farmer.photoUrl ? getAssetUrl(farmer.photoUrl) : null;

  /* Front Card View */
  const renderFront = () => (
    <div
      className="farmer-id-card farmer-id-card-front relative bg-white border border-gray-300 rounded-[3mm] overflow-hidden flex flex-col justify-between shadow-md print:shadow-none print:border-gray-400 select-none"
      style={{
        width: '85.6mm',
        height: '53.98mm',
        minWidth: '85.6mm',
        minHeight: '53.98mm',
        maxWidth: '85.6mm',
        maxHeight: '53.98mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Background Watermark Pattern */}
      <div className="absolute right-[-6mm] bottom-[-6mm] opacity-[0.07] w-[44mm] h-[44mm] pointer-events-none select-none">
        <img src="/branding/dfcs-logo.png" alt="" className="w-full h-full object-contain" />
      </div>

      {/* Top Government Header Strip */}
      <div className="bg-[#12315B] text-white px-[3mm] py-[1.8mm] flex items-center justify-between border-b border-[#0D2444] shrink-0">
        <div className="flex items-center gap-[2mm]">
          <img
            src="/branding/official-bureau-emblem.jpg"
            alt="Office of Agriculture Emblem"
            className="w-[7.5mm] h-[7.5mm] object-contain drop-shadow-xs rounded-full bg-white p-[0.3mm]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
            }}
          />
          <div className="leading-tight">
            <div className="text-[7.5pt] font-black tracking-wide text-white leading-none">
              የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ
            </div>
            <div className="text-[5.5pt] font-bold text-blue-200 tracking-tight leading-none mt-[0.5mm]">
              BAHIR DAR CITY ADMINISTRATION OFFICE OF AGRICULTURE
            </div>
          </div>
        </div>

        {/* Dedicated DFCS System Logo instead of plain text */}
        <div className="flex items-center">
          <img
            src="/branding/dfcs-logo.png"
            alt="Digital Fuel Coupon System Logo"
            className="h-[8.5mm] max-w-[26mm] object-contain drop-shadow-xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
            }}
          />
        </div>
      </div>

      {/* Card Body */}
      <div className="px-[3mm] py-[2mm] flex-1 flex gap-[2.8mm] items-center relative z-10">
        {/* Passport Photo Box */}
        <div className="w-[23mm] h-[29mm] shrink-0 bg-slate-100 border border-slate-300 rounded-[1.5mm] overflow-hidden flex flex-col items-center justify-center relative shadow-2xs">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={farmer.fullName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // fallback to silhouette on broken link
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-1 text-center h-full w-full bg-slate-100">
              <User size={26} className="text-slate-400 mb-0.5" />
              <span className="text-[4.5pt] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded leading-none border border-amber-300">
                PHOTO MISSING
              </span>
            </div>
          )}
          {/* Subtle Photo Seal Border */}
          <div className="absolute inset-0 border border-black/10 rounded-[1.5mm] pointer-events-none" />
        </div>

        {/* Farmer Information Block */}
        <div className="flex-1 flex flex-col justify-between h-[29mm] overflow-hidden">
          <div>
            {/* Beneficiary Name */}
            <div className="text-[5pt] font-bold text-gray-500 uppercase tracking-wider leading-none">
              Full Name / የአርሶ አደሩ ስም
            </div>
            <div className="text-[8.5pt] font-black text-[#12315B] tracking-tight leading-tight truncate mt-[0.3mm]">
              {farmer.fullName}
            </div>

            {/* Farmer ID & Status */}
            <div className="flex items-center gap-[2mm] mt-[1mm]">
              <span className="font-mono text-[7pt] font-extrabold text-[#1686D9] bg-blue-50 px-[1.5mm] py-[0.3mm] rounded border border-blue-200">
                {farmer.farmerCode}
              </span>
              <span
                className={`text-[4.5pt] font-bold px-[1.5mm] py-[0.3mm] rounded uppercase tracking-wider ${statusBg}`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-x-[1.5mm] gap-y-[0.8mm] text-[5.5pt] pt-[1mm] border-t border-gray-100">
            <div>
              <span className="text-gray-400 block text-[4.5pt] leading-none">Kebele / ቀበሌ</span>
              <span className="font-bold text-gray-800 truncate block leading-tight">
                {farmer.kebele?.name || 'Bahir Dar Basin'}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[4.5pt] leading-none">Sub-City / ክፍለ ከተማ</span>
              <span className="font-bold text-gray-800 truncate block leading-tight">
                {farmer.subCity?.name || farmer.kebele?.subCity?.name || 'ጣና ክፍለ ከተማ'}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[4.5pt] leading-none">Land Size / ስፋት</span>
              <span className="font-semibold text-gray-800 leading-tight">
                {farmer.irrigationProfile?.landSizeHectares || '—'} ha
              </span>
            </div>
            <div>
              <span className="text-gray-400 block text-[4.5pt] leading-none">Pump Fuel / ነዳጅ</span>
              <span className="font-extrabold text-[#12315B] leading-tight">
                {farmer.irrigationProfile?.pumpFuelType || 'Diesel'}
              </span>
            </div>
          </div>

          {/* Card Serial Number */}
          <div className="flex items-center justify-between text-[4.5pt] font-mono text-gray-500 pt-[0.8mm] border-t border-dashed border-gray-200">
            <span>SN: {cardSerial}</span>
            <span className="text-[#12315B] font-semibold">Bahir Dar, Ethiopia</span>
          </div>
        </div>
      </div>

      {/* Bottom Accent Line */}
      <div className="h-[1.2mm] w-full bg-gradient-to-r from-[#12315B] via-[#1686D9] to-[#2E7D32] shrink-0" />
    </div>
  );

  /* Back Card View */
  const renderBack = () => (
    <div
      className="farmer-id-card farmer-id-card-back relative bg-white border border-gray-300 rounded-[3mm] overflow-hidden flex flex-col justify-between shadow-md print:shadow-none print:border-gray-400 select-none"
      style={{
        width: '85.6mm',
        height: '53.98mm',
        minWidth: '85.6mm',
        minHeight: '53.98mm',
        maxWidth: '85.6mm',
        maxHeight: '53.98mm',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Strip */}
      <div className="bg-[#12315B] text-white px-[3mm] py-[1.2mm] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-[1.5mm]">
          <img
            src="/branding/dfcs-logo.png"
            alt="DFCS"
            className="h-[4.5mm] object-contain"
          />
          <span className="text-[5pt] font-bold tracking-wider text-blue-200 uppercase">
            DIGITAL FUEL COUPON VERIFICATION
          </span>
        </div>
        <span className="text-[5pt] font-mono text-gray-300">
          ID: {farmer.farmerCode}
        </span>
      </div>

      {/* Main Body */}
      <div className="px-[3mm] py-[1.8mm] flex-1 flex items-center justify-between gap-[2.5mm]">
        {/* High-Contrast QR Code */}
        <div className="w-[28mm] h-[28mm] shrink-0 bg-white border border-gray-300 rounded-[1.5mm] p-[1mm] flex flex-col items-center justify-center shadow-2xs">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain" />
          ) : (
            <div className="text-[5pt] text-gray-400 text-center">Loading QR...</div>
          )}
          <span className="text-[3.8pt] font-mono font-bold text-gray-600 mt-[0.3mm] block">
            {activeCard?.qrToken?.slice(-12) || farmer.farmerCode}
          </span>
        </div>

        {/* Verification Instructions & Security Disclaimer */}
        <div className="flex-1 flex flex-col justify-between h-full text-gray-700 leading-tight">
          {/* Instructions Block */}
          <div className="space-y-[0.8mm]">
            <div className="flex items-start gap-[1mm]">
              <ShieldCheck size={11} className="text-[#1686D9] shrink-0 mt-[0.5mm]" />
              <div>
                <p className="text-[5.5pt] font-bold text-gray-900 leading-tight m-0">
                  የገበሬውን መረጃ እና የነዳጅ ፈቃድ ለማረጋገጥ QR ኮዱን በዲጂታል ነዳጅ ኩፖን ሥርዓት (Digital Fuel Coupon System) ይቃኙ።
                </p>
                <p className="text-[4.8pt] font-medium text-gray-600 leading-tight m-0 mt-[0.3mm]">
                  Scan this QR code through the official Digital Fuel Coupon System to verify farmer identity and current fuel authorization.
                </p>
              </div>
            </div>

            {/* Disclaimer Block */}
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-[1mm] p-[1.2mm] text-amber-900">
              <p className="text-[4.8pt] font-bold leading-tight m-0">
                ይህ ካርድ በራሱ የነዳጅ መስጫ ፈቃድ አይደለም። ነዳጅ የሚሰጠው በDigital Fuel Coupon System የተረጋገጠ ወቅታዊ ፈቃድ እና ቀሪ መጠን ሲኖር ብቻ ነው።
              </p>
              <p className="text-[4.2pt] font-medium text-amber-800 leading-tight m-0 mt-[0.4mm]">
                This card is an identity credential, not an unlimited fuel coupon. Dispensing is subject to live authorization and balance verification through Digital Fuel Coupon System.
              </p>
            </div>
          </div>

          {/* Issue & Expiry Metadata */}
          <div className="flex items-center justify-between text-[4.5pt] font-mono text-gray-500 pt-[0.8mm] border-t border-gray-200">
            <div>
              <span>Issued: <b>{issueDateFormatted}</b></span>
              <span className="mx-1">·</span>
              <span>Expires: <b>{expiryDateFormatted}</b></span>
            </div>
            <span className="font-semibold text-gray-700">SN: {cardSerial.slice(-10)}</span>
          </div>
        </div>
      </div>

      {/* Bottom Legal Footer */}
      <div className="bg-gray-100 text-gray-600 text-[4.5pt] px-[3mm] py-[1mm] border-t border-gray-200 flex justify-between items-center shrink-0">
        <span className="font-bold text-gray-700">
          የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ · Bahir Dar City Administration Office of Agriculture
        </span>
        <span className="font-mono text-gray-500">Property of Government</span>
      </div>
    </div>
  );

  return (
    <div className={`farmer-card-wrapper inline-flex flex-wrap gap-4 items-center justify-center ${mode === 'print' ? 'print-mode' : ''}`}>
      {(side === 'front' || side === 'both') && (
        <div className="card-container-front">{renderFront()}</div>
      )}
      {(side === 'back' || side === 'both') && (
        <div className="card-container-back">{renderBack()}</div>
      )}
    </div>
  );
};
