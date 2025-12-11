'use client'

import React, { useState, useEffect } from 'react';
import {
    Wallet, TrendingUp, TrendingDown, Package, Fuel, Wrench, Download,
    RefreshCw, Loader2, BarChart3, PieChart, ArrowDownRight, ArrowUpRight,
    Building, Truck, Calendar, FileText, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ==================== TYPE DEFINITIONS ====================

interface FinanceSummary {
    totalInventoryValue: number;
    inventoryItemCount: number;
    fuelCostLast30Days: number;
    fuelLitersLast30Days: number;
    maintenanceCostLast30Days: number;
    maintenanceRecordCount: number;
    sparePartsCount: number;
    productionRunsLast30Days: number;
    stockInValueLast30Days: number;
    stockOutValueLast30Days: number;
    netStockValueLast30Days: number;
}

interface RecentTransaction {
    id: string;
    type: string;
    itemName: string;
    location: string;
    quantity: number;
    unit: string;
    totalCost: number | null;
    supplierName: string | null;
    createdAt: Date;
}

// ==================== MAIN COMPONENT ====================

export default function FinanceClient({ currentUser }: { currentUser: string }) {
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'overview' | 'inventory' | 'fuel' | 'maintenance'>('overview');
    const [fuelPeriod, setFuelPeriod] = useState<'7days' | '30days' | '90days'>('30days');
    const [maintenancePeriod, setMaintenancePeriod] = useState<'30days' | '90days' | 'year'>('30days');
    const [isExporting, setIsExporting] = useState(false);

    // Data states
    const [financials, setFinancials] = useState<{ summary: FinanceSummary; recentTransactions: RecentTransaction[] } | null>(null);
    const [inventoryData, setInventoryData] = useState<any>(null);
    const [fuelData, setFuelData] = useState<any>(null);
    const [maintenanceData, setMaintenanceData] = useState<any>(null);

    useEffect(() => {
        loadData();
    }, [activeView, fuelPeriod, maintenancePeriod]);

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeView === 'overview') {
                const { getCompanyFinancials } = await import('@/lib/actions/finance');
                const data = await getCompanyFinancials();
                setFinancials(data);
            } else if (activeView === 'inventory') {
                const { getInventoryBreakdown } = await import('@/lib/actions/finance');
                const data = await getInventoryBreakdown();
                setInventoryData(data);
            } else if (activeView === 'fuel') {
                const { getFuelCostBreakdown } = await import('@/lib/actions/finance');
                const data = await getFuelCostBreakdown(fuelPeriod);
                setFuelData(data);
            } else if (activeView === 'maintenance') {
                const { getMaintenanceCostBreakdown } = await import('@/lib/actions/finance');
                const data = await getMaintenanceCostBreakdown(maintenancePeriod);
                setMaintenanceData(data);
            }
        } catch (error: any) {
            console.error('Failed to load finance data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: 'csv' | 'pdf') => {
        setIsExporting(true);
        try {
            const { exportFinanceReportCSV } = await import('@/lib/actions/finance');
            const content = await exportFinanceReportCSV();

            if (format === 'csv') {
                const blob = new Blob([content], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wet-n-dry-finance-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
            } else if (format === 'pdf') {
                // For PDF, we'll open print dialog with a formatted view
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(`
                        <html>
                        <head>
                            <title>Wet N Dry Finance Report</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 40px; }
                                h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; }
                                h2 { color: #1e3a8a; margin-top: 30px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                th { background-color: #1e40af; color: white; }
                                tr:nth-child(even) { background-color: #f9fafb; }
                                .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 20px 0; }
                                .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
                                .summary-value { font-size: 24px; font-weight: bold; color: #1e40af; }
                                .summary-label { color: #666; font-size: 12px; }
                                @media print { body { padding: 20px; } }
                            </style>
                        </head>
                        <body>
                            <h1>🏢 Wet N Dry Ltd - Financial Report</h1>
                            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>Generated By:</strong> ${currentUser}</p>
                            
                            <h2>📊 Financial Summary (Last 30 Days)</h2>
                            <div class="summary-grid">
                                <div class="summary-card">
                                    <div class="summary-value">₦${financials?.summary.totalInventoryValue.toLocaleString() || 0}</div>
                                    <div class="summary-label">Total Inventory Value</div>
                                </div>
                                <div class="summary-card">
                                    <div class="summary-value">₦${financials?.summary.fuelCostLast30Days.toLocaleString() || 0}</div>
                                    <div class="summary-label">Fuel Costs (30 Days)</div>
                                </div>
                                <div class="summary-card">
                                    <div class="summary-value">₦${financials?.summary.maintenanceCostLast30Days.toLocaleString() || 0}</div>
                                    <div class="summary-label">Maintenance Costs (30 Days)</div>
                                </div>
                            </div>
                            
                            <h2>📦 Stock Movements</h2>
                            <table>
                                <tr><th>Metric</th><th>Value</th></tr>
                                <tr><td>Stock In Value</td><td>₦${financials?.summary.stockInValueLast30Days.toLocaleString() || 0}</td></tr>
                                <tr><td>Stock Out Value</td><td>₦${financials?.summary.stockOutValueLast30Days.toLocaleString() || 0}</td></tr>
                                <tr><td>Net Movement</td><td>₦${financials?.summary.netStockValueLast30Days.toLocaleString() || 0}</td></tr>
                            </table>
                            
                            <p style="margin-top: 50px; text-align: center; color: #666;">
                                This report was generated by Wet N Dry ERP System
                            </p>
                        </body>
                        </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                }
            }
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Finance & Reports</h1>
                    <p className="text-gray-500 mt-1">Company-wide financial overview and analytics</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Export Buttons */}
                    <button
                        onClick={() => handleExport('csv')}
                        disabled={isExporting}
                        className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        <Download size={16} />
                        Export CSV
                    </button>
                    <button
                        onClick={() => handleExport('pdf')}
                        disabled={isExporting || !financials}
                        className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 font-medium shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {isExporting ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <FileText size={16} />
                        )}
                        Generate PDF Report
                    </button>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* View Toggle */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
                <div className="flex gap-1">
                    {[
                        { id: 'overview', label: 'Overview', icon: <BarChart3 size={18} /> },
                        { id: 'inventory', label: 'Inventory', icon: <Package size={18} /> },
                        { id: 'fuel', label: 'Fuel/Diesel', icon: <Fuel size={18} /> },
                        { id: 'maintenance', label: 'Maintenance', icon: <Wrench size={18} /> }
                    ].map(view => (
                        <button
                            key={view.id}
                            onClick={() => setActiveView(view.id as any)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
                                activeView === view.id
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            {view.icon}
                            {view.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loading State */}
            {loading ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <Loader2 size={40} className="mx-auto text-blue-500 animate-spin mb-4" />
                    <p className="text-gray-500">Loading financial data...</p>
                </div>
            ) : (
                <>
                    {/* Overview View */}
                    {activeView === 'overview' && financials && (
                        <OverviewView data={financials} />
                    )}

                    {/* Inventory View */}
                    {activeView === 'inventory' && inventoryData && (
                        <InventoryView data={inventoryData} />
                    )}

                    {/* Fuel View */}
                    {activeView === 'fuel' && fuelData && (
                        <FuelView data={fuelData} period={fuelPeriod} setPeriod={setFuelPeriod} />
                    )}

                    {/* Maintenance View */}
                    {activeView === 'maintenance' && maintenanceData && (
                        <MaintenanceView data={maintenanceData} period={maintenancePeriod} setPeriod={setMaintenancePeriod} />
                    )}
                </>
            )}
        </div>
    );
}

// ==================== OVERVIEW VIEW ====================

function OverviewView({ data }: { data: { summary: FinanceSummary; recentTransactions: RecentTransaction[] } }) {
    const { summary, recentTransactions } = data;

    return (
        <div className="space-y-6">
            {/* Main Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Inventory Value"
                    value={`₦${summary.totalInventoryValue.toLocaleString()}`}
                    icon={<Package size={20} />}
                    color="blue"
                    subtitle={`${summary.inventoryItemCount} items`}
                    highlight
                />
                <SummaryCard
                    title="Fuel Costs (30 Days)"
                    value={`₦${summary.fuelCostLast30Days.toLocaleString()}`}
                    icon={<Fuel size={20} />}
                    color="amber"
                    subtitle={`${summary.fuelLitersLast30Days.toLocaleString()} liters`}
                />
                <SummaryCard
                    title="Maintenance (30 Days)"
                    value={`₦${summary.maintenanceCostLast30Days.toLocaleString()}`}
                    icon={<Wrench size={20} />}
                    color="purple"
                    subtitle={`${summary.maintenanceRecordCount} records`}
                />
                <SummaryCard
                    title="Net Stock Movement"
                    value={`₦${Math.abs(summary.netStockValueLast30Days).toLocaleString()}`}
                    icon={summary.netStockValueLast30Days >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    color={summary.netStockValueLast30Days >= 0 ? "emerald" : "red"}
                    subtitle={summary.netStockValueLast30Days >= 0 ? "Positive" : "Negative"}
                />
            </div>

            {/* Stock In/Out Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <ArrowDownRight size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Stock In (30 Days)</div>
                            <div className="text-xl font-bold text-emerald-600">₦{summary.stockInValueLast30Days.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ArrowUpRight size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Stock Out (30 Days)</div>
                            <div className="text-xl font-bold text-blue-600">₦{summary.stockOutValueLast30Days.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <BarChart3 size={20} className="text-indigo-600" />
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Production Runs</div>
                            <div className="text-xl font-bold text-indigo-600">{summary.productionRunsLast30Days}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Recent Stock Transactions</h3>
                    <p className="text-sm text-gray-500 mt-1">Latest inventory movements with cost data</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Value</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {recentTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        No transactions with cost data in the last 30 days
                                    </td>
                                </tr>
                            ) : (
                                recentTransactions.map(t => (
                                    <tr key={t.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium",
                                                t.type === 'IN'
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : t.type === 'OUT'
                                                        ? "bg-blue-100 text-blue-700"
                                                        : "bg-gray-100 text-gray-700"
                                            )}>
                                                {t.type === 'IN' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                                                {t.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{t.itemName}</div>
                                            {t.supplierName && (
                                                <div className="text-xs text-gray-500">{t.supplierName}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{t.location}</td>
                                        <td className="px-6 py-4 text-right text-gray-900">{t.quantity} {t.unit}</td>
                                        <td className="px-6 py-4 text-right font-medium text-gray-900">
                                            {t.totalCost ? `₦${t.totalCost.toLocaleString()}` : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(t.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ==================== INVENTORY VIEW ====================

function InventoryView({ data }: { data: any }) {
    const totalValue = data.totalValue || 0;

    return (
        <div className="space-y-6">
            {/* Category Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Value by Category</h3>
                        <p className="text-sm text-gray-500 mt-1">Total: ₦{totalValue.toLocaleString()}</p>
                    </div>
                    <div className="p-6 space-y-4">
                        {data.byCategory?.map((cat: any, idx: number) => (
                            <div key={cat.name}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">{cat.name}</span>
                                    <div className="text-right">
                                        <span className="font-bold text-gray-900">₦{cat.value.toLocaleString()}</span>
                                        <span className="text-sm text-gray-500 ml-2">({cat.percentageOfTotal.toFixed(1)}%)</span>
                                    </div>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full",
                                            idx === 0 ? "bg-blue-500" :
                                                idx === 1 ? "bg-emerald-500" :
                                                    idx === 2 ? "bg-purple-500" :
                                                        idx === 3 ? "bg-amber-500" : "bg-gray-400"
                                        )}
                                        style={{ width: `${cat.percentageOfTotal}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Location Breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Value by Location</h3>
                    </div>
                    <div className="p-6 space-y-3">
                        {data.byLocation?.map((loc: any) => (
                            <div key={loc.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <Building size={18} className="text-gray-400" />
                                    <div>
                                        <div className="font-medium text-gray-900">{loc.name}</div>
                                        <div className="text-xs text-gray-500">{loc.count} items</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-gray-900">₦{loc.value.toLocaleString()}</div>
                                    <div className="text-xs text-gray-500">{loc.percentageOfTotal.toFixed(1)}%</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Top Items */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Top 10 Highest Value Items</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Quantity</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Unit Cost</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Total Value</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.topItems?.map((item: any, idx: number) => (
                                <tr key={item.id} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                            idx === 0 ? "bg-yellow-100 text-yellow-700" :
                                                idx === 1 ? "bg-gray-200 text-gray-700" :
                                                    idx === 2 ? "bg-amber-100 text-amber-700" :
                                                        "bg-gray-100 text-gray-600"
                                        )}>
                                            {idx + 1}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                                    <td className="px-6 py-4 text-gray-600">{item.category}</td>
                                    <td className="px-6 py-4 text-right text-gray-900">{item.quantity} {item.unit}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">₦{item.unitCost.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right font-bold text-blue-600">₦{item.totalValue.toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ==================== FUEL VIEW ====================

function FuelView({ data, period, setPeriod }: { data: any; period: string; setPeriod: (p: any) => void }) {
    const maxDailyValue = Math.max(...(data.dailyData?.map((d: any) => d.cost) || [1]), 1);

    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex justify-end">
                <div className="flex bg-gray-100 rounded-xl p-1">
                    {[
                        { value: '7days', label: '7 Days' },
                        { value: '30days', label: '30 Days' },
                        { value: '90days', label: '90 Days' }
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setPeriod(opt.value)}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                                period === opt.value
                                    ? "bg-white text-amber-700 shadow-sm"
                                    : "text-gray-600 hover:text-gray-900"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <SummaryCard
                    title="Total Fuel Cost"
                    value={`₦${data.summary.totalCost.toLocaleString()}`}
                    icon={<Fuel size={20} />}
                    color="amber"
                    highlight
                />
                <SummaryCard
                    title="Total Liters"
                    value={data.summary.totalLiters.toLocaleString()}
                    icon={<BarChart3 size={20} />}
                    color="blue"
                />
                <SummaryCard
                    title="Avg Cost/Liter"
                    value={`₦${data.summary.avgCostPerLiter.toFixed(2)}`}
                    icon={<TrendingUp size={20} />}
                    color="purple"
                />
                <SummaryCard
                    title="Refill Count"
                    value={data.summary.refillCount.toString()}
                    icon={<CheckCircle2 size={20} />}
                    color="emerald"
                />
            </div>

            {/* Daily Chart & By Truck */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Daily Chart */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Daily Fuel Cost</h3>
                    </div>
                    <div className="p-6">
                        <div className="flex items-end gap-2 h-40">
                            {data.dailyData?.map((day: any) => (
                                <div key={day.date} className="flex-1 flex flex-col items-center">
                                    <div
                                        className="w-full bg-amber-400 rounded-t-md transition-all"
                                        style={{ height: `${(day.cost / maxDailyValue) * 100}%`, minHeight: day.cost > 0 ? '4px' : '0' }}
                                        title={`₦${day.cost.toLocaleString()}`}
                                    />
                                    <div className="text-xs text-gray-500 mt-2">
                                        {new Date(day.date).toLocaleDateString('en-NG', { weekday: 'short' })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* By Truck */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Cost by Truck</h3>
                    </div>
                    <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                        {data.byTruck?.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No fuel data</p>
                        ) : (
                            data.byTruck?.map((truck: any, idx: number) => (
                                <div key={truck.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-sm font-bold text-amber-700">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{truck.name}</div>
                                            <div className="text-xs text-gray-505">{truck.refills} refills · {truck.liters.toFixed(0)}L</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-gray-900">₦{truck.cost.toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== MAINTENANCE VIEW ====================

function MaintenanceView({ data, period, setPeriod }: { data: any; period: string; setPeriod: (p: any) => void }) {
    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex justify-end">
                <div className="flex bg-gray-100 rounded-xl p-1">
                    {[
                        { value: '30days', label: '30 Days' },
                        { value: '90days', label: '90 Days' },
                        { value: 'year', label: '1 Year' }
                    ].map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setPeriod(opt.value)}
                            className={cn(
                                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                                period === opt.value
                                    ? "bg-white text-purple-700 shadow-sm"
                                    : "text-gray-600 hover:text-gray-900"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard
                    title="Total Maintenance Cost"
                    value={`₦${data.summary.totalCost.toLocaleString()}`}
                    icon={<Wrench size={20} />}
                    color="purple"
                    highlight
                />
                <SummaryCard
                    title="Record Count"
                    value={data.summary.recordCount.toString()}
                    icon={<BarChart3 size={20} />}
                    color="blue"
                />
                <SummaryCard
                    title="Avg Cost/Record"
                    value={`₦${data.summary.avgCostPerRecord.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    icon={<TrendingUp size={20} />}
                    color="amber"
                />
            </div>

            {/* By Truck & By Type */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By Truck */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Cost by Truck</h3>
                    </div>
                    <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                        {data.byTruck?.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No maintenance data</p>
                        ) : (
                            data.byTruck?.map((truck: any, idx: number) => (
                                <div key={truck.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-sm font-bold text-purple-700">
                                            {idx + 1}
                                        </div>
                                        <div>
                                            <div className="font-medium text-gray-900">{truck.name}</div>
                                            <div className="text-xs text-gray-500">{truck.count} records</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-gray-900">₦{truck.cost.toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* By Type */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Cost by Type</h3>
                    </div>
                    <div className="p-6 space-y-3 max-h-80 overflow-y-auto">
                        {data.byType?.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No maintenance data</p>
                        ) : (
                            data.byType?.map((type: any) => (
                                <div key={type.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                    <div>
                                        <div className="font-medium text-gray-900">{type.name}</div>
                                        <div className="text-xs text-gray-500">{type.count} records</div>
                                    </div>
                                    <div className="font-bold text-gray-900">₦{type.cost.toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==================== HELPER COMPONENTS ====================

function SummaryCard({ title, value, icon, color, subtitle, highlight }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    subtitle?: string;
    highlight?: boolean;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        purple: 'bg-purple-50 text-purple-600',
        amber: 'bg-amber-50 text-amber-600',
        red: 'bg-red-50 text-red-600',
        gray: 'bg-gray-50 text-gray-600'
    };

    return (
        <div className={cn(
            "bg-white rounded-2xl border shadow-sm p-5",
            highlight ? "border-blue-200" : "border-gray-100"
        )}>
            <div className="flex items-center gap-3 mb-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colorClasses[color])}>
                    {icon}
                </div>
                <span className="text-sm font-medium text-gray-500">{title}</span>
            </div>
            <div className={cn("text-2xl font-bold", highlight ? "text-blue-600" : "text-gray-900")}>
                {value}
            </div>
            {subtitle && (
                <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
            )}
        </div>
    );
}
