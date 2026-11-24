import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FuelAuthorization } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Search, RefreshCw, Layers } from 'lucide-react';

export const AuthorizationsPage: React.FC = () => {
  const [authorizations, setAuthorizations] = useState<FuelAuthorization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAuthorizations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/trade/authorizations', {
        params: { search: search || undefined, status: statusFilter || undefined, limit: 50 },
      });
      if (res.data.success) {
        setAuthorizations(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load authorizations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuthorizations();
  }, [search, statusFilter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Fuel Authorizations
          </h1>
          <p className="text-xs text-gov-muted">
            Active regional fuel quotas approved by Trade Office with consumption tracking
          </p>
        </div>

        <button
          onClick={fetchAuthorizations}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={13} className="text-gov-muted" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filter */}
      <div className="bg-white border border-gov-line rounded-[13px] p-3 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Auth Code, Farmer Name, or Farmer ID..."
            className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-lg text-xs text-gov-ink focus:outline-none"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gov-line rounded-lg px-3 py-2 text-xs text-gov-ink bg-white focus:outline-none"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXHAUSTED">Exhausted (0 L)</option>
          <option value="EXPIRED">Expired</option>
          <option value="REVOKED">Revoked</option>
        </select>
      </div>

      {/* Authorizations Table */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Auth Ref
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Beneficiary Farmer
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Fuel Type
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Authorized Volume
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Consumed
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Remaining
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Assigned Station
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {authorizations.map((auth) => (
                <tr key={auth.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink font-mono">{auth.authCode}</td>
                  <td className="p-3">
                    <div className="font-semibold text-gov-ink">{auth.farmer?.fullName}</div>
                    <div className="text-[10px] text-gov-muted">{auth.farmer?.farmerCode}</div>
                  </td>
                  <td className="p-3 font-medium">{auth.fuelType?.name}</td>
                  <td className="p-3 font-bold text-gov-ink">{auth.authorizedLiters} L</td>
                  <td className="p-3 text-gov-muted">{auth.consumedLiters} L</td>
                  <td className="p-3 font-bold text-gov-blue">{auth.remainingLiters} L</td>
                  <td className="p-3 text-gov-ink font-medium">
                    {auth.assignments?.[0]?.fuelStation?.name || 'Unassigned'}
                  </td>
                  <td className="p-3">
                    <StatusBadge status={auth.status} />
                  </td>
                </tr>
              ))}
              {authorizations.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gov-muted text-xs">
                    No authorization records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
