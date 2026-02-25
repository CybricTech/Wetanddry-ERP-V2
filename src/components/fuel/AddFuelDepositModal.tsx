'use client'

import { createFuelDeposit } from '@/lib/actions/fuel'
import { X, Plus, AlertCircle } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition-all font-semibold shadow-lg shadow-emerald-500/25 disabled:opacity-50"
        >
            {pending ? 'Recording...' : 'Record Deposit'}
        </button>
    )
}

interface AddFuelDepositModalProps {
    onClose: () => void
}

export default function AddFuelDepositModal({ onClose }: AddFuelDepositModalProps) {
    const [error, setError] = useState<string | null>(null)
    const [liters, setLiters] = useState('')
    const [pricePerLiter, setPricePerLiter] = useState('')

    const totalCost = liters && pricePerLiter
        ? (parseFloat(liters) * parseFloat(pricePerLiter)).toFixed(2)
        : '0.00'

    const handleSubmit = async (formData: FormData) => {
        setError(null)
        const result = await createFuelDeposit(formData)
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
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Plus className="text-emerald-600" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Record Fuel Deposit</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <form action={handleSubmit} className="p-6 space-y-5">
                    {error && (
                        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date
                        </label>
                        <input
                            name="date"
                            type="date"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Liters <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <input
                                    name="liters"
                                    type="number"
                                    step="0.1"
                                    required
                                    value={liters}
                                    onChange={(e) => setLiters(e.target.value)}
                                    placeholder="0.0"
                                    className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                />
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 font-medium text-sm">L</div>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Price per Liter (₦) <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-medium text-sm">₦</div>
                                <input
                                    name="pricePerLiter"
                                    type="number"
                                    step="0.01"
                                    required
                                    value={pricePerLiter}
                                    onChange={(e) => setPricePerLiter(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Live total cost calculation */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-emerald-700">Total Cost</span>
                        <span className="text-xl font-bold text-emerald-800">{formatCurrency(parseFloat(totalCost))}</span>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Supplier
                        </label>
                        <input
                            name="supplier"
                            type="text"
                            placeholder="e.g., NNPC, Total Energies"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            rows={2}
                            placeholder="Additional details..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all resize-none"
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
