import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FuelRequest, Farmer, FuelType } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Plus, Send, RefreshCw, Eye, CheckCircle2, X, AlertCircle } from 'lucide-react';

export const RequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<FuelRequest[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [loading, setLoading] = useState(true);

  // Prepare Request Wizard
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [requestTitle, setRequestTitle] = useState('Dry Season Irrigation Fuel Batch');
  const [periodMonth, setPeriodMonth] = useState(11);
  const [periodYear, setPeriodYear] = useState(2026);
  const [selectedFarmers, setSelectedFarmers] = useState<{ farmerId: string; fuelTypeId: string; requestedLiters: number }[]>([]);

  // Selected Request details modal
  const [selectedReq, setSelectedReq] = useState<FuelRequest | null>(null);

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

  const handleFarmerToggle = (farmer: Farmer) => {
    const exists = selectedFarmers.some((f) => f.farmerId === farmer.id);
    if (exists) {
      setSelectedFarmers(selectedFarmers.filter((f) => f.farmerId !== farmer.id));
    } else {
      const ft = fuelTypes.find(
        (f) => f.name.toLowerCase() === (farmer.irrigationProfile?.pumpFuelType || 'diesel').toLowerCase()
      ) || fuelTypes[0];

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

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedFarmers.length === 0) {
      setModalError('Please select at least one farmer for this fuel request.');
      return;
    }

    setFormLoading(true);
    setModalError(null);

    try {
      const res = await api.post('/fuel-requests', {
        title: requestTitle,
        periodMonth,
        periodYear,
        items: selectedFarmers,
      });

      if (res.data.success) {
        setShowModal(false);
        setSelectedFarmers([]);
        fetchData();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to submit fuel request');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Requests Submitted to Trade
          </h1>
          <p className="text-xs text-gov-muted">
            Prepare, bundle and submit monthly farmer fuel allocation requests to Trade Office for authorization
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-gov-blue hover:bg-gov-blueHover text-white text-xs font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} />
          <span>Prepare Fuel Request</span>
        </button>
      </div>

      {/* Requests Table matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="p-[16px_18px] border-b border-gov-line flex justify-between items-center">
          <h3 className="text-sm font-bold text-gov-ink m-0">Fuel Request Tracking</h3>
          <button onClick={fetchData} className="p-1.5 text-gov-muted hover:text-gov-ink">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Request ID
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Period
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmers
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Requested Volume
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Approved Volume
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
                  <td className="p-3 font-semibold text-gov-ink">{req.requestNumber}</td>
                  <td className="p-3 text-gov-muted">
                    Month {req.periodMonth}, {req.periodYear}
                  </td>
                  <td className="p-3 font-medium">{req.totalFarmersCount}</td>
                  <td className="p-3 font-bold text-gov-ink">
                    {Number(req.totalLitersRequested).toLocaleString()} L
                  </td>
                  <td className="p-3 font-bold text-gov-blue">
                    {Number(req.totalLitersApproved).toLocaleString()} L
                  </td>
                  <td className="p-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedReq(req)}
                      className="border border-gov-line hover:bg-gray-100 text-gov-ink px-2.5 py-1 rounded-[6px] text-xs font-semibold transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
              {requests.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gov-muted text-xs">
                    No requests prepared yet. Click "+ Prepare Fuel Request" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PREPARE REQUEST MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden my-6">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <h3 className="text-sm font-bold text-gov-ink m-0">Prepare Fuel Request to Trade Office</h3>
              <button onClick={() => setShowModal(false)} className="text-gov-muted hover:text-gov-ink">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#526177] mb-1">Request Title *</label>
                  <input
                    type="text"
                    required
                    value={requestTitle}
                    onChange={(e) => setRequestTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#526177] mb-1">Month / Year *</label>
                  <select
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none"
                  >
                    <option value={10}>October 2026</option>
                    <option value={11}>November 2026</option>
                    <option value={12}>December 2026</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-semibold text-[#526177]">
                    Select Eligible Farmers ({selectedFarmers.length} selected)
                  </label>
                  <span className="text-[11px] text-gov-blue font-bold">
                    Total Volume:{' '}
                    {selectedFarmers.reduce((sum, item) => sum + item.requestedLiters, 0).toLocaleString()} L
                  </span>
                </div>

                <div className="border border-gov-line rounded-lg max-h-56 overflow-y-auto divide-y divide-gray-100 p-1">
                  {farmers.map((farmer) => {
                    const isSelected = selectedFarmers.some((f) => f.farmerId === farmer.id);
                    return (
                      <div
                        key={farmer.id}
                        onClick={() => handleFarmerToggle(farmer)}
                        className={`p-2.5 rounded flex items-center justify-between cursor-pointer text-xs transition-colors ${
                          isSelected ? 'bg-blue-50/70 border border-blue-200' : 'hover:bg-gray-50'
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
                            <div className="font-semibold text-gov-ink">{farmer.fullName}</div>
                            <div className="text-[10px] text-gov-muted">
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'Submitting...' : 'Submit to Trade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* INSPECT REQUEST MODAL */}
      {selectedReq && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-sm font-bold text-gov-ink m-0">
                  Request {selectedReq.requestNumber} Details
                </h3>
                <p className="text-[11px] text-gov-muted m-0">{selectedReq.title}</p>
              </div>
              <button onClick={() => setSelectedReq(null)} className="text-gov-muted hover:text-gov-ink">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg">
                <div>
                  <span className="text-gov-muted block">Status:</span>
                  <StatusBadge status={selectedReq.status} />
                </div>
                <div>
                  <span className="text-gov-muted block">Submitted By:</span>
                  <b className="text-gov-ink">{selectedReq.submittedBy?.fullName}</b>
                </div>
                <div>
                  <span className="text-gov-muted block">Total Requested:</span>
                  <b className="text-gov-ink">{selectedReq.totalLitersRequested} L</b>
                </div>
                <div>
                  <span className="text-gov-muted block">Total Approved by Trade:</span>
                  <b className="text-gov-blue">{selectedReq.totalLitersApproved} L</b>
                </div>
              </div>

              {selectedReq.reviewRemarks && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                  <b>Trade Office Remarks:</b> {selectedReq.reviewRemarks}
                </div>
              )}

              <div>
                <h4 className="font-bold text-gov-ink mb-2">Farmer Request Items:</h4>
                <div className="border border-gov-line rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {selectedReq.items?.map((item) => (
                    <div key={item.id} className="p-2.5 flex justify-between items-center">
                      <div>
                        <div className="font-semibold text-gov-ink">{item.farmer?.fullName}</div>
                        <div className="text-[10px] text-gov-muted">
                          {item.fuelType?.name} · Kebele: {item.farmer?.kebele?.name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{item.requestedLiters} L requested</div>
                        <StatusBadge status={item.itemStatus} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gov-line bg-gray-50/50 flex justify-end">
              <button
                onClick={() => setSelectedReq(null)}
                className="px-4 py-2 border border-gov-line bg-white rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-100"
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
