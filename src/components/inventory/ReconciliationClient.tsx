'use client'

import React, { useState, useTransition } from 'react'
import {
    ClipboardCheck, Plus, Search, Eye, CheckCircle, Clock,
    AlertTriangle, X, ArrowRight, Package, RefreshCw, ArrowUpRight, Play
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import {
    startReconciliation,
    getReconciliation,
    updatePhysicalCount,
    startProcessingReconciliation,
    approveReconciliation,
    cancelReconciliation,
    getReconciliationReport
} from '@/lib/actions/reconciliation'

// ==================== TYPES ====================

interface Reconciliation {
    id: string
    reconciliationDate: Date
    locationId: string | null
    location: { id: string; name: string; type: string } | null
    status: string
    totalVariance: number
    varianceValue: number
    performedBy: string
    approvedBy: string | null
    _count: { items: number }
}

interface ReconciliationItem {
    id: string
    inventoryItemId: string
    inventoryItem: { id: string; name: string; unit: string; location: { name: string } }
    systemQuantity: number
    physicalQuantity: number
    variance: number
    varianceValue: number
    reason: string | null
}

// ==================== MAIN COMPONENT ====================

interface ReconciliationClientProps {
    initialReconciliations: Reconciliation[]
    locations: { id: string; name: string; type: string }[]
    userRole: string
    userName: string
}

export default function ReconciliationClient({
    initialReconciliations,
    locations,
    userRole,
    userName
}: ReconciliationClientProps) {
    const [reconciliations, setReconciliations] = useState<Reconciliation[]>(initialReconciliations)
    const [filter, setFilter] = useState({ status: 'all' })
    const [isPending, startTransition] = useTransition()
    const [showNewModal, setShowNewModal] = useState(false)
    const [selectedRecon, setSelectedRecon] = useState<any>(null)
    const [showWizard, setShowWizard] = useState(false)

    const canApprove = hasPermission(userRole, 'approve_stock_transactions')

    const filteredReconciliations = reconciliations.filter(r => {
        if (filter.status !== 'all' && r.status !== filter.status) return false
        return true
    })

    const refreshData = async () => {
        const { getReconciliations } = await import('@/lib/actions/reconciliation')
        const data = await getReconciliations()
        setReconciliations(data)
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'Draft': 'bg-gray-100 text-gray-700',
            'In Progress': 'bg-yellow-100 text-yellow-700',
            'Completed': 'bg-green-100 text-green-700',
            'Cancelled': 'bg-red-100 text-red-700'
        }
        return styles[status] || 'bg-gray-100 text-gray-700'
    }

    const handleStartNew = async (locationId: string | null, notes: string) => {
        const formData = new FormData()
        if (locationId) formData.append('locationId', locationId)
        if (notes) formData.append('notes', notes)

        startTransition(async () => {
            const result = await startReconciliation(formData)
            if (result.success && result.reconciliationId) {
                setShowNewModal(false)
                // Open the wizard for the new reconciliation
                const fullRecon = await getReconciliation(result.reconciliationId)
                setSelectedRecon(fullRecon)
                setShowWizard(true)
                refreshData()
            }
        })
    }

    const handleOpenWizard = async (reconId: string) => {
        startTransition(async () => {
            const fullRecon = await getReconciliation(reconId)
            setSelectedRecon(fullRecon)
            setShowWizard(true)
        })
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ClipboardCheck className="w-7 h-7 text-emerald-600" />
                        Stock Reconciliation
                    </h1>
                    <p className="text-gray-500 mt-1">Compare physical counts with system records</p>
                </div>
                {canApprove && (
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                        <Plus className="w-5 h-5" />
                        New Reconciliation
                    </button>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total" value={reconciliations.length} color="bg-gray-100 text-gray-600" />
                <StatCard label="Draft" value={reconciliations.filter(r => r.status === 'Draft').length} color="bg-gray-100 text-gray-600" />
                <StatCard label="In Progress" value={reconciliations.filter(r => r.status === 'In Progress').length} color="bg-yellow-100 text-yellow-600" />
                <StatCard label="Completed" value={reconciliations.filter(r => r.status === 'Completed').length} color="bg-green-100 text-green-600" />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <select
                    value={filter.status}
                    onChange={(e) => setFilter({ status: e.target.value })}
                    className="px-3 py-2 border rounded-lg"
                >
                    <option value="all">All Status</option>
                    <option value="Draft">Draft</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </div>

            {/* Reconciliations List */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Performed By</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {filteredReconciliations.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                                    No reconciliations found
                                </td>
                            </tr>
                        ) : (
                            filteredReconciliations.map(recon => (
                                <tr key={recon.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm">
                                        {new Date(recon.reconciliationDate).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="font-medium">{recon.location?.name || 'All Locations'}</span>
                                    </td>
                                    <td className="px-4 py-3">{recon._count.items}</td>
                                    <td className="px-4 py-3">
                                        <span className={recon.varianceValue < 0 ? 'text-red-600' : recon.varianceValue > 0 ? 'text-green-600' : ''}>
                                            {formatCurrency(Math.abs(recon.varianceValue))}
                                            {recon.varianceValue !== 0 && (recon.varianceValue < 0 ? ' ▼' : ' ▲')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{recon.performedBy}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(recon.status)}`}>
                                            {recon.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleOpenWizard(recon.id)}
                                            className="text-emerald-600 hover:text-emerald-800"
                                        >
                                            <Eye className="w-5 h-5" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* New Reconciliation Modal */}
            {showNewModal && (
                <NewReconciliationModal
                    locations={locations}
                    onClose={() => setShowNewModal(false)}
                    onStart={handleStartNew}
                    isPending={isPending}
                />
            )}

            {/* Reconciliation Wizard */}
            {showWizard && selectedRecon && (
                <ReconciliationWizard
                    reconciliation={selectedRecon}
                    canApprove={canApprove}
                    onClose={() => {
                        setShowWizard(false)
                        setSelectedRecon(null)
                        refreshData()
                    }}
                />
            )}
        </div>
    )
}

// ==================== STAT CARD ====================

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>
                    <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                </div>
            </div>
        </div>
    )
}

// ==================== NEW RECONCILIATION MODAL ====================

function NewReconciliationModal({
    locations,
    onClose,
    onStart,
    isPending
}: {
    locations: { id: string; name: string; type: string }[]
    onClose: () => void
    onStart: (locationId: string | null, notes: string) => void
    isPending: boolean
}) {
    const [locationId, setLocationId] = useState<string>('')
    const [notes, setNotes] = useState('')

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
                <div className="p-6 bg-gradient-to-br from-emerald-600 to-teal-700 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ClipboardCheck size={80} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Plus className="bg-white/20 p-1 rounded-lg" size={28} />
                            New Reconciliation
                        </h2>
                        <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Location Scope</label>
                        <div className="relative">
                            <select
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all appearance-none"
                            >
                                <option value="">All Locations (Full Inventory)</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                                ))}
                            </select>
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                <ArrowRight size={16} className="rotate-90" />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <AlertTriangle size={12} className="text-amber-500" />
                            Leaving this empty will reconcile the ENTIRE inventory.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Reason for reconciliation..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 bg-gray-50/50">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onStart(locationId || null, notes)}
                        disabled={isPending}
                        className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 font-medium shadow-lg shadow-emerald-500/25 disabled:opacity-70 disabled:shadow-none flex items-center gap-2 transition-all"
                    >
                        {isPending ? 'Starting...' : 'Start Reconciliation'}
                        <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    )
}

// ==================== RECONCILIATION WIZARD ====================

function ReconciliationWizard({
    reconciliation,
    canApprove,
    onClose
}: {
    reconciliation: any
    canApprove: boolean
    onClose: () => void
}) {
    const [items, setItems] = useState<ReconciliationItem[]>(reconciliation.items || [])
    const [isPending, startTransition] = useTransition()
    const [editingItem, setEditingItem] = useState<string | null>(null)
    const [tempValue, setTempValue] = useState<number>(0)
    const [tempReason, setTempReason] = useState<string>('')

    const status = reconciliation.status
    const isEditable = ['Draft', 'In Progress'].includes(status)

    const handleUpdateCount = (item: ReconciliationItem) => {
        startTransition(async () => {
            await updatePhysicalCount(item.id, tempValue, tempReason)
            // Refresh item
            const updated = await getReconciliation(reconciliation.id)
            setItems(updated.items)
            setEditingItem(null)
        })
    }

    const handleStartProcessing = () => {
        startTransition(async () => {
            await startProcessingReconciliation(reconciliation.id)
            onClose()
        })
    }

    const handleApprove = () => {
        if (!confirm('Approve this reconciliation? Stock adjustments will be applied.')) return
        startTransition(async () => {
            await approveReconciliation(reconciliation.id)
            onClose()
        })
    }

    const handleCancel = () => {
        if (!confirm('Cancel this reconciliation?')) return
        startTransition(async () => {
            await cancelReconciliation(reconciliation.id)
            onClose()
        })
    }

    // Calculate summary
    const itemsWithVariance = items.filter(i => i.variance !== 0)
    const totalGains = items.filter(i => i.variance > 0).reduce((s, i) => s + i.varianceValue, 0)
    const totalLosses = Math.abs(items.filter(i => i.variance < 0).reduce((s, i) => s + i.varianceValue, 0))

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col transform transition-all">
                {/* Header */}
                <div className="p-6 bg-gradient-to-r from-teal-600 to-emerald-700 text-white flex-shrink-0 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <ClipboardCheck size={120} />
                    </div>
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
                                <ClipboardCheck size={28} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight">Reconciliation Wizard</h2>
                                <div className="flex items-center gap-2 text-emerald-100 text-sm mt-1">
                                    <span className="font-medium bg-white/10 px-2 py-0.5 rounded text-white">{reconciliation.location?.name || 'All Locations'}</span>
                                    <span>•</span>
                                    <span>{new Date(reconciliation.reconciliationDate).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "px-3 py-1.5 text-sm font-bold rounded-lg shadow-sm backdrop-blur-md border border-white/10",
                                status === 'Completed' ? "bg-emerald-500/20 text-emerald-50" :
                                    status === 'In Progress' ? "bg-amber-500/20 text-amber-50" :
                                        "bg-gray-500/20 text-gray-50"
                            )}>
                                {status.toUpperCase()}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/20 rounded-xl transition-all hover:scale-105 active:scale-95"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4 p-6 bg-gray-50/50 border-b border-gray-100 flex-shrink-0">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Items</div>
                        <div className="text-2xl font-bold text-gray-900">{items.length}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-2 opacity-5 text-amber-500"><AlertTriangle size={40} /></div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Variance Count</div>
                        <div className="text-2xl font-bold text-amber-600">{itemsWithVariance.length}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-2 opacity-5 text-emerald-500"><ArrowUpRight size={40} /></div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Gains</div>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalGains)}</div>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 p-2 opacity-5 text-red-500"><ArrowRight size={40} className="rotate-45" /></div>
                        <div className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">Total Losses</div>
                        <div className="text-2xl font-bold text-red-600">{formatCurrency(totalLosses)}</div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="flex-1 overflow-auto bg-white relative">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Item</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">System Qty</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-32">Physical Qty</th>
                                <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Variance</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">Reason</th>
                                {isEditable && <th className="px-6 py-4 w-20"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {items.map(item => (
                                <tr
                                    key={item.id}
                                    className={cn(
                                        "transition-colors hover:bg-gray-50",
                                        editingItem === item.id ? "bg-blue-50/50" : "",
                                        item.variance !== 0 ? "bg-amber-50/30" : ""
                                    )}
                                >
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-900">{item.inventoryItem.name}</div>
                                        <div className="text-xs text-gray-400 font-mono mt-0.5">{item.inventoryItem.unit}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{item.inventoryItem.location?.name || '-'}</td>
                                    <td className="px-6 py-4 text-right font-mono text-sm text-gray-600">
                                        {item.systemQuantity.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {editingItem === item.id ? (
                                            <input
                                                type="number"
                                                value={tempValue}
                                                onChange={(e) => setTempValue(parseFloat(e.target.value) || 0)}
                                                className="w-24 bg-white border border-blue-300 rounded-lg px-2 py-1.5 text-right font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-200 shadow-sm"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className={cn(
                                                "font-mono font-medium",
                                                item.physicalQuantity !== item.systemQuantity ? "text-gray-900" : "text-gray-500"
                                            )}>
                                                {item.physicalQuantity.toLocaleString()}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={cn(
                                            "inline-flex items-center justify-center px-2 py-1 rounded-md text-xs font-bold min-w-[3rem]",
                                            item.variance < 0 ? "bg-red-100 text-red-700" :
                                                item.variance > 0 ? "bg-green-100 text-green-700" :
                                                    "bg-gray-100/50 text-gray-400"
                                        )}>
                                            {item.variance > 0 ? '+' : ''}{item.variance.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {editingItem === item.id ? (
                                            <input
                                                type="text"
                                                value={tempReason}
                                                onChange={(e) => setTempReason(e.target.value)}
                                                placeholder="Enter reason..."
                                                className="w-full bg-white border border-blue-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-500 italic truncate block max-w-[200px]">{item.reason || '-'}</span>
                                        )}
                                    </td>
                                    {isEditable && (
                                        <td className="px-6 py-4 text-right">
                                            {editingItem === item.id ? (
                                                <div className="flex gap-1 justify-end">
                                                    <button
                                                        onClick={() => handleUpdateCount(item)}
                                                        disabled={isPending}
                                                        className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                                                        title="Save"
                                                    >
                                                        <CheckCircle size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingItem(null)}
                                                        className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                                                        title="Cancel"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(item.id)
                                                        setTempValue(item.physicalQuantity)
                                                        setTempReason(item.reason || '')
                                                    }}
                                                    className="font-medium text-emerald-600 hover:text-emerald-800 hover:underline text-sm"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
                    <div>
                        {['Draft', 'In Progress'].includes(status) && canApprove && (
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="px-5 py-2.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl font-medium transition-colors"
                            >
                                Cancel Session
                            </button>
                        )}
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-600 hover:text-gray-800 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl font-medium shadow-sm transition-all"
                        >
                            Close
                        </button>
                        {status === 'Draft' && canApprove && (
                            <button
                                onClick={handleStartProcessing}
                                disabled={isPending}
                                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2"
                            >
                                <Play size={18} fill="currentColor" />
                                Start Processing
                            </button>
                        )}
                        {status === 'In Progress' && canApprove && (
                            <button
                                onClick={handleApprove}
                                disabled={isPending}
                                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2"
                            >
                                <CheckCircle size={18} />
                                Approve & Finalize
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
