'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    Users, Building2, Plus, Search, Filter, MoreHorizontal,
    Phone, Mail, MapPin, Calendar, TrendingUp, DollarSign,
    ChevronRight, X, Loader2, AlertCircle, CheckCircle2,
    Star, UserCircle, FileText, Factory,
    ArrowUpRight, ArrowDownRight, Wallet, PieChart
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { getClients, createClient, getCRMMetrics } from '@/lib/actions/crm'

// ==================== TYPE DEFINITIONS ====================

interface Client {
    id: string
    code: string
    name: string
    type: string
    email: string | null
    phone: string
    altPhone: string | null
    address: string
    city: string
    state: string
    taxId: string | null
    paymentTerms: string
    creditLimit: number | null
    currentBalance: number
    walletBalance: number
    category: string
    status: string
    notes: string | null
    createdAt: Date
    primaryContact: {
        name: string
        role: string | null
        phone: string
        email: string | null
    } | null
    stats: {
        totalOrders: number
        totalVolume: number
        totalExpenses: number
    }
}

interface CRMMetrics {
    clients: {
        total: number
        newThisMonth: number
        newLastMonth: number
        byStatus: Record<string, number>
        byCategory: Record<string, number>
        byType: Record<string, number>
    }
    pipeline: { status: string; count: number; value: number }[]
    revenue: {
        totalOrderValue: number
        totalCollected: number
        totalOutstanding: number
        collectionRate: number
    }
    topClients: { name: string; category: string; totalOrders: number; totalValue: number; fulfilledValue: number }[]
    conversionRate: number
    totalOrders: number
}

// ==================== MAIN COMPONENT ====================

interface CRMClientProps {
    initialClients: Client[]
    userRole: string
    userName: string
}

