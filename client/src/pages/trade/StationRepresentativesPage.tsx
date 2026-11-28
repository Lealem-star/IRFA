import React, { useEffect, useState, useMemo } from 'react';
import api from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import {
  Building2,
  Search,
  RefreshCw,
  UserCheck,
  UserPlus,
  UserX,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  KeyRound,
  ArrowRightLeft,
  X,
  Loader2,
  Lock,
  ChevronDown,
  History,
  Phone,
  MapPin,
} from 'lucide-react';

interface Representative {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StationWithReps {
  id: string;
  code: string;
  name: string;
  nameAmharic: string | null;
  company: string | null;
  location: string;
  contactPerson: string | null;
  phone: string | null;
  isActive: boolean;
  activeRepresentative: Representative | null;
  representatives: Representative[];
  totalRepresentatives: number;
  transactionCount: number;
  verificationCount: number;
}

interface Metrics {
  totalStations: number;
  stationsWithActiveRep: number;
  stationsWithoutRep: number;
  totalInactiveReps: number;
}

export const StationRepresentativesPage: React.FC = () => {
  const [stations, setStations] = useState<StationWithReps[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalStations: 0,
    stationsWithActiveRep: 0,
    stationsWithoutRep: 0,
    totalInactiveReps: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'UNASSIGNED' | 'INACTIVE'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [replaceModalOpen, setReplaceModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Selected entities for actions
  const [selectedStation, setSelectedStation] = useState<StationWithReps | null>(null);
  const [selectedRep, setSelectedRep] = useState<Representative | null>(null);

  // Form states
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create Form
  const [createForm, setCreateForm] = useState({
    fuelStationId: '',
    fullName: '',
    username: '',
    password: '',
    email: '',
    forceReplace: false,
  });

  // Replace Form
  const [replaceForm, setReplaceForm] = useState({
    fullName: '',
    username: '',
    password: '',
    email: '',
    reason: '',
  });

  // Reassign Form
  const [reassignForm, setReassignForm] = useState({
    newFuelStationId: '',
    forceReplace: false,
    reason: '',
  });

  // Reset Password Form
  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trade/representatives');
      if (res.data.success) {
        setStations(res.data.stations);
        setMetrics(res.data.metrics);
      }
    } catch (err: any) {
      console.error('Failed to load representatives:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load station representatives.',
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
      // Status filter
      if (statusFilter === 'ACTIVE' && !st.activeRepresentative) return false;
      if (statusFilter === 'UNASSIGNED' && st.activeRepresentative) return false;
      if (statusFilter === 'INACTIVE' && !st.representatives.some((r) => !r.isActive)) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesStation =
          st.name.toLowerCase().includes(q) ||
          st.code.toLowerCase().includes(q) ||
          (st.nameAmharic && st.nameAmharic.toLowerCase().includes(q)) ||
          (st.company && st.company.toLowerCase().includes(q)) ||
          st.location.toLowerCase().includes(q);

        const matchesRep = st.representatives.some(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            r.username.toLowerCase().includes(q) ||
            (r.email && r.email.toLowerCase().includes(q))
        );

        return matchesStation || matchesRep;
      }

      return true;
    });
  }, [stations, statusFilter, search]);

  // Open Create Modal
  const handleOpenCreate = (targetStationId?: string) => {
    setCreateForm({
      fuelStationId: targetStationId || (stations[0]?.id ?? ''),
      fullName: '',
      username: '',
      password: '',
      email: '',
      forceReplace: false,
    });
    setFormError(null);
    setCreateModalOpen(true);
  };

  // Submit Create Representative
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await api.post('/trade/representatives', {
        ...createForm,
        email: createForm.email ? createForm.email.trim() : undefined,
      });

      if (res.data.success) {
        setCreateModalOpen(false);
        setFeedback({ type: 'success', message: res.data.message });
        await fetchData();
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        setFormError(err.response.data.message);
      } else {
        setFormError(err.response?.data?.message || 'Failed to register representative');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Replace Modal
  const handleOpenReplace = (station: StationWithReps, rep: Representative) => {
    setSelectedStation(station);
    setSelectedRep(rep);
    setReplaceForm({
      fullName: '',
      username: '',
      password: '',
      email: '',
      reason: '',
    });
    setFormError(null);
    setReplaceModalOpen(true);
  };

  // Submit Replace Representative
  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRep) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await api.post(`/trade/representatives/${selectedRep.id}/replace`, {
        ...replaceForm,
        email: replaceForm.email ? replaceForm.email.trim() : undefined,
      });

      if (res.data.success) {
        setReplaceModalOpen(false);
        setFeedback({ type: 'success', message: res.data.message });
        await fetchData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to replace representative');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Reassign Modal
  const handleOpenReassign = (station: StationWithReps, rep: Representative) => {
    setSelectedStation(station);
    setSelectedRep(rep);
    const firstOther = stations.find((s) => s.id !== station.id);
    setReassignForm({
      newFuelStationId: firstOther ? firstOther.id : '',
      forceReplace: false,
      reason: '',
    });
    setFormError(null);
    setReassignModalOpen(true);
  };

  // Submit Reassign Representative
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRep) return;
    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await api.post(`/trade/representatives/${selectedRep.id}/reassign`, reassignForm);

      if (res.data.success) {
        setReassignModalOpen(false);
        setFeedback({ type: 'success', message: res.data.message });
        await fetchData();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to reassign representative');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Representative Status (Activate / Deactivate)
  const handleToggleStatus = async (station: StationWithReps, rep: Representative) => {
    const targetStatus = rep.isActive ? 'INACTIVE' : 'ACTIVE';
    const confirmMsg = rep.isActive
      ? `Deactivate representative ${rep.fullName} (@${rep.username})? They will no longer be able to log in or verify QR coupons.`
      : `Activate representative ${rep.fullName} (@${rep.username}) for ${station.name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await api.patch(`/trade/representatives/${rep.id}/status`, {
        status: targetStatus,
      });

      if (res.data.success) {
        setFeedback({ type: 'success', message: res.data.message });
        await fetchData();
      }
    } catch (err: any) {
      if (err.response?.status === 409) {
        if (
          window.confirm(
            `${err.response.data.message}\n\nDo you want to force replacement of the current active representative?`
          )
        ) {
          try {
            const forceRes = await api.patch(`/trade/representatives/${rep.id}/status`, {
              status: targetStatus,
              forceReplace: true,
            });
            if (forceRes.data.success) {
              setFeedback({ type: 'success', message: forceRes.data.message });
              await fetchData();
            }
          } catch (retryErr: any) {
            setFeedback({
              type: 'error',
              message: retryErr.response?.data?.message || 'Activation failed',
            });
          }
        }
      } else {
        setFeedback({
          type: 'error',
          message: err.response?.data?.message || 'Failed to update representative status',
        });
      }
    }
  };

  // Open Reset Password Modal
  const handleOpenResetPassword = (rep: Representative) => {
    setSelectedRep(rep);
    setResetPasswordForm({
      newPassword: '',
      confirmPassword: '',
    });
    setFormError(null);
    setResetPasswordModalOpen(true);
  };

  // Submit Password Reset
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRep) return;

    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      setFormError('Passwords do not match');
      return;
    }

    if (resetPasswordForm.newPassword.length < 6) {
      setFormError('Password must be at least 6 characters');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      const res = await api.post(`/trade/representatives/${selectedRep.id}/reset-password`, {
        newPassword: resetPasswordForm.newPassword,
      });

      if (res.data.success) {
        setResetPasswordModalOpen(false);
        setFeedback({ type: 'success', message: res.data.message });
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open History Modal
  const handleOpenHistory = (station: StationWithReps) => {
    setSelectedStation(station);
    setHistoryModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-gov-ink">Fuel Station Representatives</h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-gov-blue border border-blue-200">
              Trade Office Authority
            </span>
          </div>
          <p className="text-xs text-gov-muted">
            Manage authorized Station Admin accounts across all licensed Bahir Dar fuel stations with active representative enforcement.
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
          <button
            onClick={() => handleOpenCreate()}
            className="bg-gov-blue hover:bg-[#124b9e] text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-all flex items-center gap-1.5 shadow-sm"
          >
            <UserPlus size={14} />
            <span>Register Representative</span>
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

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Total Fuel Stations"
          value={metrics.totalStations}
          note="Official licensed network"
          icon={<Building2 size={18} />}
        />
        <StatCard
          title="Active Representatives"
          value={metrics.stationsWithActiveRep}
          note="Stations ready to dispense"
          icon={<UserCheck size={18} className="text-emerald-600" />}
        />
        <StatCard
          title="Awaiting Representative"
          value={metrics.stationsWithoutRep}
          note="Pending assignment"
          icon={<AlertCircle size={18} className="text-amber-600" />}
        />
        <StatCard
          title="Inactive / Former Reps"
          value={metrics.totalInactiveReps}
          note="Historical accounts"
          icon={<History size={18} className="text-slate-600" />}
        />
      </div>

      {/* Directory & Controls */}
      <div className="bg-white border border-gov-line rounded-[13px] shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-gov-line flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-[#fafbfe]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(
              [
                { key: 'ALL', label: 'All Stations', count: stations.length },
                { key: 'ACTIVE', label: 'Active Rep', count: metrics.stationsWithActiveRep },
                { key: 'UNASSIGNED', label: 'Unassigned', count: metrics.stationsWithoutRep },
                { key: 'INACTIVE', label: 'With Inactive', count: metrics.totalInactiveReps },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === tab.key
                    ? 'bg-gov-blue text-white shadow-sm'
                    : 'bg-white text-gov-muted hover:text-gov-ink border border-gov-line'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gov-muted'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[260px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gov-muted" />
            <input
              type="text"
              placeholder="Search station, code, or representative..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gov-line rounded-lg text-gov-ink placeholder-gov-muted focus:outline-none focus:border-gov-blue transition-colors"
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

        {/* Directory Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafd] border-b border-gov-line text-gov-muted font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Station Details</th>
                <th className="py-3 px-4">Company & Location</th>
                <th className="py-3 px-4">Current Representative</th>
                <th className="py-3 px-4">Status & Access</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gov-line">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gov-muted">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-gov-blue" />
                    <span>Loading fuel station representatives...</span>
                  </td>
                </tr>
              ) : filteredStations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gov-muted">
                    <Building2 size={32} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-medium text-gov-ink text-sm">No stations match criteria</p>
                    <p className="text-xs text-gov-muted mt-0.5">Try adjusting your search query or filter.</p>
                  </td>
                </tr>
              ) : (
                filteredStations.map((st) => {
                  const rep = st.activeRepresentative;
                  const inactiveCount = st.representatives.filter((r) => !r.isActive).length;

                  return (
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
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                              <span>Transactions: {st.transactionCount}</span>
                              <span>•</span>
                              <span>Scans: {st.verificationCount}</span>
                            </div>
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
                        {st.phone && (
                          <div className="text-gov-muted text-[11px] flex items-center gap-1 mt-0.5">
                            <Phone size={11} className="shrink-0 text-slate-400" />
                            <span>{st.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Current Representative */}
                      <td className="py-3.5 px-4">
                        {rep ? (
                          <div className="space-y-0.5">
                            <div className="font-semibold text-gov-ink text-[13px]">{rep.fullName}</div>
                            <div className="text-gov-muted text-[11px] font-mono">@{rep.username}</div>
                            {rep.email && <div className="text-slate-500 text-[11px]">{rep.email}</div>}
                            <div className="text-[10px] text-slate-400">
                              Assigned: {new Date(rep.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                            <AlertCircle size={13} className="text-amber-600" />
                            <span>No Active Representative</span>
                          </div>
                        )}
                      </td>

                      {/* Status & Access */}
                      <td className="py-3.5 px-4">
                        {rep ? (
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                              Active
                            </span>
                            {inactiveCount > 0 && (
                              <div>
                                <button
                                  onClick={() => handleOpenHistory(st)}
                                  className="text-[10px] text-gov-blue hover:underline flex items-center gap-1"
                                >
                                  <History size={10} />
                                  <span>{inactiveCount} former {inactiveCount === 1 ? 'rep' : 'reps'}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-400 text-[11px]">Unattended</div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {rep ? (
                            <>
                              <button
                                onClick={() => handleOpenReplace(st, rep)}
                                title="Replace representative with a new account"
                                className="px-2.5 py-1.5 rounded-lg border border-gov-line bg-white hover:bg-slate-50 text-gov-ink font-medium text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <UserCheck size={12} className="text-gov-blue" />
                                <span>Replace</span>
                              </button>

                              <button
                                onClick={() => handleOpenReassign(st, rep)}
                                title="Reassign this representative to another fuel station"
                                className="px-2 py-1.5 rounded-lg border border-gov-line bg-white hover:bg-slate-50 text-gov-ink font-medium text-[11px] flex items-center gap-1 transition-colors"
                              >
                                <ArrowRightLeft size={12} className="text-slate-500" />
                                <span>Reassign</span>
                              </button>

                              <button
                                onClick={() => handleOpenResetPassword(rep)}
                                title="Reset password"
                                className="p-1.5 rounded-lg border border-gov-line bg-white hover:bg-slate-50 text-gov-ink transition-colors"
                              >
                                <KeyRound size={13} className="text-slate-600" />
                              </button>

                              <button
                                onClick={() => handleToggleStatus(st, rep)}
                                title="Deactivate representative"
                                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
                              >
                                <UserX size={13} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenCreate(st.id)}
                              className="px-3 py-1.5 rounded-lg bg-gov-blue hover:bg-[#124b9e] text-white font-medium text-[11px] flex items-center gap-1 shadow-sm transition-colors"
                            >
                              <UserPlus size={12} />
                              <span>Assign Rep</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== CREATE REPRESENTATIVE MODAL ==================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gov-line overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-gov-line flex items-center justify-between bg-[#fafbfe]">
              <div>
                <h3 className="font-bold text-base text-gov-ink">Register Station Representative</h3>
                <p className="text-xs text-gov-muted mt-0.5">
                  Create an operational Station Admin account for fuel authorization verification.
                </p>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Station Select */}
              <div>
                <label className="block font-semibold text-gov-ink mb-1.5">Fuel Station *</label>
                <select
                  value={createForm.fuelStationId}
                  onChange={(e) => setCreateForm({ ...createForm, fuelStationId: e.target.value })}
                  required
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.code} — {st.name} {st.activeRepresentative ? `(Current: @${st.activeRepresentative.username})` : '(No rep)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conflict Notice if Station Has Active Rep */}
              {(() => {
                const targetSt = stations.find((s) => s.id === createForm.fuelStationId);
                if (targetSt?.activeRepresentative) {
                  return (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Station already has an active representative</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            {targetSt.activeRepresentative.fullName} (@{targetSt.activeRepresentative.username}) is currently active.
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer font-medium pt-1 border-t border-amber-200/60">
                        <input
                          type="checkbox"
                          checked={createForm.forceReplace}
                          onChange={(e) => setCreateForm({ ...createForm, forceReplace: e.target.checked })}
                          className="rounded text-gov-blue focus:ring-gov-blue"
                        />
                        <span>Force replacement: Deactivate existing representative upon creation</span>
                      </label>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Abebe Kebede"
                    value={createForm.fullName}
                    onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., rep_tana"
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g., rep@station.et"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gov-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gov-line bg-white hover:bg-gray-50 text-gov-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-gov-blue hover:bg-[#124b9e] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Register Representative</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== REPLACE REPRESENTATIVE MODAL ==================== */}
      {replaceModalOpen && selectedStation && selectedRep && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gov-line overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-gov-line flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 grid place-items-center">
                  <UserCheck size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gov-ink">Replace Representative</h3>
                  <p className="text-xs text-gov-muted mt-0.5">{selectedStation.name} ({selectedStation.code})</p>
                </div>
              </div>
              <button
                onClick={() => setReplaceModalOpen(false)}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReplaceSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Warning on former rep deactivation */}
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                <span className="font-semibold">Notice:</span> Former representative{' '}
                <strong>{selectedRep.fullName} (@{selectedRep.username})</strong> will be{' '}
                <strong>automatically deactivated</strong> and will lose operational access.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">New Representative Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Almaz Tesfaye"
                    value={replaceForm.fullName}
                    onChange={(e) => setReplaceForm({ ...replaceForm, fullName: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">New Username *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., rep_almaz"
                    value={replaceForm.username}
                    onChange={(e) => setReplaceForm({ ...replaceForm, username: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Temporary Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={replaceForm.password}
                    onChange={(e) => setReplaceForm({ ...replaceForm, password: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gov-ink mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g., new_rep@station.et"
                    value={replaceForm.email}
                    onChange={(e) => setReplaceForm({ ...replaceForm, email: e.target.value })}
                    className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Reason for Replacement (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Representative transferred or left position"
                  value={replaceForm.reason}
                  onChange={(e) => setReplaceForm({ ...replaceForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                />
              </div>

              <div className="pt-3 border-t border-gov-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReplaceModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gov-line bg-white hover:bg-gray-50 text-gov-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Confirm Replacement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== REASSIGN STATION MODAL ==================== */}
      {reassignModalOpen && selectedStation && selectedRep && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gov-line overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-gov-line flex items-center justify-between bg-[#fafbfe]">
              <div>
                <h3 className="font-bold text-base text-gov-ink">Reassign Representative</h3>
                <p className="text-xs text-gov-muted mt-0.5">
                  Transfer {selectedRep.fullName} (@{selectedRep.username}) to a different station.
                </p>
              </div>
              <button
                onClick={() => setReassignModalOpen(false)}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gov-ink mb-1.5">Destination Fuel Station *</label>
                <select
                  value={reassignForm.newFuelStationId}
                  onChange={(e) => setReassignForm({ ...reassignForm, newFuelStationId: e.target.value })}
                  required
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                >
                  {stations
                    .filter((s) => s.id !== selectedStation.id)
                    .map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.code} — {st.name} {st.activeRepresentative ? `(Has active rep: @${st.activeRepresentative.username})` : '(No active rep)'}
                      </option>
                    ))}
                </select>
              </div>

              {/* Destination Conflict Notice */}
              {(() => {
                const targetSt = stations.find((s) => s.id === reassignForm.newFuelStationId);
                if (targetSt?.activeRepresentative) {
                  return (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Destination station has active representative</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            {targetSt.activeRepresentative.fullName} (@{targetSt.activeRepresentative.username}) is currently active.
                          </p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer font-medium pt-1 border-t border-amber-200/60">
                        <input
                          type="checkbox"
                          checked={reassignForm.forceReplace}
                          onChange={(e) => setReassignForm({ ...reassignForm, forceReplace: e.target.checked })}
                          className="rounded text-gov-blue focus:ring-gov-blue"
                        />
                        <span>Deactivate destination representative upon transfer</span>
                      </label>
                    </div>
                  );
                }
                return null;
              })()}

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Transfer Authorization Reason</label>
                <input
                  type="text"
                  placeholder="e.g., Trade Office official re-allocation"
                  value={reassignForm.reason}
                  onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                />
              </div>

              <div className="pt-3 border-t border-gov-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReassignModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gov-line bg-white hover:bg-gray-50 text-gov-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-gov-blue hover:bg-[#124b9e] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Confirm Reassignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== RESET PASSWORD MODAL ==================== */}
      {resetPasswordModalOpen && selectedRep && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gov-line overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-gov-line flex items-center justify-between bg-[#fafbfe]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-gov-blue grid place-items-center">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gov-ink">Reset Password</h3>
                  <p className="text-xs text-gov-muted mt-0.5">@{selectedRep.username} ({selectedRep.fullName})</p>
                </div>
              </div>
              <button
                onClick={() => setResetPasswordModalOpen(false)}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gov-ink mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={resetPasswordForm.newPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                />
              </div>

              <div>
                <label className="block font-semibold text-gov-ink mb-1">Confirm New Password *</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={resetPasswordForm.confirmPassword}
                  onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gov-line rounded-lg text-gov-ink focus:outline-none focus:border-gov-blue"
                />
              </div>

              <div className="pt-3 border-t border-gov-line flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setResetPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gov-line bg-white hover:bg-gray-50 text-gov-ink font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 rounded-lg bg-gov-blue hover:bg-[#124b9e] text-white font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  {formSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>Update Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== HISTORICAL REPRESENTATIVES MODAL ==================== */}
      {historyModalOpen && selectedStation && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gov-line overflow-hidden animate-scaleIn">
            <div className="p-5 border-b border-gov-line flex items-center justify-between bg-[#fafbfe]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 grid place-items-center">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gov-ink">Representative History</h3>
                  <p className="text-xs text-gov-muted mt-0.5">{selectedStation.name} ({selectedStation.code})</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="text-gov-muted hover:text-gov-ink p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs max-h-[60vh] overflow-y-auto">
              {selectedStation.representatives.map((rep) => (
                <div
                  key={rep.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between ${
                    rep.isActive ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-gov-ink flex items-center gap-2">
                      <span>{rep.fullName}</span>
                      <span className="font-mono text-[11px] text-gov-muted">@{rep.username}</span>
                      {rep.isActive ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                          CURRENT
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 text-slate-700">
                          INACTIVE
                        </span>
                      )}
                    </div>
                    {rep.email && <div className="text-slate-500 text-[11px] mt-0.5">{rep.email}</div>}
                    <div className="text-[10px] text-slate-400 mt-1">
                      Assigned: {new Date(rep.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {!rep.isActive && (
                    <button
                      onClick={() => {
                        setHistoryModalOpen(false);
                        handleToggleStatus(selectedStation, rep);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-gov-line bg-white hover:bg-slate-50 text-gov-blue font-semibold text-[11px]"
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gov-line bg-[#fafbfe] flex justify-end">
              <button
                onClick={() => setHistoryModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-gov-line bg-white hover:bg-gray-50 text-gov-ink font-semibold text-xs"
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
