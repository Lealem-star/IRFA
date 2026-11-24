import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { StatCard } from '../components/common/StatCard';
import { StatusBadge } from '../components/common/StatusBadge';
import {
  Users,
  CheckCircle2,
  Layers,
  Send,
  ScanLine,
  Receipt,
  AlertTriangle,
  Building2,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dashboard/stats');
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-gov-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const getStatIcon = (type: string) => {
    switch (type) {
      case 'farmer':
        return <Users size={18} />;
      case 'check':
        return <CheckCircle2 size={18} />;
      case 'quota':
        return <Layers size={18} />;
      case 'arrow':
        return <Send size={18} />;
      case 'station':
        return <Building2 size={18} />;
      case 'hash':
        return <ScanLine size={18} />;
      case 'alert':
        return <AlertTriangle size={18} />;
      default:
        return <ShieldCheck size={18} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Dashboard
          </h1>
          <p className="text-xs text-gov-muted">
            {user?.role === 'AGRICULTURE_OFFICE'
              ? 'Manage irrigation farmers, monthly fuel allocations and office requests'
              : user?.role === 'TRADE_OFFICE'
              ? 'Authorize fuel quotas, assign stations and monitor regional distribution'
              : user?.role === 'STATION_ADMIN'
              ? `Operational fuel dispensing portal for ${user.fuelStation?.name || 'Assigned Station'}`
              : 'System health, user access control and technical audit trail'}
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3 py-2 rounded-[8px] transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw size={13} className="text-gov-muted" />
          <span>Refresh</span>
        </button>
      </div>

      {/* 4 Stat Cards Grid matching Prototype */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {data?.stats?.map((stat: any, index: number) => (
          <StatCard
            key={index}
            title={stat.label}
            value={stat.value}
            note={stat.note}
            icon={getStatIcon(stat.icon)}
          />
        ))}
      </div>

      {/* ROLE 1: AGRICULTURE OFFICE DASHBOARD */}
      {user?.role === 'AGRICULTURE_OFFICE' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          {/* Recent Requests Panel */}
          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
            <div className="p-[16px_18px] border-b border-gov-line flex justify-between items-center">
              <h3 className="text-sm font-bold text-gov-ink m-0">Recent Fuel Requests</h3>
              <button
                onClick={() => navigate('/requests')}
                className="text-xs text-gov-blue hover:underline font-semibold"
              >
                View all requests →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gov-line bg-gray-50/50">
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Request
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Period
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Farmers
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Fuel Volume
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.recentRequests?.map((req: any) => (
                    <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 font-semibold text-gov-ink">{req.requestNumber}</td>
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
                    </tr>
                  ))}
                  {(!data?.recentRequests || data.recentRequests.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gov-muted text-xs">
                        No recent fuel requests found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Allocation Overview Progress Bars */}
          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm flex flex-col justify-between">
            <div className="p-[16px_18px] border-b border-gov-line flex justify-between items-center">
              <h3 className="text-sm font-bold text-gov-ink m-0">Monthly Allocation Overview</h3>
              <button
                onClick={() => navigate('/allocations')}
                className="text-xs text-gov-blue hover:underline font-semibold"
              >
                Manage →
              </button>
            </div>
            <div className="p-[16px_18px] space-y-4 flex-1">
              {data?.fuelBreakdowns?.map((fuel: any, idx: number) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-gov-ink">{fuel.name}</span>
                    <span className="font-mono text-gov-muted">
                      <b className="text-gov-ink">{fuel.used.toLocaleString()}</b> / {fuel.allocated.toLocaleString()} L
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#edf1f7] overflow-hidden">
                    <div
                      className="h-full bg-gov-blue rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, fuel.percentage || 0)}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="p-3 rounded-[9px] bg-gov-iceBlue text-[#405a88] text-xs leading-relaxed mt-4 border border-[#e0e9fa]">
                Allocations are planned monthly by Agriculture based on verified farm size and pump type, then submitted to Trade for authorization.
              </div>

              <div className="pt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => navigate('/farmers')}
                  className="p-3 border border-gov-line rounded-lg bg-gray-50 hover:bg-gray-100 text-left text-xs font-semibold text-gov-ink transition-colors flex items-center justify-between"
                >
                  <span>+ Register Farmer</span>
                  <ArrowRight size={13} className="text-gov-muted" />
                </button>
                <button
                  onClick={() => navigate('/requests')}
                  className="p-3 border border-gov-line rounded-lg bg-gray-50 hover:bg-gray-100 text-left text-xs font-semibold text-gov-ink transition-colors flex items-center justify-between"
                >
                  <span>+ Prepare Request</span>
                  <ArrowRight size={13} className="text-gov-muted" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ROLE 2: TRADE OFFICE DASHBOARD */}
      {user?.role === 'TRADE_OFFICE' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
            <div className="p-[16px_18px] border-b border-gov-line flex justify-between items-center">
              <h3 className="text-sm font-bold text-gov-ink m-0">Requests Awaiting Review</h3>
              <button
                onClick={() => navigate('/trade/requests')}
                className="text-xs text-gov-blue hover:underline font-semibold"
              >
                Review Queue →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gov-line bg-gray-50/50">
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Request
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      From
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Farmers
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Volume
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.recentRequests?.map((req: any) => (
                    <tr key={req.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 font-semibold text-gov-ink">{req.requestNumber}</td>
                      <td className="p-3 text-gov-muted">Agriculture Office</td>
                      <td className="p-3 font-medium">{req.totalFarmersCount}</td>
                      <td className="p-3 font-bold text-gov-ink">
                        {Number(req.totalLitersRequested).toLocaleString()} L
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => navigate('/trade/requests')}
                          className="bg-gov-softBlue text-gov-blue hover:bg-[#d6e4ff] px-2.5 py-1 rounded-[6px] font-semibold text-xs transition-colors"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentRequests || data.recentRequests.length === 0) && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gov-muted text-xs">
                        Review queue is clear. No pending requests.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm p-[16px_18px] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gov-ink mb-4">Distribution Monitoring</h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gov-muted">Authorized Quota Dispensed</span>
                    <b className="text-gov-ink">{data?.monitoring?.percentageDispensed || 0}%</b>
                  </div>
                  <div className="h-2 rounded-full bg-[#edf1f7] overflow-hidden">
                    <div
                      className="h-full bg-gov-blue rounded-full"
                      style={{ width: `${data?.monitoring?.percentageDispensed || 0}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-[9px] bg-gov-iceBlue text-[#405a88] text-xs leading-relaxed border border-[#e0e9fa]">
                  Trade Office authorizes fuel access and maps farmers to designated fuel stations. Once authorized, stations verify farmer QR identity before dispensing.
                </div>
              </div>
            </div>

            <div className="pt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate('/trade/authorizations')}
                className="p-3 border border-gov-line rounded-lg bg-gray-50 hover:bg-gray-100 text-left text-xs font-semibold text-gov-ink transition-colors flex items-center justify-between"
              >
                <span>Authorizations</span>
                <ArrowRight size={13} className="text-gov-muted" />
              </button>
              <button
                onClick={() => navigate('/trade/stations')}
                className="p-3 border border-gov-line rounded-lg bg-gray-50 hover:bg-gray-100 text-left text-xs font-semibold text-gov-ink transition-colors flex items-center justify-between"
              >
                <span>Station Links</span>
                <ArrowRight size={13} className="text-gov-muted" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ROLE 3: FUEL STATION OPERATOR DASHBOARD */}
      {user?.role === 'STATION_ADMIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm p-6 text-center flex flex-col items-center justify-center">
            <div className="border-2 border-dashed border-[#d4deee] bg-[#fafcff] rounded-[14px] p-8 w-full max-w-[450px]">
              <div className="text-4xl mb-3">▦</div>
              <h3 className="text-base font-bold text-gov-ink mb-1">Scan Farmer QR Card</h3>
              <p className="text-xs text-gov-muted max-w-[340px] mx-auto mb-6">
                Verify farmer registration, Trade authorization, station assignment, fuel type and remaining allocation in real time.
              </p>
              <button
                onClick={() => navigate('/scanner')}
                className="bg-gov-blue hover:bg-gov-blueHover text-white px-6 py-2.5 rounded-[9px] font-semibold text-xs transition-colors shadow-sm inline-flex items-center gap-2"
              >
                <ScanLine size={16} />
                <span>Open Verification Scanner</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
            <div className="p-[16px_18px] border-b border-gov-line flex justify-between items-center">
              <h3 className="text-sm font-bold text-gov-ink m-0">Recent Fuel Transactions</h3>
              <button
                onClick={() => navigate('/transactions')}
                className="text-xs text-gov-blue hover:underline font-semibold"
              >
                View all →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gov-line bg-gray-50/50">
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Farmer
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Fuel
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Volume
                    </th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.recentTransactions?.map((tx: any) => (
                    <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 font-semibold text-gov-ink">{tx.farmer?.fullName}</td>
                      <td className="p-3 text-gov-muted">{tx.fuelType?.name}</td>
                      <td className="p-3 font-bold text-gov-ink">{tx.quantityLiters} L</td>
                      <td className="p-3">
                        <StatusBadge status="RECORDED" />
                      </td>
                    </tr>
                  ))}
                  {(!data?.recentTransactions || data.recentTransactions.length === 0) && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gov-muted text-xs">
                        No transactions recorded yet today.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ROLE 4: SYSTEM ADMINISTRATOR DASHBOARD */}
      {user?.role === 'SYSTEM_ADMIN' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm p-[16px_18px]">
            <h3 className="text-sm font-bold text-gov-ink mb-4">Technical System Administration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => navigate('/sysadmin/users')}
                className="p-4 border border-gov-line rounded-xl bg-gray-50 hover:bg-gray-100 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-gov-ink text-xs">Users & Role Access</div>
                  <div className="text-[11px] text-gov-muted">Create, edit and assign offices/stations</div>
                </div>
                <ArrowRight size={14} className="text-gov-muted" />
              </button>

              <button
                onClick={() => navigate('/sysadmin/settings')}
                className="p-4 border border-gov-line rounded-xl bg-gray-50 hover:bg-gray-100 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-gov-ink text-xs">System Settings</div>
                  <div className="text-[11px] text-gov-muted">Fuel parameters and quota caps</div>
                </div>
                <ArrowRight size={14} className="text-gov-muted" />
              </button>

              <button
                onClick={() => navigate('/sysadmin/audit')}
                className="p-4 border border-gov-line rounded-xl bg-gray-50 hover:bg-gray-100 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-gov-ink text-xs">Technical Audit Logs</div>
                  <div className="text-[11px] text-gov-muted">Review security and operational events</div>
                </div>
                <ArrowRight size={14} className="text-gov-muted" />
              </button>

              <button
                onClick={() => navigate('/sysadmin/health')}
                className="p-4 border border-gov-line rounded-xl bg-gray-50 hover:bg-gray-100 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-gov-ink text-xs">System Health Diagnostics</div>
                  <div className="text-[11px] text-gov-muted">Database status, uptime & metrics</div>
                </div>
                <ArrowRight size={14} className="text-gov-muted" />
              </button>
            </div>
          </div>

          <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm p-[16px_18px] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gov-ink mb-4">Infrastructure Status</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gov-muted">Application Layer</span>
                  <StatusBadge status="ACTIVE" label="Operational" />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gov-muted">MySQL / MariaDB</span>
                  <StatusBadge status="ACTIVE" label="Connected (3306)" />
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gov-muted">Security Scope</span>
                  <span className="font-semibold text-gov-blue">RBAC Enforced</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-[9px] bg-gov-iceBlue text-[#405a88] text-[11px] leading-relaxed border border-[#e0e9fa] mt-4">
              Administrator privileges are strictly technical. Operational approvals, farmer registrations and fuel dispensing are restricted to department officers.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
