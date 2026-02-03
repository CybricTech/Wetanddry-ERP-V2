'use client'

import React, { useState, useTransition } from 'react'
import {
    ClipboardCheck, Plus, Search, Eye, CheckCircle, Clock,
    AlertTriangle, X, ArrowRight, Package, RefreshCw
} from 'lucide-react'
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
                                            ₦{Math.abs(recon.varianceValue).toLocaleString()}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">Start New Reconciliation</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
                        <select
                            value={locationId}
                            onChange={(e) => setLocationId(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2"
                        >
                            <option value="">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.type})</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Leave empty to reconcile all inventory</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full border rounded-lg px-3 py-2"
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-3 p-4 border-t">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                        Cancel
                    </button>
                    <button
                        onClick={() => onStart(locationId || null, notes)}
                        disabled={isPending}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {isPending ? 'Starting...' : 'Start Reconciliation'}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">Reconciliation Wizard</h2>
                        <p className="text-sm text-gray-500">
                            {reconciliation.location?.name || 'All Locations'} • {new Date(reconciliation.reconciliationDate).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${status === 'Completed' ? 'bg-green-100 text-green-700' :
                                status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-gray-100 text-gray-700'
                            }`}>
                            {status}
                        </span>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 border-b">
                    <div className="text-center">
                        <div className="text-lg font-bold">{items.length}</div>
                        <div className="text-xs text-gray-500">Total Items</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-yellow-600">{itemsWithVariance.length}</div>
                        <div className="text-xs text-gray-500">With Variance</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-green-600">₦{totalGains.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Gains</div>
                    </div>
                    <div className="text-center">
                        <div className="text-lg font-bold text-red-600">₦{totalLosses.toLocaleString()}</div>
                        <div className="text-xs text-gray-500">Losses</div>
                    </div>
                </div>

                {/* Items Table */}
                <div className="flex-1 overflow-auto p-4">
                    <table className="w-full">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-3 py-2 text-left">Item</th>
                                <th className="px-3 py-2 text-left">Location</th>
                                <th className="px-3 py-2 text-right">System Qty</th>
                                <th className="px-3 py-2 text-right">Physical Qty</th>
                                <th className="px-3 py-2 text-right">Variance</th>
                                <th className="px-3 py-2 text-left">Reason</th>
                                {isEditable && <th className="px-3 py-2"></th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map(item => (
                                <tr key={item.id} className={item.variance !== 0 ? 'bg-yellow-50' : ''}>
                                    <td className="px-3 py-2 font-medium">{item.inventoryItem.name}</td>
                                    <td className="px-3 py-2 text-sm text-gray-500">{item.inventoryItem.location?.name || '-'}</td>
                                    <td className="px-3 py-2 text-right">{item.systemQuantity.toLocaleString()} {item.inventoryItem.unit}</td>
                                    <td className="px-3 py-2 text-right">
                                        {editingItem === item.id ? (
                                            <input
                                                type="number"
                                                value={tempValue}
                                                onChange={(e) => setTempValue(parseFloat(e.target.value) || 0)}
                                                className="w-24 border rounded px-2 py-1 text-right"
                                                autoFocus
                                            />
                                        ) : (
                                            <span>{item.physicalQuantity.toLocaleString()} {item.inventoryItem.unit}</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <span className={item.variance < 0 ? 'text-red-600' : item.variance > 0 ? 'text-green-600' : 'text-gray-500'}>
                                            {item.variance > 0 ? '+' : ''}{item.variance.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2">
                                        {editingItem === item.id ? (
                                            <input
                                                type="text"
                                                value={tempReason}
                                                onChange={(e) => setTempReason(e.target.value)}
                                                placeholder="Reason..."
                                                className="w-full border rounded px-2 py-1 text-sm"
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-500">{item.reason || '-'}</span>
                                        )}
                                    </td>
                                    {isEditable && (
                                        <td className="px-3 py-2 text-right">
                                            {editingItem === item.id ? (
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => handleUpdateCount(item)}
                                                        disabled={isPending}
                                                        className="text-green-600 hover:text-green-800"
                                                    >
                                                        <CheckCircle className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditingItem(null)}
                                                        className="text-gray-400 hover:text-gray-600"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditingItem(item.id)
                                                        setTempValue(item.physicalQuantity)
                                                        setTempReason(item.reason || '')
                                                    }}
                                                    className="text-gray-400 hover:text-gray-600"
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
                <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    <div>
                        {status === 'Draft' && canApprove && (
                            <button
                                onClick={handleStartProcessing}
                                disabled={isPending}
                                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                            >
                                Start Processing
                            </button>
                        )}
                        {status === 'In Progress' && canApprove && (
                            <button
                                onClick={handleApprove}
                                disabled={isPending}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                            >
                                Approve & Apply Adjustments
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {['Draft', 'In Progress'].includes(status) && canApprove && (
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                                Cancel
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
