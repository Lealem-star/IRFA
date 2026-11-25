import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api, { getAssetUrl } from '../../services/api';
import { Farmer } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FarmerDigitalIdCard } from '../../components/cards/FarmerDigitalIdCard';
import { printFarmerCardDocument } from '../../utils/print';
import {
  ArrowLeft,
  QrCode,
  CheckCircle,
  AlertTriangle,
  Layers,
  Receipt,
  Printer,
  RefreshCw,
  Phone,
  MapPin,
  Flame,
  Camera,
  Upload,
  User,
} from 'lucide-react';
import QRCode from 'qrcode';

export const FarmerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [farmer, setFarmer] = useState<Farmer | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [actionLoading, setActionLoading] = useState(false);
  const [cardSide, setCardSide] = useState<'front' | 'back' | 'both'>('front');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const fetchFarmer = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/farmers/${id}`);
      if (res.data.success) {
        setFarmer(res.data.farmer);

        // Generate QR code data URL
        const activeCard = res.data.farmer.cards?.find((c: any) => c.status === 'ACTIVE') || res.data.farmer.cards?.[0];
        const token = activeCard ? activeCard.qrToken : res.data.farmer.farmerCode;
        const url = await QRCode.toDataURL(token, { width: 180, margin: 1 });
        setQrDataUrl(url);
      }
    } catch (err) {
      console.error('Failed to load farmer dossier', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmer();
  }, [id]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!farmer || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowed.includes(file.type)) {
      setPhotoError('Invalid format. Only JPG and PNG allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo exceeds 5MB limit.');
      return;
    }

    setPhotoUploading(true);
    setPhotoError(null);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const res = await api.post(`/farmers/${farmer.id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        fetchFarmer();
      }
    } catch (err: any) {
      setPhotoError(err.response?.data?.message || 'Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePrint = async () => {
    if (!farmer) return;
    try {
      await api.post(`/farmers/${farmer.id}/cards/log-print`, {
        printType: cardSide === 'both' ? 'SINGLE_BOTH' : cardSide === 'front' ? 'SINGLE_FRONT' : 'SINGLE_BACK',
      });
    } catch (err) {
      console.warn('Print audit log failed', err);
    }
    printFarmerCardDocument(farmer, cardSide);
  };

  const handleToggleEligibility = async () => {
    if (!farmer) return;
    const isSuspending = farmer.eligibilityStatus === 'ELIGIBLE';
    const reason = isSuspending
      ? prompt('Enter suspension reason:', 'Land tenure audit inquiry')
      : null;

    if (isSuspending && reason === null) return;

    setActionLoading(true);
    try {
      await api.put(`/farmers/${farmer.id}`, {
        fullName: farmer.fullName,
        phone: farmer.phone,
        kebeleId: farmer.kebeleId,
        eligibilityStatus: isSuspending ? 'SUSPENDED' : 'ELIGIBLE',
        isActive: !isSuspending,
        suspensionReason: reason,
      });
      fetchFarmer();
    } catch (err) {
      alert('Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleIssueCard = async () => {
    if (!farmer) return;
    setActionLoading(true);
    try {
      await api.post(`/farmers/${farmer.id}/cards/issue`, { reason: 'Replacement card request' });
      fetchFarmer();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to issue card');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !farmer) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-gov-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const activeCard = farmer.cards?.find((c: any) => c.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/farmers')}
          className="flex items-center gap-2 text-xs font-semibold text-gov-muted hover:text-gov-ink transition-colors"
        >
          <ArrowLeft size={16} />
          <span>Back to Farmer Registry</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleEligibility}
            disabled={actionLoading}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              farmer.eligibilityStatus === 'ELIGIBLE'
                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
            }`}
          >
            {farmer.eligibilityStatus === 'ELIGIBLE' ? (
              <>
                <AlertTriangle size={14} />
                <span>Suspend Farmer</span>
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                <span>Re-activate Farmer</span>
              </>
            )}
          </button>

          <button
            onClick={handlePrint}
            className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Printer size={14} className="text-gov-muted" />
            <span>Print Card / Dossier</span>
          </button>
        </div>
      </div>

      {/* Farmer Profile Hero Card */}
      <div className="bg-white border border-gov-line rounded-[18px] p-6 shadow-sm grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <div className="flex flex-col sm:flex-row gap-5 items-start">
          {/* Photo & Upload Box */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-24 h-30 bg-slate-100 border-2 border-slate-200 rounded-xl overflow-hidden shadow-xs flex items-center justify-center relative">
              {farmer.photoUrl ? (
                <img
                  src={getAssetUrl(farmer.photoUrl)}
                  alt={farmer.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-2 text-center text-slate-400">
                  <User size={30} className="mb-1" />
                  <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 py-0.5 rounded leading-none border border-amber-300">
                    PHOTO MISSING
                  </span>
                </div>
              )}
            </div>

            <label className="mt-2 text-[10px] font-semibold text-gov-blue hover:underline cursor-pointer flex items-center gap-1">
              <Camera size={12} />
              <span>{photoUploading ? 'Uploading...' : farmer.photoUrl ? 'Replace Photo' : 'Upload Photo'}</span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handlePhotoUpload}
                disabled={photoUploading}
                className="hidden"
              />
            </label>
            {photoError && <span className="text-[9px] text-red-600 mt-0.5">{photoError}</span>}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-xs font-mono font-bold bg-gov-softBlue text-gov-blue px-2.5 py-1 rounded-md">
                {farmer.farmerCode}
              </span>
              <StatusBadge status={farmer.eligibilityStatus} />
              <StatusBadge status={activeCard?.status || 'NO_CARD'} label={activeCard ? 'Card Active' : 'No Card'} />
            </div>

            <h2 className="text-2xl font-bold text-gov-ink mb-1">{farmer.fullName}</h2>

            <div className="grid grid-cols-2 gap-3 text-xs text-gov-muted mt-3">
              <div className="flex items-center gap-2">
                <Phone size={14} className="text-gov-muted" />
                <span>{farmer.phone}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-gov-muted" />
                <span>
                  {farmer.kebele?.name}, {farmer.kebele?.location?.name}
                </span>
              </div>
              <div>
                <span className="font-semibold text-gov-ink">National ID:</span> {farmer.nationalId || 'N/A'}
              </div>
              <div>
                <span className="font-semibold text-gov-ink">Registered:</span>{' '}
                {new Date(farmer.createdAt).toLocaleDateString()}
              </div>
            </div>

            {farmer.suspensionReason && (
              <div className="mt-3 p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                <b>Suspension Reason:</b> {farmer.suspensionReason}
              </div>
            )}
          </div>
        </div>

        {/* Printable Official ID Card Preview Box */}
        <div className="bg-slate-50/70 border border-gov-line rounded-xl p-4 flex flex-col items-center shadow-xs">
          <div className="w-full flex items-center justify-between pb-2 mb-2 border-b border-gray-200 text-xs">
            <span className="font-bold text-gov-ink">Official Wallet-Size ID Card</span>
            <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-white text-[11px]">
              <button
                type="button"
                onClick={() => setCardSide('front')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  cardSide === 'front' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Front
              </button>
              <button
                type="button"
                onClick={() => setCardSide('back')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  cardSide === 'back' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setCardSide('both')}
                className={`px-2 py-0.5 rounded font-semibold transition-colors ${
                  cardSide === 'both' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Both
              </button>
            </div>
          </div>

          {/* Card DOM target for browser printing and test selectors */}
          <div id="printable-card" className="p-1 flex items-center justify-center">
            <FarmerDigitalIdCard
              farmer={farmer}
              card={activeCard}
              qrDataUrl={qrDataUrl}
              side={cardSide}
              mode="preview"
            />
          </div>

          <div className="w-full flex items-center justify-between pt-3 mt-1 border-t border-gray-200 text-xs">
            <button
              onClick={handleIssueCard}
              disabled={actionLoading}
              className="text-[11px] text-gov-blue hover:underline font-semibold"
            >
              Official Re-issue Card ↻
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-[#12315B] hover:bg-[#0d2444] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
            >
              <Printer size={13} />
              <span>Print This Card</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Irrigation Profile & Recent Allocations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Irrigation Profile */}
        <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gov-ink border-b border-gov-line pb-2 flex items-center gap-2">
            <Flame size={16} className="text-gov-blue" />
            <span>Irrigation & Pump Profile</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-gov-muted block">Land Size:</span>
              <b className="text-gov-ink">{farmer.irrigationProfile?.landSizeHectares} Hectares</b>
            </div>
            <div>
              <span className="text-gov-muted block">Water Source:</span>
              <b className="text-gov-ink">{farmer.irrigationProfile?.waterSource}</b>
            </div>
            <div>
              <span className="text-gov-muted block">Pump Fuel Type:</span>
              <b className="text-gov-ink">{farmer.irrigationProfile?.pumpFuelType}</b>
            </div>
            <div>
              <span className="text-gov-muted block">Horsepower / Model:</span>
              <b className="text-gov-ink">
                {farmer.irrigationProfile?.pumpHorsepower || 'Standard'} (
                {farmer.irrigationProfile?.pumpModel || 'Universal'})
              </b>
            </div>
            <div className="col-span-2">
              <span className="text-gov-muted block">Primary Irrigated Crops:</span>
              <b className="text-gov-ink">{farmer.irrigationProfile?.primaryCrops || 'Vegetables'}</b>
            </div>
          </div>
        </div>

        {/* Allocation History */}
        <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-gov-ink border-b border-gov-line pb-2 flex items-center gap-2">
            <Layers size={16} className="text-gov-blue" />
            <span>Monthly Fuel Allocations</span>
          </h3>

          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {farmer.allocations?.map((alloc: any) => (
              <div
                key={alloc.id}
                className="p-3 border border-gov-line rounded-lg bg-gray-50/50 flex justify-between items-center text-xs"
              >
                <div>
                  <div className="font-semibold text-gov-ink">
                    Month {alloc.month}, {alloc.year} · {alloc.fuelType?.name}
                  </div>
                  <div className="text-[11px] text-gov-muted">
                    Allocated: {alloc.allocatedLiters} L | Used: {alloc.usedLiters} L
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-gov-blue">{alloc.remainingLiters} L</div>
                  <div className="text-[10px] text-gov-muted">Remaining</div>
                </div>
              </div>
            ))}
            {(!farmer.allocations || farmer.allocations.length === 0) && (
              <p className="text-xs text-gov-muted text-center py-4">
                No monthly allocations recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
