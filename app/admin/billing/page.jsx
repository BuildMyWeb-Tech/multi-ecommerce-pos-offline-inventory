// app/admin/billing/page.jsx
// Admin view of all bills across all stores
'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  IndianRupee, RefreshCcw, Loader2, Search,
  Receipt, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';

export default function AdminBillingPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedBill, setExpandedBill] = useState(null);
  const [storeFilter, setStoreFilter] = useState('');
  const [stores, setStores] = useState([]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit: 30 });
      if (search) params.set('search', search);
      if (storeFilter) params.set('storeId', storeFilter);
      const res = await fetch(`/api/admin/billing?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load bills');
      setBills(data.bills || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, storeFilter]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  useEffect(() => {
    fetch('/api/admin/stores?limit=100')
      .then((r) => r.json())
      .then((d) => setStores(d.stores || []))
      .catch(() => {});
  }, []);

  const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;

  const PM_COLORS = {
    CASH: 'bg-green-100 text-green-700',
    CARD: 'bg-blue-100 text-blue-700',
    UPI: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-amber-500" size={24} />
            POS Billing Records
          </h1>
          <p className="text-slate-500 text-sm mt-1">{total} total bills across all stores</p>
        </div>
        <button onClick={fetchBills} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm">
          <RefreshCcw size={15} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search bill number…"
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
        <select
          value={storeFilter}
          onChange={(e) => { setStoreFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none"
        >
          <option value="">All Stores</option>
          {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-slate-400" size={28} /></div>
      ) : error ? (
        <div className="text-center py-12 text-red-500">{error}</div>
      ) : bills.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Receipt size={40} className="mx-auto mb-3 opacity-50" />
          <p>No billing records found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bills.map((bill) => (
            <div key={bill.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="font-mono font-semibold text-slate-800">{bill.billNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PM_COLORS[bill.paymentMode] || 'bg-slate-100 text-slate-600'}`}>
                    {bill.paymentMode}
                  </span>
                  {bill.store && <span className="text-sm text-slate-500">{bill.store.name}</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-800">{fmt(bill.total)}</span>
                  <span className="text-xs text-slate-400">{new Date(bill.createdAt).toLocaleString('en-IN')}</span>
                  {expandedBill === bill.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </button>

              {expandedBill === bill.id && (
                <div className="px-5 pb-4 border-t border-slate-100">
                  <table className="w-full text-sm mt-3">
                    <thead>
                      <tr className="text-left text-slate-500 text-xs">
                        <th className="pb-2 font-medium">Item</th>
                        <th className="pb-2 font-medium text-right">Qty</th>
                        <th className="pb-2 font-medium text-right">Price</th>
                        <th className="pb-2 font-medium text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(bill.items || []).map((item, i) => (
                        <tr key={i} className="text-slate-700">
                          <td className="py-1.5">{item.name}{item.size && <span className="text-slate-400 text-xs ml-1">({item.size})</span>}</td>
                          <td className="py-1.5 text-right">{item.quantity}</td>
                          <td className="py-1.5 text-right">{fmt(item.price)}</td>
                          <td className="py-1.5 text-right font-medium">{fmt(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-sm text-right space-y-1">
                    <div className="text-slate-500">Subtotal: <span className="text-slate-700">{fmt(bill.subtotal)}</span></div>
                    {bill.discount > 0 && <div className="text-slate-500">Discount: <span className="text-red-500">-{fmt(bill.discount)}</span></div>}
                    {bill.taxAmount > 0 && <div className="text-slate-500">Tax: <span className="text-slate-700">{fmt(bill.taxAmount)}</span></div>}
                    <div className="font-semibold text-slate-800">Total: {fmt(bill.total)}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50">Previous</button>
          <span className="px-4 py-2 text-sm text-slate-600">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
        </div>
      )}
    </div>
  );
}
