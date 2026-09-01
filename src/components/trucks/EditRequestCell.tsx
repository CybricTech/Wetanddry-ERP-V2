'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Clock, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { approveEditRequest, rejectEditRequest } from '@/lib/actions/edit-requests'
import type { FieldValues } from '@/lib/edit-requests/types'

export interface PendingEditRequest {
    id: string
    entityId: string
    operation: string
    requestedBy: string
    proposedChanges: FieldValues | null
    previousValues: FieldValues | null
}

const LABELS: Record<string, string> = {
    type: 'Type',
    date: 'Date',
    cost: 'Cost',
    mileageAtService: 'Mileage',
    status: 'Status',
    notes: 'Notes',
    performedBy: 'Performed by',
    intervalType: 'Interval type',
    intervalDays: 'Interval (days)',
    intervalMileage: 'Interval (km)',
    nextDueDate: 'Next due',
    nextDueMileage: 'Next due (km)',
    priority: 'Priority',
    isActive: 'Active',
}

function render(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    // Dates round-trip through JSON as ISO strings.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value).toLocaleDateString()
    }
    return String(value)
}

/**
 * The pending-edit state on a maintenance row. Anyone who can see the row sees that a
 * change is waiting; only approvers get the diff and the controls.
 */
export default function EditRequestCell({
    request,
    canApprove,
}: {
    request: PendingEditRequest
    canApprove: boolean
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [rejecting, setRejecting] = useState(false)
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)
    // Set only when approval was refused because the live row moved since the request.
    const [stale, setStale] = useState(false)

    const isDelete = request.operation === 'delete'
    const proposed = request.proposedChanges ?? {}
    const previous = request.previousValues ?? {}
    const changed = Object.keys(proposed).filter(
        (field) => JSON.stringify(proposed[field]) !== JSON.stringify(previous[field]),
    )

    const act = (run: () => Promise<{ success: true } | { error: string }>, isApproval: boolean) => {
        setError(null)
        startTransition(async () => {
            const result = await run()
            if ('error' in result) {
                setError(result.error)
                // The core returns this exact prefix when previousValues no longer match.
                if (isApproval && result.error.startsWith('This record changed since')) setStale(true)
                return
            }
            setRejecting(false)
            setReason('')
            setStale(false)
            router.refresh()
        })
    }

    return (
        <div className="max-w-[22rem]">
            <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${
                    isDelete ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                }`}
            >
                {isDelete ? <Trash2 size={12} /> : <Pencil size={12} />}
                {isDelete ? 'Deletion pending approval' : 'Edit pending approval'}
            </span>
            <p className="text-xs text-gray-500 mt-1 truncate">by {request.requestedBy}</p>

            {canApprove && !isDelete && changed.length > 0 && (
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50 text-gray-500">
                            <tr>
                                <th className="px-2 py-1 text-left font-medium">Field</th>
                                <th className="px-2 py-1 text-left font-medium">Current</th>
                                <th className="px-2 py-1 text-left font-medium">Proposed</th>
                            </tr>
                        </thead>
                        <tbody>
                            {changed.map((field) => (
                                <tr key={field} className="border-t border-gray-100">
                                    <td className="px-2 py-1 text-gray-600 whitespace-nowrap">{LABELS[field] ?? field}</td>
                                    <td className="px-2 py-1 text-gray-500 line-through">{render(previous[field])}</td>
                                    <td className="px-2 py-1 text-gray-900 font-medium">{render(proposed[field])}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {canApprove && isDelete && (
                <p className="text-xs text-red-600 mt-2">
                    Approving removes this record permanently.
                </p>
            )}

            {canApprove && !rejecting && (
                <div className="flex items-center gap-1.5 mt-2">
                    <button
                        type="button"
                        onClick={() => act(() => approveEditRequest(request.id, stale ? { acceptStale: true } : undefined), true)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                            stale ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                        {stale ? 'Approve anyway' : 'Approve'}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setRejecting(true); setError(null) }}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-50"
                    >
                        Reject
                    </button>
                </div>
            )}

            {canApprove && rejecting && (
                <div className="mt-2 space-y-1.5">
                    <input
                        type="text"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                        placeholder="Reason for rejection"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && reason.trim()) act(() => rejectEditRequest(request.id, reason), false)
                            if (e.key === 'Escape') setRejecting(false)
                        }}
                        className="w-full px-2.5 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-500/10 outline-none transition-all"
                    />
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => act(() => rejectEditRequest(request.id, reason), false)}
                            disabled={isPending || !reason.trim()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                            Confirm
                        </button>
                        <button
                            type="button"
                            onClick={() => setRejecting(false)}
                            className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}

            {!canApprove && (
                <p className="text-xs text-gray-400 mt-1 inline-flex items-center gap-1">
                    <Clock size={11} /> Waiting on a Super Admin
                </p>
            )}
        </div>
    )
}
