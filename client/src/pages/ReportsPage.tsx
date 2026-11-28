import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Download, RefreshCw, Layers, Building2, UserCheck, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from '../components/common/StatusBadge';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<'overview' | 'agriculture' | 'trade' | 'station'>('overview');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [periodMonth, setPeriodMonth] = useState(11);
  const [periodYear, setPeriodYear] = useState(2026);
  const [exporting, setExporting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let endpoint = '/reports/overview';
      const params: any = { periodMonth, periodYear };

      if (reportType === 'agriculture') {
        endpoint = '/reports/agriculture';
      } else if (reportType === 'trade') {
        endpoint = '/reports/trade';
      } else if (reportType === 'station') {
        endpoint = '/reports/station';
        const stId = user?.fuelStationId || user?.fuelStation?.id;
        if (user?.role === 'STATION_ADMIN' && stId) {
          params.stationId = stId;
        }
      }

      const res = await api.get(endpoint, { params });
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
  }, [reportType, periodMonth, periodYear]);

  const exportReportCsv = async () => {
    setExporting(true);
    try {
      const params: any = { type: reportType, periodMonth, periodYear };
      const stId = user?.fuelStationId || user?.fuelStation?.id;
      if (reportType === 'station' && user?.role === 'STATION_ADMIN' && stId) {
        params.stationId = stId;
      }
      const response = await api.get('/reports/export', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `irfa_${reportType}_report_${periodMonth}_${periodYear}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export CSV', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1 flex items-center gap-2">
            <FileText size={24} className="text-gov-blue" />
            <span>Departmental Reports & Distribution Monitoring</span>
          </h1>
          <p className="text-xs text-gov-muted">
            Audited statistics for Bahir Dar City Administration Agriculture & Trade fuel authorization program
          </p>
        </div>

        <button
          onClick={exportReportCsv}
          disabled={exporting || loading}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <Download size={14} className="text-gov-muted" />
          <span>{exporting ? 'Exporting...' : `Export ${reportType.toUpperCase()} CSV`}</span>
        </button>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex border-b border-gov-line gap-2 overflow-x-auto text-xs">
        <button
          onClick={() => setReportType('overview')}
          className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            reportType === 'overview'
              ? 'border-gov-blue text-gov-blue'
              : 'border-transparent text-gov-muted hover:text-gov-ink'
          }`}
        >
          Overview & Quotas
        </button>
        <button
          onClick={() => setReportType('agriculture')}
          className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            reportType === 'agriculture'
              ? 'border-gov-blue text-gov-blue'
              : 'border-transparent text-gov-muted hover:text-gov-ink'
          }`}
        >
          Agriculture & Farmer Registry
        </button>
        <button
          onClick={() => setReportType('trade')}
          className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
            reportType === 'trade'
              ? 'border-gov-blue text-gov-blue'
              : 'border-transparent text-gov-muted hover:text-gov-ink'
          }`}
        >
          Trade Quotas & Stations
        </button>
        {(user?.role === 'STATION_ADMIN' || user?.role === 'TRADE_OFFICE' || user?.role === 'SYSTEM_ADMIN') && (
          <button
            onClick={() => setReportType('station')}
            className={`pb-2.5 px-3 font-semibold transition-colors border-b-2 whitespace-nowrap ${
              reportType === 'station'
                ? 'border-gov-blue text-gov-blue'
                : 'border-transparent text-gov-muted hover:text-gov-ink'
            }`}
          >
            Station Dispensing & Logs
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gov-line rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
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
          <select
            value={periodYear}
            onChange={(e) => setPeriodYear(parseInt(e.target.value))}
            className="border border-gov-line rounded-lg px-3 py-1.5 bg-white text-xs text-gov-ink focus:outline-none"
          >
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
        </div>

        <button onClick={fetchReports} className="p-1.5 text-gov-muted hover:text-gov-ink">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ================= REPORT TYPE: OVERVIEW ================= */}
      {reportType === 'overview' && (
        <div className="space-y-6">
          {/* Section 1: Quota Allocation vs Dispensing Consumption */}
          <div className="bg-white border border-gov-line rounded-xl p-5 shadow-sm space-y-4">
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
          <div className="bg-white border border-gov-line rounded-xl overflow-hidden shadow-sm">
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
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Station Name</th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Location</th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Sub-City Links</th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Dispensed Volume</th>
                    <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.stationSummary?.map((st: any) => (
                    <tr key={st.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="p-3 font-semibold text-gov-ink">
                        <div>{st.name}</div>
                        <div className="text-[10px] font-mono text-gov-muted">{st.code}</div>
                      </td>
                      <td className="p-3 text-gov-muted">{st.location}</td>
                      <td className="p-3 font-semibold text-gov-blue">{st.subCityAssignmentsCount || 0} Sub-Cities</td>
                      <td className="p-3 font-bold text-gov-ink font-mono">{st.dispensedLiters.toLocaleString()} L</td>
                      <td className="p-3 font-bold text-gov-ink font-mono">{st.totalRevenueBirr.toLocaleString()} ETB</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT TYPE: AGRICULTURE ================= */}
      {reportType === 'agriculture' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Eligible Farmers</div>
              <div className="text-2xl font-bold text-gov-ink mt-1">{data?.eligibilityCounts?.ELIGIBLE || 0}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Under Review</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{data?.eligibilityCounts?.UNDER_REVIEW || 0}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Suspended</div>
              <div className="text-2xl font-bold text-red-600 mt-1">{data?.eligibilityCounts?.SUSPENDED || 0}</div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Ineligible</div>
              <div className="text-2xl font-bold text-slate-500 mt-1">{data?.eligibilityCounts?.INELIGIBLE || 0}</div>
            </div>
          </div>

          <div className="bg-white border border-gov-line rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b">
              <h3 className="text-xs font-bold text-gov-ink uppercase tracking-wider">Sub-City & Kebele Distribution</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3">Sub-City</th>
                    <th className="p-3">Code</th>
                    <th className="p-3">Registered Farmers</th>
                    <th className="p-3">Kebeles Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.subCityBreakdown?.map((sc: any) => (
                    <tr key={sc.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold">{sc.name}</td>
                      <td className="p-3 font-mono">{sc.code}</td>
                      <td className="p-3 font-bold text-gov-ink">{sc.totalFarmers}</td>
                      <td className="p-3 text-gov-muted">{sc.kebeles?.length || 0} Kebeles</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT TYPE: TRADE ================= */}
      {reportType === 'trade' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Authorized Quota Volume</div>
              <div className="text-2xl font-bold text-gov-ink mt-1">
                {Number(data?.authorizationsSummary?.totalAuthorizedLiters || 0).toLocaleString()} L
              </div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Total Dispensed Fuel</div>
              <div className="text-2xl font-bold text-gov-blue mt-1">
                {Number(data?.authorizationsSummary?.totalConsumedLiters || 0).toLocaleString()} L
              </div>
            </div>
            <div className="bg-white border rounded-xl p-4 shadow-sm">
              <div className="text-xs text-gov-muted">Active Shortage Alerts</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">
                {data?.activeShortages?.length || 0}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gov-line rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b">
              <h3 className="text-xs font-bold text-gov-ink uppercase tracking-wider">Official Station Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-3">Station</th>
                    <th className="p-3">Representative</th>
                    <th className="p-3">Sub-Cities Covered</th>
                    <th className="p-3">Transactions</th>
                    <th className="p-3">Dispensed Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data?.stationReports?.map((st: any) => (
                    <tr key={st.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold">
                        <div>{st.name}</div>
                        <div className="text-[10px] font-mono text-gov-muted">{st.code}</div>
                      </td>
                      <td className="p-3">
                        {st.representative ? (
                          <span className="text-green-700 font-semibold">{st.representative.fullName}</span>
                        ) : (
                          <span className="text-amber-600 font-semibold">Unassigned</span>
                        )}
                      </td>
                      <td className="p-3 text-gov-muted">
                        {st.subCitiesCovered?.join(', ') || 'None assigned'}
                      </td>
                      <td className="p-3 font-mono font-medium">{st.transactionsCount}</td>
                      <td className="p-3 font-mono font-bold text-gov-ink">{st.dispensedLiters.toLocaleString()} L</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= REPORT TYPE: STATION ================= */}
      {reportType === 'station' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h2 className="text-base font-bold text-gov-ink">{data?.station?.name || 'Fuel Station'}</h2>
                <p className="text-xs text-gov-muted">{data?.station?.code} • {data?.station?.location}</p>
              </div>
              <StatusBadge status={data?.station?.isActive ? 'ACTIVE' : 'INACTIVE'} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div>
                <span className="text-gov-muted">Total Transactions:</span>
                <div className="text-xl font-bold text-gov-ink">{data?.summary?.totalTransactions || 0}</div>
              </div>
              <div>
                <span className="text-gov-muted">Dispensed Volume:</span>
                <div className="text-xl font-bold text-gov-blue">{Number(data?.summary?.totalDispensedLiters || 0).toLocaleString()} L</div>
              </div>
              <div>
                <span className="text-gov-muted">Verified Scans Success:</span>
                <div className="text-xl font-bold text-green-700">{data?.verificationSummary?.successCount || 0} / {data?.verificationSummary?.total || 0}</div>
              </div>
            </div>
          </div>

          {/* Verification rejection breakdown */}
          {data?.verificationSummary?.rejectionBreakdown && Object.keys(data.verificationSummary.rejectionBreakdown).length > 0 && (
            <div className="bg-white border rounded-xl p-4 shadow-sm space-y-2 text-xs">
              <h3 className="font-bold text-gov-ink uppercase tracking-wider text-[11px]">Rejection Reason Breakdown</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {Object.entries(data.verificationSummary.rejectionBreakdown).map(([reason, count]) => (
                  <div key={reason} className="p-2.5 rounded-lg bg-red-50/50 border border-red-100 flex justify-between items-center">
                    <span className="font-mono text-red-900 text-[11px] truncate">{reason}</span>
                    <span className="font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">{count as number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
