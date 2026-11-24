import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Farmer } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { FarmerDigitalIdCard } from '../../components/cards/FarmerDigitalIdCard';
import { A4BatchCardSheet } from '../../components/cards/A4BatchCardSheet';
import { printFarmerCardDocument, printBatchCardsDocument } from '../../utils/print';
import {
  QrCode,
  Printer,
  Search,
  RefreshCw,
  X,
  User,
  CheckSquare,
  Square,
  Layers,
  FileText,
} from 'lucide-react';
import QRCode from 'qrcode';

export const FarmerCardsPage: React.FC = () => {
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Selected farmers for batch printing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Single Card Modal
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);
  const [cardQrDataUrl, setCardQrDataUrl] = useState<string>('');
  const [cardSide, setCardSide] = useState<'front' | 'back' | 'both'>('front');

  // A4 Batch Print Modal
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchSide, setBatchSide] = useState<'front' | 'back'>('front');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  const fetchFarmers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/farmers', {
        params: { search: search || undefined, limit: 50 },
      });
      if (res.data.success) {
        setFarmers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load farmer cards', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, [search]);

  // Pre-generate QR codes when opening batch modal or single card
  const handleOpenCard = async (farmer: Farmer) => {
    setSelectedFarmer(farmer);
    const activeCard = farmer.cards?.find((c) => c.status === 'ACTIVE') || farmer.cards?.[0];
    const token = activeCard ? activeCard.qrToken : farmer.farmerCode;
    const url = await QRCode.toDataURL(token, { width: 180, margin: 1 });
    setCardQrDataUrl(url);
  };

  const handleOpenBatchModal = async () => {
    const targetFarmers = selectedIds.length > 0
      ? farmers.filter((f) => selectedIds.includes(f.id))
      : farmers.slice(0, 8); // default to first 8 for A4 page

    const map: Record<string, string> = {};
    for (const f of targetFarmers) {
      const activeCard = f.cards?.find((c) => c.status === 'ACTIVE') || f.cards?.[0];
      const token = activeCard ? activeCard.qrToken : f.farmerCode;
      map[f.id] = await QRCode.toDataURL(token, { width: 150, margin: 1 });
    }
    setQrMap(map);
    setShowBatchModal(true);
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === farmers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(farmers.map((f) => f.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePrintSingle = async () => {
    if (!selectedFarmer) return;
    try {
      await api.post(`/farmers/${selectedFarmer.id}/cards/log-print`, {
        printType: cardSide === 'both' ? 'SINGLE_BOTH' : cardSide === 'front' ? 'SINGLE_FRONT' : 'SINGLE_BACK',
      });
    } catch (err) {
      console.warn('Print log failed', err);
    }
    printFarmerCardDocument(selectedFarmer, cardSide);
  };

  const handlePrintBatch = async () => {
    const targetFarmers = selectedIds.length > 0
      ? farmers.filter((f) => selectedIds.includes(f.id))
      : farmers.slice(0, 8);

    for (const f of targetFarmers) {
      api.post(`/farmers/${f.id}/cards/log-print`, { printType: 'BATCH_A4' }).catch(() => null);
    }
    printBatchCardsDocument(targetFarmers.length, batchSide);
  };

  const handleReissueCard = async (farmerId: string) => {
    try {
      await api.post(`/farmers/${farmerId}/cards/issue`, { reason: 'Official replacement card' });
      await fetchFarmers();
      if (selectedFarmer && selectedFarmer.id === farmerId) {
        const updated = farmers.find((f) => f.id === farmerId);
        if (updated) handleOpenCard(updated);
      }
      alert('Card successfully re-issued with new secure token and serial.');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to re-issue card');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Farmer Cards &amp; QR Identity
          </h1>
          <p className="text-xs text-gov-muted">
            Official government-style wallet-size ID cards with passport photos and secure Digital Fuel Coupon System verification tokens
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenBatchModal}
            className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Layers size={14} className="text-gov-muted" />
            <span>
              A4 Batch Print {selectedIds.length > 0 ? `(${selectedIds.length})` : '(Sheet)'}
            </span>
          </button>
        </div>
      </div>

      {/* Explanatory Notice */}
      <div className="p-3.5 rounded-[9px] bg-gov-iceBlue text-[#405a88] text-xs leading-relaxed border border-[#e0e9fa]">
        <b>Official Identity Rule:</b> The Farmer Digital ID Card operates as an official government identification credential. Active monthly fuel authorizations, assigned stations, and remaining quotas are evaluated dynamically in real time when scanned at the fuel terminal.
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white border border-gov-line rounded-[13px] p-3 shadow-2xs flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Farmer ID, Name, or Card Serial..."
            className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-lg text-xs text-gov-ink focus:outline-none focus:border-gov-blue bg-white"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
        </div>

        <button
          onClick={handleToggleSelectAll}
          className="px-3 py-2 border border-gov-line rounded-lg hover:bg-gray-50 text-xs font-semibold text-gov-ink flex items-center gap-1.5"
        >
          {selectedIds.length === farmers.length && farmers.length > 0 ? (
            <CheckSquare size={14} className="text-gov-blue" />
          ) : (
            <Square size={14} className="text-gray-400" />
          )}
          <span>{selectedIds.length === farmers.length && farmers.length > 0 ? 'Deselect All' : 'Select All'}</span>
        </button>

        <button
          onClick={fetchFarmers}
          className="p-2 border border-gov-line rounded-lg hover:bg-gray-50 text-gov-muted"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Cards Table */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === farmers.length && farmers.length > 0}
                    onChange={handleToggleSelectAll}
                    className="rounded border-gray-300 text-gov-blue focus:ring-0"
                  />
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmer ID
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Beneficiary Farmer &amp; Photo
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Card Serial Number
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Card Status
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Eligibility
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {farmers.map((farmer) => {
                const card = farmer.cards?.find((c) => c.status === 'ACTIVE') || farmer.cards?.[0];
                const isSelected = selectedIds.includes(farmer.id);
                return (
                  <tr key={farmer.id} className={`hover:bg-gray-50/60 transition-colors ${isSelected ? 'bg-blue-50/30' : ''}`}>
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(farmer.id)}
                        className="rounded border-gray-300 text-gov-blue focus:ring-0"
                      />
                    </td>
                    <td className="p-3 font-semibold text-gov-blue font-mono">{farmer.farmerCode}</td>
                    <td className="p-3 font-medium text-gov-ink">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {farmer.photoUrl ? (
                            <img
                              src={farmer.photoUrl.startsWith('http') ? farmer.photoUrl : `http://localhost:5000${farmer.photoUrl}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={15} className="text-gray-400" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{farmer.fullName}</div>
                          {!farmer.photoUrl && (
                            <span className="text-[9px] text-amber-700 font-semibold bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                              Photo Missing
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-gov-muted">
                      {card?.cardSerialNumber || 'NO_CARD_ISSUED'}
                    </td>
                    <td className="p-3">
                      <StatusBadge
                        status={card?.status || 'PENDING'}
                        label={card?.status === 'ACTIVE' ? 'Card Active' : undefined}
                      />
                    </td>
                    <td className="p-3">
                      <StatusBadge status={farmer.eligibilityStatus} />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleOpenCard(farmer)}
                        className="inline-flex items-center gap-1 bg-gov-softBlue text-gov-blue hover:bg-[#d6e4ff] px-2.5 py-1.5 rounded-lg font-semibold text-xs transition-colors"
                      >
                        <QrCode size={13} />
                        <span>View Card</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {farmers.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gov-muted text-xs">
                    No farmer cards found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          PRINTABLE OFFICIAL SINGLE CARD MODAL
          ========================================================================= */}
      {selectedFarmer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-4 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">Official Wallet-Size Farmer Digital ID Card</h3>
                <p className="text-[11px] text-gov-muted m-0">
                  Standard CR80 ID-1 Physical Dimensions: 85.60 mm × 53.98 mm
                </p>
              </div>
              <button
                onClick={() => setSelectedFarmer(null)}
                className="text-gov-muted hover:text-gov-ink p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Side Controls */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-slate-50 text-xs">
              <span className="font-semibold text-gray-700">Display Side:</span>
              <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-white">
                <button
                  type="button"
                  onClick={() => setCardSide('front')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    cardSide === 'front' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Front
                </button>
                <button
                  type="button"
                  onClick={() => setCardSide('back')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    cardSide === 'back' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCardSide('both')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    cardSide === 'both' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Both Sides
                </button>
              </div>
            </div>

            {/* Official Card Target for Browser Printing & E2E Tests */}
            <div className="p-6 bg-slate-100 flex items-center justify-center min-h-[220px]">
              <div id="printable-card" className="p-2">
                <FarmerDigitalIdCard
                  farmer={selectedFarmer}
                  qrDataUrl={cardQrDataUrl}
                  side={cardSide}
                  mode="preview"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gov-line bg-gray-50/50 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button
                onClick={() => handleReissueCard(selectedFarmer.id)}
                className="text-xs text-gov-blue hover:underline font-semibold"
              >
                Official Re-issue Card ↻
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedFarmer(null)}
                  className="px-4 py-2 border border-gov-line bg-white rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-100"
                >
                  Close
                </button>
                <button
                  onClick={handlePrintSingle}
                  className="px-4 py-2 bg-[#12315B] hover:bg-[#0d2444] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer size={14} />
                  <span>Print Physical Card</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          A4 BATCH SHEET PRINT MODAL
          ========================================================================= */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-4 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">A4 Multi-Card Batch Sheet Print Preview</h3>
                <p className="text-[11px] text-gov-muted m-0">
                  Layout: 2 Columns × 85.60 mm × 53.98 mm Cards with Corner Cut Guides for Standard A4 Paper
                </p>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-gov-muted hover:text-gov-ink p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Controls */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-slate-50 text-xs">
              <span className="font-semibold text-gray-700">Sheet Duplex Side:</span>
              <div className="inline-flex rounded-lg border border-gray-300 p-0.5 bg-white">
                <button
                  type="button"
                  onClick={() => setBatchSide('front')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    batchSide === 'front' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Front Sides
                </button>
                <button
                  type="button"
                  onClick={() => setBatchSide('back')}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    batchSide === 'back' ? 'bg-[#12315B] text-white' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Back Sides (QR Verification)
                </button>
              </div>
            </div>

            {/* A4 Sheet Container */}
            <div className="p-6 bg-slate-200 overflow-x-auto flex justify-center">
              <div className="bg-white shadow-xl rounded-md">
                <A4BatchCardSheet
                  farmers={
                    selectedIds.length > 0
                      ? farmers.filter((f) => selectedIds.includes(f.id))
                      : farmers.slice(0, 8)
                  }
                  qrMap={qrMap}
                  side={batchSide}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gov-line bg-gray-50/50 flex justify-between items-center">
              <span className="text-xs text-gov-muted">
                Total Cards on Sheet: {selectedIds.length > 0 ? selectedIds.length : Math.min(8, farmers.length)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBatchModal(false)}
                  className="px-4 py-2 border border-gov-line bg-white rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePrintBatch}
                  className="px-4 py-2 bg-[#12315B] hover:bg-[#0d2444] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs"
                >
                  <Printer size={14} />
                  <span>Print A4 Sheet</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
