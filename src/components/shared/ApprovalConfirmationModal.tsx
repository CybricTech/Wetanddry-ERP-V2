'use client'

import { CheckCircle2, X, Package, MapPin, User, FileText } from 'lucide-react'

interface ApprovalItem {
    id: string
    type: string
    subType: string
    itemName: string
    location: string
    quantity: number
    unit: string
    reason: string | null
    performedBy: string | null
    totalCost: number | null
}

interface ApprovalConfirmationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    isApproving: boolean
    item: ApprovalItem
}

export default function ApprovalConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    isApproving,
    item
}: ApprovalConfirmationModalProps) {
    if (!isOpen) return null

    const typeLabels: Record<string, string> = {
        'stock_transaction': 'Stock Transaction',
        'inventory_item': 'New Inventory Item',
        'material_request': 'Material Request'
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-xl scale-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Confirm Approval</h2>
                    <button
                        onClick={onClose}
                        disabled={isApproving}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-5">
                    <div className="flex items-center gap-3 mb-5">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="text-emerald-600" size={22} />
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">You are about to approve</p>
                            <p className="font-semibold text-gray-900">{typeLabels[item.type] || item.type}</p>
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-5">
                        <div className="flex items-center gap-2 text-sm">
                            <Package size={16} className="text-gray-400" />
                            <span className="text-gray-500">Item:</span>
                            <span className="font-medium text-gray-900">{item.itemName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <FileText size={16} className="text-gray-400" />
                            <span className="text-gray-500">Type:</span>
                            <span className="font-medium text-gray-900">{item.subType}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <MapPin size={16} className="text-gray-400" />
                            <span className="text-gray-500">Location:</span>
                            <span className="font-medium text-gray-900">{item.location}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Package size={16} className="text-gray-400" />
                            <span className="text-gray-500">Quantity:</span>
                            <span className="font-medium text-gray-900">{item.quantity.toLocaleString()} {item.unit}</span>
                        </div>
                        {item.performedBy && (
                            <div className="flex items-center gap-2 text-sm">
                                <User size={16} className="text-gray-400" />
                                <span className="text-gray-500">Requested by:</span>
                                <span className="font-medium text-gray-900">{item.performedBy}</span>
                            </div>
                        )}
                        {item.reason && (
                            <div className="flex items-start gap-2 text-sm">
                                <FileText size={16} className="text-gray-400 mt-0.5" />
                                <span className="text-gray-500">Reason:</span>
                                <span className="font-medium text-gray-900">{item.reason}</span>
                            </div>
                        )}
                        {item.totalCost != null && item.totalCost > 0 && (
                            <div className="flex items-center gap-2 text-sm">
                                <Package size={16} className="text-gray-400" />
                                <span className="text-gray-500">Total Cost:</span>
                                <span className="font-medium text-gray-900">₦{item.totalCost.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    <p className="text-sm text-gray-500 mb-5">
                        This will update inventory quantities and cannot be easily reversed. Please confirm you want to proceed.
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isApproving}
                            className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isApproving}
                            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isApproving ? 'Approving...' : 'Yes, Approve'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
