'use client'

import { useState, useTransition } from 'react'
import {
    AlertTriangle, Search, CheckCircle2, EyeOff, RefreshCw, Loader2,
    Package, Users, Building2, Copy, ArrowLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { toast } from 'sonner'

interface DuplicateAlert {
    id: string
    entityType: string
    entityId1: string
    entityId2: string
    field: string
    value: string
    status: string
    resolvedBy: string | null
    resolvedAt: Date | null
    createdAt: Date
}

interface Pagination {
    page: number
    limit: number
    totalCount: number
    totalPages: number
}

interface DuplicateAlertsClientProps {
    initialAlerts: DuplicateAlert[]
    initialPagination: Pagination
}

export default function DuplicateAlertsClient({ initialAlerts, initialPagination }: DuplicateAlertsClientProps) {
    const [alerts, setAlerts] = useState(initialAlerts)
    const [pagination, setPagination] = useState(initialPagination)
    const [statusFilter, setStatusFilter] = useState<'Open' | 'Resolved' | 'Ignored' | 'all'>('Open')
    const [isScanning, setIsScanning] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const entityTypeIcons: Record<string, React.ReactNode> = {
        'InventoryItem': <Package size={16} className="text-blue-600" />,
        'Client': <Building2 size={16} className="text-purple-600" />,
        'Staff': <Users size={16} className="text-emerald-600" />,
    }

    const entityTypeColors: Record<string, string> = {
        'InventoryItem': 'bg-blue-50 text-blue-700',
        'Client': 'bg-purple-50 text-purple-700',
        'Staff': 'bg-emerald-50 text-emerald-700',
    }

    const entityTypeLabels: Record<string, string> = {
        'InventoryItem': 'Inventory Item',
        'Client': 'Client',
        'Staff': 'Staff',
    }

    const fieldLabels: Record<string, string> = {
        'name': 'Name',
        'email': 'Email',
        'phone': 'Phone',
    }

    const handleScan = async () => {
        setIsScanning(true)
        try {
            const { scanForDuplicates } = await import('@/lib/actions/duplicates')
            const result = await scanForDuplicates()
            toast.success(`Scan complete. ${result.alertsCreated} new duplicate(s) found.`)
            await refreshAlerts()
        } catch (error) {
            console.error('Scan failed:', error)
            toast.error('Failed to scan for duplicates')
        } finally {
            setIsScanning(false)
        }
    }

    const refreshAlerts = async () => {
        startTransition(async () => {
            try {
                const { getDuplicateAlerts } = await import('@/lib/actions/duplicates')
                const data = await getDuplicateAlerts(statusFilter === 'all' ? undefined : statusFilter)
                setAlerts(data.alerts)
                setPagination(data.pagination)
            } catch (error) {
                console.error('Failed to refresh alerts:', error)
            }
        })
    }

    const handleResolve = async (id: string) => {
        setActionLoading(id)
        try {
            const { resolveDuplicateAlert } = await import('@/lib/actions/duplicates')
            await resolveDuplicateAlert(id)
            toast.success('Alert resolved')
            await refreshAlerts()
        } catch (error) {
            toast.error('Failed to resolve alert')
        } finally {
            setActionLoading(null)
        }
    }

    const handleIgnore = async (id: string) => {
        setActionLoading(id)
        try {
            const { ignoreDuplicateAlert } = await import('@/lib/actions/duplicates')
            await ignoreDuplicateAlert(id)
            toast.success('Alert ignored')
            await refreshAlerts()
        } catch (error) {
            toast.error('Failed to ignore alert')
        } finally {
            setActionLoading(null)
        }
    }

    const handleFilterChange = (filter: typeof statusFilter) => {
        setStatusFilter(filter)
        startTransition(async () => {
            try {
                const { getDuplicateAlerts } = await import('@/lib/actions/duplicates')
                const data = await getDuplicateAlerts(filter === 'all' ? undefined : filter)
                setAlerts(data.alerts)
                setPagination(data.pagination)
            } catch (error) {
                console.error('Failed to filter alerts:', error)
            }
        })
    }

    const getEntityLink = (entityType: string, entityId: string): string => {
        switch (entityType) {
            case 'InventoryItem': return '/inventory'
            case 'Client': return '/crm'
            case 'Staff': return '/staff'
            default: return '#'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <Link
                            href="/settings"
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </Link>
                        <h1 className="text-2xl font-bold text-gray-900">Duplicate Alerts</h1>
                        {pagination.totalCount > 0 && (
                            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-sm font-semibold rounded-full">
                                {pagination.totalCount}
                            </span>
                        )}
                    </div>
                    <p className="text-gray-500 ml-8">Scan and manage duplicate records across the system</p>
                </div>
                <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isScanning ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <Search size={18} />
                    )}
                    {isScanning ? 'Scanning...' : 'Scan for Duplicates'}
                </button>
            </div>

            {/* Status Filter */}
            <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
                {[
                    { value: 'Open', label: 'Open' },
                    { value: 'Resolved', label: 'Resolved' },
                    { value: 'Ignored', label: 'Ignored' },
                    { value: 'all', label: 'All' }
                ].map(opt => (
                    <button
                        key={opt.value}
                        onClick={() => handleFilterChange(opt.value as typeof statusFilter)}
                        className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                            statusFilter === opt.value
                                ? "bg-white text-blue-700 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        )}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Alerts List */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {isPending ? (
                    <div className="p-12 text-center">
                        <Loader2 size={32} className="mx-auto text-blue-400 animate-spin mb-3" />
                        <p className="text-gray-500">Loading alerts...</p>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="p-12 text-center">
                        <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4" />
                        <h4 className="text-lg font-medium text-gray-600">
                            {statusFilter === 'Open' ? 'No Duplicate Alerts' : 'No alerts found'}
                        </h4>
                        <p className="text-sm text-gray-400 mt-1">
                            {statusFilter === 'Open'
                                ? 'Click "Scan for Duplicates" to check for duplicate records'
                                : 'No alerts match the current filter'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {alerts.map((alert) => (
                            <div key={alert.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={cn(
                                                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg",
                                                entityTypeColors[alert.entityType] || 'bg-gray-100 text-gray-700'
                                            )}>
                                                {entityTypeIcons[alert.entityType]}
                                                {entityTypeLabels[alert.entityType] || alert.entityType}
                                            </span>
                                            <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700">
                                                <Copy size={12} className="inline mr-1" />
                                                Duplicate {fieldLabels[alert.field] || alert.field}
                                            </span>
                                            {alert.status !== 'Open' && (
                                                <span className={cn(
                                                    "px-2.5 py-1 text-xs font-medium rounded-lg",
                                                    alert.status === 'Resolved'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-gray-100 text-gray-600'
                                                )}>
                                                    {alert.status}
                                                </span>
                                            )}
                                        </div>

                                        <p className="font-medium text-gray-900 mb-1">
                                            Matching value: <span className="text-blue-700">&quot;{alert.value}&quot;</span>
                                        </p>

                                        <div className="flex flex-wrap gap-3 mt-2 text-sm">
                                            <Link
                                                href={getEntityLink(alert.entityType, alert.entityId1)}
                                                className="text-blue-600 hover:text-blue-700 hover:underline"
                                            >
                                                Record 1 →
                                            </Link>
                                            <Link
                                                href={getEntityLink(alert.entityType, alert.entityId2)}
                                                className="text-blue-600 hover:text-blue-700 hover:underline"
                                            >
                                                Record 2 →
                                            </Link>
                                        </div>

                                        <p className="text-xs text-gray-400 mt-2">
                                            Detected {new Date(alert.createdAt).toLocaleDateString('en-NG', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                            {alert.resolvedBy && (
                                                <> · {alert.status} by {alert.resolvedBy}</>
                                            )}
                                        </p>
                                    </div>

                                    {alert.status === 'Open' && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleResolve(alert.id)}
                                                disabled={actionLoading === alert.id}
                                                className="px-3 py-2 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-xl hover:bg-emerald-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                                title="Mark as resolved"
                                            >
                                                {actionLoading === alert.id ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <CheckCircle2 size={14} />
                                                )}
                                                Resolve
                                            </button>
                                            <button
                                                onClick={() => handleIgnore(alert.id)}
                                                disabled={actionLoading === alert.id}
                                                className="px-3 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                                                title="Ignore this alert"
                                            >
                                                <EyeOff size={14} />
                                                Ignore
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
