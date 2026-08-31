'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { deleteStaff } from '@/lib/actions/staff'
import DeleteConfirmationModal from './DeleteConfirmationModal'

interface DeleteStaffPanelProps {
    staffId: string
    staffName: string
    isFormerStaff: boolean
}

// Super Admin only — the page decides whether to render this at all, based on
// the 'delete_staff' permission.
export default function DeleteStaffPanel({ staffId, staffName, isFormerStaff }: DeleteStaffPanelProps) {
    const router = useRouter()
    const [isOpen, setIsOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleDelete = async () => {
        setIsDeleting(true)
        setError(null)

        const result = await deleteStaff(staffId)

        if (result.success) {
            // Leave isDeleting set: the component is on its way out with the record.
            setIsOpen(false)
            router.push(isFormerStaff ? '/staff/former' : '/staff')
            router.refresh()
            return
        }

        setIsDeleting(false)
        setIsOpen(false)
        setError(typeof result.error === 'string' ? result.error : 'Failed to delete staff record')
    }

    return (
        <>
            <div className="bg-white border border-red-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-red-700 mb-2">Danger Zone</h2>
                <p className="text-sm text-gray-600 mb-6">
                    Permanently deletes {staffName} and every document attached to them. This cannot be
                    undone.{!isFormerStaff && ' If they have actually left the company, use Offboard Staff instead — it keeps the record.'}
                </p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                        {error}
                    </div>
                )}

                <button
                    type="button"
                    onClick={() => { setIsOpen(true); setError(null) }}
                    disabled={isDeleting}
                    className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                    Delete Record Permanently
                </button>
            </div>

            <DeleteConfirmationModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
                title={`Delete ${staffName}?`}
                message={
                    <>
                        <p>
                            This permanently deletes <span className="font-semibold text-gray-900">{staffName}</span>{' '}
                            and all of their documents. This action cannot be undone.
                        </p>
                        {!isFormerStaff && (
                            <p className="mt-3 text-sm">
                                If they have left the company, cancel and use <span className="font-medium">Offboard Staff</span>{' '}
                                instead — that keeps the record in the Former Staff docket.
                            </p>
                        )}
                    </>
                }
            />
        </>
    )
}
