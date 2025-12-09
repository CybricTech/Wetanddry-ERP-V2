'use client'

import React, { useState, useTransition, useEffect } from 'react';
import {
    Package, AlertTriangle, ArrowUpRight, ArrowDownRight, Database, Search, Filter,
    Plus, ChevronDown, Clock, CheckCircle2, XCircle, Warehouse, FlaskConical,
    Calendar, DollarSign, Layers, Settings, Eye, Edit, Trash2, X, Loader2,
    AlertCircle, TrendingUp, TrendingDown, BarChart3, History, Info, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    pendingRequests: MaterialRequest[];
}

export default function InventoryClient({
    items,
    totalItems,
    lowStockItems,
    totalValue,
    expiringItems,
    siloStats,
    locations,
    pendingRequests
}: InventoryClientProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'silos' | 'requests' | 'expiring'>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [showStockModal, setShowStockModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [showRequestModal, setShowRequestModal] = useState(false);
    const [showSiloModal, setShowSiloModal] = useState(false);
    const [showLoadCementModal, setShowLoadCementModal] = useState(false);
    const [selectedSilo, setSelectedSilo] = useState<SiloStat | null>(null);
    const [modalType, setModalType] = useState<'in' | 'out'>('in');
    const [showViewItemModal, setShowViewItemModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
                    <button
                        onClick={() => handleStockAction('in')}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 font-medium shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
                    >
                        <ArrowDownRight size={20} />
                        Stock In
                    </button>
                    <button
                        onClick={() => handleStockAction('out')}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 font-medium shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all"
                    >
                        <ArrowUpRight size={20} />
                        Stock Out
                    </button>
                    <button
                        onClick={() => setShowRequestModal(true)}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm flex items-center gap-2 transition-all"
                    >
                        <Plus size={20} />
                        Material Request
                    </button>
                    <button
                        onClick={() => setShowItemModal(true)}
                        className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium shadow-sm flex items-center gap-2 transition-all"
                    >
                        <Package size={20} />
                        Add Item
                    </button>
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
                    value={`₦${totalValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
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
                        { id: 'requests', label: `Requests ${pendingRequests.length > 0 ? `(${pendingRequests.length})` : ''}`, icon: <Clock size={18} /> },
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
                            <SiloCard key={silo.id} silo={silo} onStockAction={handleStockAction} />
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
                                                ₦{(item.quantity * item.unitCost).toLocaleString()}
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
                                                <button
                                                    onClick={() => handleStockAction('in', item)}
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                    title="Stock In"
                                                >
                                                    <ArrowDownRight size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleStockAction('out', item)}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Stock Out"
                                                >
                                                    <ArrowUpRight size={16} />
                                                </button>
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

            {activeTab === 'requests' && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900">Material Requests</h3>
                        <p className="text-sm text-gray-500 mt-1">Review and approve stock requests</p>
                    </div>

                    {pendingRequests.length === 0 ? (
                        <div className="p-12 text-center">
                            <CheckCircle2 size={48} className="mx-auto text-gray-300 mb-4" />
                            <h4 className="text-lg font-medium text-gray-600">No Pending Requests</h4>
                            <p className="text-sm text-gray-400 mt-1">All material requests have been processed</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {pendingRequests.map(request => (
                                <RequestCard key={request.id} request={request} />
                            ))}
                        </div>
                    )}
                </div>
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

            {/* Stock In/Out Modal */}
            {showStockModal && (
                <StockModal
                    type={modalType}
                    item={selectedItem}
                    items={items}
                    onClose={() => setShowStockModal(false)}
                />
            )}

            {/* Add Item Modal */}
            {showItemModal && (
                <AddItemModal
                    locations={locations}
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

function SiloCard({ silo, onStockAction }: { silo: SiloStat; onStockAction: (type: 'in' | 'out', item?: InventoryItem) => void }) {
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
                </div>
                <div className="text-right">
                    <span className="text-sm font-medium text-gray-500">Max Capacity</span>
                    <div className="text-lg font-semibold text-gray-700">
                        {silo.maxCapacity.toLocaleString()} {silo.unit}
                    </div>
                </div>
            </div>

            <div className="mt-4 flex gap-2">
                <button
                    onClick={() => onStockAction('in')}
                    className="flex-1 py-2 px-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1"
                >
                    <ArrowDownRight size={16} /> Add Stock
                </button>
                <button
                    onClick={() => onStockAction('out')}
                    className="flex-1 py-2 px-3 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-1"
                >
                    <ArrowUpRight size={16} /> Remove
                </button>
            </div>
        </div>
    );
}

function RequestCard({ request }: { request: MaterialRequest }) {
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
                    <button className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors" title="Approve">
                        <CheckCircle2 size={18} />
                    </button>
                    <button className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors" title="Reject">
                        <XCircle size={18} />
                    </button>
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

function StockModal({ type, item, items, onClose }: {
    type: 'in' | 'out';
    item: InventoryItem | null;
    items: InventoryItem[];
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [selectedItemId, setSelectedItemId] = useState(item?.id || '');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('type', type === 'in' ? 'IN' : 'OUT');

        startTransition(async () => {
            const { createStockTransaction } = await import('@/lib/actions/inventory');
            await createStockTransaction(formData);
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className={cn(
                    "p-6 text-white",
                    type === 'in' ? "bg-gradient-to-r from-emerald-500 to-emerald-600" : "bg-gradient-to-r from-blue-500 to-blue-600"
                )}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {type === 'in' ? <ArrowDownRight size={24} /> : <ArrowUpRight size={24} />}
                            <h3 className="text-xl font-bold">{type === 'in' ? 'Stock In' : 'Stock Out'}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Item</label>
                        <select
                            name="itemId"
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="">Choose an item...</option>
                            {items.map(i => (
                                <option key={i.id} value={i.id}>{i.name} ({i.location.name})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantity</label>
                        <input
                            type="number"
                            name="quantity"
                            step="0.01"
                            min="0.01"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            placeholder="Enter quantity"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                        <input
                            type="text"
                            name="reason"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            placeholder="e.g., Production batch #123"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <textarea
                            name="notes"
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                            placeholder="Additional notes..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className={cn(
                                "flex-1 py-3 px-4 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                                type === 'in'
                                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                                    : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700",
                                isPending && "opacity-70 cursor-not-allowed"
                            )}
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Processing...' : 'Confirm'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddItemModal({ locations, onClose }: {
    locations: StorageLocation[];
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);

        startTransition(async () => {
            const { createInventoryItem } = await import('@/lib/actions/inventory');
            await createInventoryItem(formData);
            onClose();
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Package size={24} />
                            <h3 className="text-xl font-bold">Add New Item</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
                            <input
                                type="text"
                                name="name"
                                required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="e.g., Portland Cement Grade 42.5"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                            <input
                                type="text"
                                name="sku"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="e.g., CEM-42-001"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                            <select
                                name="category"
                                required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            >
                                <option value="">Select category</option>
                                <option value="Raw Material">Raw Material</option>
                                <option value="Consumable">Consumable</option>
                                <option value="Equipment">Equipment</option>
                                <option value="Asset">Asset</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                            <select
                                name="itemType"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            >
                                <option value="General">General</option>
                                <option value="Cement">Cement</option>
                                <option value="Aggregate">Aggregate</option>
                                <option value="Admixture">Admixture</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Storage Location *</label>
                            <select
                                name="locationId"
                                required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            >
                                <option value="">Select location</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Initial Quantity</label>
                            <input
                                type="number"
                                name="quantity"
                                step="0.01"
                                defaultValue="0"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                            <select
                                name="unit"
                                required
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
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
                            <label className="block text-sm font-medium text-gray-700 mb-2">Max Capacity</label>
                            <input
                                type="number"
                                name="maxCapacity"
                                step="0.01"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="For silo items"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Min Threshold</label>
                            <input
                                type="number"
                                name="minThreshold"
                                step="0.01"
                                defaultValue="0"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="Low stock alert level"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost (₦)</label>
                            <input
                                type="number"
                                name="unitCost"
                                step="0.01"
                                defaultValue="0"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                            <input
                                type="date"
                                name="expiryDate"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                            <input
                                type="text"
                                name="batchNumber"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="e.g., B2024-001"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                            <input
                                type="text"
                                name="supplier"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                placeholder="Supplier name"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Clock size={24} />
                            <h3 className="text-xl font-bold">Material Request</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-amber-100 mt-2 text-sm">Submit a request for approval by Admin/Manager</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Request Type *</label>
                        <select
                            name="requestType"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="">Select type</option>
                            <option value="Stock In">Stock In (Receiving)</option>
                            <option value="Stock Out">Stock Out (Issuing)</option>
                            <option value="Transfer">Transfer Between Locations</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select Item *</label>
                        <select
                            name="itemId"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="">Choose an item...</option>
                            {items.map(i => (
                                <option key={i.id} value={i.id}>{i.name} ({i.location.name})</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                        <input
                            type="number"
                            name="quantity"
                            step="0.01"
                            min="0.01"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                            placeholder="Enter quantity"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select
                            name="priority"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        >
                            <option value="Normal">Normal</option>
                            <option value="Low">Low</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
                        <textarea
                            name="reason"
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none"
                            placeholder="Why is this material needed?"
                        />
                    </div>

                    <input type="hidden" name="requestedBy" value="Storekeeper" />

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-medium hover:from-amber-600 hover:to-amber-700 transition-all flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Database size={24} />
                            <h3 className="text-xl font-bold">{isEditing ? 'Edit Silo' : 'Add New Silo'}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Silo Name *</label>
                        <input
                            type="text"
                            name="name"
                            defaultValue={silo?.name || ''}
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            placeholder="e.g., Silo 3"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        <textarea
                            name="description"
                            rows={2}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                            placeholder="e.g., Secondary cement storage - Grade 52.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (kg)</label>
                        <input
                            type="number"
                            name="capacity"
                            defaultValue={silo?.maxCapacity || 80000}
                            step="1000"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            placeholder="Maximum capacity in kg"
                        />
                    </div>

                    {isEditing && (
                        <input type="hidden" name="isActive" value="true" />
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <ArrowDownRight size={24} />
                            <h3 className="text-xl font-bold">Load Cement to {silo.name}</h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-emerald-100 mt-2 text-sm">
                        Current Level: {silo.currentLevel.toLocaleString()} {silo.unit} ({silo.percentage.toFixed(1)}%)
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cement Type *</label>
                        <input
                            type="text"
                            name="cementName"
                            defaultValue={silo.itemName || ''}
                            required
                            disabled={hasExistingCement}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all disabled:bg-gray-50"
                            placeholder="e.g., Portland Cement (Grade 42.5)"
                        />
                        {hasExistingCement && (
                            <>
                                <input type="hidden" name="cementName" value={silo.itemName || ''} />
                                <p className="text-xs text-gray-500 mt-1">Cement type is fixed for this silo</p>
                            </>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Quantity to Add (kg) *</label>
                        <input
                            type="number"
                            name="quantity"
                            step="100"
                            min="100"
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                            placeholder="e.g., 10000"
                        />
                    </div>

                    {!hasExistingCement && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Capacity (kg)</label>
                                    <input
                                        type="number"
                                        name="maxCapacity"
                                        defaultValue={silo.maxCapacity || 80000}
                                        step="1000"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Threshold (kg)</label>
                                    <input
                                        type="number"
                                        name="minThreshold"
                                        defaultValue={15000}
                                        step="1000"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                                <input
                                    type="text"
                                    name="supplier"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    placeholder="e.g., Dangote Cement Ltd"
                                />
                            </div>
                        </>
                    )}

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                            {isPending && <Loader2 size={18} className="animate-spin" />}
                            {isPending ? 'Loading...' : 'Load Cement'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ==================== VIEW/EDIT ITEM MODAL ====================

function ViewItemModal({ item, locations, onClose }: {
    item: InventoryItem;
    locations: StorageLocation[];
    onClose: () => void;
}) {
    const [activeTabModal, setActiveTabModal] = useState<'details' | 'edit' | 'history'>('details');
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Package size={24} />
                            <div>
                                <h3 className="text-xl font-bold">{item.name}</h3>
                                {item.sku && <p className="text-sm text-indigo-100">SKU: {item.sku}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "px-3 py-1 text-xs font-semibold rounded-full",
                                item.quantity <= item.minThreshold
                                    ? "bg-red-500 text-white"
                                    : "bg-emerald-500 text-white"
                            )}>
                                {item.quantity <= item.minThreshold ? 'Low Stock' : 'In Stock'}
                            </span>
                            <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b border-gray-200 px-6 bg-gray-50">
                    <div className="flex gap-1">
                        {[
                            { id: 'details', label: 'Details', icon: <Info size={16} /> },
                            { id: 'edit', label: 'Edit', icon: <Edit size={16} /> },
                            { id: 'history', label: 'Transaction History', icon: <History size={16} /> }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTabModal(tab.id as typeof activeTabModal)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-3 font-medium transition-all relative",
                                    activeTabModal === tab.id
                                        ? "text-indigo-600"
                                        : "text-gray-600 hover:text-gray-900"
                                )}
                            >
                                {tab.icon}
                                {tab.label}
                                {activeTabModal === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTabModal === 'details' && (
                        <div className="grid grid-cols-2 gap-6">
                            <DetailItem label="Item Name" value={item.name} />
                            <DetailItem label="SKU" value={item.sku || 'N/A'} />
                            <DetailItem label="Category" value={item.category} />
                            <DetailItem label="Item Type" value={item.itemType} />
                            <DetailItem
                                label="Current Quantity"
                                value={`${item.quantity.toLocaleString()} ${item.unit}`}
                                highlight={item.quantity <= item.minThreshold}
                            />
                            <DetailItem label="Min Threshold" value={`${item.minThreshold.toLocaleString()} ${item.unit}`} />
                            {item.maxCapacity && (
                                <DetailItem label="Max Capacity" value={`${item.maxCapacity.toLocaleString()} ${item.unit}`} />
                            )}
                            <DetailItem label="Unit Cost" value={`₦${item.unitCost.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`} />
                            <DetailItem
                                label="Total Value"
                                value={`₦${item.totalValue.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`}
                            />
                            <DetailItem label="Storage Location" value={`${item.location.name} (${item.location.type})`} />
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
                    )}

                    {activeTabModal === 'edit' && (
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Item Name *</label>
                                    <input
                                        type="text"
                                        name="name"
                                        defaultValue={item.name}
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">SKU</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        defaultValue={item.sku || ''}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                                    <select
                                        name="category"
                                        defaultValue={item.category}
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    >
                                        <option value="Raw Material">Raw Material</option>
                                        <option value="Consumable">Consumable</option>
                                        <option value="Equipment">Equipment</option>
                                        <option value="Asset">Asset</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Item Type</label>
                                    <select
                                        name="itemType"
                                        defaultValue={item.itemType}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    >
                                        <option value="General">General</option>
                                        <option value="Cement">Cement</option>
                                        <option value="Aggregate">Aggregate</option>
                                        <option value="Admixture">Admixture</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Storage Location *</label>
                                    <select
                                        name="locationId"
                                        defaultValue={item.location.id}
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    >
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit *</label>
                                    <select
                                        name="unit"
                                        defaultValue={item.unit}
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    >
                                        <option value="kg">Kilograms (kg)</option>
                                        <option value="liters">Liters</option>
                                        <option value="pcs">Pieces</option>
                                        <option value="m³">Cubic Meters (m³)</option>
                                        <option value="tons">Tons</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Max Capacity</label>
                                    <input
                                        type="number"
                                        name="maxCapacity"
                                        defaultValue={item.maxCapacity || ''}
                                        step="0.01"
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Min Threshold *</label>
                                    <input
                                        type="number"
                                        name="minThreshold"
                                        defaultValue={item.minThreshold}
                                        step="0.01"
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost (₦) *</label>
                                    <input
                                        type="number"
                                        name="unitCost"
                                        defaultValue={item.unitCost}
                                        step="0.01"
                                        required
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date</label>
                                    <input
                                        type="date"
                                        name="expiryDate"
                                        defaultValue={item.expiryDate ? new Date(item.expiryDate).toISOString().split('T')[0] : ''}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Batch Number</label>
                                    <input
                                        type="text"
                                        name="batchNumber"
                                        defaultValue={item.batchNumber || ''}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Supplier</label>
                                    <input
                                        type="text"
                                        name="supplier"
                                        defaultValue={item.supplier || ''}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="px-4 py-3 border border-red-200 text-red-700 rounded-xl font-medium hover:bg-red-50 transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    Delete Item
                                </button>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => setActiveTabModal('details')}
                                    className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isPending}
                                    className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-medium hover:from-indigo-600 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {isPending && <Loader2 size={18} className="animate-spin" />}
                                    {isPending ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    )}

                    {activeTabModal === 'history' && (
                        <TransactionHistory itemId={item.id} />
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper component for detail items
function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="bg-gray-50 p-4 rounded-xl">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</div>
            <div className={cn(
                "text-sm font-semibold",
                highlight ? "text-red-600" : "text-gray-900"
            )}>
                {value}
            </div>
        </div>
    );
}

// Transaction History Component
function TransactionHistory({ itemId }: { itemId: string }) {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadTransactions() {
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
        }
        loadTransactions();
    }, [itemId]);

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
                        <div className={cn(
                            "px-2.5 py-1 text-xs font-medium rounded-lg",
                            txn.status === 'Approved' ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"
                        )}>
                            {txn.status}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
