'use client'

import { createTruck } from '@/lib/actions/trucks'
import { Save, Upload, ArrowLeft, Truck } from 'lucide-react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={pending}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 disabled:opacity-50 font-semibold shadow-lg shadow-blue-500/25 transition-all"
        >
            <Save size={18} />
            {pending ? 'Saving...' : 'Add Truck'}
        </button>
    )
}

export default function AddTruckForm() {
    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <Link
                href="/trucks"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
                <ArrowLeft size={20} />
                <span className="font-medium">Back to Fleet</span>
            </Link>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                            <Truck size={28} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">Add New Truck</h2>
                            <p className="text-blue-100">Register a new vehicle in your fleet</p>
                        </div>
                    </div>
                </div>

                <form action={createTruck} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Plate Number <span className="text-red-500">*</span>
                            </label>
                            <input
                                name="plateNumber"
                                type="text"
                                required
                                placeholder="e.g., ABC-123-XY"
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
                                placeholder="e.g., Mercedes Actros 4145"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Capacity
                            </label>
                            <select
                                name="capacity"
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
                                placeholder="e.g., 45230"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Initial Status
                            </label>
                            <select
                                name="status"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                            >
                                <option value="Available">Available</option>
                                <option value="In Use">In Use</option>
                                <option value="Maintenance">Maintenance</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Upload Truck Photo
                        </label>
                        <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-blue-400 cursor-pointer transition-colors bg-gray-50 hover:bg-blue-50/50">
                            <Upload className="mx-auto text-gray-400 mb-3" size={40} />
                            <p className="text-sm font-medium text-gray-700">Click to upload or drag and drop</p>
                            <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-100">
                        <Link
                            href="/trucks"
                            className="px-6 py-3 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all"
                        >
                            Cancel
                        </Link>
                        <SubmitButton />
                    </div>
                </form>
            </div>
        </div>
    )
}
