'use client'

import { createMaintenanceSchedule } from '@/lib/actions/trucks'
import { X, CalendarClock, AlertCircle } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 transition-all font-semibold shadow-lg shadow-green-500/25 disabled:opacity-50"
        >
            {pending ? 'Scheduling...' : 'Schedule Maintenance'}
        </button>
    )
}

interface ScheduleMaintenanceModalProps {
    truckId: string
    truckMileage: number
    onClose: () => void
}

export default function ScheduleMaintenanceModal({ truckId, truckMileage, onClose }: ScheduleMaintenanceModalProps) {
    const [intervalType, setIntervalType] = useState('date')
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (formData: FormData) => {
        setError(null)
        const result = await createMaintenanceSchedule(formData)
        if ('error' in result) {
            setError(result.error)
            return
        }
        onClose()
    }

    // Calculate default next due date (90 days from now)
    const defaultNextDue = new Date()
    defaultNextDue.setDate(defaultNextDue.getDate() + 90)

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                            <CalendarClock className="text-green-600" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Schedule Maintenance</h2>
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
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        >
                            <option value="">Select type</option>
                            <option value="Oil Change">Oil Change</option>
                            <option value="Tire Rotation">Tire Rotation</option>
                            <option value="Brake Inspection">Brake Inspection</option>
                            <option value="Full Service">Full Service</option>
                            <option value="Engine Inspection">Engine Inspection</option>
                            <option value="Transmission Service">Transmission Service</option>
                            <option value="Air Filter Replacement">Air Filter Replacement</option>
                            <option value="Coolant Flush">Coolant Flush</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Interval Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {['date', 'mileage', 'both'].map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setIntervalType(type)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${intervalType === type
                                        ? 'bg-green-100 text-green-700 border-2 border-green-500'
                                        : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
                                        }`}
                                >
                                    {type === 'both' ? 'Both' : type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                            ))}
                        </div>
                        <input type="hidden" name="intervalType" value={intervalType} />
                    </div>

                    {(intervalType === 'date' || intervalType === 'both') && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Interval (Days)
                                </label>
                                <input
                                    name="intervalDays"
                                    type="number"
                                    placeholder="e.g. 90"
                                    defaultValue={90}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Next Due Date
                                </label>
                                <input
                                    name="nextDueDate"
                                    type="date"
                                    defaultValue={defaultNextDue.toISOString().split('T')[0]}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {(intervalType === 'mileage' || intervalType === 'both') && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Interval (km)
                                </label>
                                <input
                                    name="intervalMileage"
                                    type="number"
                                    placeholder="e.g. 10000"
                                    defaultValue={10000}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Next Due (km)
                                </label>
                                <input
                                    name="nextDueMileage"
                                    type="number"
                                    defaultValue={truckMileage + 10000}
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Priority
                        </label>
                        <select
                            name="priority"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        >
                            <option value="Low">Low</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Critical">Critical</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            placeholder="Additional notes for this schedule..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
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
