'use client'

import { createMaintenanceRecord } from '@/lib/actions/trucks'
import { X, Wrench, AlertCircle } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg shadow-blue-500/25 disabled:opacity-50"
        >
            {pending ? 'Saving...' : 'Add Maintenance Record'}
        </button>
    )
}

interface AddMaintenanceModalProps {
    truckId: string
    truckMileage: number
    onClose: () => void
}

export default function AddMaintenanceModal({ truckId, truckMileage, onClose }: AddMaintenanceModalProps) {
    const [mileage, setMileage] = useState(truckMileage.toString())
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (formData: FormData) => {
        setError(null)
        const result = await createMaintenanceRecord(formData)
        if ('error' in result) {
            setError(result.error)
            return
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Wrench className="text-blue-600" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Add Maintenance Record</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form action={handleSubmit} className="p-6 space-y-5">
                    <input type="hidden" name="truckId" value={truckId} />

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Maintenance Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="type"
                            required
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                            <option value="">Select type</option>
                            <option value="Oil Change">Oil Change</option>
                            <option value="Tire Replacement">Tire Replacement</option>
                            <option value="Brake Inspection">Brake Inspection</option>
                            <option value="Battery Replacement">Battery Replacement</option>
                            <option value="Full Service">Full Service</option>
                            <option value="Engine Repair">Engine Repair</option>
                            <option value="Transmission Service">Transmission Service</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="date"
                                type="date"
                                required
                                defaultValue={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Cost (₦) <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="cost"
                                type="number"
                                step="0.01"
                                required
                                placeholder="0.00"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Mileage at Service
                            </label>
                            <input
                                name="mileageAtService"
                                type="number"
                                value={mileage}
                                onChange={(e) => setMileage(e.target.value)}
                                placeholder="Current mileage"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                name="status"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="Completed">Completed</option>
                                <option value="Scheduled">Scheduled</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Performed By
                        </label>
                        <input
                            name="performedBy"
                            type="text"
                            placeholder="Mechanic name or shop"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={3}
                            placeholder="Additional details about the maintenance..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-medium"
                        >
                            Cancel
                        </button>
                        <div className="flex-1">
                            <SubmitButton />
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
