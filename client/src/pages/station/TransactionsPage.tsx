import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { FuelTransaction } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Search, RefreshCw, Download, Receipt } from 'lucide-react';

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<FuelTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions', {
        params: { search: search || undefined, limit: 50 },
      });
      if (res.data.success) {
        setTransactions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [search]);

  const handleExportCsv = () => {
    if (transactions.length === 0) return;
    const headers = ['Receipt', 'Date', 'Farmer ID', 'Farmer Name', 'Station', 'Fuel Type', 'Volume (L)', 'Price/L (ETB)', 'Total (ETB)', 'Status'];
    const rows = transactions.map((t) => [
      t.receiptNumber,
      new Date(t.transactionDate).toLocaleString(),
      t.farmer?.farmerCode,
      `"${t.farmer?.fullName}"`,
      `"${t.fuelStation?.name}"`,
      t.fuelType?.name,
      t.quantityLiters,
      t.pricePerLiter,
      t.totalAmount,
      t.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `irfa_fuel_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gov-ink mb-1">
            Fuel Transactions
          </h1>
          <p className="text-xs text-gov-muted">
            Audited history of verified fuel dispensing records across authorized stations
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="border border-gov-line bg-white hover:bg-gray-50 text-gov-ink text-xs font-semibold px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
        >
          <Download size={14} className="text-gov-muted" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white border border-gov-line rounded-[13px] p-3 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by receipt number, Farmer ID, or name..."
            className="w-full pl-9 pr-3 py-2 border border-gov-line rounded-lg text-xs text-gov-ink focus:outline-none"
          />
          <Search size={15} className="absolute left-3 top-2.5 text-gov-muted" />
        </div>

        <button onClick={fetchTransactions} className="p-2 border border-gov-line rounded-lg hover:bg-gray-50 text-gov-muted">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Mobile Card List View (Visible on screens < sm) */}
      <div className="block sm:hidden space-y-3">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="bg-white border border-gov-line rounded-xl p-3.5 shadow-2xs space-y-2.5"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="font-mono font-bold text-xs text-gov-blue">
                #{tx.receiptNumber}
              </span>
              <StatusBadge status="RECORDED" size="sm" />
            </div>

            <div className="flex justify-between items-start text-xs">
              <div>
                <div className="font-bold text-gov-ink text-sm">{tx.farmer?.fullName || 'Beneficiary'}</div>
                <div className="text-[11px] font-mono text-gov-muted">{tx.farmer?.farmerCode}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{tx.fuelStation?.name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-extrabold text-gov-blue leading-tight">
                  {tx.quantityLiters} L
                </div>
                <div className="text-[10px] text-gov-muted uppercase font-semibold">
                  {tx.fuelType?.name || 'Diesel'}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-[11px] text-gov-muted pt-2 border-t border-dashed border-gray-100">
              <span>
                {new Date(tx.transactionDate).toLocaleDateString()}{' '}
                {new Date(tx.transactionDate).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <span className="font-extrabold text-gov-ink text-xs">
                {Number(tx.totalAmount).toLocaleString()} ETB
              </span>
            </div>
          </div>
        ))}

        {transactions.length === 0 && !loading && (
          <div className="bg-white border border-gov-line rounded-xl p-6 text-center text-xs text-gov-muted">
            No transactions recorded yet.
          </div>
        )}
      </div>

      {/* Desktop & Tablet Table (Visible on sm+) */}
      <div className="hidden sm:block bg-white border border-gov-line rounded-[13px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gov-line bg-gray-50/50">
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Receipt Ref
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Farmer Beneficiary
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Fuel Station
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Fuel Type
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Quantity
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Total (ETB)
                </th>
                <th className="p-3 text-[10px] font-bold text-gov-muted uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="p-3 font-semibold text-gov-ink font-mono">{tx.receiptNumber}</td>
                  <td className="p-3 text-gov-muted">{new Date(tx.transactionDate).toLocaleString()}</td>
                  <td className="p-3">
                    <div className="font-semibold text-gov-ink">{tx.farmer?.fullName}</div>
                    <div className="text-[10px] text-gov-muted">{tx.farmer?.farmerCode}</div>
                  </td>
                  <td className="p-3 text-gov-muted">{tx.fuelStation?.name}</td>
                  <td className="p-3 font-medium">{tx.fuelType?.name}</td>
                  <td className="p-3 font-bold text-gov-blue">{tx.quantityLiters} L</td>
                  <td className="p-3 font-semibold text-gov-ink">{Number(tx.totalAmount).toLocaleString()} ETB</td>
                  <td className="p-3">
                    <StatusBadge status="RECORDED" />
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gov-muted text-xs">
                    No transactions recorded yet.
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
