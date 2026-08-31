'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, PencilLine, Trash2, X } from 'lucide-react'
import { approveEditRequest, rejectEditRequest } from '@/lib/actions/edit-requests'
import type { EditRequestView } from '@/lib/edit-requests/types'

const LABELS: Record<string, string> = {
    date: 'Date',
    liters: 'Litres',
    cost: 'Cost',
    mileage: 'Odometer',
}

function render(field: string, value: unknown): string {
    if (value === null || value === undefined) return '—'
    if (field === 'date') return new Date(value as string).toLocaleDateString()
    return String(value)
}

export default function FuelEditRequestsSection({
    requests,
    canApprove,
}: {
    requests: EditRequestView[]
    canApprove: boolean
}) {
    const router = useRouter()
    const [busyId, setBusyId] = useState<string | null>(null)
    const [rejecting, setRejecting] = useState<string | null>(null)
    const [reason, setReason] = useState('')
    const [error, setError] = useState<string | null>(null)
    // Set only when approval was refused because the live row moved since the request.
    const [staleId, setStaleId] = useState<string | null>(null)

    const pending = requests.filter((r) => r.status === 'Pending')
    if (pending.length === 0) return null

    const act = async (
        id: string,
        run: () => Promise<{ success: true } | { error: string }>,
        isApproval: boolean
    ) => {
        setBusyId(id)
        setError(null)
        const result = await run()
        setBusyId(null)
        if ('error' in result) {
            setError(result.error)
            // The core returns this exact prefix when previousValues no longer match.
            if (isApproval && result.error.startsWith('This record changed since')) setStaleId(id)
            return
        }
        setRejecting(null)
        setReason('')
        setStaleId(null)
        router.refresh()
    }

    return (
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-2">
                <PencilLine size={18} className="text-amber-600" />
                <h3 className="text-lg font-semibold text-gray-900">
                    Fuel Log Changes Awaiting Approval
                </h3>
                <span className="ml-1 text-sm text-gray-400 tabular-nums">{pending.length}</span>
            </div>

            {error && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                </div>
            )}

            <div className="divide-y divide-gray-100">
                {pending.map((request) => {
                    const previous = request.previousValues ?? {}
                    const proposed = request.proposedChanges ?? {}
                    const isDelete = request.operation === 'delete'

                    return (
                        <div key={request.id} className="p-6 space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                {isDelete && <Trash2 size={16} className="text-red-600" />}
                                <span className="font-medium text-gray-900">
                                    {isDelete ? 'Deletion requested' : 'Change requested'}
                                </span>
                                <span className="text-gray-500">
                                    by {request.requestedBy} • {new Date(request.createdAt).toLocaleDateString()}
                                </span>
                            </div>

                            {isDelete ? (
                                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 space-y-2">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        {Object.keys(LABELS).map((field) => (
                                            <div key={field}>
                                                <span className="text-gray-500">{LABELS[field]}: </span>
                                                <span className="text-gray-900 font-medium">
                                                    {render(field, previous[field])}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    {request.rejectionReason && (
                                        <p className="text-sm text-gray-700 pt-2 border-t border-red-100">
                                            <span className="text-gray-500">Reason: </span>
                                            {request.rejectionReason}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs uppercase tracking-wider text-gray-500">
                                            <th className="text-left pb-2 font-semibold">Field</th>
                                            <th className="text-left pb-2 font-semibold">Current</th>
                                            <th className="text-left pb-2 font-semibold">Proposed</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {Object.keys(proposed).map((field) => (
                                            <tr key={field}>
                                                <td className="py-2 text-gray-500">{LABELS[field] ?? field}</td>
                                                <td className="py-2 text-gray-900">{render(field, previous[field])}</td>
                                                <td className="py-2 font-medium text-blue-700">
                                                    {render(field, proposed[field])}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}

                            {canApprove && (
                                rejecting === request.id ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            rows={2}
                                            placeholder="Reason for rejection (required)"
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none text-sm"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => act(request.id, () => rejectEditRequest(request.id, reason), false)}
                                                disabled={busyId === request.id || !reason.trim()}
                                                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 disabled:opacity-50"
                                            >
                                                Confirm rejection
                                            </button>
                                            <button
                                                onClick={() => { setRejecting(null); setReason('') }}
                                                className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => act(request.id, () => approveEditRequest(request.id), true)}
                                            disabled={busyId === request.id}
                                            className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {busyId === request.id ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                                            Approve
                                        </button>
                                        {staleId === request.id && (
                                            <button
                                                onClick={() => act(request.id, () => approveEditRequest(request.id, { acceptStale: true }), true)}
                                                disabled={busyId === request.id}
                                                className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-xl hover:bg-amber-700 disabled:opacity-50"
                                            >
                                                Approve anyway
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setRejecting(request.id)}
                                            disabled={busyId === request.id}
                                            className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <X size={16} />
                                            Reject
                                        </button>
                                    </div>
                                )
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
