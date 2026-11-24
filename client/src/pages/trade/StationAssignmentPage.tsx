import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FuelAuthorization, FuelStation } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Building2, Search, RefreshCw, CheckCircle2, X, AlertCircle } from 'lucide-react';

export const StationAssignmentPage: React.FC = () => {
  const [authorizations, setAuthorizations] = useState<FuelAuthorization[]>([]);
  const [stations, setStations] = useState<FuelStation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Assign Station Modal
  const [selectedAuth, setSelectedAuth] = useState<FuelAuthorization | null>(null);
  const [selectedStationId, setSelectedStationId] = useState('');
  const [assignNotes, setAssignNotes] = useState('Authorized for convenient collection');
  const [formLoading, setFormLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [resAuth, resStations] = await Promise.all([
        api.get('/trade/authorizations', { params: { search: search || undefined, limit: 50 } }),
        api.get('/meta/stations'),
      ]);

      if (resAuth.data.success) setAuthorizations(resAuth.data.data);
      if (resStations.data.success) {
        setStations(resStations.data.stations);
        if (resStations.data.stations.length > 0) {
          setSelectedStationId(resStations.data.stations[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load station assignments', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetStationId = selectedStationId || (stations.length > 0 ? stations[0].id : '');
    if (!selectedAuth || !targetStationId) return;

    setFormLoading(true);
    setModalError(null);

    try {
      const res = await api.post('/trade/assign-station', {
        authorizationId: selectedAuth.id,
        fuelStationId: targetStationId,
        notes: assignNotes,
      });

      if (res.data.success) {
        setSelectedAuth(null);
        fetchData();
      }
    } catch (err: any) {
      setModalError(err.response?.data?.message || 'Failed to assign station');
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
            Fuel Station Assignment
          </h1>
          <p className="text-xs text-gov-muted">
            Map authorized irrigation farmers to licensed fuel stations for verified dispensing
          </p>
        </div>

        <button
          onClick={fetchData}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={13} className="text-gov-muted" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Available Stations Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {stations.map((st) => (
          <div key={st.id} className="bg-white border border-gov-line rounded-[13px] p-4 shadow-sm flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-gov-softBlue text-gov-blue grid place-items-center shrink-0">
              <Building2 size={18} />
            </div>
            <div>
              <div className="font-bold text-xs text-gov-ink">{st.name}</div>
              <div className="text-[11px] text-gov-muted leading-tight mt-0.5">{st.location}</div>
              <div className="text-[10px] text-gov-blue font-semibold mt-2">
                {st._count?.assignments || 0} farmers assigned · {st._count?.transactions || 0} transactions
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="p-3 border-b border-gov-line flex items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Auth Code, Farmer ID, or Name..."
              className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-lg text-xs text-gov-ink focus:outline-none"
            />
            <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Auth Ref
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmer Beneficiary
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Fuel Type
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Authorized Volume
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Assigned Fuel Station
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Assignment Status
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {authorizations.map((auth) => {
                const assignedStation = auth.assignments?.[0]?.fuelStation;
                return (
                  <tr key={auth.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="p-3 font-semibold text-gov-ink font-mono">{auth.authCode}</td>
                    <td className="p-3">
                      <div className="font-semibold text-gov-ink">{auth.farmer?.fullName}</div>
                      <div className="text-[10px] text-gov-muted">{auth.farmer?.farmerCode}</div>
                    </td>
                    <td className="p-3 font-medium">{auth.fuelType?.name}</td>
                    <td className="p-3 font-bold text-gov-blue">{auth.authorizedLiters} L</td>
                    <td className="p-3 text-gov-ink font-medium">
                      {assignedStation ? assignedStation.name : <span className="text-amber-600 font-semibold">Unassigned</span>}
                    </td>
                    <td className="p-3">
                      <StatusBadge status={assignedStation ? 'ASSIGNED' : 'PENDING'} />
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedAuth(auth)}
                        className="bg-gov-softBlue text-gov-blue hover:bg-[#d6e4ff] px-2.5 py-1 rounded-[6px] font-semibold text-xs transition-colors"
                      >
                        {assignedStation ? 'Change Station' : '+ Assign Station'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {authorizations.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gov-muted text-xs">
                    No active authorizations awaiting station assignment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ASSIGN STATION MODAL */}
      {selectedAuth && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-gov-line shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gov-line flex justify-between items-center bg-gray-50/50">
              <h3 className="text-sm font-bold text-gov-ink m-0">Assign Station for Dispensing</h3>
              <button onClick={() => setSelectedAuth(null)} className="text-gov-muted hover:text-gov-ink">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="m-5 mb-0 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="p-5 space-y-4 text-xs">
              <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                <div>
                  <span className="text-gov-muted">Farmer:</span>{' '}
                  <b className="text-gov-ink">{selectedAuth.farmer?.fullName}</b> ({selectedAuth.farmer?.farmerCode})
                </div>
                <div>
                  <span className="text-gov-muted">Authorized Quota:</span>{' '}
                  <b className="text-gov-blue">{selectedAuth.authorizedLiters} L {selectedAuth.fuelType?.name}</b>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">
                  Select Fuel Station (የነዳጅ ማደያ) *
                </label>
                <select
                  required
                  value={selectedStationId}
                  onChange={(e) => setSelectedStationId(e.target.value)}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs bg-white focus:outline-none"
                >
                  {stations.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} - {st.location}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#526177] mb-1">Notes / Instructions</label>
                <textarea
                  rows={2}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gov-line rounded-lg text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gov-line">
                <button
                  type="button"
                  onClick={() => setSelectedAuth(null)}
                  className="px-4 py-2 border border-gov-line rounded-lg text-xs font-semibold text-gov-ink hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 bg-gov-blue hover:bg-gov-blueHover text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {formLoading ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
