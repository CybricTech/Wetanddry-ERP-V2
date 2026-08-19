'use client'

import { useState, useTransition } from 'react'
import { ClipboardList, Check, X, Loader2, AlertTriangle, Ban } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { approveFuelRequest, rejectFuelRequest, cancelFuelRequest } from '@/lib/actions/fuel'

export interface FuelRequest {
    id: string
    liters: number
    estimatedCost: number | null
    mileage: number | null
    purpose: string | null
    notes: string | null
    status: string
    requestedBy: string
    requestedById: string | null
    approvedBy: string | null
    approvedAt: Date | string | null
    rejectionReason: string | null
    createdAt: Date | string
    truck: { id: string; plateNumber: string; model: string } | null
    equipment: { id: string; name: string; type: string } | null
}

const STATUS_STYLES: Record<string, string> = {
    Pending: 'bg-amber-50 text-amber-700',
    Approved: 'bg-emerald-50 text-emerald-700',
    Rejected: 'bg-red-50 text-red-700',
    Cancelled: 'bg-gray-100 text-gray-500',
}

export default function FuelRequestsTab({
    requests,
    canApprove,
    currentUserId,
}: {
    requests: FuelRequest[]
    canApprove: boolean
    /** Used to decide whose pending requests can be withdrawn. */
    currentUserId: string | null
}) {
    const [filter, setFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All')
    const [approving, setApproving] = useState<FuelRequest | null>(null)
    const [rejecting, setRejecting] = useState<FuelRequest | null>(null)

    const filtered = requests.filter(r => filter === 'All' || r.status === filter)

    return (
        <div className="space-y-5">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(option => {
                    const count =
                        option === 'All' ? requests.length : requests.filter(r => r.status === option).length
                    return (
                        <button
                            key={option}
                            onClick={() => setFilter(option)}
                            className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                                filter === option ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            )}
                        >
                            {option}
                            {count > 0 && <span className="ml-1.5 tabular-nums opacity-60">{count}</span>}
                        </button>
                    )
                })}
            </div>

            <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {canApprove ? 'All Fuel Requests' : 'My Fuel Requests'}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Fuel is only issued, and consumption only recorded, once a request is approved.
                    </p>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">For</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Liters</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Est. Cost</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Requested By</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filtered.map(request => {
                                const target = request.truck
                                    ? `${request.truck.plateNumber} (${request.truck.model})`
                                    : request.equipment
                                        ? `${request.equipment.name} (${request.equipment.type})`
                                        : '—'
                                const isMine = currentUserId !== null && request.requestedById === currentUserId

                                return (
                                    <tr key={request.id} className={cn('hover:bg-gray-50/70 transition-colors', request.status === 'Pending' && 'bg-amber-50/30')}>
                                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                            {new Date(request.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="font-medium text-gray-900">{target}</div>
                                            {request.purpose && <div className="text-xs text-gray-500">{request.purpose}</div>}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">
                                            {request.liters.toLocaleString()} L
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                                            {request.estimatedCost !== null ? formatCurrency(request.estimatedCost) : '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{request.requestedBy}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap', STATUS_STYLES[request.status] ?? 'bg-gray-100 text-gray-600')}>
                                                {request.status}
                                            </span>
                                            {request.status === 'Rejected' && request.rejectionReason && (
                                                <p className="text-xs text-red-600 mt-1 max-w-[14rem]" title={request.rejectionReason}>
                                                    {request.rejectionReason}
                                                </p>
                                            )}
                                            {request.status === 'Approved' && request.approvedBy && (
                                                <p className="text-xs text-gray-400 mt-1">by {request.approvedBy}</p>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                            {request.status === 'Pending' && canApprove && (
                                                <div className="flex items-center gap-1.5 justify-end">
                                                    <button
                                                        onClick={() => setApproving(request)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                                                    >
                                                        <Check size={12} />
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => setRejecting(request)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            )}
                                            {/* Withdrawing your own request is not an approval decision, so it
                                                stays available to the requester regardless of approve rights. */}
                                            {request.status === 'Pending' && isMine && !canApprove && (
                                                <CancelButton requestId={request.id} />
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}

                            {filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center">
                                        <ClipboardList size={28} className="mx-auto text-gray-300" />
                                        <p className="text-sm text-gray-500 mt-3">
                                            {requests.length === 0 ? 'No fuel requests yet.' : 'No requests match this filter.'}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {approving && <ApproveModal request={approving} onClose={() => setApproving(null)} />}
            {rejecting && <RejectModal request={rejecting} onClose={() => setRejecting(null)} />}
        </div>
    )
}

function CancelButton({ requestId }: { requestId: string }) {
    const [isPending, startTransition] = useTransition()
    const [confirming, setConfirming] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!confirming) {
        return (
            <button
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
                <Ban size={12} />
                Withdraw
            </button>
        )
    }

    return (
        <div className="inline-flex flex-col items-end gap-1">
            <div className="flex items-center gap-1.5">
                <button
                    onClick={() => {
                        setError(null)
                        startTransition(async () => {
                            const result = await cancelFuelRequest(requestId)
                            if ('error' in result) {
                                setError(result.error)
                                setConfirming(false)
                            }
                        })
                    }}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                    {isPending ? <Loader2 size={12} className="animate-spin" /> : 'Confirm'}
                </button>
                <button
                    onClick={() => setConfirming(false)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                    Keep
                </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    )
}

function ApproveModal({ request, onClose }: { request: FuelRequest; onClose: () => void }) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const target = request.truck?.plateNumber ?? request.equipment?.name ?? 'target'

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        setError(null)

        startTransition(async () => {
            const result = await approveFuelRequest(request.id, formData)
            if ('error' in result) {
                setError(result.error)
                return
            }
            onClose()
        })
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Approve fuel request</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {request.requestedBy} requested {request.liters} L for {target}.
                        Approving issues the fuel and records the consumption.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Liters to issue</label>
                        <input
                            name="liters"
                            type="number"
                            step="0.1"
                            min="0"
                            defaultValue={request.liters}
                            required
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1.5">
                            Reduce this to approve a partial amount — the original request is kept in the notes.
                        </p>
                    </div>

                    {request.truck && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Current mileage</label>
                            <input
                                name="mileage"
                                type="number"
                                defaultValue={request.mileage ?? undefined}
                                required
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            />
                            <p className="text-xs text-gray-500 mt-1.5">Used to calculate efficiency since the last fill.</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost</label>
                        <input
                            name="cost"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Leave blank to use the blended rate"
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex-1 py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isPending && <Loader2 size={16} className="animate-spin" />}
                            Approve & Issue
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

function RejectModal({ request, onClose }: { request: FuelRequest; onClose: () => void }) {
    const [isPending, startTransition] = useTransition()
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900">Reject fuel request</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        {request.requestedBy} will be notified with the reason you give.
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason *</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                            autoFocus
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all resize-none"
                            placeholder="e.g., Truck already fuelled this morning"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setError(null)
                                startTransition(async () => {
                                    const result = await rejectFuelRequest(request.id, reason)
                                    if ('error' in result) {
                                        setError(result.error)
                                        return
                                    }
                                    onClose()
                                })
                            }}
                            disabled={isPending || !reason.trim()}
                            className="flex-1 py-2.5 px-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                            Reject
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
