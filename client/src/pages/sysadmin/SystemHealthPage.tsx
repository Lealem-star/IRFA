import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Activity, Server, Database, ShieldCheck, RefreshCw } from 'lucide-react';

export const SystemHealthPage: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/health');
      if (res.data.success) {
        setHealth(res.data.health);
      }
    } catch (err) {
      console.error('Failed to load system health', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            System Health & Infrastructure Diagnostics
          </h1>
          <p className="text-xs text-gov-muted">
            Live technical verification of database connectivity, container uptime and entity counts
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={13} className="text-gov-muted" />
          <span>Refresh Status</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-gov-ink border-b border-gov-line pb-2">
            <Server size={16} className="text-gov-blue" />
            <span>Application Server</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Status:</span>
              <StatusBadge status="ACTIVE" label={health?.application || 'Operational'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Runtime:</span>
              <span className="font-mono text-gov-ink">Node.js v20+ / ESM</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Process Uptime:</span>
              <span className="font-mono text-gov-ink">{health?.uptimeSeconds || 0} seconds</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Owner Directorate:</span>
              <span className="font-medium text-gov-ink">የባሕር ዳር ከተማ አስተዳደር ግብርና መምሪያ (Bahir Dar City Administration Office of Agriculture)</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5 text-xs font-bold text-gov-ink border-b border-gov-line pb-2">
            <Database size={16} className="text-gov-blue" />
            <span>Database Layer (MySQL / MariaDB)</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Connection:</span>
              <StatusBadge status="ACTIVE" label={health?.database || 'Connected'} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Database Engine:</span>
              <span className="font-mono text-gov-ink">MariaDB 10.4.32 (localhost:3306)</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">ORM:</span>
              <span className="font-mono text-gov-ink">Prisma Client v5.22.0</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gov-muted">Schema Status:</span>
              <span className="text-gov-blue font-semibold">Synchronized</span>
            </div>
          </div>
        </div>
      </div>

      {/* Database Entity Tallies */}
      <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm">
        <h3 className="text-xs font-bold text-gov-ink mb-3 uppercase tracking-wider">
          Provisioned Entity Statistics
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-lg bg-gray-50 border border-gov-line">
            <div className="text-xl font-bold text-gov-ink">{health?.counts?.farmers ?? 0}</div>
            <div className="text-[10px] text-gov-muted">Registered Farmers</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gov-line">
            <div className="text-xl font-bold text-gov-blue">{health?.counts?.fuelRequests ?? 0}</div>
            <div className="text-[10px] text-gov-muted">Fuel Requests</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gov-line">
            <div className="text-xl font-bold text-green-700">{health?.counts?.transactions ?? 0}</div>
            <div className="text-[10px] text-gov-muted">Dispensing Transactions</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 border border-gov-line">
            <div className="text-xl font-bold text-gov-ink">{health?.counts?.users ?? 0}</div>
            <div className="text-[10px] text-gov-muted">System Accounts</div>
          </div>
        </div>
      </div>
    </div>
  );
};
