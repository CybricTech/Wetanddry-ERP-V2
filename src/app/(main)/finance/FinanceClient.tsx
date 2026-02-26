'use client'

import React, { useState, useEffect, useTransition } from 'react';
import {
    Wallet, TrendingUp, TrendingDown, Package, Fuel, Wrench, Download,
    RefreshCw, Loader2, BarChart3, PieChart, ArrowDownRight, ArrowUpRight,
    Building, Truck, Calendar, FileText, AlertTriangle, CheckCircle2,
    Receipt, MapPin, Factory, Users, Building2, DollarSign, Clock,
    AlertCircle, Plus, X
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

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

interface Expense {
    id: string
    category: string
    description: string
    amount: number
    date: Date
    invoiceNumber: string | null
    status: string
    recordedBy: string
    approvedBy: string | null
    client: { id: string; code: string; name: string } | null
    truck: { id: string; plateNumber: string } | null
}

// ==================== MAIN COMPONENT ====================

export default function FinanceClient({ currentUser, userRole }: { currentUser: string; userRole: string }) {
    const [loading, setLoading] = useState(true);
    const [activeView, setActiveView] = useState<'overview' | 'inventory' | 'fuel' | 'maintenance' | 'expenses'>('overview');
    const [fuelPeriod, setFuelPeriod] = useState<'7days' | '30days' | '90days'>('30days');
    const [maintenancePeriod, setMaintenancePeriod] = useState<'30days' | '90days' | 'year'>('30days');
    const [isExporting, setIsExporting] = useState(false);

    // Data states
    const [financials, setFinancials] = useState<{ summary: FinanceSummary; recentTransactions: RecentTransaction[] } | null>(null);
    const [inventoryData, setInventoryData] = useState<any>(null);
    const [fuelData, setFuelData] = useState<any>(null);
    const [maintenanceData, setMaintenanceData] = useState<any>(null);

    // Expenses state
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [expenseFilter, setExpenseFilter] = useState({ category: 'all', status: 'all' });
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [trucks, setTrucks] = useState<{ id: string; plateNumber: string }[]>([]);
    const [clientsForSelect, setClientsForSelect] = useState<{ id: string; code: string; name: string }[]>([]);

    const canManageExpenses = userRole ? ['Super Admin', 'Manager', 'Accountant'].includes(userRole) : false;
    const canApproveExpenses = userRole ? ['Super Admin', 'Manager'].includes(userRole) : false;

    useEffect(() => {
        loadData();
    }, [activeView, fuelPeriod, maintenancePeriod]);

    useEffect(() => {
        if (activeView === 'expenses') {
            loadExpenses();
        }
    }, [expenseFilter]);

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
            } else if (activeView === 'expenses') {
                await loadExpenses();
                await loadTrucksAndClients();
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
                            <title>Wetanddry Finance Report</title>
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
                            <h1>🏢 Wetanddry Ltd - Financial Report</h1>
                            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                            <p><strong>Generated By:</strong> ${currentUser}</p>
                            
                            <h2>📊 Financial Summary (Last 30 Days)</h2>
                            <div class="summary-grid">
                                <div class="summary-card">
                                    <div class="summary-value">${formatCurrency(financials?.summary.totalInventoryValue ?? 0)}</div>
                                    <div class="summary-label">Total Inventory Value</div>
                                </div>
                                <div class="summary-card">
                                    <div class="summary-value">${formatCurrency(financials?.summary.fuelCostLast30Days ?? 0)}</div>
                                    <div class="summary-label">Fuel Costs (30 Days)</div>
                                </div>
                                <div class="summary-card">
                                    <div class="summary-value">${formatCurrency(financials?.summary.maintenanceCostLast30Days ?? 0)}</div>
                                    <div class="summary-label">Maintenance Costs (30 Days)</div>
                                </div>
                            </div>
                            
                            <h2>📦 Stock Movements</h2>
                            <table>
                                <tr><th>Metric</th><th>Value</th></tr>
                                <tr><td>Stock In Value</td><td>${formatCurrency(financials?.summary.stockInValueLast30Days ?? 0)}</td></tr>
                                <tr><td>Stock Out Value</td><td>${formatCurrency(financials?.summary.stockOutValueLast30Days ?? 0)}</td></tr>
                                <tr><td>Net Movement</td><td>${formatCurrency(financials?.summary.netStockValueLast30Days ?? 0)}</td></tr>
                            </table>
                            
                            <p style="margin-top: 50px; text-align: center; color: #666;">
                                This report was generated by Cybric's ERP System for Wetanddry
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

    async function loadExpenses() {
        try {
            const { getExpenses } = await import('@/lib/actions/crm');
            const data = await getExpenses(expenseFilter);
            setExpenses(data as Expense[]);
        } catch (error) {
            console.error('Failed to load expenses:', error);
        }
    }

    async function loadTrucksAndClients() {
        try {
            const [{ getTrucks }, { getClientsForSelect }] = await Promise.all([
                import('@/lib/actions/trucks'),
                import('@/lib/actions/crm'),
            ]);
            const [trucksData, clientsData] = await Promise.all([getTrucks(), getClientsForSelect()]);
            setTrucks(trucksData.map((t: any) => ({ id: t.id, plateNumber: t.plateNumber })));
            setClientsForSelect(clientsData);
        } catch (error) {
            console.error('Failed to load trucks/clients:', error);
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Finance & Reports</h1>
                    <p className="text-gray-500 mt-1">Company-wide financial overview and analytics</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    {canManageExpenses && (
                        <button
                            onClick={() => setShowExpenseModal(true)}
                            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium flex items-center gap-2 transition-all shadow-sm"
                        >
                            <Plus size={16} />
                            Record Expense
                        </button>
                    )}
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
                <div className="flex gap-1 flex-wrap">
                    {[
                        { id: 'overview', label: 'Overview', icon: <BarChart3 size={18} /> },
                        { id: 'inventory', label: 'Inventory', icon: <Package size={18} /> },
                        { id: 'fuel', label: 'Fuel/Diesel', icon: <Fuel size={18} /> },
                        { id: 'maintenance', label: 'Maintenance', icon: <Wrench size={18} /> },
                        { id: 'expenses', label: 'Expenses', icon: <Receipt size={18} /> },
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

                    {/* Expenses View */}
                    {activeView === 'expenses' && (
                        <ExpensesView
                            expenses={expenses}
                            filter={expenseFilter}
                            setFilter={setExpenseFilter}
                            loading={false}
                            canApprove={canApproveExpenses}
                            onApprove={async (id) => {
                                const { approveExpense } = await import('@/lib/actions/crm');
                                const result = await approveExpense(id);
                                if (result.success) loadExpenses();
                                return result;
                            }}
                        />
                    )}
                </>
            )}

            {/* Record Expense Modal */}
            {showExpenseModal && (
                <ExpenseModal
                    clients={clientsForSelect}
                    trucks={trucks}
                    onClose={() => setShowExpenseModal(false)}
                    onSuccess={() => {
                        setShowExpenseModal(false);
                        loadExpenses();
                    }}
                />
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
                    value={formatCurrency(summary.totalInventoryValue)}
                    icon={<Package size={20} />}
                    color="blue"
                    subtitle={`${summary.inventoryItemCount} items`}
                    highlight
                />
                <SummaryCard
                    title="Fuel Costs (30 Days)"
                    value={formatCurrency(summary.fuelCostLast30Days)}
                    icon={<Fuel size={20} />}
                    color="amber"
                    subtitle={`${summary.fuelLitersLast30Days.toLocaleString()} liters`}
                />
                <SummaryCard
                    title="Maintenance (30 Days)"
                    value={formatCurrency(summary.maintenanceCostLast30Days)}
                    icon={<Wrench size={20} />}
                    color="purple"
                    subtitle={`${summary.maintenanceRecordCount} records`}
                />
                <SummaryCard
                    title="Net Stock Movement"
                    value={formatCurrency(Math.abs(summary.netStockValueLast30Days))}
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
                            <div className="text-xl font-bold text-emerald-600">{formatCurrency(summary.stockInValueLast30Days)}</div>
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
                            <div className="text-xl font-bold text-blue-600">{formatCurrency(summary.stockOutValueLast30Days)}</div>
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
                                            {t.totalCost ? formatCurrency(t.totalCost) : '—'}
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
                        <p className="text-sm text-gray-500 mt-1">Total: {formatCurrency(totalValue)}</p>
                    </div>
                    <div className="p-6 space-y-4">
                        {data.byCategory?.map((cat: any, idx: number) => (
                            <div key={cat.name}>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-gray-900">{cat.name}</span>
                                    <div className="text-right">
                                        <span className="font-bold text-gray-900">{formatCurrency(cat.value)}</span>
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
                                    <div className="font-bold text-gray-900">{formatCurrency(loc.value)}</div>
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
                                    <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(item.unitCost)}</td>
                                    <td className="px-6 py-4 text-right font-bold text-blue-600">{formatCurrency(item.totalValue)}</td>
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
                    value={formatCurrency(data.summary.totalCost)}
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
                    value={formatCurrency(data.summary.avgCostPerLiter)}
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
                                        title={formatCurrency(day.cost)}
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
                                    <div className="font-bold text-gray-900">{formatCurrency(truck.cost)}</div>
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
                    value={formatCurrency(data.summary.totalCost)}
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
                    value={formatCurrency(data.summary.avgCostPerRecord)}
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
                                    <div className="font-bold text-gray-900">{formatCurrency(truck.cost)}</div>
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
                                    <div className="font-bold text-gray-900">{formatCurrency(type.cost)}</div>
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

// ==================== EXPENSES VIEW ====================

function ExpensesView({
    expenses,
    filter,
    setFilter,
    loading,
    canApprove,
    onApprove
}: {
    expenses: Expense[]
    filter: { category: string; status: string }
    setFilter: (f: typeof filter) => void
    loading: boolean
    canApprove: boolean
    onApprove: (id: string) => Promise<{ success: boolean; message?: string }>
}) {
    const [approving, setApproving] = useState<string | null>(null)

    const categoryIcons: Record<string, React.ReactNode> = {
        Transport: <MapPin size={16} />,
        Materials: <Factory size={16} />,
        Labor: <Users size={16} />,
        Equipment: <Building2 size={16} />,
        Maintenance: <Receipt size={16} />,
        Administrative: <FileText size={16} />,
        Other: <DollarSign size={16} />
    }

    const categoryColors: Record<string, string> = {
        Transport: 'bg-blue-100 text-blue-600',
        Materials: 'bg-amber-100 text-amber-600',
        Labor: 'bg-green-100 text-green-600',
        Equipment: 'bg-purple-100 text-purple-600',
        Maintenance: 'bg-orange-100 text-orange-600',
        Administrative: 'bg-gray-100 text-gray-600',
        Other: 'bg-slate-100 text-slate-600'
    }

    const handleApprove = async (id: string) => {
        setApproving(id)
        await onApprove(id)
        setApproving(null)
    }

    const totalApproved = expenses.filter(e => e.status === 'Approved').reduce((sum, e) => sum + e.amount, 0)
    const totalPending = expenses.filter(e => e.status === 'Pending').reduce((sum, e) => sum + e.amount, 0)

    return (
        <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
                        <Receipt size={22} className="text-violet-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Total Expenses</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(expenses.reduce((s, e) => s + e.amount, 0))}</p>
                        <p className="text-xs text-gray-400">{expenses.length} records</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <CheckCircle2 size={22} className="text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Approved</p>
                        <p className="text-xl font-bold text-green-700">{formatCurrency(totalApproved)}</p>
                        <p className="text-xs text-gray-400">{expenses.filter(e => e.status === 'Approved').length} records</p>
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Clock size={22} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Pending Approval</p>
                        <p className="text-xl font-bold text-amber-700">{formatCurrency(totalPending)}</p>
                        <p className="text-xs text-gray-400">{expenses.filter(e => e.status === 'Pending').length} records</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={filter.category}
                    onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                    <option value="all">All Categories</option>
                    <option value="Transport">Transport</option>
                    <option value="Materials">Materials</option>
                    <option value="Labor">Labor</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Administrative">Administrative</option>
                    <option value="Other">Other</option>
                </select>
                <select
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                >
                    <option value="all">All Status</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>

            {/* Expenses List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            ) : expenses.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No expenses found</h3>
                    <p className="text-gray-500 mt-1">Use the "Record Expense" button above to get started.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {expenses.map(expense => (
                                    <tr key={expense.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={cn(
                                                    "p-2 rounded-lg",
                                                    categoryColors[expense.category] || categoryColors.Other
                                                )}>
                                                    {categoryIcons[expense.category] || categoryIcons.Other}
                                                </div>
                                                <span className="font-medium text-gray-900">{expense.category}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-gray-900 line-clamp-1">{expense.description}</p>
                                            {expense.invoiceNumber && (
                                                <p className="text-xs text-gray-500">Inv: {expense.invoiceNumber}</p>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            {expense.client ? (
                                                <div>
                                                    <p className="text-gray-900 font-medium">{expense.client.name}</p>
                                                    <p className="text-xs text-gray-500">{expense.client.code}</p>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic">General</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-gray-600">
                                                {new Date(expense.date).toLocaleDateString('en-NG', {
                                                    day: 'numeric', month: 'short', year: 'numeric'
                                                })}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={cn(
                                                "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
                                                expense.status === 'Approved' && "bg-green-100 text-green-700",
                                                expense.status === 'Pending' && "bg-amber-100 text-amber-700",
                                                expense.status === 'Rejected' && "bg-red-100 text-red-700"
                                            )}>
                                                {expense.status === 'Approved' && <CheckCircle2 size={12} />}
                                                {expense.status === 'Pending' && <Clock size={12} />}
                                                {expense.status === 'Rejected' && <AlertCircle size={12} />}
                                                {expense.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            {expense.status === 'Pending' && canApprove && (
                                                <button
                                                    onClick={() => handleApprove(expense.id)}
                                                    disabled={approving === expense.id}
                                                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                                >
                                                    {approving === expense.id ? (
                                                        <Loader2 size={14} className="animate-spin" />
                                                    ) : 'Approve'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

// ==================== EXPENSE MODAL ====================

function ExpenseModal({
    clients,
    trucks,
    onClose,
    onSuccess
}: {
    clients: { id: string; code: string; name: string }[]
    trucks: { id: string; plateNumber: string }[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const [category, setCategory] = useState('')

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        startTransition(async () => {
            const { createExpense } = await import('@/lib/actions/crm')
            const result = await createExpense(formData)
            if (result.success) {
                onSuccess()
            } else {
                setError(result.message)
            }
        })
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Record Expense</h2>
                        <p className="text-sm text-gray-500">Log a new business expense</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form id="expense-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                        <select
                            name="category"
                            required
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">Select category...</option>
                            <option value="Transport">Transport</option>
                            <option value="Materials">Materials</option>
                            <option value="Labor">Labor</option>
                            <option value="Equipment">Equipment</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="Administrative">Administrative</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                        <input
                            type="text"
                            name="description"
                            required
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Brief description of the expense"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₦) *</label>
                            <input
                                type="number"
                                name="amount"
                                required
                                min={1}
                                step={0.01}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                            <input
                                type="date"
                                name="date"
                                defaultValue={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Invoice/Receipt Number</label>
                        <input
                            type="text"
                            name="invoiceNumber"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            placeholder="Optional"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client (if applicable)</label>
                        <select
                            name="clientId"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        >
                            <option value="">General expense (no client)</option>
                            {clients.map(client => (
                                <option key={client.id} value={client.id}>
                                    {client.code} - {client.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {category === 'Transport' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Truck</label>
                            <select
                                name="truckId"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            >
                                <option value="">Select truck...</option>
                                {trucks.map(truck => (
                                    <option key={truck.id} value={truck.id}>
                                        {truck.plateNumber}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            name="notes"
                            rows={2}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            placeholder="Additional notes..."
                        />
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="expense-form"
                        disabled={isPending}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isPending && <Loader2 size={16} className="animate-spin" />}
                        Record Expense
                    </button>
                </div>
            </div>
        </div>
    )
}
