'use client'

import { useState } from 'react'
import { updateTruck } from '@/lib/actions/trucks'
import { X, Save, Loader2, Truck } from 'lucide-react'

interface EditTruckModalProps {
    truck: {
        id: string
        plateNumber: string
        model: string
        capacity: string
        status: string
        purchaseDate: Date
        mileage: number
    }
    onClose: () => void
}

export default function EditTruckModal({ truck, onClose }: EditTruckModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsSubmitting(true)
        setError(null)

        try {
            const formData = new FormData(e.currentTarget)
            await updateTruck(truck.id, formData)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update truck')
            setIsSubmitting(false)
        }
    }

    const formatDate = (date: Date) => {
        const d = new Date(date)
        return d.toISOString().split('T')[0]
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                                <Truck size={20} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Edit Truck</h2>
                                <p className="text-blue-100 text-sm">Update vehicle information</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 p-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Plate Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="plateNumber"
                                type="text"
                                required
                                defaultValue={truck.plateNumber}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Model <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="model"
                                type="text"
                                required
                                defaultValue={truck.model}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Capacity <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="capacity"
                                required
                                defaultValue={truck.capacity}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="">Select capacity</option>
                                <option value="4m³">4m³</option>
                                <option value="6m³">6m³</option>
                                <option value="8m³">8m³</option>
                                <option value="10m³">10m³</option>
                                <option value="12m³">12m³</option>
                                <option value="14m³">14m³</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Purchase Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="purchaseDate"
                                type="date"
                                required
                                defaultValue={formatDate(truck.purchaseDate)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Current Mileage (km)
                            </label>
                            <input
                                name="mileage"
                                type="number"
                                defaultValue={truck.mileage}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Status
                            </label>
                            <select
                                name="status"
                                defaultValue={truck.status}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="Available">Available</option>
                                <option value="In Use">In Use</option>
                                <option value="Maintenance">Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 disabled:opacity-50 font-semibold shadow-lg shadow-blue-500/25 transition-all"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
