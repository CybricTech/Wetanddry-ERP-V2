'use client'

import { createEquipment } from '@/lib/actions/fuel'
import { X, Plus, AlertCircle, Zap } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useState } from 'react'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-violet-600 to-violet-700 text-white rounded-xl hover:from-violet-700 hover:to-violet-800 transition-all font-semibold shadow-lg shadow-violet-500/25 disabled:opacity-50"
        >
            {pending ? 'Adding...' : 'Add Equipment'}
        </button>
    )
}

interface AddEquipmentModalProps {
    onClose: () => void
}

export default function AddEquipmentModal({ onClose }: AddEquipmentModalProps) {
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (formData: FormData) => {
        setError(null)
        const result = await createEquipment(formData)
        if ('error' in result) {
            setError(result.error)
            return
        }
        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                            <Zap className="text-violet-600" size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900">Add Equipment</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
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
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            name="name"
                            type="text"
                            required
                            placeholder="e.g., Generator 1"
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="type"
                            required
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                        >
                            <option value="">Select type...</option>
                            <option value="Generator">Generator</option>
                            <option value="Pump">Pump</option>
                            <option value="Compressor">Compressor</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                        <textarea
                            name="notes"
                            rows={2}
                            placeholder="Optional notes..."
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all resize-none"
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
