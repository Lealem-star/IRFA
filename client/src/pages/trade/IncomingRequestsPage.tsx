import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FuelRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { CheckCircle2, XCircle, ArrowLeftRight, Eye, RefreshCw, X, AlertCircle } from 'lucide-react';

export const IncomingRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Review Modal
  const [activeReq, setActiveReq] = useState<FuelRequest | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'RETURNED'>('APPROVED');
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [itemApprovals, setItemApprovals] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/fuel-requests');
      if (res.data.success) {
        setRequests(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load incoming requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openReviewModal = (req: FuelRequest) => {
    setActiveReq(req);
    setReviewStatus('APPROVED');
    setReviewRemarks(req.status === 'APPROVED' ? (req.reviewRemarks || '') : 'Approved following quota and land verification.');
    const approvals: Record<string, number> = {};
    req.items?.forEach((it) => {
      approvals[it.id] = Number(it.approvedLiters || it.requestedLiters);
    });
    setItemApprovals(approvals);
    setModalError(null);
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReq) return;

    setActionLoading(true);
    setModalError(null);

    try {
      const itemDecisions = activeReq.items?.map((it) => ({
        itemId: it.id,
        approvedLiters: reviewStatus === 'REJECTED' || reviewStatus === 'RETURNED' ? 0 : itemApprovals[it.id] ?? Number(it.requestedLiters),
        itemStatus:
          reviewStatus === 'REJECTED'
            ? 'REJECTED'
            : reviewStatus === 'RETURNED'
            ? 'PENDING'
            : (itemApprovals[it.id] ?? 0) < Number(it.requestedLiters)
            ? 'PARTIALLY_APPROVED'
            : 'APPROVED',
      }));

      const res = await api.post(`/trade/review-request/${activeReq.id}`, {
        status: reviewStatus,
        reviewRemarks,
        itemDecisions,
      });

      if (res.data.success) {
        setActiveReq(null);
        fetchRequests();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Review submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Incoming Agriculture Requests
          </h1>
          <p className="text-xs text-gov-muted">
            Review fuel requests submitted by Agriculture Office, approve quotas, or return for correction
          </p>
        </div>

        <button
          onClick={fetchRequests}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={13} className="text-gov-muted" />
          <span>Refresh Queue</span>
        </button>
      </div>

      {/* Requests Table matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Request Ref
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Submitted By
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Period
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmers Count
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Requested Volume
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Status
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink">
                    <div>{req.requestNumber}</div>
                    <div className="text-[10px] text-gov-muted">{req.title}</div>
                  </td>
                  <td className="p-3 text-gov-muted">
                    {req.submittedBy?.fullName || 'Agriculture Office'}
                  </td>
                  <td className="p-3 text-gov-muted">
                    Month {req.periodMonth}, {req.periodYear}
                  </td>
                  <td className="p-3 font-medium">{req.totalFarmersCount}</td>
                  <td className="p-3 font-bold text-gov-ink">
                    {Number(req.totalLitersRequested).toLocaleString()} L
                  </td>
                  <td className="p-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => openReviewModal(req)}
                      className="bg-gov-softBlue text-gov-blue hover:bg-[#d6e4ff] px-3 py-1 rounded-[6px] font-semibold text-xs transition-colors"
                    >
                      {['SUBMITTED', 'UNDER_REVIEW'].includes(req.status) ? 'Review Request' : 'View Decision'}
                    </button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gov-muted text-xs">
                    No incoming requests in review queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REVIEW & AUTHORIZATION MODAL */}
      {activeReq && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">
                  Review Fuel Request: {activeReq.requestNumber}
                </h3>
                <p className="text-[11px] text-gov-muted m-0">{activeReq.title}</p>
              </div>
              <button onClick={() => setActiveReq(null)} className="text-gov-muted hover:text-gov-ink">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Summary Banner */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 p-3 rounded-xl text-xs">
                <div>
                  <span className="text-gov-muted block">Submitted By:</span>
                  <b className="text-gov-ink">{activeReq.submittedBy?.fullName}</b>
                </div>
                <div>
                  <span className="text-gov-muted block">Farmers Included:</span>
                  <b className="text-gov-ink">{activeReq.totalFarmersCount} beneficiaries</b>
                </div>
                <div>
                  <span className="text-gov-muted block">Requested Fuel Volume:</span>
                  <b className="text-gov-blue">{Number(activeReq.totalLitersRequested).toLocaleString()} L</b>
                </div>
              </div>

              {/* Items Breakdown with inline quantity adjustment */}
              <div>
                <h4 className="font-bold text-gov-ink text-xs mb-2">Farmer Quota Review:</h4>
                <div className="border border-gov-line rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                  {activeReq.items?.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between text-xs gap-3">
                      <div>
                        <div className="font-semibold text-gov-ink">{item.farmer?.fullName}</div>
                        <div className="text-[10px] text-gov-muted">
                          {item.farmer?.farmerCode} · {item.farmer?.kebele?.name} · {item.fuelType?.name}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-gov-muted text-[11px]">Requested: {item.requestedLiters} L</span>
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-semibold text-gov-ink">Approve (L):</label>
                          <input
                            type="number"
                            min="0"
                            max={Number(item.requestedLiters)}
                            value={itemApprovals[item.id] ?? item.requestedLiters}
                            onChange={(e) =>
                              setItemApprovals({
                                ...itemApprovals,
                                [item.id]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 px-2 py-1 border border-gov-line rounded text-xs text-right font-mono focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decision Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1.5">Trade Decision *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus('APPROVED')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      reviewStatus === 'APPROVED'
                        ? 'bg-green-50 border-green-400 text-green-700 shadow-sm'
                        : 'bg-white border-gov-line text-gov-ink hover:bg-gray-50'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    <span>Approve Full</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('PARTIALLY_APPROVED')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      reviewStatus === 'PARTIALLY_APPROVED'
                        ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-sm'
                        : 'bg-white border-gov-line text-gov-ink hover:bg-gray-50'
                    }`}
                  >
                    <span>Partial Approve</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('RETURNED')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      reviewStatus === 'RETURNED'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm'
                        : 'bg-white border-gov-line text-gov-ink hover:bg-gray-50'
                    }`}
                  >
                    <ArrowLeftRight size={14} />
                    <span>Return for Fix</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReviewStatus('REJECTED')}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border flex items-center justify-center gap-1.5 transition-colors ${
                      reviewStatus === 'REJECTED'
                        ? 'bg-red-50 border-red-400 text-red-700 shadow-sm'
                        : 'bg-white border-gov-line text-gov-ink hover:bg-gray-50'
                    }`}
                  >
                    <XCircle size={14} />
                    <span>Reject</span>
                  </button>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">
                  Decision Remarks / Official Order *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="Record formal approval justification, quota adjustments, or reasons for return..."
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none focus:border-gov-blue"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setActiveReq(null)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Recording Decision...' : 'Commit Trade Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
