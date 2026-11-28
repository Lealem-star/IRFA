import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import { FuelRequest, Farmer, FuelType } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import {
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  X,
  AlertCircle,
  RotateCcw,
  Clock,
  MessageSquare,
  FileEdit,
  History,
  Send,
  Search,
  Filter,
  Check,
  XCircle,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';

export const RequestsPage: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ALL' | 'SUBMITTED' | 'RETURNED' | 'APPROVED' | 'REJECTED'>('ALL');
  const [search, setSearch] = useState('');
  const [periodFilter, setPeriodFilter] = useState<string>('ALL');

  // Prepare Request Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [requestTitle, setRequestTitle] = useState('Dry Season Irrigation Fuel Batch');
  const [periodMonth, setPeriodMonth] = useState(11);
  const [periodYear, setPeriodYear] = useState(2026);
  const [selectedFarmers, setSelectedFarmers] = useState<
    { farmerId: string; fuelTypeId: string; requestedLiters: number; remarks?: string }[]
  >([]);

  // Detailed Inspect Modal (with History & Timeline)
  const [inspectReq, setInspectReq] = useState<FuelRequest | null>(null);

  // Review Decision Modal (for Agriculture Reviewer)
  const [reviewModalReq, setReviewModalReq] = useState<FuelRequest | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'RETURNED' | 'REJECTED' | 'UNDER_REVIEW'>('RETURNED');
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Edit & Resubmit Modal (for Submitter correcting a RETURNED request)
  const [resubmitModalReq, setResubmitModalReq] = useState<FuelRequest | null>(null);
  const [resubmitTitle, setResubmitTitle] = useState('');
  const [resubmitItems, setResubmitItems] = useState<
    { farmerId: string; farmerName: string; fuelTypeId: string; fuelTypeName: string; requestedLiters: number; remarks: string }[]
  >([]);
  const [resubmissionNotes, setResubmissionNotes] = useState('');
  const [resubmitLoading, setResubmitLoading] = useState(false);
  const [resubmitError, setResubmitError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resReq, resFarmers, resFuel] = await Promise.all([
        api.get('/fuel-requests'),
        api.get('/farmers', { params: { eligibilityStatus: 'ELIGIBLE', limit: 100 } }),
        api.get('/meta/fuel-types'),
      ]);

      if (resReq.data.success) setRequests(resReq.data.data);
      if (resFarmers.data.success) setFarmers(resFarmers.data.data);
      if (resFuel.data.success) setFuelTypes(resFuel.data.fuelTypes);
    } catch (err) {
      console.error('Failed to load fuel requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered requests computation
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Tab filter
      if (activeTab === 'SUBMITTED' && req.status !== 'SUBMITTED' && req.status !== 'UNDER_REVIEW') return false;
      if (activeTab === 'RETURNED' && req.status !== 'RETURNED') return false;
      if (activeTab === 'APPROVED' && req.status !== 'APPROVED' && req.status !== 'PARTIALLY_APPROVED') return false;
      if (activeTab === 'REJECTED' && req.status !== 'REJECTED') return false;

      // Period filter
      if (periodFilter !== 'ALL' && `${req.periodYear}-${req.periodMonth}` !== periodFilter) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesNumber = req.requestNumber.toLowerCase().includes(q);
        const matchesTitle = req.title.toLowerCase().includes(q);
        const matchesSubmitter = req.submittedBy?.fullName?.toLowerCase().includes(q);
        const matchesFarmer = req.items?.some((it) => it.farmer?.fullName?.toLowerCase().includes(q));
        if (!matchesNumber && !matchesTitle && !matchesSubmitter && !matchesFarmer) return false;
      }

      return true;
    });
  }, [requests, activeTab, periodFilter, search]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      all: requests.length,
      submitted: requests.filter((r) => r.status === 'SUBMITTED' || r.status === 'UNDER_REVIEW').length,
      returned: requests.filter((r) => r.status === 'RETURNED').length,
      approved: requests.filter((r) => r.status === 'APPROVED' || r.status === 'PARTIALLY_APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
    };
  }, [requests]);

  // Handle Create Request Farmer Toggle
  const handleFarmerToggle = (farmer: Farmer) => {
    const exists = selectedFarmers.some((f) => f.farmerId === farmer.id);
    if (exists) {
      setSelectedFarmers(selectedFarmers.filter((f) => f.farmerId !== farmer.id));
    } else {
      const ft =
        fuelTypes.find((f) => f.name.toLowerCase() === (farmer.irrigationProfile?.pumpFuelType || 'diesel').toLowerCase()) ||
        fuelTypes[0];

      setSelectedFarmers([
        ...selectedFarmers,
        {
          farmerId: farmer.id,
          fuelTypeId: ft ? ft.id : '',
          requestedLiters: 150,
        },
      ]);
    }
  };

  // Submit New Request Bundle
  const handleSubmitNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFarmers.length === 0) {
      setCreateError('Please select at least one farmer for this fuel request.');
      return;
    }

    setCreateLoading(true);
    setCreateError(null);

    try {
      const res = await api.post('/fuel-requests', {
        title: requestTitle,
        periodMonth,
        periodYear,
        items: selectedFarmers,
      });

      if (res.data.success) {
        setShowCreateModal(false);
        setSelectedFarmers([]);
        fetchData();
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Failed to submit fuel request');
    } finally {
      setCreateLoading(false);
    }
  };

  // Open Review Decision Modal
  const openReviewModal = (req: FuelRequest) => {
    setReviewModalReq(req);
    setReviewDecision('RETURNED');
    setReviewFeedback(req.reviewRemarks || '');
    setReviewError(null);
  };

  // Submit Review Decision (Agriculture Office Review)
  const handleSubmitReviewDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalReq) return;

    if ((reviewDecision === 'RETURNED' || reviewDecision === 'REJECTED') && reviewFeedback.trim().length < 5) {
      setReviewError('Please provide clear, detailed feedback (at least 5 characters) explaining the reason.');
      return;
    }

    setReviewLoading(true);
    setReviewError(null);

    try {
      const res = await api.post(`/fuel-requests/${reviewModalReq.id}/review`, {
        status: reviewDecision,
        reviewRemarks: reviewFeedback.trim(),
      });

      if (res.data.success) {
        setReviewModalReq(null);
        fetchData();
      }
    } catch (err: any) {
      setReviewError(err.response?.data?.message || 'Failed to submit review decision');
    } finally {
      setReviewLoading(false);
    }
  };

  // Open Resubmit Modal for Returned Request
  const openResubmitModal = (req: FuelRequest) => {
    setResubmitModalReq(req);
    setResubmitTitle(req.title);
    setResubmissionNotes('');
    setResubmitError(null);

    // Populate existing items
    const items = (req.items || []).map((it) => ({
      farmerId: it.farmerId,
      farmerName: it.farmer?.fullName || 'Farmer',
      fuelTypeId: it.fuelTypeId,
      fuelTypeName: it.fuelType?.name || 'Diesel',
      requestedLiters: Number(it.requestedLiters),
      remarks: it.remarks || '',
    }));
    setResubmitItems(items);
  };

  // Submit Corrected Resubmission
  const handleSubmitResubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitModalReq) return;

    if (resubmitItems.length === 0) {
      setResubmitError('At least one farmer item must remain in the request.');
      return;
    }

    setResubmitLoading(true);
    setResubmitError(null);

    try {
      const res = await api.post(`/fuel-requests/${resubmitModalReq.id}/resubmit`, {
        title: resubmitTitle,
        resubmissionNotes,
        items: resubmitItems.map((it) => ({
          farmerId: it.farmerId,
          fuelTypeId: it.fuelTypeId,
          requestedLiters: it.requestedLiters,
          remarks: it.remarks,
        })),
      });

      if (res.data.success) {
        setResubmitModalReq(null);
        fetchData();
      }
    } catch (err: any) {
      setResubmitError(err.response?.data?.message || 'Failed to resubmit request');
    } finally {
      setResubmitLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Fuel Requests & Resubmission Management
          </h1>
          <p className="text-xs text-gov-muted">
            Prepare, review, return for correction, and resubmit monthly farmer fuel allocation requests
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-gov-blue hover:bg-gov-blueHover text-white text-xs font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
        >
          <Plus size={14} />
          <span>Prepare Fuel Request</span>
        </button>
      </div>

      {/* Overview Status Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gov-line pb-3">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ALL'
              ? 'bg-gov-ink text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>All Requests</span>
          <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">{tabCounts.all}</span>
        </button>

        <button
          onClick={() => setActiveTab('SUBMITTED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'SUBMITTED'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
          }`}
        >
          <Clock size={13} />
          <span>Pending Review</span>
          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-bold">
            {tabCounts.submitted}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('RETURNED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'RETURNED'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-50'
          }`}
        >
          <RotateCcw size={13} />
          <span>Returned for Correction</span>
          <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full font-bold">
            {tabCounts.returned}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('APPROVED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'APPROVED'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <CheckCircle2 size={13} />
          <span>Approved</span>
          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
            {tabCounts.approved}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('REJECTED')}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'REJECTED'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <XCircle size={13} />
          <span>Rejected</span>
          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.2 rounded-full font-bold">
            {tabCounts.rejected}
          </span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-gov-line rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, title, or farmer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gov-blue"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none bg-white text-slate-700 font-medium"
          >
            <option value="ALL">All Periods</option>
            <option value="2026-10">October 2026</option>
            <option value="2026-11">November 2026</option>
            <option value="2026-12">December 2026</option>
          </select>

          <button
            onClick={fetchData}
            title="Refresh"
            className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Request Tracking Table */}
      <div className="bg-white border border-gov-line rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-slate-50/75">
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Request Code</th>
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Title & Period</th>
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Submitter</th>
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Farmers / Volume</th>
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Feedback / Remarks</th>
                <th className="p-3 font-bold text-slate-500 uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRequests.map((req) => {
                const isReturned = req.status === 'RETURNED';
                const isPending = req.status === 'SUBMITTED' || req.status === 'UNDER_REVIEW';

                return (
                  <tr
                    key={req.id}
                    className={`transition-colors ${isReturned ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-slate-50/75'}`}
                  >
                    <td className="p-3 font-mono font-bold text-slate-900">{req.requestNumber}</td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-800">{req.title}</div>
                      <div className="text-[10px] text-slate-400">
                        Month {req.periodMonth}, {req.periodYear}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-slate-700">{req.submittedBy?.fullName || 'Agriculture Officer'}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(req.submittedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">
                        {Number(req.totalLitersRequested).toLocaleString()} L
                      </div>
                      <div className="text-[10px] text-slate-500">{req.totalFarmersCount} farmers included</div>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="p-3 max-w-xs">
                      {req.reviewRemarks ? (
                        <div
                          className={`p-2 rounded-lg text-[11px] leading-tight ${
                            isReturned
                              ? 'bg-amber-100/70 border border-amber-300 text-amber-900 font-medium'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="font-bold block text-[10px] uppercase tracking-wider">
                            {isReturned ? 'Correction Feedback:' : 'Review Remarks:'}
                          </span>
                          <span className="line-clamp-2">{req.reviewRemarks}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">No feedback recorded</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* If returned: Action to correct & resubmit */}
                        {isReturned && (
                          <button
                            onClick={() => openResubmitModal(req)}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <FileEdit size={12} />
                            <span>Correct & Resubmit</span>
                          </button>
                        )}

                        {/* Review Button for Agriculture Reviewer */}
                        {isPending && (
                          <button
                            onClick={() => openReviewModal(req)}
                            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <CheckCircle2 size={12} />
                            <span>Review</span>
                          </button>
                        )}

                        {/* Inspect full history */}
                        <button
                          onClick={() => setInspectReq(req)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye size={12} />
                          <span>Inspect</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredRequests.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-400 text-xs">
                    No requests found matching your filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PREPARE NEW FUEL REQUEST                                         */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-slate-50/75">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">Prepare Fuel Request Bundle</h3>
                <p className="text-[11px] text-gov-muted m-0">Select eligible farmers and bundle monthly quota demands</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gov-muted hover:text-gov-ink cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNewRequest} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Request Title *</label>
                  <input
                    type="text"
                    required
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gov-blue"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Month / Year *</label>
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none bg-white"
                  >
                    <option value={10}>October 2026</option>
                    <option value={11}>November 2026</option>
                    <option value={12}>December 2026</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">
                    Select Eligible Farmers ({selectedFarmers.length} selected)
                  </label>
                  <span className="text-[11px] text-gov-blue font-bold">
                    Total Volume: {selectedFarmers.reduce((sum, item) => sum + item.requestedLiters, 0).toLocaleString()} L
                  </span>
                </div>

                <div className="border border-slate-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100 p-1">
                  {farmers.map((farmer) => {
                    const isSelected = selectedFarmers.some((f) => f.farmerId === farmer.id);
                    return (
                      <div
                        key={farmer.id}
                        onClick={() => handleFarmerToggle(farmer)}
                        className={`p-2.5 rounded flex items-center justify-between cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-blue-50/70 border border-blue-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-gov-blue"
                          />
                          <div>
                            <div className="font-semibold text-slate-800">{farmer.fullName}</div>
                            <div className="text-[10px] text-slate-400">
                              {farmer.farmerCode} · {farmer.kebele?.name} · {farmer.irrigationProfile?.landSizeHectares} ha
                            </div>
                          </div>
                        </div>

                        <span className="font-mono text-xs font-bold text-gov-blue">
                          {farmer.irrigationProfile?.pumpFuelType || 'Diesel'} (150 L)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>{createLoading ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: AGRICULTURE REVIEW DECISION MODAL                                */}
      {/* ========================================================================= */}
      {reviewModalReq && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-slate-50/75">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">Official Agriculture Review</h3>
                <p className="text-[11px] text-gov-muted m-0">
                  Request {reviewModalReq.requestNumber} · {reviewModalReq.totalFarmersCount} farmers (
                  {Number(reviewModalReq.totalLitersRequested).toLocaleString()} L)
                </p>
              </div>
              <button onClick={() => setReviewModalReq(null)} className="text-gov-muted hover:text-gov-ink cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {reviewError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{reviewError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitReviewDecision} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Review Decision *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewDecision('RETURNED')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      reviewDecision === 'RETURNED'
                        ? 'border-amber-500 bg-amber-50/80 text-amber-900 ring-1 ring-amber-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <RotateCcw size={14} className="text-amber-600" />
                      <span>Return for Correction</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Allow submitter to adjust data & resubmit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision('APPROVED')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      reviewDecision === 'APPROVED'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 ring-1 ring-emerald-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={14} className="text-emerald-600" />
                      <span>Approve Request</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Confirm verified agricultural eligibility</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision('REJECTED')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      reviewDecision === 'REJECTED'
                        ? 'border-rose-500 bg-rose-50/80 text-rose-900 ring-1 ring-rose-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <XCircle size={14} className="text-rose-600" />
                      <span>Reject Request</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Final rejection with official reason</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewDecision('UNDER_REVIEW')}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                      reviewDecision === 'UNDER_REVIEW'
                        ? 'border-blue-500 bg-blue-50/80 text-blue-900 ring-1 ring-blue-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      <Clock size={14} className="text-blue-600" />
                      <span>Under Review</span>
                    </div>
                    <span className="text-[10px] text-slate-500">Mark active evaluation in progress</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Official Feedback / Correction Instructions{' '}
                  {(reviewDecision === 'RETURNED' || reviewDecision === 'REJECTED') && (
                    <span className="text-red-500">* (Mandatory)</span>
                  )}
                </label>
                <textarea
                  rows={4}
                  required={reviewDecision === 'RETURNED' || reviewDecision === 'REJECTED'}
                  placeholder={
                    reviewDecision === 'RETURNED'
                      ? 'Specify exactly what needs correction (e.g. land size discrepancy, pump type verification, incorrect farmer quota)...'
                      : reviewDecision === 'REJECTED'
                      ? 'Explain the institutional reason for rejection...'
                      : 'Optional review notes...'
                  }
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-gov-blue"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setReviewModalReq(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {reviewLoading ? 'Recording...' : 'Submit Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT & RESUBMIT RETURNED REQUEST                                 */}
      {/* ========================================================================= */}
      {resubmitModalReq && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-amber-50/50">
              <div>
                <h3 className="text-sm font-bold text-amber-950 m-0">Correct & Resubmit Request</h3>
                <p className="text-[11px] text-amber-800 m-0">
                  {resubmitModalReq.requestNumber} · Returned by Agriculture Review
                </p>
              </div>
              <button onClick={() => setResubmitModalReq(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Prominent reviewer feedback alert banner */}
            <div className="m-5 p-3.5 bg-amber-100/70 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                <MessageSquare size={13} />
                <span>Reviewer Correction Feedback:</span>
              </div>
              <p className="text-xs font-semibold leading-relaxed pl-5">
                {resubmitModalReq.reviewRemarks || 'Please review farmer items and correct discrepancies.'}
              </p>
            </div>

            {resubmitError && (
              <div className="mx-5 mb-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{resubmitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitResubmission} className="p-5 pt-0 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Request Title *</label>
                <input
                  type="text"
                  required
                  value={resubmitTitle}
                  onChange={(e) => setResubmitTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gov-blue"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Correct Farmer Requested Quantities</label>
                  <span className="text-[11px] font-bold text-gov-blue">
                    Total Volume: {resubmitItems.reduce((sum, item) => sum + item.requestedLiters, 0).toLocaleString()} L
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {resubmitItems.map((item, idx) => (
                    <div key={item.farmerId} className="p-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-800 truncate">{item.farmerName}</div>
                        <div className="text-[10px] text-slate-400">{item.fuelTypeName}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="2000"
                          value={item.requestedLiters}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const next = [...resubmitItems];
                            next[idx].requestedLiters = val;
                            setResubmitItems(next);
                          }}
                          className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 text-right focus:outline-none focus:ring-1 focus:ring-gov-blue"
                        />
                        <span className="text-slate-500 text-[11px]">L</span>

                        <button
                          type="button"
                          onClick={() => {
                            setResubmitItems(resubmitItems.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer"
                          title="Remove farmer from batch"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Resubmission Notes / What was corrected
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain corrections made in response to feedback (e.g. Adjusted requested liters for Abebe to 100L as per verified land profile)..."
                  value={resubmissionNotes}
                  onChange={(e) => setResubmissionNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-gov-blue"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setResubmitModalReq(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resubmitLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <Send size={13} />
                  <span>{resubmitLoading ? 'Resubmitting...' : 'Confirm & Resubmit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INSPECT REQUEST WITH FULL DECISION & HISTORY TIMELINE            */}
      {/* ========================================================================= */}
      {inspectReq && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-slate-50/75">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">
                  Request {inspectReq.requestNumber} Details & History
                </h3>
                <p className="text-[11px] text-gov-muted m-0">{inspectReq.title}</p>
              </div>
              <button onClick={() => setInspectReq(null)} className="text-gov-muted hover:text-gov-ink cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              {/* Summary card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status:</span>
                  <StatusBadge status={inspectReq.status} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted By:</span>
                  <span className="font-semibold text-slate-800">{inspectReq.submittedBy?.fullName || 'Agriculture'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Requested Volume:</span>
                  <span className="font-bold text-slate-800">{Number(inspectReq.totalLitersRequested).toLocaleString()} L</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Approved Volume:</span>
                  <span className="font-bold text-emerald-700">{Number(inspectReq.totalLitersApproved).toLocaleString()} L</span>
                </div>
              </div>

              {/* Feedback if any */}
              {inspectReq.reviewRemarks && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider mb-0.5">
                    <MessageSquare size={13} className="text-amber-700" />
                    <span>Review Feedback / Remarks:</span>
                  </div>
                  <p className="text-xs pl-5 font-medium">{inspectReq.reviewRemarks}</p>
                </div>
              )}

              {/* History Timeline */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5 text-xs">
                  <History size={14} className="text-slate-500" />
                  <span>Review Decision & Resubmission History</span>
                </h4>

                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                  {inspectReq.history && inspectReq.history.length > 0 ? (
                    inspectReq.history.map((h, i) => (
                      <div key={h.id || i} className="p-3 hover:bg-slate-50/60 transition-colors">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                h.action === 'RESUBMITTED'
                                  ? 'bg-blue-100 text-blue-800'
                                  : h.action === 'RETURNED_FOR_CORRECTION'
                                  ? 'bg-amber-100 text-amber-800'
                                  : h.action === 'REJECTED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : h.action === 'OFFICIALLY_APPROVED' || h.action === 'APPROVED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {h.action}
                            </span>
                            <span className="text-[11px] font-medium text-slate-700">
                              by {h.actor?.fullName || 'Authorized Officer'} ({h.actor?.role || 'Staff'})
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {new Date(h.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {h.feedback && (
                          <div className="mt-1 text-slate-600 text-[11px] pl-2 border-l-2 border-slate-300">
                            {h.feedback}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-400 text-xs italic">
                      No previous decision history entries recorded.
                    </div>
                  )}
                </div>
              </div>

              {/* Items in request */}
              <div>
                <h4 className="font-bold text-slate-800 mb-2 text-xs">Farmer Request Items ({inspectReq.items?.length || 0}):</h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {inspectReq.items?.map((item) => (
                    <div key={item.id} className="p-2.5 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-800">{item.farmer?.fullName}</div>
                        <div className="text-[10px] text-slate-400">
                          {item.fuelType?.name} · Kebele: {item.farmer?.kebele?.name} · {item.farmer?.farmerCode}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800">{item.requestedLiters} L requested</div>
                        <StatusBadge status={item.itemStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gov-line bg-slate-50/50 flex justify-end">
              <button
                onClick={() => setInspectReq(null)}
                className="px-4 py-2 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
