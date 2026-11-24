import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { AuditLog } from '../../types';
import { Shield, Search, RefreshCw } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/audit-logs', {
        params: { action: search || undefined, limit: 50 },
      });
      if (res.data.success) {
        setLogs(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [search]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Technical Audit Logs
          </h1>
          <p className="text-xs text-gov-muted">
            Immutable system logs tracking operational authorizations, QR scans, and security events
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={13} className="text-gov-muted" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-gov-line rounded-[13px] p-3 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action keyword (e.g. LOGIN, DISPENSE, ASSIGN, REJECT)..."
            className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-lg text-xs text-gov-ink focus:outline-none"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
        </div>
      </div>

      {/* Audit Table matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  User
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Action
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Entity
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Audit Details
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  IP Address
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 text-gov-muted whitespace-nowrap font-mono text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 font-semibold text-gov-ink">
                    {log.user ? `${log.user.fullName} (${log.user.username})` : 'System / Anonymous'}
                  </td>
                  <td className="p-3 font-mono font-bold text-gov-blue">{log.action}</td>
                  <td className="p-3 text-gov-muted">{log.entityType}</td>
                  <td className="p-3 text-gov-ink max-w-xs truncate" title={log.details || ''}>
                    {log.details || '—'}
                  </td>
                  <td className="p-3 font-mono text-gov-muted text-[11px]">{log.ipAddress || '127.0.0.1'}</td>
                </tr>
              ))}
              {logs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gov-muted text-xs">
                    No audit records found.
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
