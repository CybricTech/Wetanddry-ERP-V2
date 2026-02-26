'use client'

import { createSparePart } from '@/lib/actions/trucks'
import { getStorageLocations } from '@/lib/actions/inventory'
import { Plus, X, Package } from 'lucide-react'
import { useFormStatus } from 'react-dom'
import { useState, useEffect } from 'react'

function SubmitButton() {
    const { pending } = useFormStatus()
    return (
        <button
            type="submit"
            disabled={pending}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all font-semibold shadow-lg shadow-blue-500/25 disabled:opacity-50"
        >
            {pending ? 'Adding...' : 'Add Spare Part'}
        </button>
    )
}

interface StorageLocation {
    id: string
    name: string
    type: string
}

export default function AddSparePartButton() {
    const [showModal, setShowModal] = useState(false)
    const [locations, setLocations] = useState<StorageLocation[]>([])

    useEffect(() => {
        if (showModal) {
            getStorageLocations().then((locs) => {
                setLocations(locs.map(l => ({ id: l.id, name: l.name, type: l.type })))
            })
        }
    }, [showModal])

    const handleSubmit = async (formData: FormData) => {
        await createSparePart(formData)
        setShowModal(false)
    }

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm hover:shadow-md"
            >
                <Plus size={20} className="mr-2" />
                Add Spare Part
            </button>

            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <Package className="text-blue-600" size={20} />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900">Add Spare Part</h2>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <form action={handleSubmit} className="p-6 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Part Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="partNumber"
                                        type="text"
                                        required
                                        placeholder="e.g. TIR-001"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="category"
                                        required
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    >
                                        <option value="">Select</option>
                                        <option value="Tire">Tire</option>
                                        <option value="Battery">Battery</option>
                                        <option value="Filter">Filter</option>
                                        <option value="Brake Pad">Brake Pad</option>
                                        <option value="Belt">Belt</option>
                                        <option value="Hose">Hose</option>
                                        <option value="Lubricant">Lubricant</option>
                                        <option value="Tool">Tool</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Part Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    name="name"
                                    type="text"
                                    required
                                    placeholder="e.g. Michelin XDN2 Grip 315/80R22.5"
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    rows={2}
                                    placeholder="Optional description..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Quantity
                                    </label>
                                    <input
                                        name="quantity"
                                        type="number"
                                        min="0"
                                        defaultValue="0"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Min Qty
                                    </label>
                                    <input
                                        name="minQuantity"
                                        type="number"
                                        min="0"
                                        defaultValue="1"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Price (₦) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        name="purchasePrice"
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
                                        Supplier
                                    </label>
                                    <input
                                        name="supplier"
                                        type="text"
                                        placeholder="Supplier name"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Storage Location
                                    </label>
                                    <select
                                        name="location"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    >
                                        <option value="">Select location</option>
                                        {locations.map(loc => (
                                            <option key={loc.id} value={loc.name}>
                                                {loc.name} ({loc.type})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
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
            )}
        </>
    )
}
