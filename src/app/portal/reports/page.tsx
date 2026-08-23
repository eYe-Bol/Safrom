'use client';

import { Topbar } from '@/components/Topbar';
import { StatCard } from '@/components/StatCard';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useStore } from '@/context/StoreContext';
import { fmt, downloadCSV } from '@/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

type SaleRow = {
  id: string;
  units_sold: number;
  revenue: number;
  created_at: string;
  inventory: { name: string; category: string; cost_price: number; sell_price: number } | null;
};

type ProductStat = {
  name: string;
  cat: string;
  units: number;
  revenue: number;
  cost_price: number;
  sell_price: number;
  hasCost: boolean;
  totalCost: number;
  totalProfit: number | null;
  marginPct: number | null;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const defaultFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const defaultTo = new Date().toISOString().split('T')[0];

export default function ReportsPage() {
  const { storeId, branchName } = useStore();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [catF, setCatF] = useState('All');
  const [prodF, setProdF] = useState('All');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('month');
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);

  const applyPreset = (preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom') => {
    setDatePreset(preset);
    const todayStr = new Date().toISOString().split('T')[0];
    if (preset === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === 'week') {
      const w = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateFrom(w);
      setDateTo(todayStr);
    } else if (preset === 'month') {
      const m = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      setDateFrom(m);
      setDateTo(todayStr);
    }
  };

  const fetchData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const supabase = createClient();

    const toEnd = dateTo + 'T23:59:59';
    const curBranch = branchName || 'Main Branch';

    const { data: salesData } = await supabase
      .from('sales')
      .select('id, units_sold, revenue, created_at, inventory(name, category, cost_price, sell_price)')
      .eq('user_id', storeId)
      .eq('branch_name', curBranch)
      .gte('created_at', dateFrom + 'T00:00:00')
      .lte('created_at', toEnd)
      .order('created_at', { ascending: false });

    if (salesData) setSales(salesData as unknown as SaleRow[]);
    setLoading(false);
  }, [dateFrom, dateTo, storeId, branchName]);

  useEffect(() => { fetchData(); }, [storeId, branchName, fetchData]);

  // ─── Filter Categories & Products ──────────────────────────────────────────

  const allCategories = ['All', ...Array.from(new Set(sales.map(s => s.inventory?.category || 'General')))];
  
  // Available products matching category filter
  const categorySales = sales.filter(s => catF === 'All' || (s.inventory?.category || 'General') === catF);
  const allProducts = ['All', ...Array.from(new Set(categorySales.map(s => s.inventory?.name || 'Unknown')))];

  // Final filtered sales
  const filteredSales = categorySales.filter(s => prodF === 'All' || (s.inventory?.name || 'Unknown') === prodF);

  // ─── Individual Product Calculation ────────────────────────────────────────

  const productMap: Record<string, ProductStat> = {};

  filteredSales.forEach(r => {
    const name = r.inventory?.name || 'Unknown';
    const costPrice = Number(r.inventory?.cost_price || 0);
    const sellPrice = Number(r.inventory?.sell_price || 0);
    const hasCost = costPrice > 0;

    if (!productMap[name]) {
      productMap[name] = {
        name,
        cat: r.inventory?.category || 'General',
        units: 0,
        revenue: 0,
        cost_price: costPrice,
        sell_price: sellPrice,
        hasCost,
        totalCost: 0,
        totalProfit: null,
        marginPct: null,
      };
    }
    
    const rev = Number(r.revenue);
    productMap[name].revenue += rev;
    productMap[name].units += r.units_sold;
    if (hasCost) {
      productMap[name].totalCost += r.units_sold * costPrice;
    }
  });

  // Calculate profits & margins for each product individually
  const productList: ProductStat[] = Object.values(productMap).map(p => {
    if (p.hasCost) {
      const profit = p.revenue - p.totalCost;
      const margin = p.revenue > 0 ? Math.round((profit / p.revenue) * 100) : 0;
      return { ...p, totalProfit: profit, marginPct: margin };
    }
    return { ...p, totalProfit: null, marginPct: null };
  }).sort((a, b) => b.revenue - a.revenue);

  // ─── Summary Metrics (Revenue, Cost, Profit only) ──────────────────────────

  const totalRevenue = filteredSales.reduce((s, r) => s + Number(r.revenue), 0);
  
  // Total Cost is sum of costs for products that have a cost price filled
  const totalCost = productList.filter(p => p.hasCost).reduce((s, p) => s + p.totalCost, 0);
  
  // Total Profit is sum of profits for products that have a cost price filled
  const totalProfit = productList.filter(p => p.hasCost && p.totalProfit !== null).reduce((s, p) => s + (p.totalProfit || 0), 0);
  
  const revenueWithCost = productList.filter(p => p.hasCost).reduce((s, p) => s + p.revenue, 0);
  const overallMargin = revenueWithCost > 0 ? Math.round((totalProfit / revenueWithCost) * 100) : null;
  const productsWithoutCostCount = productList.filter(p => !p.hasCost).length;

  // Chart data grouping by day: Revenue, Cost, Profit
  const dayMap: Record<string, { day: string; revenue: number; cost: number; profit: number }> = {};
  filteredSales.forEach(r => {
    const day = r.created_at.slice(0, 10);
    if (!dayMap[day]) dayMap[day] = { day, revenue: 0, cost: 0, profit: 0 };
    const rev = Number(r.revenue);
    const cp = Number(r.inventory?.cost_price || 0);
    dayMap[day].revenue += rev;
    if (cp > 0) {
      const itemCost = r.units_sold * cp;
      dayMap[day].cost += itemCost;
      dayMap[day].profit += rev - itemCost;
    }
  });
  const chartData = Object.values(dayMap).sort((a, b) => a.day.localeCompare(b.day));

  // ─── CSV Export ──────────────────────────────────────────────────────────────

  const handleExportSalesCSV = () => {
    const rows = productList.map(r => ({
      Product: r.name,
      Category: r.cat,
      Sell_Price: r.sell_price || '',
      Cost_Price: r.cost_price > 0 ? r.cost_price : 'Not set',
      Total_Revenue: r.revenue,
      Total_Cost: r.hasCost ? r.totalCost : 'Not set',
      Total_Profit: r.hasCost && r.totalProfit !== null ? r.totalProfit : 'N/A (Cost missing)',
      Margin_Pct: r.marginPct !== null ? `${r.marginPct}%` : 'N/A',
    }));
    downloadCSV(rows, `sales_by_product_${dateFrom}_to_${dateTo}.csv`);
  };

  return (
    <div className="flex flex-col min-h-dvh pb-10 w-full">
      <Topbar title="Reports" sub="Sales, Cost & Individual Product Profitability" />

      <div className="p-3 sm:p-5 max-w-[1200px] mx-auto w-full flex flex-col gap-4 sm:gap-5">

        {/* ─── FILTERS BAR ─── */}
        <div className="bg-white rounded-2xl p-4 border border-[var(--color-line-lt)] shadow-sm flex flex-col gap-3">
          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-bold text-[var(--color-slate)] uppercase tracking-wider mr-1">Period:</span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'Last 30 Days' },
              { id: 'custom', label: 'Custom' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-3 py-1 rounded-lg text-[12px] font-bold transition-all cursor-pointer ${
                  datePreset === p.id 
                    ? 'bg-[var(--color-teal)] text-white shadow-sm' 
                    : 'bg-[var(--color-canvas)] text-[var(--color-slate)] hover:bg-[var(--color-line-lt)]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Detailed Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end pt-2 border-t border-[var(--color-line-lt)]">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">Category</label>
              <select
                value={catF}
                onChange={e => { setCatF(e.target.value); setProdF('All'); }}
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none bg-white font-medium focus:border-[var(--color-teal)] cursor-pointer"
              >
                {allCategories.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
              </select>
            </div>

            {/* Individual Product Filter */}
            <div>
              <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">Product</label>
              <select
                value={prodF}
                onChange={e => setProdF(e.target.value)}
                className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none bg-white font-medium focus:border-[var(--color-teal)] cursor-pointer"
              >
                {allProducts.map(p => <option key={p} value={p}>{p === 'All' ? 'All Products' : p}</option>)}
              </select>
            </div>

            {/* Date Range Start / End */}
            <div className="sm:col-span-2 flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setDatePreset('custom'); }}
                  className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none font-medium text-[var(--color-ink)] focus:border-[var(--color-teal)]"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[11px] font-bold text-[var(--color-slate)] uppercase tracking-wider mb-1">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setDatePreset('custom'); }}
                  className="w-full px-3 py-2 border-[1.5px] border-[var(--color-line)] rounded-xl text-[13px] outline-none font-medium text-[var(--color-ink)] focus:border-[var(--color-teal)]"
                />
              </div>
              <button
                onClick={fetchData}
                className="px-4 py-2 bg-[var(--color-teal)] text-white border-none rounded-xl font-bold text-[13px] cursor-pointer hover:opacity-90 whitespace-nowrap self-end h-[38px] shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* ─── SUMMARY KPI CARDS (REVENUE, COST, PROFIT ONLY) ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <StatCard
            label="Total Revenue"
            value={fmt(totalRevenue)}
            sub={`${productList.length} products sold in period`}
            accent="var(--color-teal)"
          />
          <StatCard
            label="Total Cost"
            value={fmt(totalCost)}
            sub={productsWithoutCostCount > 0 ? `Calculated from ${productList.length - productsWithoutCostCount} products with cost` : 'Total cost of goods sold'}
            accent="var(--color-gold)"
          />
          <StatCard
            label="Total Profit"
            value={fmt(totalProfit)}
            sub={overallMargin !== null ? `${overallMargin}% overall gross margin` : 'Gross profits earned'}
            accent="var(--color-emerald)"
          />
        </div>

        {/* Notice for products without cost price */}
        {productsWithoutCostCount > 0 && (
          <div className="bg-[var(--color-amber-bg)]/60 border border-[var(--color-amber)]/30 rounded-xl px-4 py-3 text-[12px] text-[var(--color-amber)] font-semibold flex items-center justify-between flex-wrap gap-2">
            <span>
              ℹ️ <strong>{productsWithoutCostCount} product{productsWithoutCostCount !== 1 ? 's' : ''}</strong> do not have a cost price set. Their revenue is included, while items with cost prices display individual profits below.
            </span>
            <span className="text-[11px] text-[var(--color-slate)]">Update cost prices in Catalogue anytime.</span>
          </div>
        )}

        {/* ─── REVENUE VS COST VS PROFIT CHART ─── */}
        <div className="bg-white rounded-2xl p-5 pb-3 border border-[var(--color-line-lt)] shadow-sm">
          <div className="font-serif text-[15px] font-bold text-[var(--color-ink)] mb-4">
            Revenue · Cost · Profit Trends
          </div>
          <div className="h-[220px] w-full">
            {loading ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">Loading trends...</div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-[var(--color-muted)]">No sales recorded for this timeframe.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line-lt)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} dy={10}
                    tickFormatter={v => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => `${Number(v) / 1000}k`} />
                  <Tooltip
                    formatter={(val, name) => [fmt(Number(val)), String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                    labelFormatter={label => new Date(label as string).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: '1px solid var(--color-line)' }}
                    itemStyle={{ fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--color-teal)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="cost" stroke="var(--color-gold)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="profit" stroke="var(--color-emerald)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex gap-4 mt-3 text-[12px] font-semibold text-[var(--color-slate)] justify-center">
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-teal)]" /> Total Revenue</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 border-t-2 border-dashed border-[var(--color-gold)]" /> Total Cost</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 bg-[var(--color-emerald)]" /> Total Profit</div>
          </div>
        </div>

        {/* ─── SALES BY PRODUCT (INDIVIDUAL PROFITABILITY) ─── */}
        <div className="bg-white rounded-2xl border border-[var(--color-line-lt)] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-[var(--color-line-lt)] flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="font-serif text-[16px] font-bold text-[var(--color-ink)]">Sales By Product</h2>
              <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                {productList.length} product{productList.length !== 1 ? 's' : ''} listed · Individual cost and profit breakdowns
              </div>
            </div>
            <button
              onClick={handleExportSalesCSV}
              disabled={productList.length === 0}
              className="px-3.5 py-1.5 bg-[var(--color-canvas)] text-[var(--color-slate)] border border-[var(--color-line)] rounded-lg font-bold text-[12px] cursor-pointer hover:bg-white disabled:opacity-50"
            >
              ⬇ Export CSV
            </button>
          </div>

          {/* ─── MOBILE CARD VIEW (< md) ─── */}
          <div className="block md:hidden divide-y divide-[var(--color-line-lt)] max-h-[70vh] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-[13px] text-[var(--color-muted)]">Loading products...</div>
            ) : productList.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[var(--color-muted)]">No sales recorded for this selection.</div>
            ) : productList.map(r => {
              const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={r.name} className="p-4 flex flex-col gap-2.5 bg-white hover:bg-[var(--color-canvas)] transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="font-semibold text-[14px] text-[var(--color-ink)]">{r.name}</div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">{r.cat}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-serif text-[15px] font-bold text-[var(--color-teal)]">{fmt(r.revenue)}</div>
                      <div className="text-[10px] text-[var(--color-muted)]">Revenue</div>
                    </div>
                  </div>

                  {/* Financial Details Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-[var(--color-canvas)] p-2.5 rounded-xl border border-[var(--color-line-lt)] text-center">
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Cost Price</div>
                      <div className="font-semibold text-[12px] text-[var(--color-slate)] mt-0.5">
                        {r.hasCost ? fmt(r.cost_price) : <span className="text-[11px] text-gray-400 italic">Not set</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Total Profit</div>
                      <div className="font-bold text-[13px] text-[var(--color-emerald)] mt-0.5">
                        {r.hasCost && r.totalProfit !== null ? fmt(r.totalProfit) : <span className="text-[11px] text-gray-400 italic">—</span>}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase text-[var(--color-muted)]">Margin</div>
                      <div className="mt-0.5">
                        {r.marginPct !== null ? (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${r.marginPct >= 30 ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' : r.marginPct >= 15 ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]' : 'bg-[var(--color-red-bg)] text-[var(--color-red)]'}`}>
                            {r.marginPct}%
                          </span>
                        ) : <span className="text-[11px] text-gray-400 italic">—</span>}
                      </div>
                    </div>
                  </div>

                  {/* Revenue Share Bar */}
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[11px] text-[var(--color-muted)] shrink-0">Rev Share:</span>
                    <div className="flex-1 h-1.5 bg-[var(--color-line-lt)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--color-teal)] rounded-full" style={{ width: `${share}%` }} />
                    </div>
                    <span className="text-[11px] font-bold text-[var(--color-slate)] shrink-0">{share.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ─── DESKTOP DATA TABLE (md+) ─── */}
          <div className="hidden md:block overflow-auto max-h-[70vh]">
            <table className="w-full border-collapse" style={{ minWidth: 700 }}>
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--color-line-lt)]">
                <tr className="bg-[var(--color-canvas)]">
                  {['Product', 'Category', 'Sell Price', 'Cost Price', 'Total Revenue', 'Total Cost', 'Total Profit', 'Margin', 'Share'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-left text-[10px] font-bold text-[var(--color-muted)] uppercase tracking-[0.07em] whitespace-nowrap ${i === 0 ? 'sticky left-0 z-20 bg-[var(--color-canvas)] shadow-[1px_0_0_var(--color-line-lt)]' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="p-5 text-center text-[13px] text-[var(--color-muted)]">Loading products...</td></tr>
                ) : productList.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-[13px] text-[var(--color-muted)]">No sales found matching current filters.</td></tr>
                ) : productList.map(r => {
                  const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
                  return (
                    <tr key={r.name} className="border-b border-[var(--color-line-lt)] last:border-0 hover:bg-[#fafafa] transition-colors group">
                      <td className="px-4 py-3 sticky left-0 z-10 bg-white shadow-[1px_0_0_var(--color-line-lt)] group-hover:bg-[#fafafa] transition-colors">
                        <div className="font-bold text-[13px] text-[var(--color-ink)]">{r.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--color-canvas)] text-[var(--color-slate)] px-2 py-1 rounded-full">{r.cat}</span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[var(--color-slate)]">{r.sell_price > 0 ? fmt(r.sell_price) : '—'}</td>
                      <td className="px-4 py-3 text-[13px] text-[var(--color-slate)]">
                        {r.hasCost ? fmt(r.cost_price) : <span className="text-[11px] text-gray-400 italic">Not set</span>}
                      </td>
                      <td className="px-4 py-3 font-serif text-[14px] font-bold text-[var(--color-ink)]">{fmt(r.revenue)}</td>
                      <td className="px-4 py-3 text-[13px] text-[var(--color-slate)]">
                        {r.hasCost ? fmt(r.totalCost) : <span className="text-[11px] text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[13px]">
                        {r.hasCost && r.totalProfit !== null ? (
                          <span className="text-[var(--color-emerald)] font-bold">{fmt(r.totalProfit)}</span>
                        ) : (
                          <span className="text-[11px] text-gray-400 italic">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.marginPct !== null ? (
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${r.marginPct >= 30 ? 'bg-[var(--color-emerald-bg)] text-[var(--color-emerald)]' : r.marginPct >= 15 ? 'bg-[var(--color-amber-bg)] text-[var(--color-amber)]' : 'bg-[var(--color-red-bg)] text-[var(--color-red)]'}`}>
                            {r.marginPct}%
                          </span>
                        ) : <span className="text-[11px] text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-[50px] h-1.5 bg-[var(--color-line-lt)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--color-teal)] rounded-full" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-[11px] font-semibold text-[var(--color-slate)]">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
