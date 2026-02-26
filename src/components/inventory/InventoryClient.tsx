'use client'

import React, { useState, useTransition, useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { hasPermission, Permission } from '@/lib/permissions';
import {
    Package, AlertTriangle, ArrowUpRight, ArrowDownRight, Database, Search, Filter,
    Plus, ChevronDown, Clock, CheckCircle2, XCircle, Warehouse, FlaskConical,
    Calendar, DollarSign, Layers, Settings, Eye, Edit, Trash2, X, Loader2,
    AlertCircle, TrendingUp, TrendingDown, BarChart3, History, FileText, Save,
    Container, ClipboardList, Lock, MapPin
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import ActivityTab, { PendingApproval, StockTransaction } from './ActivityTab';
import StorageLocationsModal from './StorageLocationsModal';

// Type definitions
interface StorageLocation {
    id: string;
    name: string;
    type: string;
    description: string | null;
}

interface InventoryItem {
    id: string;
    name: string;
    sku: string | null;
    category: string;
    itemType: string;
    quantity: number;
    maxCapacity: number | null;
    unit: string;
    minThreshold: number;
    unitCost: number;
    totalValue: number;
    expiryDate: Date | null;
    batchNumber: string | null;
    supplier: string | null;
    location: StorageLocation;
    status?: string; // 'Pending', 'Active', 'Rejected'
    createdBy?: string | null;
    createdAt?: Date;
}

interface SiloStat {
    id: string;
    name: string;
    itemName: string;
    currentLevel: number;
    maxCapacity: number;
    percentage: number;
    unit: string;
    status: string;
}

interface MaterialRequest {
    id: string;
    requestType: string;
    quantity: number;
    reason: string | null;
    priority: string;
    status: string;
    requestedBy: string;
    approvedBy: string | null;
    createdAt: Date;
    item: InventoryItem;
}

interface InventoryClientProps {
    items: InventoryItem[];
    totalItems: number;
    lowStockItems: number;
    totalValue: number;
    expiringItems: number;
    siloStats: SiloStat[];
    locations: StorageLocation[];
    transactions: StockTransaction[];
    pendingApprovals: PendingApproval[];
    pendingCounts: {
        transactions: number;
        items: number;
        requests: number;
        total: number;
    };
    currentUser: string;
    userRole?: string;
}

export default function InventoryClient({
    items,
    totalItems,
    lowStockItems,
    totalValue,
    expiringItems,
    siloStats,
    locations,
    transactions,
    pendingApprovals,
    pendingCounts,
    currentUser,
    userRole
}: InventoryClientProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'silos' | 'containers' | 'locations' | 'activity' | 'expiring'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showStockModal, setShowStockModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showSiloModal, setShowSiloModal] = useState(false);
    const [showContainerModal, setShowContainerModal] = useState(false);
    const [showLoadCementModal, setShowLoadCementModal] = useState(false);
    const [selectedSilo, setSelectedSilo] = useState<SiloStat | null>(null);
    const [containerStats, setContainerStats] = useState<SiloStat[]>([]);
    const [containerLoading, setContainerLoading] = useState(false);
    const [modalType, setModalType] = useState<'in' | 'out'>('in');
    const [showViewItemModal, setShowViewItemModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [showLocationsModal, setShowLocationsModal] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const { can: clientCan } = usePermissions();

    // Use server-side role if available, otherwise fall back to client-side session
    // This prevents the "flash of hidden UI" when session is loading
    const can = (permission: Permission): boolean => {
        if (userRole) {
            // Use server-provided role (instant, no loading state)
            return hasPermission(userRole, permission);
        }
        // Fall back to client-side session (may have loading delay)
        return clientCan(permission);
    };

    // Filter items based on search and category
    const filteredItems = items.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.location.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    // Get expiring items (within 30 days)
    const expiringItemsList = items.filter(item => {
        if (!item.expiryDate) return false;
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return new Date(item.expiryDate) <= thirtyDaysFromNow;
    });

    // Category summary
    const categoryBreakdown = [
        { name: 'Raw Material', count: items.filter(i => i.category === 'Raw Material').length, color: 'bg-blue-500' },
        { name: 'Consumable', count: items.filter(i => i.category === 'Consumable').length, color: 'bg-amber-500' },
        { name: 'Equipment', count: items.filter(i => i.category === 'Equipment').length, color: 'bg-purple-500' },
        { name: 'Asset', count: items.filter(i => i.category === 'Asset').length, color: 'bg-green-500' },
    ];

    const handleStockAction = (type: 'in' | 'out', item?: InventoryItem) => {
        setModalType(type);
        setSelectedItem(item || null);
        setShowStockModal(true);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Advanced Inventory Management</h1>
                    <p className="text-gray-600 mt-1">Multi-location stock control with approval workflows</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {can('create_stock_transactions') && (
                        <button
                            onClick={() => handleStockAction('in')}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 font-medium shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
                        >
                            <ArrowDownRight size={20} />
                            Stock In
                        </button>
                    )}
                    {can('create_stock_transactions') && (
                        <button
                            onClick={() => handleStockAction('out')}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-medium shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all"
                        >
                            <ArrowUpRight size={20} />
                            Stock Out
                        </button>
                    )}
                    {can('create_material_requests') && (
                        <button
                            onClick={() => setShowRequestModal(true)}
                            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm flex items-center gap-2 transition-all"
                        >
                            <Plus size={20} />
                            Material Request
                        </button>
                    )}
                    {can('create_inventory_item') && (
                        <button
                            onClick={() => setShowItemModal(true)}
                            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm flex items-center gap-2 transition-all"
                        >
                            <Package size={20} />
                            Add Item
                        </button>
                    )}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    title="Total Items"
                    value={totalItems.toString()}
                    icon={<Package size={22} />}
                    color="bg-gradient-to-br from-blue-500 to-blue-600"
                    trend={+5.2}
                />
                <StatsCard
                    title="Low Stock Alerts"
                    value={lowStockItems.toString()}
                    icon={<AlertTriangle size={22} />}
                    color="bg-gradient-to-br from-red-500 to-red-600"
                    alert={lowStockItems > 0}
                />
                <StatsCard
                    title="Total Value"
                    value={formatCurrency(totalValue)}
                    icon={<DollarSign size={22} />}
                    color="bg-gradient-to-br from-emerald-500 to-emerald-600"
                    trend={+12.4}
                />
                <StatsCard
                    title="Expiring Soon"
                    value={expiringItems.toString()}
                    icon={<Clock size={22} />}
                    color="bg-gradient-to-br from-amber-500 to-amber-600"
                    alert={expiringItems > 0}
                />
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-2">
                <div className="flex gap-2 overflow-x-auto">
                    {[
                        { id: 'overview', label: 'Overview', icon: <BarChart3 size={18} /> },
                        { id: 'items', label: 'All Items', icon: <Package size={18} /> },
                        { id: 'silos', label: 'Silo Management', icon: <Database size={18} /> },
                        { id: 'containers', label: 'Container Storage', icon: <Container size={18} /> },
                        { id: 'locations', label: 'Storage Locations', icon: <Warehouse size={18} /> },
                        { id: 'activity', label: `Activity ${pendingCounts.total > 0 ? `(${pendingCounts.total})` : ''}`, icon: <History size={18} /> },
                        { id: 'expiring', label: 'Expiring Items', icon: <AlertCircle size={18} /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap",
                                activeTab === tab.id
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:bg-gray-50"
                            )}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Silo Visualization */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {siloStats.map(silo => (
                            <SiloCard key={silo.id} silo={silo} onStockAction={handleStockAction} userRole={userRole} />
                        ))}
                    </div>

                    {/* Category Breakdown */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Inventory by Category</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {categoryBreakdown.map(cat => (
                                <div key={cat.name} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={cn("w-3 h-3 rounded-full", cat.color)} />
                                        <span className="text-sm font-medium text-gray-600">{cat.name}</span>
                                    </div>
                                    <div className="text-2xl font-bold text-gray-900">{cat.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Location Summary */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-6">Storage Locations</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {locations.map(loc => (
                                <div key={loc.id} className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            {loc.type === 'Silo' ? <Database size={20} className="text-blue-600" /> :
                                                loc.type === 'Container' ? <Container size={20} className="text-teal-600" /> :
                                                    loc.type === 'Warehouse' ? <Warehouse size={20} className="text-amber-600" /> :
                                                        <FlaskConical size={20} className="text-purple-600" />}
                                        </div>
                                    </div>
                                    <h4 className="font-semibold text-gray-900">{loc.name}</h4>
                                    <p className="text-sm text-gray-500 mt-1">{loc.description}</p>
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                        <span className="text-sm text-gray-600">
                                            {items.filter(i => i.location.id === loc.id).length} items
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'items' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Search and Filter Bar */}
                    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h3 className="text-lg font-bold text-gray-900">Stock Overview</h3>
                        <div className="flex gap-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search items..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 rounded-xl outline-none text-sm transition-all w-64"
                                />
                            </div>
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:border-blue-500 outline-none"
                            >
                                <option value="all">All Categories</option>
                                <option value="Raw Material">Raw Material</option>
                                <option value="Consumable">Consumable</option>
                                <option value="Equipment">Equipment</option>
                                <option value="Asset">Asset</option>
                            </select>
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Location</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Value</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                                                {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {item.location.type === 'Silo' ? <Database size={14} className="text-blue-500" /> :
                                                    item.location.type === 'Container' ? <Container size={14} className="text-teal-500" /> :
                                                        <Warehouse size={14} className="text-amber-500" />}
                                                <span className="text-sm text-gray-600">{item.location.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium",
                                                item.category === 'Raw Material' && "bg-blue-100 text-blue-700",
                                                item.category === 'Consumable' && "bg-amber-100 text-amber-700",
                                                item.category === 'Equipment' && "bg-purple-100 text-purple-700",
                                                item.category === 'Asset' && "bg-green-100 text-green-700"
                                            )}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-gray-900">
                                                {item.quantity.toLocaleString()}
                                                <span className="font-normal text-gray-500 ml-1">{item.unit}</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-medium text-gray-900">
                                                {formatCurrency(item.quantity * item.unitCost)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.quantity <= item.minThreshold ? (
                                                <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
                                                    <AlertTriangle size={14} /> Low Stock
                                                </span>
                                            ) : item.expiryDate && new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? (
                                                <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium">
                                                    <Clock size={14} /> Expiring
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-medium">
                                                    <CheckCircle2 size={14} /> In Stock
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {can('create_stock_transactions') && (
                                                    <button
                                                        onClick={() => handleStockAction('in', item)}
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                        title="Stock In"
                                                    >
                                                        <ArrowDownRight size={16} />
                                                    </button>
                                                )}
                                                {can('create_stock_transactions') && (
                                                    <button
                                                        onClick={() => handleStockAction('out', item)}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        title="Stock Out"
                                                    >
                                                        <ArrowUpRight size={16} />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => { setSelectedItem(item); setShowViewItemModal(true); }}
                                                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'silos' && (
                <div className="space-y-6">
                    {/* Silo Management Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Cement Silo Management</h3>
                            <p className="text-sm text-gray-500 mt-1">Manage silos and cement inventory</p>
                        </div>
                        <button
                            onClick={() => { setSelectedSilo(null); setShowSiloModal(true); }}
                            className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl hover:from-indigo-600 hover:to-indigo-700 font-medium shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition-all"
                        >
                            <Plus size={18} />
                            Add New Silo
                        </button>
                    </div>

                    {/* Silo Grid */}
                    {siloStats.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                            <Database size={48} className="mx-auto text-gray-300 mb-4" />
                            <h4 className="text-lg font-medium text-gray-600">No Silos Configured</h4>
                            <p className="text-sm text-gray-400 mt-1">Add your first silo to start tracking cement inventory</p>
                            <button
                                onClick={() => { setSelectedSilo(null); setShowSiloModal(true); }}
                                className="mt-4 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 transition-colors"
                            >
                                Create Silo
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {siloStats.map(silo => (
                                <div key={silo.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900">{silo.name}</h4>
                                            <p className="text-sm text-gray-500">{silo.itemName || 'No cement loaded'}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "px-2.5 py-1 text-xs font-semibold rounded-full",
                                                silo.status === 'Low' ? "bg-red-100 text-red-800" :
                                                    silo.status === 'High' ? "bg-amber-100 text-amber-800" :
                                                        silo.status === 'Optimal' ? "bg-emerald-100 text-emerald-800" :
                                                            "bg-gray-100 text-gray-800"
                                            )}>
                                                {silo.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Silo Level Visualization */}
                                    <div className="relative h-32 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 mb-4">
                                        <div
                                            className={cn(
                                                "absolute bottom-0 left-0 w-full transition-all duration-700 ease-in-out",
                                                silo.status === 'Low' ? "bg-gradient-to-t from-red-500 to-red-400" :
                                                    silo.status === 'High' ? "bg-gradient-to-t from-amber-500 to-amber-400" :
                                                        "bg-gradient-to-t from-indigo-600 to-indigo-400"
                                            )}
                                            style={{ height: `${Math.min(silo.percentage, 100)}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-2xl font-bold text-gray-700 bg-white/80 px-3 py-1 rounded-lg shadow">
                                                {silo.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-sm mb-4">
                                        <div>
                                            <span className="text-gray-500">Current Level</span>
                                            <div className="font-bold text-gray-900">
                                                {silo.currentLevel.toLocaleString()} {silo.unit}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-500">Capacity</span>
                                            <div className="font-bold text-gray-700">
                                                {silo.maxCapacity.toLocaleString()} {silo.unit}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => { setSelectedSilo(silo); setShowLoadCementModal(true); }}
                                            className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <ArrowDownRight size={16} />
                                            Load Cement
                                        </button>
                                        <button
                                            onClick={() => { setSelectedSilo(silo); setShowSiloModal(true); }}
                                            className="py-2 px-3 bg-gray-50 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                                            title="Edit Silo"
                                        >
                                            <Edit size={16} />
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (confirm(`Are you sure you want to delete ${silo.name}?`)) {
                                                    startTransition(async () => {
                                                        try {
                                                            const { deleteSilo } = await import('@/lib/actions/inventory');
                                                            await deleteSilo(silo.id);
                                                            setMessage({ type: 'success', text: `${silo.name} deleted successfully` });
                                                        } catch (error: any) {
                                                            setMessage({ type: 'error', text: error.message });
                                                        }
                                                    });
                                                }
                                            }}
                                            className="py-2 px-3 bg-red-50 text-red-700 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                                            title="Delete Silo"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={20} />
                        <div className="text-sm text-blue-800">
                            <span className="font-semibold">Tip:</span> Use "Load Cement" to add stock to a silo, or "Add Item" in the header to add other inventory items to storage locations.
                            Silos are specifically designed for cement storage and are used during production runs.
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'containers' && (
                <div className="space-y-6">
                    {/* Container Management Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Container Storage Management</h3>
                            <p className="text-sm text-gray-500 mt-1">Manage cement containers and container inventory</p>
                        </div>
                        <button
                            onClick={async () => {
                                setContainerLoading(true);
                                try {
                                    const { getContainersWithCement } = await import('@/lib/actions/inventory');
                                    const containers = await getContainersWithCement();
                                    setContainerStats(containers.map(c => ({
                                        id: c.id,
                                        name: c.name,
                                        itemName: c.cementItem?.name || 'Empty',
                                        currentLevel: c.cementItem?.quantity || 0,
                                        maxCapacity: c.cementItem?.maxCapacity || c.capacity || 30000,
                                        percentage: c.percentage,
                                        unit: c.cementItem?.unit || 'kg',
                                        status: c.status
                                    })));
                                } catch (error) {
                                    console.error('Failed to load containers:', error);
                                }
                                setContainerLoading(false);
                            }}
                            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm flex items-center gap-2 transition-all mr-2"
                        >
                            <History size={18} className={containerLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                    </div>

                    {/* Container Info Banner */}
                    <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
                        <Container className="text-teal-600 mt-0.5 flex-shrink-0" size={20} />
                        <div className="text-sm text-teal-800">
                            <span className="font-semibold">Multi-Unit Tracking:</span> Containers provide flexible cement storage tracking alongside silos.
                            Use the refresh button above to load container data, or create containers via the inventory settings.
                        </div>
                    </div>

                    {/* Container Grid */}
                    {containerStats.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                            <Container size={48} className="mx-auto text-gray-300 mb-4" />
                            <h4 className="text-lg font-medium text-gray-600">No Containers Found</h4>
                            <p className="text-sm text-gray-400 mt-1">Click Refresh to load containers, or create new container storage locations</p>
                            <button
                                onClick={async () => {
                                    setContainerLoading(true);
                                    try {
                                        const { getContainersWithCement } = await import('@/lib/actions/inventory');
                                        const containers = await getContainersWithCement();
                                        setContainerStats(containers.map(c => ({
                                            id: c.id,
                                            name: c.name,
                                            itemName: c.cementItem?.name || 'Empty',
                                            currentLevel: c.cementItem?.quantity || 0,
                                            maxCapacity: c.cementItem?.maxCapacity || c.capacity || 30000,
                                            percentage: c.percentage,
                                            unit: c.cementItem?.unit || 'kg',
                                            status: c.status
                                        })));
                                    } catch (error) {
                                        console.error('Failed to load containers:', error);
                                    }
                                    setContainerLoading(false);
                                }}
                                className="mt-4 px-4 py-2 bg-teal-100 text-teal-700 rounded-lg font-medium hover:bg-teal-200 transition-colors"
                            >
                                Load Containers
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {containerStats.map(container => (
                                <div key={container.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Container size={18} className="text-teal-600" />
                                                <h4 className="text-lg font-bold text-gray-900">{container.name}</h4>
                                            </div>
                                            <p className="text-sm text-gray-500">{container.itemName || 'No cement loaded'}</p>
                                        </div>
                                        <span className={cn(
                                            "px-2.5 py-1 text-xs font-semibold rounded-full",
                                            container.status === 'Low' ? "bg-red-100 text-red-800" :
                                                container.status === 'High' ? "bg-amber-100 text-amber-800" :
                                                    container.status === 'Optimal' ? "bg-emerald-100 text-emerald-800" :
                                                        "bg-gray-100 text-gray-800"
                                        )}>
                                            {container.status}
                                        </span>
                                    </div>

                                    {/* Container Level Visualization */}
                                    <div className="relative h-28 bg-gray-100 rounded-xl overflow-hidden border border-gray-200 mb-4">
                                        <div
                                            className={cn(
                                                "absolute bottom-0 left-0 w-full transition-all duration-700 ease-in-out",
                                                container.status === 'Low' ? "bg-gradient-to-t from-red-500 to-red-400" :
                                                    container.status === 'High' ? "bg-gradient-to-t from-amber-500 to-amber-400" :
                                                        "bg-gradient-to-t from-teal-600 to-teal-400"
                                            )}
                                            style={{ height: `${Math.min(container.percentage, 100)}%` }}
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xl font-bold text-gray-700 bg-white/80 px-3 py-1 rounded-lg shadow">
                                                {container.percentage.toFixed(0)}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between text-sm mb-4">
                                        <div>
                                            <span className="text-gray-500">Current Level</span>
                                            <div className="font-bold text-gray-900">
                                                {container.currentLevel.toLocaleString()} {container.unit}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-500">Capacity</span>
                                            <div className="font-bold text-gray-700">
                                                {container.maxCapacity.toLocaleString()} {container.unit}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setSelectedSilo(container);
                                                setShowLoadCementModal(true);
                                            }}
                                            className="flex-1 py-2 px-3 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <ArrowDownRight size={16} />
                                            Load Cement
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'locations' && (
                <div className="space-y-6">
                    {/* Storage Locations Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">Storage Locations</h3>
                            <p className="text-sm text-gray-500 mt-1">Configure and manage storage locations for inventory</p>
                        </div>
                        {can('manage_inventory') && (
                            <button
                                onClick={() => setShowLocationsModal(true)}
                                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl hover:from-amber-600 hover:to-amber-700 font-medium shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all"
                            >
                                <Settings size={18} />
                                Configure Locations
                            </button>
                        )}
                    </div>

                    {/* Locations Grid */}
                    {locations.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                            <Warehouse size={48} className="mx-auto text-gray-300 mb-4" />
                            <h4 className="text-lg font-medium text-gray-600">No Storage Locations Configured</h4>
                            <p className="text-sm text-gray-400 mt-1">Add your first storage location to organize your inventory</p>
                            {can('manage_inventory') && (
                                <button
                                    onClick={() => setShowLocationsModal(true)}
                                    className="mt-4 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg font-medium hover:bg-amber-200 transition-colors"
                                >
                                    Add Location
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {locations.map(loc => {
                                const itemCount = items.filter(i => i.location.id === loc.id).length;
                                return (
                                    <div key={loc.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center",
                                                    loc.type === 'Silo' ? "bg-blue-100" :
                                                        loc.type === 'Container' ? "bg-teal-100" :
                                                            loc.type === 'Warehouse' ? "bg-amber-100" : "bg-gray-100"
                                                )}>
                                                    {loc.type === 'Silo' ? <Database size={24} className="text-blue-600" /> :
                                                        loc.type === 'Container' ? <Container size={24} className="text-teal-600" /> :
                                                            loc.type === 'Warehouse' ? <Warehouse size={24} className="text-amber-600" /> :
                                                                <MapPin size={24} className="text-gray-600" />}
                                                </div>
                                                <div>
                                                    <h4 className="text-lg font-bold text-gray-900">{loc.name}</h4>
                                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{loc.type}</span>
                                                </div>
                                            </div>
                                        </div>
                                        {loc.description && (
                                            <p className="text-sm text-gray-500 mb-3">{loc.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                                            <Package size={16} />
                                            <span className="font-medium">{itemCount}</span> item{itemCount !== 1 ? 's' : ''} stored
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'activity' && (
                <ActivityTab
                    transactions={transactions}
                    pendingApprovals={pendingApprovals}
                    pendingCounts={pendingCounts}
                    userRole={userRole}
                />
            )}

            {activeTab === 'expiring' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Expiring Items</h3>
                        <p className="text-sm text-gray-500 mt-1">Items expiring within the next 30 days</p>
                    </div>

                    {expiringItemsList.length === 0 ? (
                        <div className="p-12 text-center">
                            <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
                            <h4 className="text-lg font-medium text-gray-600">All Clear!</h4>
                            <p className="text-sm text-gray-400 mt-1">No items expiring in the next 30 days</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {expiringItemsList.map(item => (
                                <ExpiringItemCard key={item.id} item={item} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Storage Locations Modal */}
            {showLocationsModal && (
                <StorageLocationsModal
                    locations={locations}
                    onClose={() => setShowLocationsModal(false)}
                />
            )}

            {/* Stock In/Out Modal */}
            {showStockModal && (
                <StockModal
                    type={modalType}
                    item={selectedItem}
                    items={items}
                    currentUser={currentUser}
                    onClose={() => setShowStockModal(false)}
                />
            )}

            {/* Add Item Modal */}
            {showItemModal && (
                <AddItemModal
                    locations={locations}
                    currentUser={currentUser}
                    onClose={() => setShowItemModal(false)}
                />
            )}

            {/* Material Request Modal */}
            {showRequestModal && (
                <MaterialRequestModal
                    items={items}
                    onClose={() => setShowRequestModal(false)}
                />
            )}

            {/* Silo Management Modal */}
            {showSiloModal && (
                <SiloModal
                    silo={selectedSilo}
                    onClose={() => { setShowSiloModal(false); setSelectedSilo(null); }}
                />
            )}

            {/* Load Cement Modal */}
            {showLoadCementModal && selectedSilo && (
                <LoadCementModal
                    silo={selectedSilo}
                    onClose={() => { setShowLoadCementModal(false); setSelectedSilo(null); }}
                />
            )}

            {/* View/Edit Item Modal */}
            {showViewItemModal && selectedItem && (
                <ViewItemModal
                    item={selectedItem}
                    locations={locations}
                    onClose={() => { setShowViewItemModal(false); setSelectedItem(null); }}
                    userRole={userRole}
                />
            )}

            {/* Message Toast */}
            {message && (
                <div className={cn(
                    "fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300 z-50",
                    message.type === 'success'
                        ? "bg-emerald-600 text-white"
                        : "bg-red-600 text-white"
                )}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <span className="font-medium">{message.text}</span>
                    <button onClick={() => setMessage(null)} className="ml-2 hover:bg-white/20 p-1 rounded">
                        <X size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ==================== COMPONENT DEFINITIONS ====================

function StatsCard({ title, value, icon, color, alert, trend }: {
    title: string;
    value: string;
    icon: React.ReactNode;
    color: string;
    alert?: boolean;
    trend?: number;
}) {
    return (
        <div className={cn(
            "bg-white p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md",
            alert ? "border-red-200 ring-2 ring-red-50" : "border-gray-100"
        )}>
            <div className="flex items-center justify-between mb-4">
                <div className={cn("p-3 rounded-xl text-white", color)}>
                    {icon}
                </div>
                {trend && (
                    <div className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg",
                        trend > 0 ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
                    )}>
                        {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div className="text-sm font-medium text-gray-500">{title}</div>
            <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
        </div>
    );
}

function SiloCard({ silo, onStockAction, userRole }: { silo: SiloStat; onStockAction: (type: 'in' | 'out', item?: InventoryItem) => void; userRole?: string }) {
    const { can: clientCan } = usePermissions();

    // Use server-side role if available
    const can = (permission: Permission): boolean => {
        if (userRole) {
            return hasPermission(userRole, permission);
        }
        return clientCan(permission);
    };

    const levelColor = silo.status === 'Low' ? 'from-red-500 to-red-400' :
        silo.status === 'High' ? 'from-amber-500 to-amber-400' :
            'from-blue-600 to-blue-400';

    return (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">{silo.name}</h3>
                    <p className="text-gray-500">{silo.itemName}</p>
                </div>
                <span className={cn(
                    "px-3 py-1 text-xs font-semibold rounded-full",
                    silo.status === 'Low' ? "bg-red-100 text-red-800" :
                        silo.status === 'High' ? "bg-amber-100 text-amber-800" :
                            "bg-emerald-100 text-emerald-800"
                )}>
                    {silo.status === 'Low' ? 'Low Level' : silo.status === 'High' ? 'Near Capacity' : 'Optimal'}
                </span>
            </div>

            <div className="relative h-44 bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                {/* Silo Visualization */}
                <div
                    className={cn("absolute bottom-0 left-0 w-full bg-gradient-to-t transition-all duration-1000 ease-in-out", levelColor)}
                    style={{ height: `${Math.min(silo.percentage, 100)}%` }}
                >
                    <div className="absolute top-0 left-0 w-full h-3 bg-white/20 animate-pulse" />
                </div>

                {/* Level Markers */}
                <div className="absolute inset-0 flex flex-col justify-between py-3 px-3 pointer-events-none">
                    {[100, 75, 50, 25, 0].map(level => (
                        <div key={level} className="flex items-center gap-2">
                            <div className="w-full border-t border-dashed border-gray-300/50" />
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{level}%</span>
                        </div>
                    ))}
                </div>

                {/* Current Level Indicator */}
                <div
                    className="absolute left-0 right-0 border-t-2 border-white flex items-center justify-end pr-2"
                    style={{ bottom: `${Math.min(silo.percentage, 100)}%` }}
                >
                    <span className="text-[10px] bg-white text-gray-700 px-1.5 py-0.5 rounded shadow-sm font-medium">
                        {silo.percentage.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
                <div>
                    <span className="text-sm font-medium text-gray-500">Current Level</span>
                    <div className="text-2xl font-bold text-gray-900">
                        {silo.currentLevel.toLocaleString()}
                        <span className="text-sm font-normal text-gray-500 ml-1">{silo.unit}</span>
                    </div>
                    {silo.unit === 'kg' && (
                        <span className="text-xs text-gray-400">({Math.floor(silo.currentLevel / 50).toLocaleString()} bags)</span>
                    )}
                </div>
                <div className="text-right">
                    <span className="text-sm font-medium text-gray-500">Max Capacity</span>
                    <div className="text-lg font-semibold text-gray-700">
                        {silo.maxCapacity.toLocaleString()} {silo.unit}
                    </div>
                    {silo.unit === 'kg' && (
                        <span className="text-xs text-gray-400">({Math.floor(silo.maxCapacity / 50).toLocaleString()} bags)</span>
                    )}
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                {can('create_stock_transactions') && (
                    <button
                        onClick={() => onStockAction('in')}
                        className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                    >
                        <ArrowDownRight size={16} /> Add Stock
                    </button>
                )}
                {can('create_stock_transactions') && (
                    <button
                        onClick={() => onStockAction('out')}
                        className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                    >
                        <ArrowUpRight size={16} /> Remove
                    </button>
                )}
            </div>
        </div>
    );
}

function RequestCard({ request }: { request: MaterialRequest }) {
    const { can } = usePermissions();

    const priorityColors = {
        'Urgent': 'bg-red-100 text-red-700 border-red-200',
        'High': 'bg-amber-100 text-amber-700 border-amber-200',
        'Normal': 'bg-blue-100 text-blue-700 border-blue-200',
        'Low': 'bg-gray-100 text-gray-700 border-gray-200'
    };

    return (
        <div className="p-5 hover:bg-gray-50/50 transition-colors">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <span className={cn(
                            "px-2.5 py-1 text-xs font-semibold rounded-lg border",
                            priorityColors[request.priority as keyof typeof priorityColors]
                        )}>
                            {request.priority}
                        </span>
                        <span className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-lg",
                            request.requestType === 'Stock In' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                        )}>
                            {request.requestType}
                        </span>
                    </div>
                    <h4 className="font-semibold text-gray-900">{request.item.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                        Quantity: <span className="font-medium text-gray-700">{request.quantity} {request.item.unit}</span>
                        {request.reason && <> · Reason: {request.reason}</>}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                        Requested by {request.requestedBy} · {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    {can('approve_material_requests') && (
                        <>
                            <button className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors" title="Approve">
                                <CheckCircle2 size={18} />
                            </button>
                            <button className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors" title="Reject">
                                <XCircle size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function ExpiringItemCard({ item }: { item: InventoryItem }) {
    const daysUntilExpiry = item.expiryDate
        ? Math.ceil((new Date(item.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : 0;

    const urgencyColor = daysUntilExpiry <= 7 ? 'text-red-600 bg-red-50 border-red-200' :
        daysUntilExpiry <= 14 ? 'text-amber-600 bg-amber-50 border-amber-200' :
            'text-yellow-600 bg-yellow-50 border-yellow-200';

    return (
        <div className="p-5 hover:bg-gray-50/50 transition-colors flex items-center justify-between gap-4">
            <div className="flex-1">
                <h4 className="font-semibold text-gray-900">{item.name}</h4>
                <p className="text-sm text-gray-500 mt-1">
                    {item.location.name} · Batch: {item.batchNumber || 'N/A'}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                    Quantity: <span className="font-medium">{item.quantity} {item.unit}</span>
                </p>
            </div>
            <div className="text-right">
                <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium", urgencyColor)}>
                    <Calendar size={14} />
                    {daysUntilExpiry <= 0 ? 'Expired!' : `${daysUntilExpiry} days left`}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Expires: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
                </p>
            </div>
        </div>
    );
}

// ==================== MODAL COMPONENTS ====================

function StockModal({ type, item, items, currentUser, onClose }: {
    type: 'in' | 'out';
    item: InventoryItem | null;
    items: InventoryItem[];
    currentUser: string;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [selectedItemId, setSelectedItemId] = useState(item?.id || '');
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [updateItemCost, setUpdateItemCost] = useState(false);

    // Get selected item details
    const selectedItem = items.find(i => i.id === selectedItemId);

    // Calculate total cost
    const totalCost = quantity && unitCost
        ? (parseFloat(quantity) * parseFloat(unitCost)).toFixed(2)
        : '0.00';

    // Update unit cost when item changes
    useEffect(() => {
        if (selectedItem) {
            setUnitCost(selectedItem.unitCost.toString());
        }
    }, [selectedItem]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('type', type === 'in' ? 'IN' : 'OUT');
        formData.set('performedBy', currentUser);
        formData.set('receivedBy', currentUser);
        formData.set('updateItemCost', updateItemCost.toString());

        startTransition(async () => {
            const { createStockTransaction } = await import('@/lib/actions/inventory');
            await createStockTransaction(formData);
            onClose();
        });
    };

    const isStockIn = type === 'in';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={cn(
                "bg-white rounded-2xl shadow-2xl w-full overflow-hidden flex flex-col transform transition-all",
                isStockIn ? "max-w-3xl max-h-[90vh]" : "max-w-lg max-h-[90vh]"
            )}>
                {/* Header */}
                <div className={cn(
                    "p-6 text-white relative overflow-hidden",
                    isStockIn
                        ? "bg-gradient-to-br from-emerald-600 to-teal-700"
                        : "bg-gradient-to-br from-blue-600 to-indigo-700"
                )}>
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        {isStockIn ? <ArrowDownRight size={120} /> : <ArrowUpRight size={120} />}
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                {isStockIn ? <ArrowDownRight size={28} /> : <ArrowUpRight size={28} />}
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">
                                    {isStockIn ? 'Receive Stock' : 'Issue Stock'}
                                </h3>
                                <p className={cn(
                                    "text-sm font-medium mt-1",
                                    isStockIn ? "text-emerald-100" : "text-blue-100"
                                )}>
                                    {isStockIn ? 'Record new material delivery' : 'Record usage or transfer'}
                                </p>
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

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
                    {/* Material Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-gray-100 rounded-lg text-gray-500">
                                <Package size={18} />
                            </div>
                            <h4 className="font-semibold text-gray-900">Material Selection</h4>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Item to {isStockIn ? 'Receive' : 'Issue'}</label>
                                <div className="relative">
                                    <select
                                        name="itemId"
                                        value={selectedItemId}
                                        onChange={(e) => setSelectedItemId(e.target.value)}
                                        required
                                        className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none font-medium text-gray-700"
                                    >
                                        <option value="">Choose a material...</option>
                                        {items.map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.name} • {i.location.name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            </div>

                            {selectedItem && (
                                <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-200 shadow-sm grid grid-cols-3 gap-6">
                                    <div>
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Available Stock</span>
                                        <div className="font-bold text-gray-900 text-lg mt-1 flex items-baseline gap-1">
                                            {selectedItem.quantity.toLocaleString()} <span className="text-sm font-normal text-gray-500">{selectedItem.unit}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Current Cost</span>
                                        <div className="font-bold text-gray-900 text-lg mt-1">
                                            {formatCurrency(selectedItem.unitCost)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Supplier</span>
                                        <div className="font-bold text-gray-900 text-lg mt-1 truncate" title={selectedItem.supplier || 'N/A'}>
                                            {selectedItem.supplier || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stock In: Delivery Details Section */}
                    {isStockIn && (
                        <div className="space-y-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                                    <Layers size={18} />
                                </div>
                                <h4 className="font-semibold text-gray-900">Delivery Information</h4>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Supplier Name</label>
                                    <input
                                        type="text"
                                        name="supplierName"
                                        defaultValue={selectedItem?.supplier || ''}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                                        placeholder="e.g., Dangote Cement"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Delivery Date</label>
                                    <input
                                        type="date"
                                        name="deliveryDate"
                                        defaultValue={new Date().toISOString().split('T')[0]}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-gray-700"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Invoice Number</label>
                                    <input
                                        type="text"
                                        name="invoiceNumber"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                                        placeholder="e.g., INV-2024-001"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Waybill #</label>
                                    <input
                                        type="text"
                                        name="waybillNumber"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                                        placeholder="e.g., WB-12345"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                        {selectedItem?.itemType === 'Cement' ? 'ATC Number' : 'Batch / Lot Number'}
                                    </label>
                                    <input
                                        type="text"
                                        name={selectedItem?.itemType === 'Cement' ? 'atcNumber' : 'batchNumber'}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                                        placeholder={selectedItem?.itemType === 'Cement' ? 'e.g., ATC-2024-001' : 'e.g., B2024-DEC-001'}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quantity & Cost Section */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                <DollarSign size={18} />
                            </div>
                            <h4 className="font-semibold text-gray-900">{isStockIn ? 'Quantity & Valuation' : 'Transaction Details'}</h4>
                        </div>

                        <div className={cn("grid gap-5", isStockIn ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1")}>
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                    Quantity {selectedItem ? `(${selectedItem.unit})` : ''} *
                                </label>
                                <input
                                    type="number"
                                    name="quantity"
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    step="0.01"
                                    min="0.01"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-semibold text-gray-900"
                                    placeholder="0.00"
                                />
                            </div>
                            {isStockIn && (
                                <>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Unit Cost (₦)</label>
                                        <input
                                            type="number"
                                            name="unitCostAtTime"
                                            value={unitCost}
                                            onChange={(e) => setUnitCost(e.target.value)}
                                            step="0.01"
                                            min="0"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-semibold text-gray-900"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Total Cost</label>
                                        <div className="px-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-700 font-bold flex items-center h-[52px]">
                                            {formatCurrency(parseFloat(totalCost))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {isStockIn && (
                            <label className="flex items-start gap-3 p-4 bg-amber-50/50 rounded-xl border border-amber-100 cursor-pointer hover:bg-amber-100/50 transition-colors">
                                <div className="mt-1">
                                    <input
                                        type="checkbox"
                                        checked={updateItemCost}
                                        onChange={(e) => setUpdateItemCost(e.target.checked)}
                                        className="w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <span className="font-semibold text-amber-900 block text-sm">Update stored unit cost</span>
                                    <p className="text-xs text-amber-600 mt-0.5">Check this to update the system price for this item to {formatCurrency(parseFloat(unitCost) || 0)} for all future transactions.</p>
                                </div>
                            </label>
                        )}
                    </div>

                    {/* Reason & Notes */}
                    <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                                {isStockIn ? 'Reason / Purpose' : 'Reason for Stock Out *'}
                            </label>
                            <input
                                type="text"
                                name="reason"
                                required={!isStockIn}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                placeholder={isStockIn ? "e.g., Regular restocking" : "e.g., Production batch #123, Site XYZ"}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Additional Notes</label>
                            <textarea
                                name="notes"
                                rows={2}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none"
                                placeholder="Any additional context..."
                            />
                        </div>
                    </div>

                    {/* Audit Info Helper */}
                    <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                        <Clock size={14} />
                        <span>Action will be logged by <strong>{currentUser}</strong> on {new Date().toLocaleDateString()}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:text-gray-900 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className={cn(
                                "flex-[2] py-4 px-6 text-white rounded-xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2",
                                isStockIn
                                    ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:to-emerald-400 shadow-emerald-500/20"
                                    : "bg-gradient-to-r from-blue-600 to-blue-500 hover:to-blue-400 shadow-blue-500/20",
                                isPending && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Processing...' : isStockIn ? 'Complete Reception' : 'Confirm Issue'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


function AddItemModal({ locations, currentUser, onClose }: {
    locations: StorageLocation[];
    currentUser: string;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('createdBy', currentUser); // Set who created the item

        startTransition(async () => {
            const { createInventoryItem } = await import('@/lib/actions/inventory');
            await createInventoryItem(formData);
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 bg-gradient-to-br from-purple-600 to-indigo-700 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Package size={100} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                <Plus size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Add New Item</h3>
                                <p className="text-purple-100 text-sm mt-1">Register new inventory to the system</p>
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

                <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-8">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                            Basic Information
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="md:col-span-2">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Item Name *</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                    placeholder="e.g., Portland Cement Grade 42.5"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">SKU</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="sku"
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                        placeholder="e.g., CEM-42-001"
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Category *</label>
                                <select
                                    name="category"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                >
                                    <option value="">Select category</option>
                                    <option value="Raw Material">Raw Material</option>
                                    <option value="Consumable">Consumable</option>
                                    <option value="Equipment">Equipment</option>
                                    <option value="Asset">Asset</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Item Type</label>
                                <select
                                    name="itemType"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                >
                                    <option value="General">General</option>
                                    <option value="Cement">Cement</option>
                                    <option value="Aggregate">Aggregate</option>
                                    <option value="Admixture">Admixture</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Supplier</label>
                                <input
                                    type="text"
                                    name="supplier"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                    placeholder="Supplier name"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Storage & Tracking */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            Storage Details
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Storage Location *</label>
                                <select
                                    name="locationId"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                >
                                    <option value="">Select location</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Initial Quantity</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    step="0.01"
                                    defaultValue="0"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Unit *</label>
                                <select
                                    name="unit"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                >
                                    <option value="">Select unit</option>
                                    <option value="kg">Kilograms (kg)</option>
                                    <option value="liters">Liters</option>
                                    <option value="pcs">Pieces</option>
                                    <option value="m³">Cubic Meters (m³)</option>
                                    <option value="tons">Tons</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Max Capacity</label>
                                <input
                                    type="number"
                                    name="maxCapacity"
                                    step="0.01"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                    placeholder="Optional"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Valuation & Alerts */}
                    <div className="space-y-4">
                        <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Valuation & Alerts
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Unit Cost (₦)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₦</span>
                                    <input
                                        type="number"
                                        name="unitCost"
                                        step="0.01"
                                        defaultValue="0"
                                        className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Low Stock Threshold</label>
                                <input
                                    type="number"
                                    name="minThreshold"
                                    step="0.01"
                                    defaultValue="0"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                    placeholder="Alert at..."
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Expiry Date</label>
                                <input
                                    type="date"
                                    name="expiryDate"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all text-gray-700"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Batch Number</label>
                                <input
                                    type="text"
                                    name="batchNumber"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-gray-400"
                                    placeholder="e.g., B2024-001"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] py-4 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:to-indigo-500 transition-all shadow-lg hover:shadow-purple-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Creating...' : 'Create Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function MaterialRequestModal({ items, onClose }: {
    items: InventoryItem[];
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const { createMaterialRequest } = await import('@/lib/actions/inventory');
            await createMaterialRequest(formData);
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                <div className="p-6 bg-gradient-to-br from-amber-500 to-orange-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ClipboardList size={100} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                <ClipboardList size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Material Request</h3>
                                <p className="text-amber-100 text-sm mt-1">Submit request for approval</p>
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

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg">
                                <AlertCircle size={18} />
                            </div>
                            <h4 className="font-semibold text-gray-900">Request Details</h4>
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Request Type *</label>
                                <select
                                    name="requestType"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                >
                                    <option value="">Select type</option>
                                    <option value="Stock In">Stock In (Receiving)</option>
                                    <option value="Stock Out">Stock Out (Issuing)</option>
                                    <option value="Transfer">Transfer</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Priority</label>
                                <select
                                    name="priority"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all"
                                >
                                    <option value="Normal">Normal</option>
                                    <option value="Low">Low</option>
                                    <option value="High">High</option>
                                    <option value="Urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Select Item *</label>
                            <div className="relative">
                                <select
                                    name="itemId"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all appearance-none"
                                >
                                    <option value="">Choose an item...</option>
                                    {items.map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.location.name})</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Quantity *</label>
                            <input
                                type="number"
                                name="quantity"
                                step="0.01"
                                min="0.01"
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all placeholder:text-gray-400"
                                placeholder="Enter quantity"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Reason / Justification</label>
                            <textarea
                                name="reason"
                                rows={3}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 outline-none transition-all resize-none"
                                placeholder="Why is this material needed?"
                            />
                        </div>
                    </div>

                    <input type="hidden" name="requestedBy" value="Storekeeper" />

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl font-bold hover:to-orange-500 transition-all shadow-lg hover:shadow-amber-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Submitting...' : 'Submit Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== SILO MODAL ====================

function SiloModal({ silo, onClose }: {
    silo: SiloStat | null;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const isEditing = !!silo;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            if (isEditing) {
                const { updateSilo } = await import('@/lib/actions/inventory');
                await updateSilo(silo!.id, formData);
            } else {
                const { createSilo } = await import('@/lib/actions/inventory');
                await createSilo(formData);
            }
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="p-6 bg-gradient-to-br from-indigo-500 to-violet-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Database size={100} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                <Database size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">{isEditing ? 'Edit Silo' : 'New Silo'}</h3>
                                <p className="text-indigo-100 text-sm mt-1">Manage storage infrastructure</p>
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

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Silo Name *</label>
                            <input
                                type="text"
                                name="name"
                                defaultValue={silo?.name || ''}
                                required
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-gray-400"
                                placeholder="e.g., Silo 3"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Description</label>
                            <textarea
                                name="description"
                                rows={2}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all resize-none"
                                placeholder="e.g., Secondary cement storage - Grade 52.5"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Capacity (kg)</label>
                            <input
                                type="number"
                                name="capacity"
                                defaultValue={silo?.maxCapacity || 95000}
                                step="1000"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all font-mono"
                                placeholder="95000"
                            />
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                                <AlertCircle size={12} />
                                95,000 kg = 95 tons = 1,900 bags (50kg)
                            </p>
                        </div>
                    </div>

                    {isEditing && (
                        <input type="hidden" name="isActive" value="true" />
                    )}

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-4 px-6 bg-gradient-to-r from-indigo-500 to-violet-600 text-white rounded-xl font-bold hover:to-violet-500 transition-all shadow-lg hover:shadow-indigo-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Saving...' : isEditing ? 'Update Silo' : 'Create Silo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== LOAD CEMENT MODAL ====================

function LoadCementModal({ silo, onClose }: {
    silo: SiloStat;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const hasExistingCement = !!silo.itemName;

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('siloId', silo.id);

        startTransition(async () => {
            const { addCementToSilo } = await import('@/lib/actions/inventory');
            await addCementToSilo(formData);
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ArrowDownRight size={100} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                <ArrowDownRight size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Load Cement</h3>
                                <p className="text-emerald-100 text-sm mt-1">Refill {silo.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Visual Capacity Indicator */}
                    <div className="mt-6 bg-black/20 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                        <div className="flex justify-between text-xs font-semibold mb-1.5 opacity-90">
                            <span>Current Level</span>
                            <span>{silo.percentage.toFixed(1)}% Full</span>
                        </div>
                        <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-white/90 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(silo.percentage, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs mt-1.5 opacity-75">
                            <span>{silo.currentLevel.toLocaleString()} {silo.unit}</span>
                            <span>{Math.floor(silo.currentLevel / 50).toLocaleString()} bags</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Cement Type *</label>
                            <input
                                type="text"
                                name="cementName"
                                defaultValue={silo.itemName || ''}
                                required
                                disabled={hasExistingCement}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
                                placeholder="e.g., Portland Cement (Grade 42.5)"
                            />
                            {hasExistingCement && (
                                <>
                                    <input type="hidden" name="cementName" value={silo.itemName || ''} />
                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                        <Lock size={12} />
                                        Cement type is locked to currently stored material
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="col-span-2 md:col-span-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Quantity to Load (kg) *</label>
                                <input
                                    type="number"
                                    name="quantity"
                                    step="50"
                                    min="50"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-gray-900"
                                    placeholder="e.g., 30000"
                                />
                                <p className="text-xs text-gray-500 mt-2">1 bag = 50kg</p>
                            </div>

                            <div className="col-span-2 md:col-span-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">ATC Number *</label>
                                <input
                                    type="text"
                                    name="atcNumber"
                                    required
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all uppercase placeholder:normal-case"
                                    placeholder="e.g., ATC-2024-001"
                                />
                            </div>
                        </div>
                    </div>

                    {!hasExistingCement && (
                        <div className="pt-4 border-t border-gray-100 space-y-4">
                            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                <Settings size={16} className="text-emerald-500" />
                                Initial Configuration
                            </h4>
                            <div className="grid grid-cols-2 gap-5">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Max Capacity</label>
                                    <input
                                        type="number"
                                        name="maxCapacity"
                                        defaultValue={silo.maxCapacity || 95000}
                                        step="1000"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Min Threshold</label>
                                    <input
                                        type="number"
                                        name="minThreshold"
                                        defaultValue={15000}
                                        step="1000"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Supplier</label>
                                    <input
                                        type="text"
                                        name="supplier"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                                        placeholder="e.g., Dangote Cement Ltd"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-4 px-6 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-[2] py-4 px-6 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-bold hover:to-teal-500 transition-all shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Loading...' : 'Confirm Load'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== VIEW/EDIT ITEM MODAL ====================

// ==================== VIEW/EDIT ITEM MODAL ====================

function ViewItemModal({ item, locations, onClose, userRole }: {
    item: InventoryItem;
    locations: StorageLocation[];
    onClose: () => void;
    userRole?: string;
}) {
    const [activeTabModal, setActiveTabModal] = useState<'details' | 'edit' | 'history' | 'pricing'>('details');
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);

    const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const { updateInventoryItem } = await import('@/lib/actions/inventory');
            await updateInventoryItem(item.id, formData);
            setIsEditing(false);
            onClose();
        });
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${item.name}"? This action cannot be undone.`)) {
            return;
        }

        startTransition(async () => {
            try {
                const { deleteInventoryItem } = await import('@/lib/actions/inventory');
                await deleteInventoryItem(item.id);
                onClose();
            } catch (error: any) {
                alert(error.message || 'Failed to delete item');
            }
        });
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all">
                {/* Header */}
                <div className="p-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white relative overflow-hidden flex-shrink-0">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Package size={120} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                <Package size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">{item.name}</h3>
                                {item.sku && <p className="text-indigo-100 text-sm font-mono mt-0.5">SKU: {item.sku}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={cn(
                                "px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm border border-white/10 backdrop-blur-md",
                                item.quantity <= item.minThreshold
                                    ? "bg-rose-500 text-white"
                                    : "bg-emerald-500 text-white"
                            )}>
                                {item.quantity <= item.minThreshold ? 'Low Stock' : 'In Stock'}
                            </span>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200 px-6 bg-gray-50/50 flex-shrink-0">
                    <div className="flex gap-6">
                        {[
                            { id: 'details', label: 'Overview', icon: <FileText size={18} /> },
                            { id: 'edit', label: 'Edit Item', icon: <Edit size={18} /> },
                            { id: 'history', label: 'History', icon: <History size={18} /> },
                            { id: 'pricing', label: 'Pricing', icon: <DollarSign size={18} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTabModal(tab.id as typeof activeTabModal)}
                                className={cn(
                                    "flex items-center gap-2 py-4 font-medium transition-all relative outline-none",
                                    activeTabModal === tab.id
                                        ? "text-indigo-600"
                                        : "text-gray-500 hover:text-gray-800"
                                )}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                                {activeTabModal === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-8 bg-gray-50/30">
                    {activeTabModal === 'details' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {/* Key Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Quantity</div>
                                    <div className="text-2xl font-bold text-gray-900">{item.quantity.toLocaleString()}</div>
                                    <div className="text-xs text-gray-400 mt-1">{item.unit}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Unit Cost</div>
                                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(item.unitCost)}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Total Value</div>
                                    <div className="text-2xl font-bold text-indigo-600">{formatCurrency(item.totalValue)}</div>
                                </div>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Status</div>
                                    <div className={cn("text-lg font-bold", item.quantity <= item.minThreshold ? "text-rose-600" : "text-emerald-600")}>
                                        {item.quantity <= item.minThreshold ? 'Reorder' : 'Good'}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                    <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                                        <Package size={18} className="text-indigo-500" />
                                        Basic Information
                                    </h4>
                                    <div className="space-y-4">
                                        <DetailItem label="Item Name" value={item.name} />
                                        <DetailItem label="SKU" value={item.sku || 'N/A'} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <DetailItem label="Category" value={item.category} />
                                            <DetailItem label="Type" value={item.itemType} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                                    <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                                        <Warehouse size={18} className="text-indigo-500" />
                                        Storage & Limits
                                    </h4>
                                    <div className="space-y-4">
                                        <DetailItem label="Location" value={`${item.location.name} (${item.location.type})`} />
                                        <div className="grid grid-cols-2 gap-4">
                                            <DetailItem label="Min Threshold" value={`${item.minThreshold.toLocaleString()} ${item.unit}`} />
                                            <DetailItem label="Max Capacity" value={item.maxCapacity ? `${item.maxCapacity.toLocaleString()} ${item.unit}` : 'N/A'} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 md:col-span-2">
                                    <h4 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                                        <ClipboardList size={18} className="text-indigo-500" />
                                        Tracking Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {item.expiryDate && (
                                            <DetailItem
                                                label="Expiry Date"
                                                value={new Date(item.expiryDate).toLocaleDateString()}
                                                highlight={new Date(item.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)}
                                            />
                                        )}
                                        {item.batchNumber && <DetailItem label="Batch Number" value={item.batchNumber} />}
                                        {item.supplier && <DetailItem label="Supplier" value={item.supplier} />}
                                    </div>
                                </div>
                            </div>

                            {/* Audit Trail */}
                            <div className="pt-6 border-t border-gray-200">
                                <h4 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
                                    <History size={16} />
                                    Audit Trail
                                </h4>
                                <div className="flex gap-8 text-sm text-gray-600">
                                    <div>
                                        <span className="text-gray-400 mr-2">Added By:</span>
                                        <span className="font-medium">{item.createdBy || 'System'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 mr-2">Added On:</span>
                                        <span className="font-medium">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTabModal === 'edit' && (
                        <form onSubmit={handleUpdate} className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Item Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        defaultValue={item.name}
                                        required
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">SKU</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        defaultValue={item.sku || ''}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Category *</label>
                                    <div className="relative">
                                        <select
                                            name="category"
                                            defaultValue={item.category}
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                                        >
                                            <option value="Raw Material">Raw Material</option>
                                            <option value="Consumable">Consumable</option>
                                            <option value="Equipment">Equipment</option>
                                            <option value="Asset">Asset</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Item Type</label>
                                    <div className="relative">
                                        <select
                                            name="itemType"
                                            defaultValue={item.itemType}
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                                        >
                                            <option value="General">General</option>
                                            <option value="Cement">Cement</option>
                                            <option value="Aggregate">Aggregate</option>
                                            <option value="Admixture">Admixture</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Storage Location *</label>
                                    <div className="relative">
                                        <select
                                            name="locationId"
                                            defaultValue={item.location.id}
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                                        >
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Unit *</label>
                                    <div className="relative">
                                        <select
                                            name="unit"
                                            defaultValue={item.unit}
                                            required
                                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                                        >
                                            <option value="kg">Kilograms (kg)</option>
                                            <option value="liters">Liters</option>
                                            <option value="pcs">Pieces</option>
                                            <option value="m³">Cubic Meters (m³)</option>
                                            <option value="tons">Tons</option>
                                        </select>
                                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Max Capacity</label>
                                    <input
                                        type="number"
                                        name="maxCapacity"
                                        defaultValue={item.maxCapacity || ''}
                                        step="0.01"
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Min Threshold *</label>
                                    <input
                                        type="number"
                                        name="minThreshold"
                                        defaultValue={item.minThreshold}
                                        step="0.01"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Unit Cost (₦) *</label>
                                    <input
                                        type="number"
                                        name="unitCost"
                                        defaultValue={item.unitCost}
                                        step="0.01"
                                        required
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Expiry Date</label>
                                    <input
                                        type="date"
                                        name="expiryDate"
                                        defaultValue={item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : ''}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Batch Number</label>
                                    <input
                                        type="text"
                                        name="batchNumber"
                                        defaultValue={item.batchNumber || ''}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Supplier</label>
                                    <input
                                        type="text"
                                        name="supplier"
                                        defaultValue={item.supplier || ''}
                                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-6 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="px-6 py-4 border border-rose-200 text-rose-700 rounded-xl font-bold hover:bg-rose-50 transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={20} />
                                    Delete Item
                                </button>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => setActiveTabModal('details')}
                                    className="px-6 py-4 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                                >
                                    {isPending && <Loader2 size={20} className="animate-spin" />}
                                    {isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTabModal === 'history' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <TransactionHistory itemId={item.id} userRole={userRole} />
                        </div>
                    )}

                    {activeTabModal === 'pricing' && (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <PriceHistory itemId={item.id} currentPrice={item.unitCost} unit={item.unit} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper component for detail items
function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</div>
            <div className={cn(
                "text-base font-medium",
                highlight ? "text-rose-600" : "text-gray-900"
            )}>
                {value || '—'}
            </div>
        </div>
    );
}

// Transaction History Component
function TransactionHistory({ itemId, userRole }: { itemId: string; userRole?: string }) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const { can: clientCan } = usePermissions();

    // Use server-side role if available
    const can = (permission: Permission): boolean => {
        if (userRole) {
            return hasPermission(userRole, permission);
        }
        return clientCan(permission);
    };

    const loadTransactions = async () => {
        try {
            const { getInventoryItemById } = await import('@/lib/actions/inventory');
            const itemData = await getInventoryItemById(itemId);
            if (itemData?.transactions) {
                setTransactions(itemData.transactions);
            }
        } catch (error) {
            console.error('Failed to load transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTransactions();
    }, [itemId]);

    const handleApprove = async (transactionId: string) => {
        if (!confirm('Approve this stock transaction? This will update the inventory quantity.')) return;
        setActionLoading(transactionId);
        try {
            const { approveStockTransaction } = await import('@/lib/actions/inventory');
            const result = await approveStockTransaction(transactionId);
            if (result.success) {
                await loadTransactions();
            }
        } catch (error: any) {
            alert('Failed to approve: ' + error.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (transactionId: string) => {
        const reason = prompt('Enter rejection reason (optional):');
        if (reason === null) return; // User cancelled
        setActionLoading(transactionId);
        try {
            const { rejectStockTransaction } = await import('@/lib/actions/inventory');
            const result = await rejectStockTransaction(transactionId, reason);
            if (result.success) {
                await loadTransactions();
            }
        } catch (error: any) {
            alert('Failed to reject: ' + error.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-12">
                <History size={48} className="mx-auto text-gray-300 mb-4" />
                <h4 className="text-lg font-medium text-gray-600">No Transaction History</h4>
                <p className="text-sm text-gray-400 mt-1">No transactions have been recorded for this item yet</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {transactions.map((txn: any) => (
                <div key={txn.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={cn(
                                    "px-2.5 py-1 text-xs font-semibold rounded-lg",
                                    txn.type === 'IN' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                                )}>
                                    {txn.type === 'IN' ? 'Stock In' : 'Stock Out'}
                                </span>
                                <span className="text-xs text-gray-500">
                                    {new Date(txn.createdAt).toLocaleDateString('en-NG', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>
                            <div className="text-sm font-medium text-gray-900 mb-1">
                                {txn.type === 'IN' ? '+' : '-'}{txn.quantity.toLocaleString()} units
                            </div>
                            {txn.reason && (
                                <div className="text-sm text-gray-600 mb-1">
                                    <span className="font-medium">Reason:</span> {txn.reason}
                                </div>
                            )}
                            {txn.notes && (
                                <div className="text-xs text-gray-500">
                                    <span className="font-medium">Notes:</span> {txn.notes}
                                </div>
                            )}
                            <div className="text-xs text-gray-500 mt-2">
                                By: {txn.performedBy} {txn.approvedBy && `• Approved by: ${txn.approvedBy}`}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <div className={cn(
                                "px-2.5 py-1 text-xs font-medium rounded-lg",
                                txn.status === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                    txn.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                        "bg-amber-100 text-amber-700"
                            )}>
                                {txn.status}
                            </div>

                            {/* Approval buttons for pending transactions */}
                            {txn.status === 'Pending' && can('approve_stock_transactions') && (
                                <div className="flex gap-1 mt-2">
                                    <button
                                        onClick={() => handleApprove(txn.id)}
                                        disabled={actionLoading === txn.id}
                                        className="px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {actionLoading === txn.id ? (
                                            <Loader2 size={12} className="animate-spin" />
                                        ) : (
                                            <CheckCircle2 size={12} />
                                        )}
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => handleReject(txn.id)}
                                        disabled={actionLoading === txn.id}
                                        className="px-2.5 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                    >
                                        <XCircle size={12} />
                                        Reject
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ==================== PRICE HISTORY COMPONENT ====================

function PriceHistory({ itemId, currentPrice, unit }: { itemId: string; currentPrice: number; unit: string }) {
    const [priceData, setPriceData] = useState<any>(null);
    const [wacData, setWacData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [wacLoading, setWacLoading] = useState(false);
    const [applyingWac, setApplyingWac] = useState(false);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        loadPriceHistory();
    }, [itemId]);

    const loadPriceHistory = async () => {
        setLoading(true);
        try {
            const { getItemPriceHistory, calculateWAC } = await import('@/lib/actions/inventory');
            const [history, wac] = await Promise.all([
                getItemPriceHistory(itemId, 30),
                calculateWAC(itemId)
            ]);
            setPriceData(history);
            setWacData(wac);
        } catch (error) {
            console.error('Failed to load price history:', error);
        }
        setLoading(false);
    };

    const handleApplyWAC = async () => {
        if (!confirm('Apply the calculated Weighted Average Cost as the new unit price? This will update the item\'s unit cost.')) {
            return;
        }
        setApplyingWac(true);
        try {
            const { applyWACAsUnitCost } = await import('@/lib/actions/inventory');
            await applyWACAsUnitCost(itemId);
            await loadPriceHistory(); // Refresh data
        } catch (error: any) {
            alert(error.message || 'Failed to apply WAC');
        }
        setApplyingWac(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Current Price & WAC Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-5 rounded-xl border border-blue-200">
                    <div className="text-xs font-medium text-blue-600 uppercase tracking-wider mb-1">Current Unit Cost</div>
                    <div className="text-2xl font-bold text-blue-900">
                        {formatCurrency(currentPrice)}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">per {unit}</div>
                </div>

                {wacData && (
                    <>
                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-5 rounded-xl border border-emerald-200">
                            <div className="text-xs font-medium text-emerald-600 uppercase tracking-wider mb-1">Weighted Average Cost</div>
                            <div className="text-2xl font-bold text-emerald-900">
                                {wacData.wac ? formatCurrency(wacData.wac) : 'N/A'}
                            </div>
                            <div className="text-xs text-emerald-600 mt-1">
                                From {wacData.transactionCount || 0} transactions
                            </div>
                        </div>

                        <div className={cn(
                            "p-5 rounded-xl border",
                            wacData.difference > 0
                                ? "bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200"
                                : wacData.difference < 0
                                    ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200"
                                    : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
                        )}>
                            <div className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">WAC vs Current</div>
                            <div className="flex items-center gap-2">
                                {wacData.difference !== 0 && (
                                    wacData.difference > 0 ? (
                                        <TrendingUp size={20} className="text-amber-600" />
                                    ) : (
                                        <TrendingDown size={20} className="text-green-600" />
                                    )
                                )}
                                <span className={cn(
                                    "text-2xl font-bold",
                                    wacData.difference > 0 ? "text-amber-700" :
                                        wacData.difference < 0 ? "text-green-700" : "text-gray-700"
                                )}>
                                    {wacData.differencePercent > 0 ? '+' : ''}
                                    {wacData.differencePercent?.toFixed(1) || 0}%
                                </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                                {wacData.difference > 0 ? 'WAC higher than current' :
                                    wacData.difference < 0 ? 'WAC lower than current' : 'Match'}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Apply WAC Button */}
            {wacData && wacData.difference !== 0 && (
                <div className="flex justify-end">
                    <button
                        onClick={handleApplyWAC}
                        disabled={applyingWac}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25"
                    >
                        {applyingWac ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <DollarSign size={18} />
                        )}
                        {applyingWac ? 'Applying...' : 'Apply WAC as Unit Cost'}
                    </button>
                </div>
            )}

            {/* Price Metrics */}
            {priceData?.metrics && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <BarChart3 size={16} />
                        Price Change Metrics
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Previous Price</div>
                            <div className="font-semibold text-gray-900">
                                {priceData.metrics.previousPrice != null ? formatCurrency(priceData.metrics.previousPrice) : 'N/A'}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Change from Previous</div>
                            <div className={cn(
                                "font-semibold",
                                priceData.metrics.changeFromPrevious > 0 ? "text-red-600" :
                                    priceData.metrics.changeFromPrevious < 0 ? "text-green-600" : "text-gray-900"
                            )}>
                                {priceData.metrics.changePercentFromPrevious > 0 ? '+' : ''}
                                {priceData.metrics.changePercentFromPrevious?.toFixed(1) || 0}%
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Oldest Recorded</div>
                            <div className="font-semibold text-gray-900">
                                {priceData.metrics.oldestPrice != null ? formatCurrency(priceData.metrics.oldestPrice) : 'N/A'}
                            </div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                            <div className="text-xs text-gray-500 mb-1">Change from Oldest</div>
                            <div className={cn(
                                "font-semibold",
                                priceData.metrics.changeFromOldest > 0 ? "text-red-600" :
                                    priceData.metrics.changeFromOldest < 0 ? "text-green-600" : "text-gray-900"
                            )}>
                                {priceData.metrics.changePercentFromOldest > 0 ? '+' : ''}
                                {priceData.metrics.changePercentFromOldest?.toFixed(1) || 0}%
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Price History Timeline */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                    <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <History size={16} />
                        Historical Prices
                    </h4>
                    <button
                        onClick={loadPriceHistory}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                        Refresh
                    </button>
                </div>

                {priceData?.history && priceData.history.length > 0 ? (
                    <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                        {priceData.history.map((record: any, idx: number) => (
                            <div key={record.id || idx} className="p-4 flex items-center justify-between hover:bg-gray-50">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <DollarSign size={16} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900">
                                            {formatCurrency(record.price)}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {record.source || 'Manual Entry'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-gray-500">
                                        {new Date(record.effectiveDate).toLocaleDateString()}
                                    </div>
                                    {record.recordedBy && (
                                        <div className="text-xs text-gray-400">
                                            by {record.recordedBy}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-500">
                        <History size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-sm">No price history recorded yet</p>
                    </div>
                )}
            </div>

            {/* Info Note */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />
                <div className="text-sm text-blue-800">
                    <span className="font-semibold">Price Fluctuation Tracking:</span> Price history is automatically recorded when stock deliveries
                    are received with different unit costs. Use the Weighted Average Cost (WAC) to maintain accurate costing across price changes.
                </div>
            </div>
        </div>
    );
}
