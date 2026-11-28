import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import {
  Building2,
  MapPin,
  Layers,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Filter,
  Trash2,
  Eye,
  CheckSquare,
  Square,
  Shield,
  UserCheck,
  ChevronRight,
  Info,
} from 'lucide-react';

interface SubCity {
  id: string;
  code: string;
  name: string;
  nameAmharic: string | null;
  farmerCount?: number;
  kebeleCount?: number;
  stationCount?: number;
  authorizedStations?: any[];
}

interface AllocationRecord {
  id: string;
  subCityId: string;
  fuelStationId: string;
  status: 'ACTIVE' | 'REVOKED' | 'TRANSFERRED';
  notes: string | null;
  createdAt: string;
  subCity: { id: string; code: string; name: string; nameAmharic: string | null };
  assignedBy?: { id: string; fullName: string; username: string };
}

interface StationWithAllocations {
  id: string;
  code: string;
  name: string;
  nameAmharic: string | null;
  company: string | null;
  location: string;
  phone: string | null;
  isActive: boolean;
  activeRepresentative: { id: string; fullName: string; username: string } | null;
  activeSubCities: SubCity[];
  allocations: AllocationRecord[];
  allocationCount: number;
  hasAllocation: boolean;
}

interface Metrics {
  totalActiveStations: number;
  totalSubCities: number;
  totalActiveAllocations: number;
  stationsWithNoAllocation: number;
  subCitiesWithNoStations: number;
}

