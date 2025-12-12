'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
    Users, Building2, Plus, Search, Filter, MoreHorizontal,
    Phone, Mail, MapPin, Calendar, TrendingUp, DollarSign,
    ChevronRight, X, Loader2, AlertCircle, CheckCircle2,
    Receipt, Factory, Clock, Star, UserCircle, FileText,
    ArrowUpRight, ArrowDownRight, Wallet, PieChart
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getClients, createClient, getExpenses, createExpense, approveExpense, getExpenseAnalytics, getClientsForSelect } from '@/lib/actions/crm'
import { getTrucks } from '@/lib/actions/trucks'

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
        totalProductionRuns: number
        totalProductionVolume: number
        totalExpenses: number
    }
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

interface ExpenseAnalytics {
    summary: {
        totalExpenses: number
        expenseCount: number
        avgExpenseAmount: number
    }
    byCategory: { name: string; count: number; total: number; percentage: number }[]
    byClient: { name: string; count: number; total: number; percentage: number }[]
}

interface Truck {
    id: string
    plateNumber: string
}

// ==================== MAIN COMPONENT ====================

interface CRMClientProps {
    initialClients: Client[]
    userRole: string
    userName: string
}

export default function CRMClient({ initialClients, userRole, userName }: CRMClientProps) {
    const [activeTab, setActiveTab] = useState<'clients' | 'expenses' | 'analytics'>('clients')
    const [clients, setClients] = useState<Client[]>(initialClients)
    const [expenses, setExpenses] = useState<Expense[]>([])
    const [analytics, setAnalytics] = useState<ExpenseAnalytics | null>(null)
    const [trucks, setTrucks] = useState<Truck[]>([])
    const [clientsForSelect, setClientsForSelect] = useState<{ id: string; code: string; name: string }[]>([])

    // Modal states
    const [showClientModal, setShowClientModal] = useState(false)
    const [showExpenseModal, setShowExpenseModal] = useState(false)

    // Filter states
    const [clientFilter, setClientFilter] = useState({ status: 'all', category: 'all', search: '' })
    const [expenseFilter, setExpenseFilter] = useState({ category: 'all', status: 'all' })
    const [analyticsPeriod, setAnalyticsPeriod] = useState<'7days' | '30days' | '90days' | 'year'>('30days')

    const [isPending, startTransition] = useTransition()
    const [loading, setLoading] = useState(false)

    const canManageClients = ['Super Admin', 'Manager'].includes(userRole)
    const canManageExpenses = ['Super Admin', 'Manager', 'Accountant'].includes(userRole)
    const canApproveExpenses = ['Super Admin', 'Manager'].includes(userRole)

    // Load data based on active tab
    useEffect(() => {
        if (activeTab === 'expenses' && expenses.length === 0) {
            loadExpenses()
            loadTrucks()
            loadClientsForSelect()
        }
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

    async function loadExpenses() {
        setLoading(true)
        try {
            const data = await getExpenses(expenseFilter)
            setExpenses(data as Expense[])
        } catch (error) {
            console.error('Failed to load expenses:', error)
        } finally {
            setLoading(false)
        }
    }

    async function loadTrucks() {
        try {
            const data = await getTrucks()
            setTrucks(data.map(t => ({ id: t.id, plateNumber: t.plateNumber })))
        } catch (error) {
            console.error('Failed to load trucks:', error)
        }
    }

    async function loadClientsForSelect() {
        try {
            const data = await getClientsForSelect()
            setClientsForSelect(data)
        } catch (error) {
            console.error('Failed to load clients for select:', error)
        }
    }

    async function loadAnalytics() {
        setLoading(true)
        try {
            const data = await getExpenseAnalytics(analyticsPeriod)
            setAnalytics(data)
        } catch (error) {
            console.error('Failed to load analytics:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (activeTab === 'analytics') {
            loadAnalytics()
        }
    }, [analyticsPeriod])

    // Filter effect for clients
    useEffect(() => {
        const timer = setTimeout(() => {
            if (activeTab === 'clients') {
                loadClients()
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [clientFilter])

    useEffect(() => {
        if (activeTab === 'expenses') {
            loadExpenses()
        }
    }, [expenseFilter])

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
                    <p className="text-gray-600 mt-1">Manage clients, track expenses, and view analytics</p>
                </div>

                <div className="flex gap-3">
                    {canManageExpenses && (
                        <button
                            onClick={() => setShowExpenseModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium shadow-sm"
                        >
                            <Receipt size={18} />
                            Record Expense
                        </button>
                    )}
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
                    { id: 'expenses', label: 'Expenses', icon: Receipt },
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

            {activeTab === 'expenses' && (
                <ExpensesTab
                    expenses={expenses}
                    filter={expenseFilter}
                    setFilter={setExpenseFilter}
                    loading={loading || isPending}
                    canApprove={canApproveExpenses}
                    onApprove={async (id) => {
                        const result = await approveExpense(id)
                        if (result.success) loadExpenses()
                        return result
                    }}
                />
            )}

            {activeTab === 'analytics' && analytics && (
                <AnalyticsTab
                    analytics={analytics}
                    period={analyticsPeriod}
                    setPeriod={setAnalyticsPeriod}
                    loading={loading}
                />
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

            {/* Create Expense Modal */}
            {showExpenseModal && (
                <ExpenseModal
                    clients={clientsForSelect}
                    trucks={trucks}
                    onClose={() => setShowExpenseModal(false)}
                    onSuccess={() => {
                        setShowExpenseModal(false)
                        loadExpenses()
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
                                    <p className="text-lg font-bold text-gray-900">{client.stats.totalProductionRuns}</p>
                                    <p className="text-xs text-gray-500">Orders</p>
                                </div>
                                <div className="text-center border-x border-gray-200">
                                    <p className="text-lg font-bold text-gray-900">{client.stats.totalProductionVolume.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500">m³ Total</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-violet-600">₦{(client.stats.totalExpenses / 1000).toFixed(0)}k</p>
                                    <p className="text-xs text-gray-500">Expenses</p>
                                </div>
                            </div>

                            {/* Hover Action */}
                            <div className="px-4 py-3 bg-white border-t border-gray-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-gray-400">Payment: {client.paymentTerms}</span>
                                <button className="text-violet-600 hover:text-violet-700 text-sm font-medium flex items-center gap-1">
                                    View Details
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ==================== EXPENSES TAB ====================

function ExpensesTab({
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
    onApprove: (id: string) => Promise<{ success: boolean; message: string }>
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

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3">
                <select
                    value={filter.category}
                    onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
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
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
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
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                </div>
            ) : expenses.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">No expenses found</h3>
                    <p className="text-gray-500 mt-1">Record your first expense to get started.</p>
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
                                            <span className="font-semibold text-gray-900">₦{expense.amount.toLocaleString()}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-gray-600">
                                                {new Date(expense.date).toLocaleDateString('en-NG', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
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
                                                    ) : (
                                                        'Approve'
                                                    )}
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

// ==================== ANALYTICS TAB ====================

function AnalyticsTab({
    analytics,
    period,
    setPeriod,
    loading
}: {
    analytics: ExpenseAnalytics
    period: string
    setPeriod: (p: '7days' | '30days' | '90days' | 'year') => void
    loading: boolean
}) {
    return (
        <div className="space-y-6">
            {/* Period Selector */}
            <div className="flex gap-2">
                {[
                    { id: '7days', label: '7 Days' },
                    { id: '30days', label: '30 Days' },
                    { id: '90days', label: '90 Days' },
                    { id: 'year', label: 'Year' }
                ].map(p => (
                    <button
                        key={p.id}
                        onClick={() => setPeriod(p.id as '7days' | '30days' | '90days' | 'year')}
                        className={cn(
                            "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                            period === p.id
                                ? "bg-violet-600 text-white"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-violet-100 rounded-xl">
                                    <Wallet className="w-6 h-6 text-violet-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Total Expenses</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ₦{analytics.summary.totalExpenses.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Receipt className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Expense Count</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {analytics.summary.expenseCount}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="p-3 bg-green-100 rounded-xl">
                                    <TrendingUp className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Avg. Expense</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        ₦{analytics.summary.avgExpenseAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Breakdown Cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* By Category */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Expenses by Category</h3>
                            <div className="space-y-3">
                                {analytics.byCategory.map((cat, idx) => (
                                    <div key={cat.name} className="flex items-center gap-3">
                                        <div className="w-8 text-sm font-medium text-gray-500">#{idx + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-medium text-gray-900">{cat.name}</span>
                                                <span className="text-gray-600">₦{cat.total.toLocaleString()}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${cat.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-12 text-right text-sm text-gray-500">
                                            {cat.percentage.toFixed(1)}%
                                        </div>
                                    </div>
                                ))}
                                {analytics.byCategory.length === 0 && (
                                    <p className="text-gray-500 text-center py-4">No expense data available</p>
                                )}
                            </div>
                        </div>

                        {/* By Client */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Top Clients by Expenses</h3>
                            <div className="space-y-3">
                                {analytics.byClient.map((client, idx) => (
                                    <div key={client.name} className="flex items-center gap-3">
                                        <div className="w-8 text-sm font-medium text-gray-500">#{idx + 1}</div>
                                        <div className="flex-1">
                                            <div className="flex justify-between mb-1">
                                                <span className="font-medium text-gray-900 truncate">{client.name}</span>
                                                <span className="text-gray-600">₦{client.total.toLocaleString()}</span>
                                            </div>
                                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                                    style={{ width: `${client.percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                        <div className="w-12 text-right text-sm text-gray-500">
                                            {client.count}
                                        </div>
                                    </div>
                                ))}
                                {analytics.byClient.length === 0 && (
                                    <p className="text-gray-500 text-center py-4">No client expense data available</p>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Record Expense</h2>
                        <p className="text-sm text-gray-500">Log a new business expense</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-5">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Category *
                        </label>
                        <select
                            name="category"
                            required
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description *
                        </label>
                        <input
                            type="text"
                            name="description"
                            required
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            placeholder="Brief description of the expense"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Amount (₦) *
                            </label>
                            <input
                                type="number"
                                name="amount"
                                required
                                min={1}
                                step={0.01}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                            </label>
                            <input
                                type="date"
                                name="date"
                                defaultValue={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Invoice/Receipt Number
                        </label>
                        <input
                            type="text"
                            name="invoiceNumber"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                            placeholder="Optional"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Client (if applicable)
                        </label>
                        <select
                            name="clientId"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Truck
                            </label>
                            <select
                                name="truckId"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 resize-none"
                            placeholder="Additional notes..."
                        />
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
                        disabled={isPending}
                        onClick={(e) => {
                            const form = document.querySelector('form')
                            if (form) form.requestSubmit()
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isPending && <Loader2 size={16} className="animate-spin" />}
                        Record Expense
                    </button>
                </div>
            </div>
        </div>
    )
}
