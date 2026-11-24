import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Download, RefreshCw, Layers, Building2, UserCheck, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [periodMonth, setPeriodMonth] = useState(11);
  const [periodYear, setPeriodYear] = useState(2026);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/overview', {
        params: { periodMonth, periodYear },
      });
      if (res.data.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [periodMonth, periodYear]);

  const exportReportCsv = () => {
    if (!data?.stationSummary) return;
    const headers = ['Station Name', 'Station Code', 'Location', 'Assigned Farmers', 'Total Transactions', 'Dispensed Volume (L)', 'Total Revenue (ETB)'];
    const rows = data.stationSummary.map((st: any) => [
      `"${st.name}"`,
      st.code,
      `"${st.location}"`,
      st.assignedFarmers,
      st.totalTransactions,
      st.dispensedLiters,
      st.totalRevenueBirr,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `irfa_distribution_report_${periodMonth}_${periodYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Departmental Reports & Distribution Monitoring
          </h1>
          <p className="text-xs text-gov-muted">
            Audited statistics for Bahir Dar Agriculture Directorate (ባህርዳር ግብርና መምሪያ) fuel authorization program
          </p>
        </div>

        <button
          onClick={exportReportCsv}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Download size={14} className="text-gov-muted" />
          <span>Export Summary CSV</span>
        </button>
      </div>

      {/* Filter Controls matching prototype */}
      <div className="bg-white border border-gov-line rounded-[13px] p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-gov-ink">Reporting Period:</span>
          <select
            value={periodMonth}
            onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
            className="border border-gov-line rounded-lg px-3 py-1.5 bg-white text-xs text-gov-ink focus:outline-none"
          >
            <option value={10}>October 2026</option>
            <option value={11}>November 2026</option>
            <option value={12}>December 2026</option>
          </select>
        </div>

        <button onClick={fetchReports} className="p-1.5 text-gov-muted hover:text-gov-ink">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Section 1: Quota Allocation vs Dispensing Consumption */}
      <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-gov-ink uppercase tracking-wider flex items-center gap-2">
          <Layers size={16} className="text-gov-blue" />
          <span>Monthly Quota vs Actual Fuel Consumption</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.fuelSummary?.map((fuel: any, idx: number) => (
            <div key={idx} className="p-4 rounded-xl bg-gray-50 border border-gov-line space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gov-ink text-sm">{fuel.fuelType}</span>
                <span className="font-mono text-gov-blue font-bold">{fuel.usageRate}% Dispensed</span>
              </div>
              <div className="flex justify-between text-gov-muted">
                <span>Allocated: <b>{fuel.totalAllocated.toLocaleString()} L</b></span>
                <span>Consumed: <b>{fuel.totalUsed.toLocaleString()} L</b></span>
                <span>Remaining: <b className="text-gov-ink">{fuel.totalRemaining.toLocaleString()} L</b></span>
              </div>
              <div className="h-2 rounded-full bg-[#edf1f7] overflow-hidden">
                <div
                  className="h-full bg-gov-blue rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, fuel.usageRate || 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 2: Fuel Distribution by Station Table */}
      <div className="bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="p-[16px_18px] border-b border-gov-line flex justify-between items-center">
          <h3 className="text-xs font-bold text-gov-ink uppercase tracking-wider flex items-center gap-2">
            <Building2 size={16} className="text-gov-blue" />
            <span>Fuel Station Distribution Records</span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Station Name
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Location
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Assigned Farmers
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Dispensed Volume
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Transactions
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Total Revenue
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data?.stationSummary?.map((st: any) => (
                <tr key={st.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink">{st.name}</td>
                  <td className="p-3 text-gov-muted">{st.location}</td>
                  <td className="p-3 font-medium">{st.assignedFarmers}</td>
                  <td className="p-3 font-bold text-gov-blue">{st.dispensedLiters.toLocaleString()} L</td>
                  <td className="p-3 text-gov-muted">{st.totalTransactions}</td>
                  <td className="p-3 font-semibold text-gov-ink">
                    {Number(st.totalRevenueBirr).toLocaleString()} ETB
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Farmer Registry & Suspended Follow-up */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-gov-ink uppercase tracking-wider flex items-center gap-2">
            <UserCheck size={16} className="text-gov-blue" />
            <span>Beneficiary Eligibility Status Breakdown</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-green-50 border border-green-200">
              <span className="text-green-800 block text-[11px]">Eligible & Active</span>
              <b className="text-xl text-green-900">{data?.farmerStats?.eligible || 0}</b>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-800 block text-[11px]">Under Review</span>
              <b className="text-xl text-amber-900">{data?.farmerStats?.underReview || 0}</b>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <span className="text-red-800 block text-[11px]">Suspended Accounts</span>
              <b className="text-xl text-red-900">{data?.farmerStats?.suspended || 0}</b>
            </div>
            <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
              <span className="text-gray-800 block text-[11px]">Total Registered</span>
              <b className="text-xl text-gray-900">{data?.farmerStats?.total || 0}</b>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gov-line rounded-[13px] p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-600" />
            <span>Suspended Beneficiaries (Compliance Audit)</span>
          </h3>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data?.suspendedFarmers?.map((farmer: any) => (
              <div key={farmer.id} className="p-2.5 rounded-lg border border-red-200 bg-red-50/50 text-xs">
                <div className="flex justify-between font-semibold text-gov-ink">
                  <span>{farmer.fullName} ({farmer.farmerCode})</span>
                  <StatusBadge status="SUSPENDED" />
                </div>
                <div className="text-[11px] text-red-700 mt-1">
                  <b>Reason:</b> {farmer.suspensionReason || 'Tenure audit pending'}
                </div>
              </div>
            ))}
            {(!data?.suspendedFarmers || data.suspendedFarmers.length === 0) && (
              <p className="text-xs text-gov-muted text-center py-4">No suspended farmers.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
