'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { requestFuelLogEdit, requestFuelLogDelete } from '@/lib/actions/fuel'

interface EditableLog {
    id: string
    date: Date | string
    liters: number
    cost: number
    mileage: number | null
    truck: { plateNumber: string } | null
    equipment: { name: string } | null
}

export default function EditFuelLogModal({
    log,
    mode,
    canApprove,
    onClose,
}: {
    log: EditableLog
    mode: 'edit' | 'delete'
    /** Drives the button copy only. The server re-checks the permission. */
    canApprove: boolean
    onClose: () => void
}) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reason, setReason] = useState('')

    const target = log.truck?.plateNumber ?? log.equipment?.name ?? 'unassigned'
    const isTruck = Boolean(log.truck)

    const handleEdit = async (formData: FormData) => {
        setIsSubmitting(true)
        setError(null)
        const result = await requestFuelLogEdit(log.id, formData)
        setIsSubmitting(false)
        if ('error' in result) return setError(result.error)
        onClose()
        router.refresh()
    }

    const handleDelete = async () => {
        if (!reason.trim()) return setError('A reason is required')
        setIsSubmitting(true)
        setError(null)
        const result = await requestFuelLogDelete(log.id, reason.trim())
        setIsSubmitting(false)
        if ('error' in result) return setError(result.error)
        onClose()
        router.refresh()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between p-6 pb-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {mode === 'delete' ? 'Delete fuel log' : 'Edit fuel log'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {log.liters} L issued to {target}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {!canApprove && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm mb-4 flex gap-2">
                            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                            <span>
                                This will be submitted for approval. The record keeps its current values until
                                an approver signs off.
                            </span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {mode === 'edit' ? (
                        <form action={handleEdit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    defaultValue={new Date(log.date).toISOString().split('T')[0]}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Litres</label>
                                    <input
                                        type="number" step="0.01" name="liters" defaultValue={log.liters}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Cost</label>
                                    <input
                                        type="number" step="0.01" name="cost" defaultValue={log.cost}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                            {isTruck && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">Odometer (km)</label>
                                    <input
                                        type="number" name="mileage" defaultValue={log.mileage ?? ''}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    />
                                    <p className="text-xs text-gray-500">
                                        Corrects this log&apos;s km/L and the next fill&apos;s. It does not change the
                                        truck&apos;s recorded odometer.
                                    </p>
                                </div>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                                {canApprove ? 'Save changes' : 'Submit for Approval'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    rows={3}
                                    placeholder="Why should this record be removed?"
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <p className="text-sm text-gray-600">
                                Deleting returns {log.liters} L to stock and removes its cost from reports.
                            </p>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="w-full px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                                {canApprove ? 'Delete record' : 'Submit for Approval'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
