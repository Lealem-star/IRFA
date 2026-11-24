import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { MonthlyAllocation, FuelType, Farmer } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Plus, RefreshCw, Layers, Calendar, Filter, AlertCircle, X } from 'lucide-react';

export const AllocationPage: React.FC = () => {
  const [allocations, setAllocations] = useState<MonthlyAllocation[]>([]);
  const [fuelTypes, setFuelTypes] = useState<FuelType[]>([]);
  const [eligibleFarmers, setEligibleFarmers] = useState<Farmer[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(11);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [fuelTypeFilter, setFuelTypeFilter] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    farmerId: '',
    fuelTypeId: '',
    allocatedLiters: 150,
    notes: 'Regular monthly irrigation quota',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resAlloc, resSummary, resFuel, resFarmers] = await Promise.all([
        api.get('/allocations', {
          params: {
            month: selectedMonth,
            year: selectedYear,
            fuelTypeId: fuelTypeFilter || undefined,
            limit: 50,
          },
        }),
        api.get('/allocations/summary', {
          params: { month: selectedMonth, year: selectedYear },
        }),
        api.get('/meta/fuel-types'),
        api.get('/farmers', { params: { eligibilityStatus: 'ELIGIBLE', limit: 100 } }),
      ]);

      if (resAlloc.data.success) setAllocations(resAlloc.data.data);
      if (resSummary.data.success) setSummary(resSummary.data);
      if (resFuel.data.success) {
        setFuelTypes(resFuel.data.fuelTypes);
        if (!formData.fuelTypeId && resFuel.data.fuelTypes.length > 0) {
          setFormData((prev) => ({ ...prev, fuelTypeId: resFuel.data.fuelTypes[0].id }));
        }
      }
      if (resFarmers.data.success) {
        setEligibleFarmers(resFarmers.data.data);
        if (!formData.farmerId && resFarmers.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, farmerId: resFarmers.data.data[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load allocations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear, fuelTypeFilter]);

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setModalError(null);

    const targetFarmerId = formData.farmerId || (eligibleFarmers.length > 0 ? eligibleFarmers[0].id : '');
    const targetFuelTypeId = formData.fuelTypeId || (fuelTypes.length > 0 ? fuelTypes[0].id : '');

    try {
      const res = await api.post('/allocations', {
        ...formData,
        farmerId: targetFarmerId,
        fuelTypeId: targetFuelTypeId,
        month: selectedMonth,
        year: selectedYear,
        allocatedLiters: Number(formData.allocatedLiters),
      });

      if (res.data.success) {
        setShowModal(false);
        fetchData();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to create allocation');
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
            Monthly Fuel Allocation
          </h1>
          <p className="text-xs text-gov-muted">
            Plan and allocate monthly fuel quotas per farmer and verify consumption
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-gov-blue hover:bg-gov-blueHover text-white text-xs font-semibold px-3.5 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Plus size={14} />
          <span>Create Allocation</span>
        </button>
      </div>

      {/* Progress Overview Panel matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gov-line pb-4 mb-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-gov-ink">Allocation Period:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="border border-gov-line rounded-[8px] px-3 py-1.5 text-xs text-gov-ink bg-white focus:outline-none"
            >
              <option value={10}>October 2026</option>
              <option value={11}>November 2026</option>
              <option value={12}>December 2026</option>
            </select>

            <select
              value={fuelTypeFilter}
              onChange={(e) => setFuelTypeFilter(e.target.value)}
              className="border border-gov-line rounded-[8px] px-3 py-1.5 text-xs text-gov-ink bg-white focus:outline-none"
            >
              <option value="">All Fuel Types</option>
              {fuelTypes.map((ft) => (
                <option key={ft.id} value={ft.id}>
                  {ft.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            className="p-1.5 border border-gov-line rounded-[8px] hover:bg-gray-50 text-gov-muted"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Progress tracks matching prototype */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {summary?.summaries?.map((item: any, idx: number) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-gov-ink">{item.fuelTypeName} Quota</span>
                <span className="font-mono text-gov-muted">
                  <b className="text-gov-ink">{item.totalUsed.toLocaleString()}</b> / {item.totalAllocated.toLocaleString()} L ({item.usagePercentage}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-[#edf1f7] overflow-hidden">
                <div
                  className="h-full bg-gov-blue rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, item.usagePercentage || 0)}%` }}
                />
              </div>
              <div className="text-[11px] text-gov-muted flex justify-between">
                <span>Active farmers: {item.farmerCount}</span>
                <span className="text-gov-blue font-semibold">{item.totalRemaining.toLocaleString()} L remaining</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 rounded-[9px] bg-gov-iceBlue text-[#405a88] text-xs leading-relaxed border border-[#e0e9fa]">
          Set allocation quantities by farmer or grouped location, then prepare the request to Trade.
        </div>
      </div>

      {/* Allocation Data Table */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmer
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Location / Kebele
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Fuel Type
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Allocated This Month
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Used
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Remaining
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allocations.map((alloc) => (
                <tr key={alloc.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink">
                    <div>{alloc.farmer?.fullName}</div>
                    <div className="text-[10px] font-mono text-gov-muted">{alloc.farmer?.farmerCode}</div>
                  </td>
                  <td className="p-3 text-gov-muted">{alloc.farmer?.kebele?.name}</td>
                  <td className="p-3 font-medium">{alloc.fuelType?.name}</td>
                  <td className="p-3 font-bold text-gov-ink">{alloc.allocatedLiters} L</td>
                  <td className="p-3 text-gov-muted">{alloc.usedLiters} L</td>
                  <td className="p-3 font-bold text-gov-blue">{alloc.remainingLiters} L</td>
                  <td className="p-3">
                    <StatusBadge status={alloc.status} />
                  </td>
                </tr>
              ))}
              {allocations.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gov-muted text-xs">
                    No allocation records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ALLOCATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <h3 className="text-sm font-bold text-gov-ink m-0">Create Monthly Fuel Allocation</h3>
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

            <form onSubmit={handleCreateAllocation} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Select Farmer *</label>
                <select
                  required
                  value={formData.farmerId}
                  onChange={(e) => setFormData({ ...formData, farmerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                >
                  {eligibleFarmers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.fullName} ({f.farmerCode}) - {f.kebele?.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Fuel Type *</label>
                <select
                  required
                  value={formData.fuelTypeId}
                  onChange={(e) => setFormData({ ...formData, fuelTypeId: e.target.value })}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                >
                  {fuelTypes.map((ft) => (
                    <option key={ft.id} value={ft.id}>
                      {ft.name} ({ft.nameAmharic})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">
                  Allocated Volume in Liters *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.allocatedLiters}
                  onChange={(e) => setFormData({ ...formData, allocatedLiters: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Notes / Justification</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                />
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
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
