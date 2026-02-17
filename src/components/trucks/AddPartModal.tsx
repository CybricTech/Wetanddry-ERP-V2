'use client'

import { createPart } from '@/lib/actions/trucks'
import { X, Cog, AlertCircle } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all font-semibold shadow-lg shadow-purple-500/25 disabled:opacity-50"
        >
            {pending ? 'Adding...' : 'Add Component'}
        </button>
    )
}

interface AddPartModalProps {
    truckId: string
    truckMileage: number
    onClose: () => void
}

export default function AddPartModal({ truckId, truckMileage, onClose }: AddPartModalProps) {
    const [category, setCategory] = useState('')
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (formData: FormData) => {
        setError(null)
        const result = await createPart(formData)
        if ('error' in result) {
            setError(result.error)
            return
        }
        onClose()
    }

    // Position options based on category
    const getPositionOptions = () => {
        switch (category) {
            case 'Tire':
                return ['Front Left', 'Front Right', 'Rear Left Outer', 'Rear Left Inner', 'Rear Right Outer', 'Rear Right Inner', 'Spare']
            case 'Battery':
                return ['Primary', 'Secondary', 'Backup']
            case 'Brake Pad':
                return ['Front Left', 'Front Right', 'Rear Left', 'Rear Right']
            default:
                return ['Engine Bay', 'Cabin', 'Chassis', 'Drum', 'Other']
        }
    }

    // Default lifespan based on category
    const getDefaultLifespan = () => {
        switch (category) {
            case 'Tire': return { months: 18, mileage: 50000 }
            case 'Battery': return { months: 36, mileage: null }
            case 'Brake Pad': return { months: 12, mileage: 30000 }
            case 'Filter': return { months: 6, mileage: 15000 }
            default: return { months: 12, mileage: null }
        }
    }

    const defaults = getDefaultLifespan()

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Cog className="text-purple-600" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Add Component</h2>
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
                    <input type="hidden" name="mileageAtInstall" value={truckMileage} />

                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Part Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="partNumber"
                                type="text"
                                required
                                placeholder="e.g. TIR-2024-001"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Category <span className="text-red-500">*</span>
                            </label>
                            <select
                                name="category"
                                required
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            >
                                <option value="">Select</option>
                                <option value="Tire">Tire</option>
                                <option value="Battery">Battery</option>
                                <option value="Brake Pad">Brake Pad</option>
                                <option value="Filter">Filter</option>
                                <option value="Belt">Belt</option>
                                <option value="Hose">Hose</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Component Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="name"
                            type="text"
                            required
                            placeholder="e.g. Michelin XDN2 Grip 315/80R22.5"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {category && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Position
                            </label>
                            <select
                                name="position"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            >
                                <option value="">Select position</option>
                                {getPositionOptions().map(pos => (
                                    <option key={pos} value={pos}>{pos}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Install Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="installedDate"
                                type="date"
                                required
                                defaultValue={new Date().toISOString().split('T')[0]}
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Lifespan (Months) <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="lifespanMonths"
                                type="number"
                                required
                                key={category}
                                defaultValue={defaults.months}
                                placeholder="e.g. 18"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Lifespan (km)
                            </label>
                            <input
                                name="lifespanMileage"
                                type="number"
                                key={category + '_mileage'}
                                defaultValue={defaults.mileage || ''}
                                placeholder="e.g. 50000"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Purchase Price (₦)
                            </label>
                            <input
                                name="purchasePrice"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Supplier
                            </label>
                            <input
                                name="supplier"
                                type="text"
                                placeholder="Supplier name"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Warranty Expiry
                            </label>
                            <input
                                name="warrantyExpiry"
                                type="date"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            placeholder="Additional notes..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
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