export const StationAllocationPage: React.FC = () => {
  const [stations, setStations] = useState<StationWithAllocations[]>([]);
  const [subCities, setSubCities] = useState<SubCity[]>([]);
  const [rawAllocations, setRawAllocations] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalActiveStations: 0,
    totalSubCities: 4,
    totalActiveAllocations: 0,
    stationsWithNoAllocation: 0,
    subCitiesWithNoStations: 0,
  });

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subCityFilter, setSubCityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ALLOCATED' | 'UNALLOCATED'>('ALL');
  const [activeTab, setActiveTab] = useState<'STATIONS' | 'SUBCITIES' | 'ALLOCATIONS'>('STATIONS');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Manage Allocations Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<StationWithAllocations | null>(null);
  const [selectedSubCityIds, setSelectedSubCityIds] = useState<string[]>([]);
  const [allocationNotes, setAllocationNotes] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trade/station-allocations');
      if (res.data.success) {
        setStations(res.data.stations);
        setSubCities(res.data.subCities);
        setRawAllocations(res.data.allocations);
        setMetrics(res.data.metrics);
      }
    } catch (err: any) {
      console.error('Failed to load station allocations:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load station allocations.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered stations
  const filteredStations = useMemo(() => {
    return stations.filter((st) => {
      // Allocation status filter
      if (statusFilter === 'ALLOCATED' && !st.hasAllocation) return false;
      if (statusFilter === 'UNALLOCATED' && st.hasAllocation) return false;

      // Sub-City filter
      if (subCityFilter !== 'ALL') {
        const servesSubCity = st.activeSubCities.some((sc) => sc.id === subCityFilter);
        if (!servesSubCity) return false;
      }

      // Search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesStation =
          st.name.toLowerCase().includes(q) ||
          st.code.toLowerCase().includes(q) ||
          (st.nameAmharic && st.nameAmharic.toLowerCase().includes(q)) ||
          (st.company && st.company.toLowerCase().includes(q)) ||
          st.location.toLowerCase().includes(q);

        const matchesSubCity = st.activeSubCities.some(
          (sc) =>
            sc.name.toLowerCase().includes(q) ||
            (sc.nameAmharic && sc.nameAmharic.toLowerCase().includes(q))
        );

        return matchesStation || matchesSubCity;
      }

      return true;
    });
  }, [stations, statusFilter, subCityFilter, search]);

  // Open Manage Modal
  const handleOpenManage = (station: StationWithAllocations) => {
    setSelectedStation(station);
    setSelectedSubCityIds(station.activeSubCities.map((sc) => sc.id));
    setAllocationNotes('');
    setFormError(null);
    setIsConfirming(false);
    setModalOpen(true);
  };

  // Toggle Sub-City selection in modal
  const handleToggleSubCity = (scId: string) => {
    setSelectedSubCityIds((prev) =>
      prev.includes(scId) ? prev.filter((id) => id !== scId) : [...prev, scId]
    );
  };

  // Select all Sub-Cities for a station
  const handleSelectAllSubCities = () => {
    if (selectedSubCityIds.length === subCities.length) {
      setSelectedSubCityIds([]);
    } else {
      setSelectedSubCityIds(subCities.map((sc) => sc.id));
    }
  };

  // Submit Bulk Allocation
  const handleSaveAllocations = async () => {
    if (!selectedStation) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await api.put(`/trade/station-allocations/station/${selectedStation.id}`, {
        subCityIds: selectedSubCityIds,
        notes: allocationNotes || undefined,
      });

      if (res.data.success) {
        setModalOpen(false);
        setFeedback({ type: 'success', message: res.data.message });
        await fetchData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save allocations');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Remove single allocation
  const handleRemoveAllocation = async (allocationId: string, stationName: string, subCityName: string) => {
    if (
      !window.confirm(
        `Remove authorization for '${stationName}' to serve '${subCityName}'? Farmers from this Sub-City will no longer be directed to this station.`
      )
    ) {
      return;
    }

    try {
      const res = await api.delete(`/trade/station-allocations/${allocationId}`);
      if (res.data.success) {
        setFeedback({ type: 'success', message: res.data.message });
        await fetchData();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to remove allocation',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gov-ink">Station–Sub-City Allocations</h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Trade Office Allocation Authority
            </span>
          </div>
          <p className="text-xs text-gov-muted">
            Configure which licensed fuel stations are authorized to serve irrigation farmers from each administrative Sub-City.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-gov-muted' : 'text-gov-muted'} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100 p-0.5">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <StatCard
          title="Active Fuel Stations"
          value={metrics.totalActiveStations}
          note="Licensed stations"
          icon={<Building2 size={18} />}
        />
        <StatCard
          title="Total Sub-Cities"
          value={metrics.totalSubCities}
          note="Bahir Dar administrative"
          icon={<MapPin size={18} className="text-gov-blue" />}
        />
        <StatCard
          title="Active Allocations"
          value={metrics.totalActiveAllocations}
          note="Configured station–Sub-City pairs"
          icon={<Layers size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Unallocated Stations"
          value={metrics.stationsWithNoAllocation}
          note="No Sub-City assigned"
          icon={<AlertCircle size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Unassigned Sub-Cities"
          value={metrics.subCitiesWithNoStations}
          note="Awaiting fuel station"
          icon={<AlertCircle size={18} className="text-rose-600" />}
        />
      </div>

      {/* Empty State Banner (Clean Baseline Notice) */}
      {metrics.totalActiveAllocations === 0 && !loading && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-900 flex items-start gap-3">
          <Info size={18} className="text-gov-blue shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-sm">Initial Allocation Database is Clean</p>
            <p>
              No operational fuel station-to-Sub-City allocations exist yet. No allocation data has been invented.
              Click <strong>&quot;Configure Allocation&quot;</strong> on any fuel station below to authorize it to serve farmers in one or more Sub-Cities.
            </p>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="bg-white border border-gov-line rounded-[13px] shadow-sm overflow-hidden">
        {/* Navigation Tabs & Filters */}
        <div className="p-4 border-b border-gov-line flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-[#fafbfe]">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setActiveTab('STATIONS')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'STATIONS'
                  ? 'bg-gov-blue text-white shadow-sm'
                  : 'bg-white text-gov-muted hover:text-gov-ink border border-gov-line'
              }`}
            >
              <Building2 size={13} />
              <span>By Fuel Station</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'STATIONS' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gov-muted'
                }`}
              >
                {stations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('SUBCITIES')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'SUBCITIES'
                  ? 'bg-gov-blue text-white shadow-sm'
                  : 'bg-white text-gov-muted hover:text-gov-ink border border-gov-line'
              }`}
            >
              <MapPin size={13} />
              <span>By Sub-City</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'SUBCITIES' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gov-muted'
                }`}
              >
                {subCities.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('ALLOCATIONS')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === 'ALLOCATIONS'
                  ? 'bg-gov-blue text-white shadow-sm'
                  : 'bg-white text-gov-muted hover:text-gov-ink border border-gov-line'
              }`}
            >
              <Layers size={13} />
              <span>All Allocations</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'ALLOCATIONS' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gov-muted'
                }`}
              >
                {rawAllocations.length}
              </span>
            </button>
          </div>

          {/* Search & Sub-City Filter */}
          <div className="flex items-center gap-2">
            {activeTab === 'STATIONS' && (
              <select
                value={subCityFilter}
                onChange={(e) => setSubCityFilter(e.target.value)}
                className="text-xs bg-white border border-gov-line rounded-lg px-2.5 py-1.5 text-gov-ink focus:outline-none focus:border-gov-blue"
              >
                <option value="ALL">All Sub-Cities</option>
                {subCities.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            )}

            <div className="relative min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gov-muted" />
              <input
                type="text"
                placeholder="Search station or Sub-City..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gov-line rounded-lg text-gov-ink placeholder-gov-muted focus:outline-none focus:border-gov-blue"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gov-muted hover:text-gov-ink"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ==================== TAB 1: STATIONS DIRECTORY ==================== */}
        {activeTab === 'STATIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafd] border-b border-gov-line text-gov-muted font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Station Details</th>
                  <th className="py-3 px-4">Company & Location</th>
                  <th className="py-3 px-4">Authorized Sub-Cities</th>
                  <th className="py-3 px-4">Representative</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-line">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gov-muted">
                      <Loader2 size={24} className="animate-spin mx-auto mb-2 text-gov-blue" />
                      <span>Loading station allocations...</span>
                    </td>
                  </tr>
                ) : filteredStations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gov-muted">
                      <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-gov-ink text-sm">No stations match criteria</p>
                    </td>
                  </tr>
                ) : (
                  filteredStations.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Station Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-gov-blue grid place-items-center shrink-0 mt-0.5 font-bold text-[11px]">
                            {st.code.split('-')[2] || 'ST'}
                          </div>
                          <div>
                            <div className="font-semibold text-gov-ink text-[13px] flex items-center gap-1.5">
                              <span>{st.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                {st.code}
                              </span>
                            </div>
                            {st.nameAmharic && (
                              <div className="text-[11px] text-gov-muted">{st.nameAmharic}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Company & Location */}
                      <td className="py-3.5 px-4 text-gov-ink">
                        <div className="font-medium">{st.company || 'Independent'}</div>
                        <div className="text-gov-muted text-[11px] flex items-center gap-1 mt-0.5">
                          <MapPin size={11} className="shrink-0 text-slate-400" />
                          <span className="truncate max-w-[200px]">{st.location}</span>
                        </div>
                      </td>

                      {/* Authorized Sub-Cities */}
                      <td className="py-3.5 px-4">
                        {st.activeSubCities.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {st.activeSubCities.map((sc) => (
                              <span
                                key={sc.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50 text-gov-blue border border-blue-200"
                              >
                                <span>{sc.name}</span>
                                {sc.nameAmharic && (
                                  <span className="opacity-75 text-[10px]">({sc.nameAmharic.split(' ')[0]})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                            <AlertCircle size={12} className="text-amber-600" />
                            <span>Unallocated (No Sub-City)</span>
                          </span>
                        )}
                      </td>

                      {/* Active Representative */}
                      <td className="py-3.5 px-4">
                        {st.activeRepresentative ? (
                          <div>
                            <div className="font-medium text-gov-ink">{st.activeRepresentative.fullName}</div>
                            <div className="text-gov-muted text-[10px] font-mono">@{st.activeRepresentative.username}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unattended</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenManage(st)}
                          className="px-3 py-1.5 rounded-lg border border-gov-line bg-white hover:bg-slate-50 text-gov-blue font-semibold text-[11px] inline-flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Layers size={12} />
                          <span>{st.hasAllocation ? 'Configure' : 'Allocate'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ==================== TAB 2: BY SUB-CITY MATRIX ==================== */}
        {activeTab === 'SUBCITIES' && (
          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            {subCities.map((sc) => (
              <div
                key={sc.id}
                className="bg-white border border-gov-line rounded-xl p-4 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-gov-ink flex items-center gap-2">
                        <span>{sc.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700">
                          {sc.code}
                        </span>
                      </h3>
                      {sc.nameAmharic && (
                        <p className="text-xs text-gov-muted font-medium mt-0.5">{sc.nameAmharic}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-50 text-gov-blue border border-blue-200">
                      {sc.stationCount || 0} Stations
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gov-muted mt-3 py-2 border-y border-gov-line bg-slate-50/50 rounded-lg px-2.5">
                    <div>Kebeles: <strong className="text-gov-ink">{sc.kebeleCount || 0}</strong></div>
                    <div>Registered Farmers: <strong className="text-gov-ink">{sc.farmerCount || 0}</strong></div>
                  </div>

                  {/* Authorized Stations List */}
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold text-gov-muted uppercase tracking-wider">
                      Authorized Stations ({sc.authorizedStations?.length || 0}):
                    </p>
                    {sc.authorizedStations && sc.authorizedStations.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {sc.authorizedStations.map((st: any) => (
                          <span
                            key={st.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-slate-100 text-gov-ink border border-slate-200 font-medium"
                          >
                            <Building2 size={11} className="text-gov-blue" />
                            <span>{st.name}</span>
                            <span className="text-[10px] font-mono opacity-70">({st.code})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                        <AlertCircle size={14} className="text-amber-600 shrink-0" />
                        <span>No fuel stations currently allocated to serve this Sub-City.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setActiveTab('STATIONS');
                      setSubCityFilter(sc.id);
                    }}
                    className="text-xs font-semibold text-gov-blue hover:underline flex items-center gap-1"
                  >
                    <span>View stations serving this Sub-City</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ==================== TAB 3: ALL ALLOCATIONS AUDIT LOG ==================== */}
        {activeTab === 'ALLOCATIONS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafd] border-b border-gov-line text-gov-muted font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Fuel Station</th>
                  <th className="py-3 px-4">Allocated Sub-City</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Allocated By</th>
                  <th className="py-3 px-4">Allocation Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gov-line">
                {rawAllocations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gov-muted">
                      <Layers size={32} className="mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-gov-ink text-sm">No allocations in database</p>
                      <p className="text-xs text-gov-muted mt-0.5">Use the Stations tab to configure your first allocation.</p>
                    </td>
                  </tr>
                ) : (
                  rawAllocations.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-semibold text-gov-ink">
                        <div>{a.fuelStation.name}</div>
                        <div className="text-[10px] text-gov-muted font-mono">{a.fuelStation.code}</div>
                      </td>
                      <td className="py-3 px-4 text-gov-ink font-medium">
                        {a.subCity.name}
                        {a.subCity.nameAmharic && (
                          <span className="text-gov-muted text-[11px] block">{a.subCity.nameAmharic}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            a.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gov-muted">
                        {a.assignedBy?.fullName || 'Trade Office'}
                      </td>
                      <td className="py-3 px-4 text-gov-muted">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleRemoveAllocation(a.id, a.fuelStation.name, a.subCity.name)}
                          className="p-1 rounded hover:bg-rose-50 text-rose-600 transition-colors"
                          title="Remove allocation"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================== MANAGE ALLOCATION MODAL ==================== */}
      {modalOpen && selectedStation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gov-line overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-gov-line flex items-center justify-between bg-[#fafbfe]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-gov-blue grid place-items-center">
                  <Layers size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gov-ink">Configure Station Allocations</h3>
                  <p className="text-xs text-gov-muted mt-0.5">
                    {selectedStation.name} ({selectedStation.code})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Station Info Notice */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-gov-ink flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm">{selectedStation.name}</div>
                  <div className="text-[11px] text-gov-muted mt-0.5">{selectedStation.location}</div>
                </div>
                <button
                  type="button"
                  onClick={handleSelectAllSubCities}
                  className="text-xs font-semibold text-gov-blue hover:underline"
                >
                  {selectedSubCityIds.length === subCities.length ? 'Clear All' : 'Select All 4'}
                </button>
              </div>

              {/* Four Sub-Cities Selection */}
              <div>
                <label className="block font-semibold text-gov-ink mb-2">
                  Authorize Station to Serve Farmers from Sub-Cities:
                </label>
                <div className="space-y-2">
                  {subCities.map((sc) => {
                    const isSelected = selectedSubCityIds.includes(sc.id);
                    return (
                      <div
                        key={sc.id}
                        onClick={() => handleToggleSubCity(sc.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-50/70 border-gov-blue text-gov-ink'
                            : 'bg-white border-gov-line text-gov-muted hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {isSelected ? (
                            <CheckSquare size={17} className="text-gov-blue shrink-0" />
                          ) : (
                            <Square size={17} className="text-slate-400 shrink-0" />
                          )}
                          <div>
                            <div className="font-semibold text-[13px] text-gov-ink">{sc.name}</div>
                            {sc.nameAmharic && (
                              <div className="text-[11px] text-gov-muted font-medium">{sc.nameAmharic}</div>
                            )}
                          </div>
                        </div>

                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          {sc.code}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Allocation Notes */}
              <div>
                <label className="block font-semibold text-gov-ink mb-1">Authorization Notes / Remarks (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Authorized for Tana sub-city irrigation farmers"
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                />
              </div>

              {/* Confirmation Screen */}
              {isConfirming && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5 animate-fadeIn">
                  <p className="font-bold flex items-center gap-1.5">
                    <Shield size={14} className="text-amber-700" />
                    <span>Confirm Allocation Changes</span>
                  </p>
                  <p>
                    {selectedSubCityIds.length === 0
                      ? `This will remove all Sub-City allocations for ${selectedStation.name}.`
                      : `Station ${selectedStation.name} will be authorized to serve ${selectedSubCityIds.length} Sub-City/Cities.`}
                  </p>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-gov-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gov-line bg-white hover:bg-gray-50 text-gov-ink font-semibold"
                >
                  Cancel
                </button>

                {!isConfirming ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirming(true)}
                    className="px-4 py-2 rounded-lg bg-gov-blue hover:bg-[#124b9e] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>Review & Confirm</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSaveAllocations}
                    disabled={formSubmitting}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                    <span>Save Allocation</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
