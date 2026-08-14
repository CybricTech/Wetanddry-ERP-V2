'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, LogOut, Loader2, Undo2 } from 'lucide-react'
import { offboardStaff, reinstateStaff } from '@/lib/actions/staff'
import { EXIT_TYPES, type ExitType } from '@/lib/constants/staff'
import { DatePicker } from '@/components/ui/date-picker'

interface OffboardStaffPanelProps {
    staffId: string
    staffName: string
    exitType: string | null
    exitDate: Date | null
    exitReason: string | null
    exitRecordedBy: string | null
    exitRecordedAt: Date | null
}

export default function OffboardStaffPanel({
    staffId,
    staffName,
    exitType,
    exitDate,
    exitReason,
    exitRecordedBy,
    exitRecordedAt,
}: OffboardStaffPanelProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [type, setType] = useState<string>('')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [reason, setReason] = useState('')

    const handleOffboard = async () => {
        if (!type) return setError('Select an exit type')
        if (!date) return setError('Select an exit date')
        if (!reason.trim()) return setError('A reason is required')

        setIsSubmitting(true)
        setError(null)

        const result = await offboardStaff(staffId, {
            exitType: type as ExitType,
            exitDate: new Date(date),
            exitReason: reason.trim(),
        })

        setIsSubmitting(false)

        if (result.success) {
            setIsOpen(false)
            router.push('/staff/former')
            router.refresh()
        } else {
            setError(typeof result.error === 'string' ? result.error : 'Failed to offboard staff member')
        }
    }

    const handleReinstate = async () => {
        setIsSubmitting(true)
        setError(null)

        const result = await reinstateStaff(staffId)

        setIsSubmitting(false)

        if (result.success) {
            router.push('/staff')
            router.refresh()
        } else {
            setError(typeof result.error === 'string' ? result.error : 'Failed to reinstate staff member')
        }
    }

    // Already offboarded — show the exit record instead of the form.
    if (exitType) {
        return (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Exit Record</h2>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                        {error}
                    </div>
                )}

                <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Exit Type</dt>
                        <dd className="mt-1 text-sm font-semibold text-gray-900">{exitType}</dd>
                    </div>
                    <div>
                        <dt className="text-sm font-medium text-gray-500">Exit Date</dt>
                        <dd className="mt-1 text-sm font-semibold text-gray-900">
                            {exitDate ? new Date(exitDate).toLocaleDateString() : '—'}
                        </dd>
                    </div>
                    <div className="col-span-full">
                        <dt className="text-sm font-medium text-gray-500">Reason</dt>
                        <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{exitReason || '—'}</dd>
                    </div>
                    <div className="col-span-full">
                        <dt className="text-sm font-medium text-gray-500">Recorded By</dt>
                        <dd className="mt-1 text-sm text-gray-600">
                            {exitRecordedBy || 'Unknown'}
                            {exitRecordedAt && ` • ${new Date(exitRecordedAt).toLocaleString()}`}
                        </dd>
                    </div>
                </dl>

                <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between gap-4">
                    <p className="text-sm text-gray-500">
                        Recorded in error? Reinstating returns {staffName} to the active registry.
                    </p>
                    <button
                        type="button"
                        onClick={handleReinstate}
                        disabled={isSubmitting}
                        className="px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Undo2 size={18} />}
                        Reinstate
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="bg-white border border-red-100 rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Offboard Staff</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Records why {staffName} is leaving and moves them to the Former Staff docket.
                    The record and all documents are kept — nothing is deleted.
                </p>
                <button
                    type="button"
                    onClick={() => { setIsOpen(true); setError(null) }}
                    className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/25 transition-all flex items-center gap-2"
                >
                    <LogOut size={18} />
                    Offboard Staff
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex items-start gap-4 mb-6">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                    <AlertTriangle className="text-red-600" size={24} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">Offboard {staffName}</h2>
                                    <p className="text-sm text-gray-600 mt-1">
                                        They will be removed from the active registry and filed under Former Staff.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Exit Type <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Select reason for leaving</option>
                                        {EXIT_TYPES.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Exit Date <span className="text-red-500">*</span>
                                    </label>
                                    <DatePicker
                                        value={date}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
                                        className="focus:bg-white focus:border-blue-500 py-2.5"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Reason / Notes <span className="text-red-500">*</span>
                                    </label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        rows={4}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all resize-none"
                                        placeholder="Grounds for dismissal, retirement circumstances, resignation notes..."
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOffboard}
                                    disabled={isSubmitting}
                                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                                    {isSubmitting ? 'Offboarding...' : 'Confirm Offboarding'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
