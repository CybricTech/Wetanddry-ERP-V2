'use client'

import React, { useState, useTransition, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { hasPermission, Permission } from '@/lib/permissions';
import { useLiveUpdates, formatRefreshTime } from '@/hooks/use-live-updates';
import { useRouter } from 'next/navigation';
import {
    Clock, CheckCircle2, XCircle, Search, Filter, ChevronDown, ArrowDownRight, ArrowUpRight,
    Package, FileText, History, Download, AlertCircle, Loader2, X, Eye, RefreshCw, Calendar, Radio
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

// ==================== TYPE DEFINITIONS ====================

export interface PendingApproval {
    id: string;
    type: 'stock_transaction' | 'inventory_item' | 'material_request';
    subType: string;
    itemName: string;
    itemId: string;
    location: string;
    quantity: number;
    unit: string;
    reason: string | null;
    supplierName: string | null;
    invoiceNumber: string | null;
    waybillNumber: string | null;
    atcNumber: string | null;
    batchNumber: string | null;
    totalCost: number | null;
    performedBy: string | null;
    createdAt: Date;
    priority: 'Low' | 'Normal' | 'High' | 'Urgent';
}

export interface StockTransaction {
    id: string;
    itemId: string;
    item: {
        id: string;
        name: string;
        unit: string;
        location: { id: string; name: string };
    };
    type: string; // 'IN' | 'OUT' | 'ADJUSTMENT'
    quantity: number;
    reason: string | null;
    supplierName: string | null;
    invoiceNumber: string | null;
    waybillNumber: string | null;
    deliveryDate: Date | null;
    batchNumber: string | null;
    atcNumber: string | null;
    unitCostAtTime: number | null;
    totalCost: number | null;
    status: string;
    performedBy: string | null;
    receivedBy: string | null;
    approvedBy: string | null;
    approvedAt: Date | null;
    notes: string | null;
    createdAt: Date;
}

interface PendingCounts {
    transactions: number;
    items: number;
    requests: number;
    total: number;
}

interface ActivityTabProps {
    transactions: StockTransaction[];
    pendingApprovals: PendingApproval[];
    pendingCounts: PendingCounts;
    userRole?: string;
}

// ==================== MAIN ACTIVITY TAB COMPONENT ====================

export default function ActivityTab({ transactions, pendingApprovals, pendingCounts, userRole }: ActivityTabProps) {
    const [activeSubTab, setActiveSubTab] = useState<'pending' | 'movements' | 'audit'>('pending');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'IN' | 'OUT' | 'ADJUSTMENT'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState<StockTransaction | null>(null);
    const { can: clientCan } = usePermissions();

    // Use server-side role if available
    const can = (permission: Permission): boolean => {
        if (userRole) {
            return hasPermission(userRole, permission);
        }
        return clientCan(permission);
    };

    // Live updates - refresh data every 30 seconds
    const { refresh, isRefreshing, nextRefreshIn } = useLiveUpdates({
        interval: 30000, // 30 seconds
        enabled: activeSubTab === 'pending', // Only poll when on pending tab
    });

    // Filter transactions
    const filteredTransactions = transactions.filter(t => {
        const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
        const matchesType = typeFilter === 'all' || t.type === typeFilter;
        const matchesSearch = searchQuery === '' ||
            t.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.performedBy?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesStatus && matchesType && matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Sub-Tab Navigation */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
                <div className="flex gap-1">
                    <button
                        onClick={() => setActiveSubTab('pending')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
                            activeSubTab === 'pending'
                                ? "bg-amber-50 text-amber-700"
                                : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <Clock size={18} />
                        <span>Pending</span>
                        {pendingCounts.total > 0 && (
                            <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                {pendingCounts.total}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveSubTab('movements')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
                            activeSubTab === 'movements'
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <Package size={18} />
                        Movement Log
                    </button>
                    <button
                        onClick={() => setActiveSubTab('audit')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all",
                            activeSubTab === 'audit'
                                ? "bg-purple-50 text-purple-700"
                                : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <FileText size={18} />
                        Audit Trail
                    </button>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Live Updates Indicator */}
                    {activeSubTab === 'pending' && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>Live</span>
                                {nextRefreshIn !== null && (
                                    <span className="text-gray-400">· {formatRefreshTime(nextRefreshIn)}</span>
                                )}
                            </div>
                            <button
                                onClick={refresh}
                                disabled={isRefreshing}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                                title="Refresh now"
                            >
                                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Pending Sub-Tab */}
            {activeSubTab === 'pending' && (
                <PendingSubTab
                    pendingApprovals={pendingApprovals}
                    counts={pendingCounts}
                    userRole={userRole}
                />
            )}

            {/* Movement Log Sub-Tab */}
            {activeSubTab === 'movements' && (
                <MovementLogSubTab
                    transactions={filteredTransactions}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    typeFilter={typeFilter}
                    setTypeFilter={setTypeFilter}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onViewDetails={(t) => { setSelectedTransaction(t); setShowDetailModal(true); }}
                />
            )}

            {/* Audit Trail Sub-Tab */}
            {activeSubTab === 'audit' && (
                <AuditTrailSubTab />
            )}

            {/* Transaction Detail Modal */}
            {showDetailModal && selectedTransaction && (
                <TransactionDetailModal
                    transaction={selectedTransaction}
                    onClose={() => { setShowDetailModal(false); setSelectedTransaction(null); }}
                />
            )}
        </div>
    );
}

// ==================== PENDING SUB-TAB ====================

function PendingSubTab({ pendingApprovals, counts, userRole }: { pendingApprovals: PendingApproval[]; counts: PendingCounts; userRole?: string }) {
    const [isPending, startTransition] = useTransition();
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { can: clientCan } = usePermissions();

    // Use server-side role if available
    const can = (permission: Permission): boolean => {
        if (userRole) {
            return hasPermission(userRole, permission);
        }
        return clientCan(permission);
    };

    const handleApprove = async (item: PendingApproval) => {
        setActionLoading(item.id);
        startTransition(async () => {
            try {
                if (item.type === 'stock_transaction') {
                    const { approveStockTransaction } = await import('@/lib/actions/inventory');
                    await approveStockTransaction(item.id);
                } else if (item.type === 'inventory_item') {
                    const { approveInventoryItem } = await import('@/lib/actions/inventory');
                    await approveInventoryItem(item.id, item.quantity);
                } else if (item.type === 'material_request') {
                    const { approveMaterialRequest } = await import('@/lib/actions/inventory');
                    await approveMaterialRequest(item.id, 'Manager');
                }
            } catch (error) {
                console.error('Approval failed:', error);
            } finally {
                setActionLoading(null);
            }
        });
    };

    const handleReject = async (item: PendingApproval) => {
        const reason = prompt('Enter rejection reason (optional):');
        setActionLoading(item.id);
        startTransition(async () => {
            try {
                if (item.type === 'stock_transaction') {
                    const { rejectStockTransaction } = await import('@/lib/actions/inventory');
                    await rejectStockTransaction(item.id, reason || undefined);
                } else if (item.type === 'inventory_item') {
                    const { rejectInventoryItem } = await import('@/lib/actions/inventory');
                    await rejectInventoryItem(item.id, reason || 'Rejected');
                } else if (item.type === 'material_request') {
                    const { rejectMaterialRequest } = await import('@/lib/actions/inventory');
                    await rejectMaterialRequest(item.id, 'Manager', reason || 'Rejected');
                }
            } catch (error) {
                console.error('Rejection failed:', error);
            } finally {
                setActionLoading(null);
            }
        });
    };

    const priorityColors = {
        'Urgent': 'bg-red-100 text-red-700 border-red-200',
        'High': 'bg-amber-100 text-amber-700 border-amber-200',
        'Normal': 'bg-blue-100 text-blue-700 border-blue-200',
        'Low': 'bg-gray-100 text-gray-700 border-gray-200'
    };

    const typeColors = {
        'stock_transaction': 'bg-emerald-50 text-emerald-700',
        'inventory_item': 'bg-purple-50 text-purple-700',
        'material_request': 'bg-amber-50 text-amber-700'
    };

    const typeLabels = {
        'stock_transaction': 'Stock Transaction',
        'inventory_item': 'New Item',
        'material_request': 'Material Request'
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header with counts */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900">Pending Approvals</h3>
                    <p className="text-sm text-gray-500 mt-1">Items awaiting manager review and approval</p>
                </div>
                <div className="flex gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg">
                        <ArrowDownRight size={14} className="text-emerald-600" />
                        <span className="text-sm font-medium text-emerald-700">{counts.transactions} Transactions</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                        <Package size={14} className="text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">{counts.items} Items</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
                        <Clock size={14} className="text-amber-600" />
                        <span className="text-sm font-medium text-amber-700">{counts.requests} Requests</span>
                    </div>
                </div>
            </div>

            {/* Pending Items List */}
            {pendingApprovals.length === 0 ? (
                <div className="p-12 text-center">
                    <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
                    <h4 className="text-lg font-medium text-gray-600">All Caught Up!</h4>
                    <p className="text-sm text-gray-400 mt-1">No pending items require approval</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {pendingApprovals.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="p-5 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    {/* Type and Priority badges */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-lg",
                                            typeColors[item.type]
                                        )}>
                                            {typeLabels[item.type]}
                                        </span>
                                        <span className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-lg border",
                                            priorityColors[item.priority]
                                        )}>
                                            {item.priority}
                                        </span>
                                        <span className={cn(
                                            "px-2.5 py-1 text-xs font-medium rounded-lg",
                                            item.subType === 'IN' || item.subType === 'Stock In'
                                                ? "bg-emerald-100 text-emerald-700"
                                                : item.subType === 'OUT' || item.subType === 'Stock Out'
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-gray-100 text-gray-700"
                                        )}>
                                            {item.subType}
                                        </span>
                                    </div>

                                    {/* Item name and details */}
                                    <h4 className="font-semibold text-gray-900">{item.itemName}</h4>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
                                        <span className="text-gray-600">
                                            <span className="font-medium">Qty:</span> {item.quantity.toLocaleString()} {item.unit}
                                        </span>
                                        <span className="text-gray-600">
                                            <span className="font-medium">Location:</span> {item.location}
                                        </span>
                                        {item.supplierName && (
                                            <span className="text-gray-600">
                                                <span className="font-medium">Supplier:</span> {item.supplierName}
                                            </span>
                                        )}
                                        {item.totalCost && (
                                            <span className="text-gray-600">
                                                <span className="font-medium">Value:</span> {formatCurrency(item.totalCost)}
                                            </span>
                                        )}
                                    </div>

                                    {/* Document references */}
                                    {(item.invoiceNumber || item.waybillNumber || item.atcNumber || item.batchNumber) && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {item.invoiceNumber && (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    Invoice: {item.invoiceNumber}
                                                </span>
                                            )}
                                            {item.waybillNumber && (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    Waybill: {item.waybillNumber}
                                                </span>
                                            )}
                                            {item.atcNumber && (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                                                    ATC: {item.atcNumber}
                                                </span>
                                            )}
                                            {item.batchNumber && (
                                                <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">
                                                    Batch: {item.batchNumber}
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Reason */}
                                    {item.reason && (
                                        <p className="text-sm text-gray-500 mt-2 italic">"{item.reason}"</p>
                                    )}

                                    {/* Metadata */}
                                    <p className="text-xs text-gray-400 mt-3">
                                        By <span className="font-medium">{item.performedBy || 'Unknown'}</span>
                                        {' · '}
                                        {new Date(item.createdAt).toLocaleDateString('en-NG', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>

                                {/* Action Buttons */}
                                {can('approve_stock_transactions') && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(item)}
                                            disabled={actionLoading === item.id}
                                            className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors disabled:opacity-50"
                                            title="Approve"
                                        >
                                            {actionLoading === item.id ? (
                                                <Loader2 size={18} className="animate-spin" />
                                            ) : (
                                                <CheckCircle2 size={18} />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleReject(item)}
                                            disabled={actionLoading === item.id}
                                            className="p-2.5 bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50"
                                            title="Reject"
                                        >
                                            <XCircle size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ==================== MOVEMENT LOG SUB-TAB ====================

function MovementLogSubTab({
    transactions,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    onViewDetails
}: {
    transactions: StockTransaction[];
    statusFilter: 'all' | 'Pending' | 'Approved' | 'Rejected';
    setStatusFilter: (f: 'all' | 'Pending' | 'Approved' | 'Rejected') => void;
    typeFilter: 'all' | 'IN' | 'OUT' | 'ADJUSTMENT';
    setTypeFilter: (f: 'all' | 'IN' | 'OUT' | 'ADJUSTMENT') => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onViewDetails: (t: StockTransaction) => void;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Stock Movement Log</h3>
                        <p className="text-sm text-gray-500 mt-1">Complete history of all inventory movements</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none text-sm transition-all w-48"
                            />
                        </div>

                        {/* Status Filter */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                        </select>

                        {/* Type Filter */}
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="IN">Stock In</option>
                            <option value="OUT">Stock Out</option>
                            <option value="ADJUSTMENT">Adjustment</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50/80">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier / Reason</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-12 text-center">
                                    <Package size={40} className="mx-auto text-gray-300 mb-3" />
                                    <p className="text-gray-500">No transactions found</p>
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t) => (
                                <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
                                            t.type === 'IN' ? "bg-emerald-100 text-emerald-700" :
                                                t.type === 'OUT' ? "bg-blue-100 text-blue-700" :
                                                    "bg-gray-100 text-gray-700"
                                        )}>
                                            {t.type === 'IN' ? <ArrowDownRight size={12} /> :
                                                t.type === 'OUT' ? <ArrowUpRight size={12} /> : null}
                                            {t.type === 'IN' ? 'Stock In' : t.type === 'OUT' ? 'Stock Out' : 'Adjustment'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div>
                                            <div className="font-medium text-gray-900">{t.item.name}</div>
                                            <div className="text-xs text-gray-500">{t.item.location.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-gray-900">
                                            {t.type === 'OUT' ? '-' : '+'}{t.quantity.toLocaleString()}
                                            <span className="font-normal text-gray-500 ml-1">{t.item.unit}</span>
                                        </span>
                                        {t.totalCost && (
                                            <div className="text-xs text-gray-500">{formatCurrency(t.totalCost)}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {t.supplierName ? (
                                            <div className="text-sm text-gray-700">{t.supplierName}</div>
                                        ) : (
                                            <div className="text-sm text-gray-500 italic">{t.reason || '—'}</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {t.invoiceNumber && (
                                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    INV
                                                </span>
                                            )}
                                            {t.waybillNumber && (
                                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    WB
                                                </span>
                                            )}
                                            {t.atcNumber && (
                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-xs rounded">
                                                    ATC
                                                </span>
                                            )}
                                            {t.batchNumber && (
                                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-600 text-xs rounded">
                                                    BATCH
                                                </span>
                                            )}
                                            {!t.invoiceNumber && !t.waybillNumber && !t.atcNumber && !t.batchNumber && (
                                                <span className="text-gray-400 text-xs">—</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold",
                                            t.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                                t.status === 'Pending' ? "bg-amber-100 text-amber-700" :
                                                    "bg-red-100 text-red-700"
                                        )}>
                                            {t.status === 'Approved' ? <CheckCircle2 size={12} /> :
                                                t.status === 'Pending' ? <Clock size={12} /> :
                                                    <XCircle size={12} />}
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-700">
                                            {new Date(t.createdAt).toLocaleDateString('en-NG', {
                                                day: 'numeric',
                                                month: 'short'
                                            })}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                            {new Date(t.createdAt).toLocaleTimeString('en-NG', {
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <button
                                            onClick={() => onViewDetails(t)}
                                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                            title="View Details"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ==================== AUDIT TRAIL SUB-TAB ====================

function AuditTrailSubTab() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activityFilter, setActivityFilter] = useState<string>('all');
    const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'custom' | 'all'>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [isExporting, setIsExporting] = useState(false);

    // Calculate date range
    const getDateFilters = useCallback(() => {
        const now = new Date();
        let startDate: Date | undefined;
        let endDate: Date | undefined = now;

        switch (dateRange) {
            case 'today':
                startDate = new Date(now.setHours(0, 0, 0, 0));
                break;
            case '7days':
                startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                break;
            case '30days':
                startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'custom':
                startDate = customStartDate ? new Date(customStartDate) : undefined;
                endDate = customEndDate ? new Date(customEndDate) : undefined;
                break;
            default:
                startDate = undefined;
                endDate = undefined;
        }
        return { startDate, endDate };
    }, [dateRange, customStartDate, customEndDate]);

    useEffect(() => {
        loadLogs();
    }, [searchQuery, activityFilter, dateRange, customStartDate, customEndDate]);

    const loadLogs = async () => {
        setLoading(true);
        try {
            const { getAuditLogs } = await import('@/lib/actions/inventory');
            const { startDate, endDate } = getDateFilters();
            const result = await getAuditLogs({
                search: searchQuery || undefined,
                activityType: activityFilter as any,
                startDate,
                endDate,
                limit: 100
            });
            setLogs(result.logs);
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const { exportAuditLogsCSV } = await import('@/lib/actions/inventory');
            const csv = await exportAuditLogsCSV({
                search: searchQuery || undefined,
                activityType: activityFilter as any
            });

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `inventory-audit-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const activityTypeColors: Record<string, string> = {
        'stock_in': 'bg-emerald-100 text-emerald-700',
        'stock_out': 'bg-blue-100 text-blue-700',
        'adjustment': 'bg-gray-100 text-gray-700',
        'item_approved': 'bg-purple-100 text-purple-700',
        'item_created': 'bg-amber-100 text-amber-700',
        'production': 'bg-indigo-100 text-indigo-700'
    };

    const activityTypeLabels: Record<string, string> = {
        'stock_in': 'Stock In',
        'stock_out': 'Stock Out',
        'adjustment': 'Adjustment',
        'item_approved': 'Item Approved',
        'item_created': 'Item Created',
        'production': 'Production'
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header with filters */}
            <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Audit Trail</h3>
                        <p className="text-sm text-gray-500 mt-1">Complete chronological record of all inventory activity</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Search items, users..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none text-sm transition-all w-56"
                            />
                        </div>

                        {/* Activity Type Filter */}
                        <select
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value)}
                            className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 outline-none"
                        >
                            <option value="all">All Activities</option>
                            <option value="stock_in">Stock In</option>
                            <option value="stock_out">Stock Out</option>
                            <option value="adjustment">Adjustments</option>
                            <option value="item_approved">Item Approvals</option>
                            <option value="production">Production</option>
                        </select>

                        {/* Date Range Filter */}
                        <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 rounded-xl p-1">
                                {[
                                    { value: 'all', label: 'All' },
                                    { value: 'today', label: 'Today' },
                                    { value: '7days', label: '7D' },
                                    { value: '30days', label: '30D' },
                                    { value: 'custom', label: 'Custom' }
                                ].map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setDateRange(opt.value as any)}
                                        className={cn(
                                            "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                                            dateRange === opt.value
                                                ? "bg-white text-blue-700 shadow-sm"
                                                : "text-gray-600 hover:text-gray-900"
                                        )}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {dateRange === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={customStartDate}
                                        onChange={(e) => setCustomStartDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                                    />
                                    <span className="text-gray-400">to</span>
                                    <input
                                        type="date"
                                        value={customEndDate}
                                        onChange={(e) => setCustomEndDate(e.target.value)}
                                        className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Export Button */}
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-medium shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
                        >
                            {isExporting ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Download size={16} />
                            )}
                            Export CSV
                        </button>

                        {/* Refresh Button */}
                        <button
                            onClick={loadLogs}
                            disabled={loading}
                            className="p-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 size={32} className="animate-spin text-blue-500" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <h4 className="text-lg font-medium text-gray-600">No Activity Found</h4>
                        <p className="text-sm text-gray-400 mt-1">Audit logs will appear here as inventory actions are performed</p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

                        {/* Timeline items */}
                        <div className="space-y-6">
                            {logs.map((log) => (
                                <div key={log.id} className="relative pl-10">
                                    {/* Timeline dot */}
                                    <div className={cn(
                                        "absolute left-2 top-1.5 w-5 h-5 rounded-full flex items-center justify-center",
                                        activityTypeColors[log.activityType] || 'bg-gray-100'
                                    )}>
                                        {log.activityType === 'stock_in' && <ArrowDownRight size={12} />}
                                        {log.activityType === 'stock_out' && <ArrowUpRight size={12} />}
                                        {log.activityType === 'production' && <Package size={12} />}
                                        {(log.activityType === 'item_approved' || log.activityType === 'item_created') && <CheckCircle2 size={12} />}
                                        {log.activityType === 'adjustment' && <RefreshCw size={12} />}
                                    </div>

                                    {/* Content */}
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-xs font-semibold rounded",
                                                        activityTypeColors[log.activityType] || 'bg-gray-100 text-gray-700'
                                                    )}>
                                                        {activityTypeLabels[log.activityType] || log.activityType}
                                                    </span>
                                                    <span className={cn(
                                                        "px-2 py-0.5 text-xs font-medium rounded",
                                                        log.status === 'Approved' ? "bg-emerald-50 text-emerald-600" :
                                                            log.status === 'Pending' ? "bg-amber-50 text-amber-600" :
                                                                log.status === 'Rejected' ? "bg-red-50 text-red-600" :
                                                                    "bg-gray-50 text-gray-600"
                                                    )}>
                                                        {log.status}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-gray-900">{log.description}</p>
                                                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                                                    <span>Location: {log.details.location}</span>
                                                    {log.details.supplierName && <span>Supplier: {log.details.supplierName}</span>}
                                                    {log.details.totalCost && <span>Value: {formatCurrency(log.details.totalCost)}</span>}
                                                </div>
                                            </div>
                                            <div className="text-right text-xs">
                                                <div className="font-medium text-gray-700">{log.performedBy}</div>
                                                {log.approvedBy && (
                                                    <div className="text-emerald-600">✓ {log.approvedBy}</div>
                                                )}
                                                <div className="text-gray-400 mt-1">
                                                    {new Date(log.timestamp).toLocaleDateString('en-NG', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ==================== TRANSACTION DETAIL MODAL ====================

// ==================== TRANSACTION DETAIL MODAL ====================

function TransactionDetailModal({ transaction, onClose }: { transaction: StockTransaction; onClose: () => void }) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden transform transition-all">
                {/* Header */}
                <div className={cn(
                    "p-6 text-white relative overflow-hidden",
                    transaction.type === 'IN' ? "bg-gradient-to-br from-emerald-600 to-teal-700" :
                        transaction.type === 'OUT' ? "bg-gradient-to-br from-blue-600 to-indigo-700" :
                            "bg-gradient-to-br from-gray-600 to-gray-700"
                )}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        {transaction.type === 'IN' ? <ArrowDownRight size={100} /> :
                            transaction.type === 'OUT' ? <ArrowUpRight size={100} /> :
                                <RefreshCw size={100} />}
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                {transaction.type === 'IN' ? <ArrowDownRight size={24} /> :
                                    transaction.type === 'OUT' ? <ArrowUpRight size={24} /> :
                                        <RefreshCw size={24} />}
                            </div>
                            <div>
                                <h3 className="text-xl font-bold tracking-tight">
                                    {transaction.type === 'IN' ? 'Stock In' : transaction.type === 'OUT' ? 'Stock Out' : 'Adjustment'} Details
                                </h3>
                                <p className="text-white/80 text-sm font-mono mt-0.5">ID: {transaction.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
                    {/* Item Info */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 font-semibold text-gray-900 border-b border-gray-100 pb-2">
                            <Package size={18} className="text-gray-500" />
                            Item Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailRow label="Item Name" value={transaction.item.name} />
                            <DetailRow label="Location" value={transaction.item.location.name} />
                            <DetailRow
                                label="Quantity"
                                value={`${transaction.type === 'OUT' ? '-' : '+'}${transaction.quantity.toLocaleString()} ${transaction.item.unit}`}
                                highlight={true}
                                highlightColor={transaction.type === 'OUT' ? 'text-blue-600' : 'text-emerald-600'}
                            />
                            <DetailRow label="Unit Cost" value={transaction.unitCostAtTime ? formatCurrency(transaction.unitCostAtTime) : '—'} />
                            <DetailRow label="Total Value" value={transaction.totalCost ? formatCurrency(transaction.totalCost) : '—'} />
                        </div>
                    </div>

                    {/* Document References */}
                    {(transaction.supplierName || transaction.invoiceNumber || transaction.waybillNumber || transaction.atcNumber || transaction.batchNumber) && (
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 font-semibold text-gray-900 border-b border-gray-100 pb-2">
                                <FileText size={18} className="text-gray-500" />
                                Document References
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {transaction.supplierName && <DetailRow label="Supplier" value={transaction.supplierName} />}
                                {transaction.invoiceNumber && <DetailRow label="Invoice Number" value={transaction.invoiceNumber} />}
                                {transaction.waybillNumber && <DetailRow label="Waybill Number" value={transaction.waybillNumber} />}
                                {transaction.atcNumber && <DetailRow label="ATC Number" value={transaction.atcNumber} />}
                                {transaction.batchNumber && <DetailRow label="Batch Number" value={transaction.batchNumber} />}
                                {transaction.deliveryDate && <DetailRow label="Delivery Date" value={new Date(transaction.deliveryDate).toLocaleDateString()} />}
                            </div>
                        </div>
                    )}

                    {/* Workflow Status */}
                    <div className="space-y-4">
                        <h4 className="flex items-center gap-2 font-semibold text-gray-900 border-b border-gray-100 pb-2">
                            <History size={18} className="text-gray-500" />
                            Workflow Status
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DetailRow
                                label="Status"
                                value={transaction.status}
                                badge={true}
                                badgeColor={
                                    transaction.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' :
                                        transaction.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                                            'bg-red-100 text-red-700'
                                }
                            />
                            <DetailRow label="Performed By" value={transaction.performedBy || 'Unknown'} />
                            {transaction.receivedBy && <DetailRow label="Received By" value={transaction.receivedBy} />}
                            {transaction.approvedBy && <DetailRow label="Approved By" value={transaction.approvedBy} />}
                            {transaction.approvedAt && <DetailRow label="Approved At" value={new Date(transaction.approvedAt).toLocaleString()} />}
                            <DetailRow label="Created At" value={new Date(transaction.createdAt).toLocaleString()} />
                        </div>
                    </div>

                    {/* Reason/Notes */}
                    {(transaction.reason || transaction.notes) && (
                        <div className="space-y-4">
                            <h4 className="flex items-center gap-2 font-semibold text-gray-900 border-b border-gray-100 pb-2">
                                <AlertCircle size={18} className="text-gray-500" />
                                Notes
                            </h4>
                            {transaction.reason && (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Reason</span>
                                    <p className="text-gray-700">{transaction.reason}</p>
                                </div>
                            )}
                            {transaction.notes && (
                                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                                    <span className="text-xs font-bold text-amber-600 uppercase tracking-wider block mb-1">Additional Notes</span>
                                    <p className="text-gray-800">{transaction.notes}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm active:scale-[0.98]"
                    >
                        Close Details
                    </button>
                </div>
            </div>
        </div>
    );
}

function DetailRow({
    label,
    value,
    highlight,
    highlightColor,
    badge,
    badgeColor
}: {
    label: string;
    value: string;
    highlight?: boolean;
    highlightColor?: string;
    badge?: boolean;
    badgeColor?: string;
}) {
    return (
        <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{label}</div>
            {badge ? (
                <span className={cn(
                    "inline-flex items-center px-2.5 py-0.5 rounded-lg text-sm font-semibold",
                    badgeColor || "bg-gray-100 text-gray-800"
                )}>
                    {value}
                </span>
            ) : (
                <div className={cn(
                    "text-base font-medium",
                    highlight ? (highlightColor || "text-gray-900") : "text-gray-900"
                )}>
                    {value}
                </div>
            )}
        </div>
    );
}
