import React, { useEffect, useState, useRef } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { VerificationResultData, FuelTransaction } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { printReceiptDocument } from '../../utils/print';
import {
  ScanLine,
  Camera,
  Search,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Printer,
  X,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { MobileQrScanner } from '../../components/scanner/MobileQrScanner';

export const ScannerPage: React.FC = () => {
  const { user } = useAuth();

  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifiedData, setVerifiedData] = useState<VerificationResultData | null>(null);

  // Dispensing Form State
  const [dispenseLiters, setDispenseLiters] = useState<number>(80);
  const [dispenseNotes, setDispenseNotes] = useState('');
  const [dispensing, setDispensing] = useState(false);
  const [dispenseSuccess, setDispenseSuccess] = useState<{
    receipt: FuelTransaction;
    remaining: number;
  } | null>(null);

  // Camera Scanner active toggle
  const [showCamera, setShowCamera] = useState(false);

  const handleCameraScan = (decodedToken: string) => {
    setShowCamera(false);
    setInputCode(decodedToken);
    executeVerification(decodedToken);
  };

  const executeVerification = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;

    setLoading(true);
    setError(null);
    setVerifiedData(null);
    setDispenseSuccess(null);

    try {
      const res = await api.post('/verification/verify', {
        qrTokenOrCode: codeToVerify.trim(),
      });

      if (res.data.success && res.data.verified) {
        setVerifiedData(res.data.data);
        const rem = Number(res.data.data.authorization.remainingLiters);
        setDispenseLiters(rem > 50 ? 50 : rem);
      }
    } catch (err: any) {
      setError(
        err.response?.data?.rejectionReason ||
        err.response?.data?.message ||
        'Verification failed: Record not eligible or invalid.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    executeVerification(inputCode);
  };

  const handleDispenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedData) return;

    setDispensing(true);
    setError(null);

    try {
      const res = await api.post('/transactions/dispense', {
        authorizationId: verifiedData.authorization.id,
        quantityLiters: Number(dispenseLiters),
        notes: dispenseNotes,
      });

      if (res.data.success) {
        setDispenseSuccess({
          receipt: res.data.receipt,
          remaining: res.data.remainingBalance,
        });

        // Update remaining liters in local verification display
        setVerifiedData({
          ...verifiedData,
          authorization: {
            ...verifiedData.authorization,
            consumedLiters:
              Number(verifiedData.authorization.consumedLiters) + Number(dispenseLiters),
            remainingLiters: res.data.remainingBalance,
          },
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Dispensing failed');
    } finally {
      setDispensing(false);
    }
  };

  const calculateTotalBirr = () => {
    if (!verifiedData) return 0;
    const price = Number(verifiedData.authorization.pricePerLiter);
    return (Number(dispenseLiters || 0) * price).toFixed(2);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            QR Legality Verification & Dispensing
          </h1>
          <p className="text-xs text-gov-muted">
            Live 8-step verification against central database at{' '}
            <b className="text-gov-ink">{user?.fuelStation?.name || 'Tana Energy Station'}</b>
          </p>
        </div>

        <span className="bg-gov-softBlue text-gov-blue text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#c7d9fc]">
          Station: {user?.fuelStation?.code || 'BD-ST-01'}
        </span>
      </div>

      {/* Verification Scanner & Search Box matching prototype */}
      <div className="bg-white border border-gov-line rounded-[16px] p-4 sm:p-6 shadow-sm">
        <div className="border-2 border-dashed border-[#d4deee] bg-[#fafcff] rounded-[14px] p-4 sm:p-8 text-center">
          <div className="text-3xl sm:text-4xl text-gov-blue mb-2">▦</div>
          <h3 className="text-base sm:text-lg font-bold text-gov-ink mb-1">Scan Farmer QR Card</h3>
          <p className="text-xs text-gov-muted max-w-[420px] mx-auto mb-4 sm:mb-5">
            Use your device camera to scan the cryptographic QR code or manually enter the Farmer ID.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
            <button
              onClick={() => setShowCamera(!showCamera)}
              className={`w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-sm inline-flex items-center justify-center gap-2 cursor-pointer ${
                showCamera
                  ? 'bg-slate-800 hover:bg-slate-900 text-white'
                  : 'bg-gov-blue hover:bg-gov-blueHover active:scale-[0.98] text-white'
              }`}
            >
              <Camera size={18} />
              <span>{showCamera ? 'Hide Camera' : 'Start Camera Scanner'}</span>
            </button>

            {/* Quick Demo Scan Buttons */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setInputCode('FR-00124');
                  executeVerification('FR-00124');
                }}
                className="flex-1 sm:flex-none bg-white hover:bg-gray-50 border border-gov-line text-gov-ink px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Demo: Abebe (FR-00124)
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputCode('FR-00127');
                  executeVerification('FR-00127');
                }}
                className="flex-1 sm:flex-none bg-white hover:bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Demo: Suspended (FR-00127)
              </button>
            </div>
          </div>

          {/* Dedicated High-Performance Mobile QR Camera Scanner */}
          <MobileQrScanner
            isOpen={showCamera}
            onScan={handleCameraScan}
            onClose={() => setShowCamera(false)}
          />

          {/* Manual Lookup Fallback */}
          <div className="mt-5 pt-4 border-t border-[#e2eaf5] max-w-md mx-auto">
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  inputMode="text"
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="Enter Farmer ID e.g. FR-00124..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gov-line rounded-xl text-xs text-gov-ink focus:outline-none focus:border-gov-blue bg-white shadow-2xs"
                />
                <Search size={15} className="absolute left-3 top-3 text-gov-muted" />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="bg-gray-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95 shrink-0"
              >
                {loading ? 'Verifying...' : 'Verify'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* VERIFICATION RESULT: REJECTED / BLOCKED */}
      {error && (
        <div className="bg-[#fdecef] border border-[#f8b4bb] rounded-xl p-5 text-xs text-[#b12c39] flex items-start gap-3.5 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-[#f9ccd1] grid place-items-center shrink-0">
            <AlertTriangle size={18} className="text-[#b12c39]" />
          </div>
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">
              VERIFICATION REJECTED — ACCESS BLOCKED
            </div>
            <p className="mt-1 leading-relaxed text-xs font-medium">{error}</p>
            <div className="mt-2 text-[11px] text-[#8e202b]">
              Security event logged with station identifier and operator timestamp.
            </div>
          </div>
        </div>
      )}

      {/* VERIFICATION RESULT: AUTHORIZED (Matching Prototype Exactly) */}
      {verifiedData && (
        <div className="bg-white border-2 border-green-400 rounded-[18px] overflow-hidden shadow-md">
          {/* Top Banner */}
          <div className="bg-[#e5f7ef] p-4 border-b border-green-200 flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white grid place-items-center">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <b className="text-sm text-gov-ink font-bold">
                  {verifiedData.farmer.fullName} · {verifiedData.farmer.farmerCode}
                </b>
                <p className="text-[11px] text-[#117a54] m-0">
                  Irrigation Beneficiary · Active · {verifiedData.authorization.stationName}
                </p>
              </div>
            </div>

            <StatusBadge status="ACTIVE" label="AUTHORIZED FOR DISPENSING" size="md" />
          </div>

          <div className="p-6 space-y-6">
            {/* 3 Metric Cards matching prototype demoVerify() */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 border border-gov-line rounded-xl p-4 text-center">
                <div className="text-[11px] text-gov-muted uppercase font-medium">Approved Quota</div>
                <div className="text-2xl font-bold text-gov-ink mt-1">
                  {verifiedData.authorization.authorizedLiters} L
                </div>
                <div className="text-[10px] text-gov-muted mt-0.5">
                  {verifiedData.authorization.fuelType}
                </div>
              </div>

              <div className="bg-gray-50 border border-gov-line rounded-xl p-4 text-center">
                <div className="text-[11px] text-gov-muted uppercase font-medium">Purchased / Used</div>
                <div className="text-2xl font-bold text-gov-muted mt-1">
                  {verifiedData.authorization.consumedLiters} L
                </div>
                <div className="text-[10px] text-gov-muted mt-0.5">Prior Dispensing</div>
              </div>

              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 text-center">
                <div className="text-[11px] text-gov-blue uppercase font-bold">Remaining Available</div>
                <div className="text-2xl font-extrabold text-gov-blue mt-1">
                  {verifiedData.authorization.remainingLiters} L
                </div>
                <div className="text-[10px] text-gov-blue font-semibold mt-0.5">Ready for Dispensing</div>
              </div>
            </div>

            {/* Farm & Pump Details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-gray-50/60 p-3.5 rounded-xl border border-gov-line">
              <div>
                <span className="text-gov-muted block">Kebele:</span>
                <b className="text-gov-ink">{verifiedData.farmer.kebele}</b>
              </div>
              <div>
                <span className="text-gov-muted block">Land Size:</span>
                <b className="text-gov-ink">{verifiedData.farmer.landSize} ha</b>
              </div>
              <div>
                <span className="text-gov-muted block">Water Source:</span>
                <b className="text-gov-ink">{verifiedData.farmer.waterSource}</b>
              </div>
              <div>
                <span className="text-gov-muted block">Pump Fuel / HP:</span>
                <b className="text-gov-ink">
                  {verifiedData.farmer.pumpFuelType} ({verifiedData.farmer.pumpHorsepower || 'Std'})
                </b>
              </div>
            </div>

            {/* ATOMIC FUEL DISPENSING FORM */}
            <form onSubmit={handleDispenseSubmit} className="pt-3 border-t border-gov-line space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gov-ink flex items-center gap-1.5">
                  <Flame size={16} className="text-gov-blue" />
                  <span>Record Fuel Dispensing</span>
                </h4>
                <span className="text-[11px] font-bold text-gov-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  Avail: {verifiedData.authorization.remainingLiters} L
                </span>
              </div>

              {/* Quick Volume Preset Chips for Fast Mobile Operation */}
              <div>
                <div className="text-[11px] font-semibold text-gray-500 mb-1.5">
                  Quick Volume Selection:
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[10, 20, 30, 50, 80]
                    .filter((qty) => qty <= Number(verifiedData.authorization.remainingLiters))
                    .map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setDispenseLiters(qty)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          dispenseLiters === qty
                            ? 'bg-gov-blue text-white border-gov-blue shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200'
                        }`}
                      >
                        {qty} L
                      </button>
                    ))}
                  {Number(verifiedData.authorization.remainingLiters) > 0 && (
                    <button
                      type="button"
                      onClick={() => setDispenseLiters(Number(verifiedData.authorization.remainingLiters))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                        dispenseLiters === Number(verifiedData.authorization.remainingLiters)
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border-emerald-300'
                      }`}
                    >
                      Full Balance ({verifiedData.authorization.remainingLiters} L)
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Dispensed Volume (Liters) *
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    max={Number(verifiedData.authorization.remainingLiters)}
                    required
                    value={dispenseLiters}
                    onChange={(e) => setDispenseLiters(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 border border-gov-line rounded-xl text-base font-bold font-mono focus:outline-none focus:border-gov-blue text-gov-ink bg-white shadow-2xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Price per Liter
                  </label>
                  <div className="px-3.5 py-2.5 border border-gov-line rounded-xl text-sm font-mono bg-gray-50 text-gov-ink">
                    {verifiedData.authorization.pricePerLiter} ETB
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">
                    Total Charge (ETB)
                  </label>
                  <div className="px-3.5 py-2.5 border border-blue-200 rounded-xl text-base font-black font-mono bg-blue-50 text-gov-blue">
                    {calculateTotalBirr()} ETB
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">
                  Operator Notes / Jerrycan / Container ID
                </label>
                <input
                  type="text"
                  value={dispenseNotes}
                  onChange={(e) => setDispenseNotes(e.target.value)}
                  placeholder="e.g. Dispensed into approved containers"
                  className="w-full px-3.5 py-2.5 border border-gov-line rounded-xl text-xs sm:text-sm focus:outline-none focus:border-gov-blue bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={dispensing || Number(verifiedData.authorization.remainingLiters) <= 0}
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3.5 px-4 rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Receipt size={18} />
                <span>
                  {dispensing ? 'Recording Dispensing...' : 'Confirm Dispensing & Issue Official Receipt'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DISPENSING RECEIPT MODAL */}
      {dispenseSuccess && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gov-line flex justify-between items-center bg-[#e5f7ef]">
              <div className="flex items-center gap-2 text-[#117a54]">
                <CheckCircle2 size={18} />
                <h3 className="text-sm font-bold m-0">Fuel Dispensed Successfully</h3>
              </div>
              <button
                onClick={() => setDispenseSuccess(null)}
                className="text-gov-muted hover:text-gov-ink"
              >
                <X size={18} />
              </button>
            </div>

            <div id="printable-card" className="p-6 space-y-4 text-xs">
              <div className="text-center pb-3 border-b border-gov-line flex flex-col items-center">
                <img
                  src="/branding/dfcs-logo.png"
                  alt="Digital Fuel Coupon System Logo"
                  className="w-12 h-12 object-contain mb-1.5"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/branding/irfa-logo.png';
                  }}
                />
                <div className="text-sm font-extrabold text-gov-ink">የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ</div>
                <div className="text-[11px] font-bold text-[#1E5285]">Bahir Dar City Administration Office of Agriculture</div>
                <div className="text-[10px] text-gov-muted mt-0.5">Digital Fuel Coupon System Dispensing Receipt</div>
                <div className="font-mono font-bold text-gov-blue text-xs mt-1">
                  Receipt #{dispenseSuccess.receipt.receiptNumber}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gov-muted">Station:</span>
                  <b className="text-gov-ink">{user?.fuelStation?.name}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gov-muted">Farmer:</span>
                  <b className="text-gov-ink">{dispenseSuccess.receipt.farmer?.fullName}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gov-muted">Farmer ID:</span>
                  <span className="font-mono">{dispenseSuccess.receipt.farmer?.farmerCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gov-muted">Fuel Type:</span>
                  <b>{dispenseSuccess.receipt.fuelType?.name}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gov-muted">Quantity Dispensed:</span>
                  <b className="text-gov-blue">{dispenseSuccess.receipt.quantityLiters} Liters</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-gov-muted">Price per Liter:</span>
                  <span>{dispenseSuccess.receipt.pricePerLiter} ETB</span>
                </div>
                <div className="flex justify-between border-t border-gov-line pt-2 text-sm">
                  <span className="font-bold text-gov-ink">Total Amount Paid:</span>
                  <b className="text-gov-blue">{dispenseSuccess.receipt.totalAmount} ETB</b>
                </div>
                <div className="flex justify-between text-gov-muted pt-1">
                  <span>Remaining Quota Balance:</span>
                  <b className="text-gov-ink">{dispenseSuccess.remaining} Liters</b>
                </div>
              </div>

              <div className="text-[10px] text-gov-muted text-center pt-3 border-t border-gov-line">
                Date: {new Date(dispenseSuccess.receipt.transactionDate).toLocaleString()} · Operator: {user?.username}
              </div>
            </div>

            <div className="p-4 border-t border-gov-line bg-gray-50/50 flex justify-end gap-2">
              <button
                onClick={() => setDispenseSuccess(null)}
                className="px-4 py-2 border border-gov-line bg-white rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={() =>
                  printReceiptDocument(
                    dispenseSuccess.receipt.receiptNumber,
                    dispenseSuccess.receipt.farmer?.fullName,
                    dispenseSuccess.receipt.farmer?.farmerCode
                  )
                }
                className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={14} />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
