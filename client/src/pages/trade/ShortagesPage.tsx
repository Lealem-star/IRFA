import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Eye,
  Building2,
  Calendar,
  Filter,
} from 'lucide-react';

interface FuelShortage {
  id: string;
  fuelStationId: string;
  fuelStation: { id: string; code: string; name: string; location: string };
  fuelTypeId: string;
  fuelType: { id: string; name: string; code: string };
  reportedBy: { id: string; fullName: string; role: string; username: string };
  reportedAt: string;
  category: string;
  status: string;
  estimatedAvailable?: number | null;
  estimatedShortage?: number | null;
  description: string;
  notes?: string | null;
  reviewRemarks?: string | null;
  reviewedBy?: { id: string; fullName: string; role: string } | null;
  resolvedAt?: string | null;
}

export const ShortagesPage: React.FC = () => {
  const { user } = useAuth();
  const [shortages, setShortages] = useState<FuelShortage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [stations, setStations] = useState<any[]>([]);
  const [fuelTypes, setFuelTypes] = useState<any[]>([]);

  // Modal states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedShortage, setSelectedShortage] = useState<FuelShortage | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Form states
  const [targetStationId, setTargetStationId] = useState('');
  const [targetFuelTypeId, setTargetFuelTypeId] = useState('');
  const [category, setCategory] = useState('FUEL_SUPPLY_SHORTAGE');
  const [description, setDescription] = useState('');
  const [estimatedAvailable, setEstimatedAvailable] = useState('');
  const [estimatedShortage, setEstimatedShortage] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Review form states
  const [reviewStatus, setReviewStatus] = useState('CONFIRMED');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchShortages = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterStatus !== 'ALL') params.status = filterStatus;
      const res = await api.get('/shortages', { params });
      if (res.data.success) {
        setShortages(res.data.shortages || res.data.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load shortages', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [stRes, ftRes] = await Promise.all([
        api.get('/meta/stations'),
        api.get('/meta/fuel-types'),
      ]);
      if (stRes.data.success) {
        setStations(stRes.data.stations || []);
      }
      if (ftRes.data.success) {
        setFuelTypes(ftRes.data.fuelTypes || []);
        if (ftRes.data.fuelTypes?.length > 0) {
          setTargetFuelTypeId(ftRes.data.fuelTypes[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load metadata', err);
    }
  };

  useEffect(() => {
    fetchShortages();
    fetchMetadata();
  }, [filterStatus]);

  const handleOpenReportModal = () => {
    setFormError(null);
    setDescription('');
    setEstimatedAvailable('');
    setEstimatedShortage('');
    setNotes('');
    setCategory('FUEL_SUPPLY_SHORTAGE');
    const stId = user?.fuelStationId || user?.fuelStation?.id;
    if (user?.role === 'STATION_ADMIN' && stId) {
      setTargetStationId(stId);
    } else if (stations.length > 0) {
      setTargetStationId(stations[0].id);
    }
    setIsReportModalOpen(true);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const payload: any = {
        fuelTypeId: targetFuelTypeId,
        category,
        description,
        notes: notes || undefined,
        estimatedAvailable: estimatedAvailable ? parseFloat(estimatedAvailable) : undefined,
        estimatedShortage: estimatedShortage ? parseFloat(estimatedShortage) : undefined,
      };

      if (user?.role === 'TRADE_OFFICE') {
        payload.fuelStationId = targetStationId;
      }

      const res = await api.post('/shortages', payload);
      if (res.data.success) {
        setIsReportModalOpen(false);
        fetchShortages();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to report shortage incident');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShortage) return;
    setReviewError(null);

    if (reviewStatus === 'REJECTED' && (!reviewRemarks || reviewRemarks.trim().length < 3)) {
      setReviewError('Mandatory explanation required when rejecting a shortage report');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.patch(`/shortages/${selectedShortage.id}/review`, {
        status: reviewStatus,
        reviewRemarks: reviewRemarks || undefined,
      });
      if (res.data.success) {
        setIsReviewModalOpen(false);
        setSelectedShortage(null);
        fetchShortages();
      }
    } catch (err: any) {
      setReviewError(err.response?.data?.message || 'Failed to update shortage review');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'FUEL_SUPPLY_SHORTAGE':
        return 'Fuel Supply Shortage (የነዳጅ እጥረት)';
      case 'TEMPORARY_STATION_CLOSURE':
        return 'Temporary Closure (ጊዜያዊ መዘጋት)';
      case 'FUEL_TYPE_UNAVAILABLE':
        return 'Fuel Type Unavailable (የነዳጅ አይነት አለመኖር)';
      case 'DISTRIBUTION_INTERRUPTION':
        return 'Distribution Interruption (የስርጭት መቋረጥ)';
      case 'TECHNICAL_STATION_PROBLEM':
        return 'Technical Station Problem (ቴክኒካል ችግር)';
      default:
        return 'Other (ሌላ)';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={24} />
            <span>Fuel Shortage Incidents Management</span>
          </h1>
          <p className="text-xs text-gov-muted">
            Track, review and coordinate station fuel shortages across Bahir Dar City. Shortages are operational alerts and do not alter approved quotas or station allocations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchShortages}
            disabled={loading}
            className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {(user?.role === 'TRADE_OFFICE' || user?.role === 'STATION_ADMIN') && (
            <button
              onClick={handleOpenReportModal}
              className="bg-gov-blue hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} />
              <span>Report Shortage</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gov-line rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <Filter size={15} className="text-gov-muted" />
          <span className="font-semibold text-gov-ink">Status Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gov-line rounded-lg px-3 py-1.5 bg-white text-xs text-gov-ink focus:outline-none"
          >
            <option value="ALL">All Incidents</option>
            <option value="REPORTED">Reported (Pending Review)</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="CONFIRMED">Confirmed Shortage</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="text-xs text-gov-muted">
          Showing <b>{shortages.length}</b> reported incident(s)
        </div>
      </div>

      {/* Shortage Records Table */}
      <div className="bg-white border border-gov-line rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Station</th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Fuel Type</th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Category</th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Estimated Shortage</th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Reported Date</th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Status</th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shortages.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink">
                    <div>{s.fuelStation?.name}</div>
                    <div className="text-[10px] font-mono text-gov-muted">{s.fuelStation?.code}</div>
                  </td>
                  <td className="p-3 text-gov-ink font-medium">{s.fuelType?.name}</td>
                  <td className="p-3 text-gov-muted max-w-[200px] truncate" title={getCategoryLabel(s.category)}>
                    {getCategoryLabel(s.category)}
                  </td>
                  <td className="p-3 font-mono font-bold text-gov-ink">
                    {s.estimatedShortage ? `${Number(s.estimatedShortage).toLocaleString()} L` : 'Not specified'}
                  </td>
                  <td className="p-3 text-gov-muted">
                    {new Date(s.reportedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user?.role === 'TRADE_OFFICE' && (
                        <button
                          onClick={() => {
                            setSelectedShortage(s);
                            setReviewStatus(s.status === 'REPORTED' ? 'CONFIRMED' : s.status);
                            setReviewRemarks(s.reviewRemarks || '');
                            setIsReviewModalOpen(true);
                          }}
                          className="bg-gov-softBlue text-gov-blue hover:bg-blue-100 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {shortages.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gov-muted text-xs">
                    No fuel shortage incidents found matching the selected filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Shortage Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-gov-ink flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={18} />
                <span>Report Fuel Shortage Incident</span>
              </h2>
              <button onClick={() => setIsReportModalOpen(false)} className="text-gov-muted hover:text-gov-ink text-sm">✕</button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleReportSubmit} className="space-y-3.5 text-xs">
              {user?.role === 'TRADE_OFFICE' ? (
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Fuel Station</label>
                  <select
                    value={targetStationId}
                    onChange={(e) => setTargetStationId(e.target.value)}
                    required
                    className="w-full border border-gov-line rounded-lg p-2 text-xs"
                  >
                    {stations.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.code}) - {st.location}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-gray-50 border text-gov-muted">
                  Reporting for assigned station: <b>{user?.fuelStation?.name || 'Assigned Station'}</b>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Fuel Type</label>
                <select
                  value={targetFuelTypeId}
                  onChange={(e) => setTargetFuelTypeId(e.target.value)}
                  required
                  className="w-full border border-gov-line rounded-lg p-2 text-xs"
                >
                  {fuelTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name} ({ft.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Category / Reason</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gov-line rounded-lg p-2 text-xs"
                >
                  <option value="FUEL_SUPPLY_SHORTAGE">Fuel Supply Shortage (የነዳጅ እጥረት)</option>
                  <option value="TEMPORARY_STATION_CLOSURE">Temporary Closure (ጊዜያዊ መዘጋት)</option>
                  <option value="FUEL_TYPE_UNAVAILABLE">Fuel Type Unavailable (የነዳጅ አይነት አለመኖር)</option>
                  <option value="DISTRIBUTION_INTERRUPTION">Distribution Interruption (የስርጭት መቋረጥ)</option>
                  <option value="TECHNICAL_STATION_PROBLEM">Technical Station Problem (ቴክኒካል ችግር)</option>
                  <option value="OTHER">Other (ሌላ)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Available Quantity (Liters)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={estimatedAvailable}
                    onChange={(e) => setEstimatedAvailable(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full border border-gov-line rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Estimated Shortage (Liters)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={estimatedShortage}
                    onChange={(e) => setEstimatedShortage(e.target.value)}
                    placeholder="e.g. 2000"
                    className="w-full border border-gov-line rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Description *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={2}
                  placeholder="Detail the operational fuel shortage incident..."
                  className="w-full border border-gov-line rounded-lg p-2 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Supporting Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Supplier dispatch status, expected replenishment date..."
                  className="w-full border border-gov-line rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-3 py-2 border rounded-lg text-xs font-semibold text-gov-muted hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gov-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Incident'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal for Trade Office */}
      {isReviewModalOpen && selectedShortage && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h2 className="text-base font-bold text-gov-ink">Trade Office Incident Review</h2>
              <button onClick={() => setIsReviewModalOpen(false)} className="text-gov-muted hover:text-gov-ink text-sm">✕</button>
            </div>

            {reviewError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {reviewError}
              </div>
            )}

            <div className="p-3 bg-gray-50 rounded-lg space-y-1 text-xs">
              <div><b>Station:</b> {selectedShortage.fuelStation.name} ({selectedShortage.fuelStation.code})</div>
              <div><b>Fuel:</b> {selectedShortage.fuelType.name}</div>
              <div><b>Reason:</b> {getCategoryLabel(selectedShortage.category)}</div>
              <div><b>Description:</b> {selectedShortage.description}</div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-gov-ink mb-1">Update Status</label>
                <select
                  value={reviewStatus}
                  onChange={(e) => setReviewStatus(e.target.value)}
                  className="w-full border border-gov-line rounded-lg p-2 text-xs"
                >
                  <option value="UNDER_REVIEW">Under Review (ምርመራ ላይ)</option>
                  <option value="CONFIRMED">Confirmed Shortage (የተረጋገጠ እጥረት)</option>
                  <option value="RESOLVED">Resolved (ችግሩ ተፈቷል)</option>
                  <option value="REJECTED">Reject Report (ሪፖርቱን ውድቅ አድርግ)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gov-ink mb-1">
                  Review Remarks / Instructions {reviewStatus === 'REJECTED' && <span className="text-red-500">* (Mandatory for rejection)</span>}
                </label>
                <textarea
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  rows={3}
                  required={reviewStatus === 'REJECTED'}
                  placeholder={reviewStatus === 'REJECTED' ? 'Mandatory explanation explaining why shortage report is rejected...' : 'Administrative instructions or replenishment notes...'}
                  className="w-full border border-gov-line rounded-lg p-2 text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-3 py-2 border rounded-lg text-xs font-semibold text-gov-muted hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-gov-blue text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Confirm Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