export default function CRMClient({ initialClients, userRole, userName }: CRMClientProps) {
    const [activeTab, setActiveTab] = useState<'clients' | 'analytics'>('clients')
    const [clients, setClients] = useState<Client[]>(initialClients)
    const [analytics, setAnalytics] = useState<CRMMetrics | null>(null)

    // Modal states
    const [showClientModal, setShowClientModal] = useState(false)

    // Filter states
    const [clientFilter, setClientFilter] = useState({ status: 'all', category: 'all', search: '' })

    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(false)

    const canManageClients = ['Super Admin', 'Manager'].includes(userRole)

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 'analytics' && !analytics) {
            loadAnalytics()
        }
    }, [activeTab])

    async function loadClients() {
        setLoading(true)
        try {
            const data = await getClients(clientFilter)
            setClients(data as Client[])
        } catch (error) {
            console.error('Failed to load clients:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadAnalytics() {
        setLoading(true)
        try {
            const data = await getCRMMetrics()
            if (data) setAnalytics(data)
        } catch (error) {
            console.error('Failed to load analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    // Filter effect for clients
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'clients') {
                loadClients()
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [clientFilter])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white">
                            <Users size={24} />
                        </div>
                        Customer Relationship
                    </h1>
                    <p className="text-gray-600 mt-1">Manage clients and view analytics</p>
                </div>

                <div className="flex gap-3">
                    {canManageClients && (
                        <button
                            onClick={() => setShowClientModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all font-medium shadow-lg shadow-violet-500/25"
                        >
                            <Plus size={18} />
                            Add Client
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 inline-flex">
                {[
                    { id: 'clients', label: 'Clients', icon: Building2 },
                    { id: 'analytics', label: 'Analytics', icon: PieChart }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all",
                            activeTab === tab.id
                                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25"
                                : "text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'clients' && (
                <ClientsTab
                    clients={clients}
                    filter={clientFilter}
                    setFilter={setClientFilter}
                    loading={loading || isPending}
                    canManageClients={canManageClients}
                />
            )}

            {activeTab === 'analytics' && analytics && (
                <AnalyticsTab analytics={analytics} loading={loading} />
            )}

            {/* Create Client Modal */}
            {showClientModal && (
                <ClientModal
                    onClose={() => setShowClientModal(false)}
                    onSuccess={() => {
                        setShowClientModal(false)
                        loadClients()
                    }}
                />
            )}

        </div>
    )
}

// ==================== CLIENTS TAB ====================

function ClientsTab({
    clients,
    filter,
    setFilter,
    loading,
    canManageClients
}: {
    clients: Client[]
    filter: { status: string; category: string; search: string }
    setFilter: (f: typeof filter) => void
    loading: boolean
    canManageClients: boolean
}) {
    const [selectedClient, setSelectedClient] = useState<Client | null>(null)

    const categoryColors: Record<string, string> = {
        VIP: 'bg-amber-100 text-amber-700 border-amber-200',
        Regular: 'bg-blue-100 text-blue-700 border-blue-200',
        New: 'bg-green-100 text-green-700 border-green-200',
        Dormant: 'bg-gray-100 text-gray-600 border-gray-200'
    }

    const statusColors: Record<string, string> = {
        Active: 'bg-emerald-500',
        Inactive: 'bg-gray-400',
        Suspended: 'bg-red-500',
        Blacklisted: 'bg-red-700'
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search clients..."
                        value={filter.search}
                        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                    />
                </div>
                <select
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                >
                    <option value="all">All Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                </select>
                <select
                    value={filter.category}
                    onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                >
                    <option value="all">All Categories</option>
                    <option value="VIP">VIP</option>
                    <option value="Regular">Regular</option>
                    <option value="New">New</option>
                    <option value="Dormant">Dormant</option>
                </select>
            </div>

            {/* Clients Grid */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                </div>
            ) : clients.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No clients found</h3>
                    <p className="text-gray-500 mt-1">Try adjusting your filters or add a new client.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {clients.map(client => (
                        <div
                            key={client.id}
                            className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg hover:border-violet-200 transition-all duration-300 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="p-5 border-b border-gray-50">
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="w-12 h-12 bg-gradient-to-br from-violet-100 to-purple-100 rounded-xl flex items-center justify-center">
                                                <Building2 className="w-6 h-6 text-violet-600" />
                                            </div>
                                            <div className={cn(
                                                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white",
                                                statusColors[client.status] || 'bg-gray-400'
                                            )} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-400">{client.code}</p>
                                            <h3 className="font-semibold text-gray-900 line-clamp-1">{client.name}</h3>
                                        </div>
                                    </div>
                                    <span className={cn(
                                        "px-2.5 py-1 text-xs font-medium rounded-lg border",
                                        categoryColors[client.category] || categoryColors.Regular
                                    )}>
                                        {client.category}
                                    </span>
                                </div>

                                {/* Contact Info */}
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Phone size={14} className="text-gray-400" />
                                        <span>{client.phone}</span>
                                    </div>
                                    {client.email && (
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Mail size={14} className="text-gray-400" />
                                            <span className="truncate">{client.email}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <MapPin size={14} className="text-gray-400" />
                                        <span className="truncate">{client.city}, {client.state}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Stats Footer */}
                            <div className="p-4 bg-gray-50/50 grid grid-cols-3 gap-3">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-gray-900">{client.stats.totalOrders}</p>
                                    <p className="text-xs text-gray-500">Orders</p>
                                </div>
                                <div className="text-center border-x border-gray-200">
                                    <p className="text-lg font-bold text-gray-900">{client.stats.totalVolume.toFixed(1)}</p>
                                    <p className="text-xs text-gray-500">m³ Total</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-violet-600">{formatCurrency(client.stats.totalExpenses)}</p>
                                    <p className="text-xs text-gray-500">Expenses</p>
                                </div>
                            </div>

                            {/* Hover Action */}
                            <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-gray-400">Payment: {client.paymentTerms}</span>
                                <button
                                    onClick={() => setSelectedClient(client)}
                                    className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1"
                                >
                                    View Details
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Client Detail Modal */}
            {selectedClient && (
                <ClientDetailModal
                    client={selectedClient}
                    onClose={() => setSelectedClient(null)}
                />
            )}
        </div>
    )
}

// ==================== ANALYTICS TAB ====================

function AnalyticsTab({ analytics, loading }: { analytics: CRMMetrics; loading: boolean }) {
    const pipelineOrder = ['Draft', 'Pending', 'Active', 'Fulfilled', 'Closed', 'Cancelled']
    const pipelineColors: Record<string, string> = {
        Draft: 'bg-gray-400',
        Pending: 'bg-amber-400',
        Active: 'bg-blue-500',
        Fulfilled: 'bg-emerald-500',
        Closed: 'bg-violet-500',
        Cancelled: 'bg-red-400',
    }
    const categoryColors: Record<string, string> = {
        VIP: 'bg-amber-400',
        Regular: 'bg-blue-400',
        New: 'bg-emerald-400',
        Dormant: 'bg-gray-400',
    }

    const maxPipelineValue = Math.max(...analytics.pipeline.map(p => p.value), 1)
    const acquisitionTrend = analytics.clients.newLastMonth > 0
        ? ((analytics.clients.newThisMonth - analytics.clients.newLastMonth) / analytics.clients.newLastMonth * 100)
        : analytics.clients.newThisMonth > 0 ? 100 : 0

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Row 1: Key KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Clients</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.clients.total}</p>
                    <p className="text-xs text-gray-500 mt-1">{analytics.clients.byStatus['Active'] || 0} active</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">New This Month</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.clients.newThisMonth}</p>
                    <p className={cn("text-xs mt-1 flex items-center gap-1", acquisitionTrend >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {acquisitionTrend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        {Math.abs(acquisitionTrend).toFixed(0)}% vs last month
                    </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Pipeline Value</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                        {formatCurrency(analytics.revenue.totalOrderValue)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{analytics.totalOrders} total orders</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Collection Rate</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{analytics.revenue.collectionRate.toFixed(1)}%</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {formatCurrency(analytics.revenue.totalOutstanding)} outstanding
                    </p>
                </div>
            </div>

            {/* Row 2: Revenue + Pipeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Revenue Summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <DollarSign size={18} className="text-emerald-600" /> Revenue Summary
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Total Order Value</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(analytics.revenue.totalOrderValue)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full" />
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Collected</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(analytics.revenue.totalCollected)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${analytics.revenue.collectionRate}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Outstanding</span>
                                <span className="font-semibold text-red-500">{formatCurrency(analytics.revenue.totalOutstanding)}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-400 rounded-full transition-all duration-500"
                                    style={{ width: `${100 - analytics.revenue.collectionRate}%` }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 pt-4 border-t border-gray-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Order Conversion Rate</span>
                            <span className="font-bold text-violet-600">{analytics.conversionRate.toFixed(1)}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Orders that became Active, Fulfilled, or Closed</p>
                    </div>
                </div>

                {/* Sales Pipeline */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-600" /> Sales Pipeline
                    </h3>
                    <div className="space-y-3">
                        {pipelineOrder.map(status => {
                            const entry = analytics.pipeline.find(p => p.status === status)
                            if (!entry) return null
                            const widthPct = (entry.value / maxPipelineValue) * 100
                            return (
                                <div key={status} className="flex items-center gap-3">
                                    <div className="w-20 text-xs font-medium text-gray-600">{status}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-500">{entry.count} orders</span>
                                            <span className="font-medium text-gray-700">{formatCurrency(entry.value)}</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-500", pipelineColors[status] || 'bg-gray-400')}
                                                style={{ width: `${widthPct}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {analytics.pipeline.length === 0 && (
                            <p className="text-gray-400 text-center py-6">No order data yet</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Row 3: Client Breakdown + Top Clients */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Client breakdown by category */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Users size={18} className="text-violet-600" /> Client Breakdown
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(analytics.clients.byCategory).map(([cat, count]) => {
                            const pct = analytics.clients.total > 0 ? (count / analytics.clients.total) * 100 : 0
                            return (
                                <div key={cat} className="flex items-center gap-3">
                                    <span className={cn("w-2 h-2 rounded-full shrink-0", categoryColors[cat] || 'bg-gray-400')} />
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-800">{cat}</span>
                                            <span className="text-gray-500">{count} clients</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={cn("h-full rounded-full transition-all duration-500", categoryColors[cat] || 'bg-gray-400')}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className="w-10 text-right text-xs text-gray-400">{pct.toFixed(0)}%</span>
                                </div>
                            )
                        })}
                        {/* Status pill summary */}
                        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                            {Object.entries(analytics.clients.byStatus).map(([status, count]) => (
                                <span key={status} className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                    {status}: {count}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top clients by order value */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Star size={18} className="text-amber-500" /> Top Clients by Revenue
                    </h3>
                    <div className="space-y-3">
                        {analytics.topClients.length === 0 ? (
                            <p className="text-gray-400 text-center py-6">No order data yet</p>
                        ) : analytics.topClients.map((client, idx) => (
                            <div key={client.name} className="flex items-center gap-3">
                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                    {idx + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-medium text-gray-900 text-sm truncate">{client.name}</span>
                                        <span className="font-bold text-gray-900 text-sm ml-2 shrink-0">
                                            {formatCurrency(client.totalValue)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-gray-400">{client.totalOrders} orders</span>
                                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">{client.category}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ==================== CLIENT MODAL ====================

function ClientModal({
    onClose,
    onSuccess
}: {
    onClose: () => void
    onSuccess: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)

        const formData = new FormData(e.currentTarget)

        startTransition(async () => {
            const result = await createClient(formData)
            if (result.success) {
                onSuccess()
            } else {
                setError(result.message)
            }
        })
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Add New Client</h2>
                        <p className="text-sm text-gray-500">Enter client details to create a new record</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* Basic Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Building2 size={16} />
                                Basic Information
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Company/Client Name *
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="e.g., ABC Construction Ltd"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Client Type
                                    </label>
                                    <select
                                        name="type"
                                        defaultValue="Business"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                    >
                                        <option value="Business">Business</option>
                                        <option value="Individual">Individual</option>
                                        <option value="Government">Government</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category
                                    </label>
                                    <select
                                        name="category"
                                        defaultValue="New"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                    >
                                        <option value="VIP">VIP</option>
                                        <option value="Regular">Regular</option>
                                        <option value="New">New</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <Phone size={16} />
                                Contact Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Phone Number *
                                    </label>
                                    <input
                                        type="tel"
                                        name="phone"
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="e.g., 08012345678"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Alt. Phone
                                    </label>
                                    <input
                                        type="tel"
                                        name="altPhone"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="Optional"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="e.g., contact@company.com"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <MapPin size={16} />
                                Address
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Street Address *
                                    </label>
                                    <input
                                        type="text"
                                        name="address"
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="e.g., 123 Main Street"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        City *
                                    </label>
                                    <input
                                        type="text"
                                        name="city"
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="e.g., Lagos"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        State *
                                    </label>
                                    <input
                                        type="text"
                                        name="state"
                                        required
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="e.g., Lagos State"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Business Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                <DollarSign size={16} />
                                Business Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Tax ID / TIN
                                    </label>
                                    <input
                                        type="text"
                                        name="taxId"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="Optional"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Payment Terms
                                    </label>
                                    <select
                                        name="paymentTerms"
                                        defaultValue="Net 30"
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                    >
                                        <option value="COD">COD (Cash on Delivery)</option>
                                        <option value="Net 15">Net 15</option>
                                        <option value="Net 30">Net 30</option>
                                        <option value="Net 60">Net 60</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Credit Limit (₦)
                                    </label>
                                    <input
                                        type="number"
                                        name="creditLimit"
                                        min={0}
                                        step={1000}
                                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="Leave empty for no limit"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes
                            </label>
                            <textarea
                                name="notes"
                                rows={3}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
                                placeholder="Any additional notes about this client..."
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="client-form"
                        disabled={isPending}
                        onClick={(e) => {
                            const form = document.querySelector('form')
                            if (form) form.requestSubmit()
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isPending && <Loader2 size={16} className="animate-spin" />}
                        Create Client
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== CLIENT DETAIL MODAL ====================

function ClientDetailModal({
    client,
    onClose
}: {
    client: Client
    onClose: () => void
}) {
    const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'report'>('overview')
    const [salesOrders, setSalesOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [dateFrom, setDateFrom] = useState('')
    const [dateTo, setDateTo] = useState('')
    const [reportDateFrom, setReportDateFrom] = useState('')
    const [reportDateTo, setReportDateTo] = useState('')

    // Fetch sales orders when tab changes to orders or report
    useEffect(() => {
        if (activeTab === 'orders' || activeTab === 'report') {
            loadSalesOrders()
        }
    }, [activeTab])

    const loadSalesOrders = async () => {
        setLoading(true)
        try {
            const { getClientSalesOrders } = await import('@/lib/actions/crm')
            const orders = await getClientSalesOrders(client.id)
            setSalesOrders(orders)
        } catch (error) {
            console.error('Error loading sales orders:', error)
        } finally {
            setLoading(false)
        }
    }

    // Filter orders based on search and date
    const filteredOrders = salesOrders.filter(order => {
        const matchesSearch = !searchQuery ||
            order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.lineItems?.some((item: any) => item.recipe?.name?.toLowerCase().includes(searchQuery.toLowerCase()))

        const orderDate = new Date(order.orderDate)
        const matchesDateFrom = !dateFrom || orderDate >= new Date(dateFrom)
        const matchesDateTo = !dateTo || orderDate <= new Date(dateTo + 'T23:59:59')

        return matchesSearch && matchesDateFrom && matchesDateTo
    })

    // Calculate totals for filtered orders
    const totalVolume = filteredOrders.reduce((sum, order) =>
        sum + order.lineItems.reduce((lineSum: number, item: any) => lineSum + (item.cubicMeters || 0), 0), 0
    )
    const totalAmount = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
    const totalPaid = filteredOrders.reduce((sum, order) => sum + (order.amountPaid || 0), 0)

    // Report filtered orders
    const reportFilteredOrders = salesOrders.filter(order => {
        const orderDate = new Date(order.orderDate)
        const matchesDateFrom = !reportDateFrom || orderDate >= new Date(reportDateFrom)
        const matchesDateTo = !reportDateTo || orderDate <= new Date(reportDateTo + 'T23:59:59')
        return matchesDateFrom && matchesDateTo
    })

    // Calculate report totals
    const reportTotalOrders = reportFilteredOrders.length
    const reportTotalVolume = reportFilteredOrders.reduce((sum, order) =>
        sum + order.lineItems.reduce((lineSum: number, item: any) => lineSum + (item.cubicMeters || 0), 0), 0
    )
    const reportTotalPaid = reportFilteredOrders.reduce((sum, order) => sum + (order.amountPaid || 0), 0)

    const handleDownloadPDF = () => {
        // Create printable content
        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const content = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Client Report - ${client.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; }
                    h1 { color: #7c3aed; }
                    .header { margin-bottom: 30px; }
                    .stats { display: flex; gap: 20px; margin: 20px 0; }
                    .stat-card { background: #f3f4f6; padding: 15px 25px; border-radius: 8px; text-align: center; }
                    .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
                    .stat-label { font-size: 12px; color: #6b7280; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                    th { background: #f9fafb; font-weight: 600; }
                    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Client Production Report</h1>
                    <p><strong>${client.code}</strong> - ${client.name}</p>
                    <p>Report generated: ${new Date().toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    ${reportDateFrom || reportDateTo ? `<p>Date Range: ${reportDateFrom || 'Start'} to ${reportDateTo || 'Present'}</p>` : '<p>All orders included</p>'}
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">${reportTotalOrders}</div>
                        <div class="stat-label">Orders</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${reportTotalVolume.toFixed(1)}</div>
                        <div class="stat-label">Total Volume (m³)</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${formatCurrency(reportTotalPaid)}</div>
                        <div class="stat-label">Total Paid</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Order #</th>
                            <th>Date</th>
                            <th>Products</th>
                            <th>Volume (m³)</th>
                            <th>Total (₦)</th>
                            <th>Paid (₦)</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${reportFilteredOrders.map(order => `
                            <tr>
                                <td>${order.orderNumber}</td>
                                <td>${new Date(order.orderDate).toLocaleDateString('en-NG')}</td>
                                <td>${order.lineItems?.map((item: any) => item.recipe?.name || item.productType).join(', ') || '-'}</td>
                                <td>${order.lineItems?.reduce((sum: number, item: any) => sum + (item.cubicMeters || 0), 0).toFixed(1)} m³</td>
                                <td>${formatCurrency(order.totalAmount ?? 0)}</td>
                                <td>${formatCurrency(order.amountPaid ?? 0)}</td>
                                <td>${order.status}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>Generated by Wet N Dry ERP System</p>
                </div>
            </body>
            </html>
        `

        printWindow.document.write(content)
        printWindow.document.close()
        printWindow.print()
    }

    const statusColors: Record<string, string> = {
        Active: 'bg-emerald-100 text-emerald-700',
        Inactive: 'bg-gray-100 text-gray-600',
        Suspended: 'bg-red-100 text-red-700',
        Blacklisted: 'bg-red-100 text-red-700'
    }

    const categoryColors: Record<string, string> = {
        VIP: 'bg-amber-100 text-amber-700',
        Regular: 'bg-blue-100 text-blue-700',
        New: 'bg-green-100 text-green-700',
        Dormant: 'bg-gray-100 text-gray-600'
    }

    const tabs = [
        { id: 'overview', label: 'Overview', icon: Building2 },
        { id: 'orders', label: 'Sales Orders', icon: Factory },
        { id: 'report', label: 'Generate Report', icon: FileText }
    ] as const

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-6 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <Building2 className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <p className="text-violet-200 text-sm font-medium">{client.code}</p>
                            <h2 className="text-xl font-bold">{client.name}</h2>
                            <div className="flex gap-2 mt-1.5">
                                <span className={cn(
                                    "px-2 py-0.5 text-xs font-medium rounded-full",
                                    statusColors[client.status] || statusColors.Active
                                )}>
                                    {client.status}
                                </span>
                                <span className={cn(
                                    "px-2 py-0.5 text-xs font-medium rounded-full",
                                    categoryColors[client.category] || categoryColors.Regular
                                )}>
                                    {client.category}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 px-6 bg-white">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === tab.id
                                    ? "border-violet-600 text-violet-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-280px)]">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="space-y-5">
                            {/* Statistics */}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="bg-violet-50 rounded-xl p-3.5 text-center">
                                    <p className="text-xl font-bold text-violet-700">{client.stats.totalOrders}</p>
                                    <p className="text-xs text-violet-600">Total Orders</p>
                                </div>
                                <div className="bg-blue-50 rounded-xl p-3.5 text-center">
                                    <p className="text-xl font-bold text-blue-700">{client.stats.totalVolume.toFixed(1)}</p>
                                    <p className="text-xs text-blue-600">Volume (m³)</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-center">
                                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(client.walletBalance || 0)}</p>
                                    <p className="text-xs text-emerald-600">Wallet Balance</p>
                                </div>
                                <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-center">
                                    <p className="text-xl font-bold text-red-600">{formatCurrency(client.stats.totalExpenses)}</p>
                                    <p className="text-xs text-red-500">Expenses</p>
                                </div>
                            </div>

                            {/* Contact Info & Address */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <Phone size={14} />
                                        Contact Information
                                    </h3>
                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-xs text-gray-500">Phone</p>
                                            <p className="font-medium text-gray-900 text-sm">{client.phone}</p>
                                        </div>
                                        {client.email && (
                                            <div>
                                                <p className="text-xs text-gray-500">Email</p>
                                                <p className="font-medium text-gray-900 text-sm">{client.email}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <MapPin size={14} />
                                        Address
                                    </h3>
                                    <div>
                                        <p className="font-medium text-gray-900 text-sm">{client.address}</p>
                                        <p className="text-gray-600 text-sm">{client.city}, {client.state}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Business Details */}
                            <div className="bg-gray-50 rounded-xl p-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                    <FileText size={14} />
                                    Business Details
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500">Client Type</p>
                                        <p className="font-medium text-gray-900 text-sm">{client.type}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Payment Terms</p>
                                        <p className="font-medium text-gray-900 text-sm">{client.paymentTerms}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Member Since */}
                            <div className="text-center text-sm text-gray-500 pt-2">
                                <Calendar size={14} className="inline mr-1" />
                                Member since {new Date(client.createdAt).toLocaleDateString('en-NG', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </div>
                        </div>
                    )}

                    {/* Production Orders Tab */}
                    {activeTab === 'orders' && (
                        <div className="space-y-4">
                            {/* Search & Filters */}
                            <div className="flex gap-3 items-center">
                                <div className="flex-1 relative">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search orders..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                    />
                                </div>
                                <input
                                    type="date"
                                    value={dateFrom}
                                    onChange={(e) => setDateFrom(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                />
                                <span className="text-gray-400 text-sm">to</span>
                                <input
                                    type="date"
                                    value={dateTo}
                                    onChange={(e) => setDateTo(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                />
                            </div>

                            {/* Summary */}
                            <p className="text-sm text-gray-500">
                                Showing <span className="font-medium text-gray-700">{filteredOrders.length}</span> orders &nbsp;
                                Volume: <span className="font-medium text-violet-600">{totalVolume.toFixed(1)} m³</span> &nbsp;
                                Paid: <span className="font-medium text-emerald-600">{formatCurrency(totalPaid)}</span>
                            </p>

                            {/* Orders Table */}
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
                                </div>
                            ) : filteredOrders.length > 0 ? (
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Order #</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Date</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Products</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Volume</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Total</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Paid</th>
                                                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredOrders.map((order) => {
                                                const orderVolume = order.lineItems?.reduce((sum: number, item: any) => sum + (item.cubicMeters || 0), 0) || 0
                                                const products = order.lineItems?.map((item: any) => item.recipe?.name || item.productType).join(', ') || '-'
                                                return (
                                                    <tr key={order.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2.5 text-violet-600 font-medium">{order.orderNumber}</td>
                                                        <td className="px-4 py-2.5 text-gray-900">
                                                            {new Date(order.orderDate).toLocaleDateString('en-NG', {
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <span className="font-medium text-gray-900">{products}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-900">{orderVolume.toFixed(1)} m³</td>
                                                        <td className="px-4 py-2.5 text-gray-900">{formatCurrency(order.totalAmount ?? 0)}</td>
                                                        <td className="px-4 py-2.5 text-emerald-600 font-medium">{formatCurrency(order.amountPaid ?? 0)}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={cn(
                                                                "px-2 py-0.5 text-xs font-medium rounded-full",
                                                                order.status === 'Active' || order.status === 'Fulfilled' ? "bg-emerald-100 text-emerald-700" :
                                                                    order.status === 'Draft' ? "bg-gray-100 text-gray-600" :
                                                                        order.status === 'Pending' ? "bg-amber-100 text-amber-700" :
                                                                            "bg-blue-100 text-blue-700"
                                                            )}>
                                                                {order.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500">
                                    <Factory className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p>No sales orders found</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Generate Report Tab */}
                    {activeTab === 'report' && (
                        <div className="space-y-5">
                            <div className="bg-violet-50 rounded-xl p-5">
                                <h3 className="font-semibold text-gray-900 mb-1">Generate PDF Report</h3>
                                <p className="text-sm text-gray-600">
                                    Generate a comprehensive PDF report for this client including all production orders within the selected date range.
                                </p>
                            </div>

                            {/* Date Range Selection */}
                            <div className="bg-gray-50 rounded-xl p-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4">Select Date Range</h4>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">From</label>
                                        <input
                                            type="date"
                                            value={reportDateFrom}
                                            onChange={(e) => setReportDateFrom(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-500 mb-1">To</label>
                                        <input
                                            type="date"
                                            value={reportDateTo}
                                            onChange={(e) => setReportDateTo(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-2">Leave empty to include all orders</p>
                            </div>

                            {/* Report Preview */}
                            <div className="border border-gray-200 rounded-xl p-5">
                                <h4 className="text-sm font-semibold text-gray-700 mb-4">Report Preview</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                        <p className="text-2xl font-bold text-violet-600">{reportTotalOrders}</p>
                                        <p className="text-xs text-gray-500">Orders</p>
                                    </div>
                                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                                        <p className="text-2xl font-bold text-violet-600">{reportTotalVolume.toFixed(1)}</p>
                                        <p className="text-xs text-gray-500">Total Volume (m³)</p>
                                    </div>
                                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                                        <p className="text-2xl font-bold text-emerald-600">{formatCurrency(reportTotalPaid)}</p>
                                        <p className="text-xs text-gray-500">Total Paid</p>
                                    </div>
                                </div>
                            </div>

                            {/* Download Button */}
                            <button
                                onClick={handleDownloadPDF}
                                disabled={loading}
                                className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2"
                            >
                                <FileText size={18} />
                                Download PDF Report
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end p-6 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}
