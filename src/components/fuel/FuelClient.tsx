'use client'

import { useState } from 'react'
import { Fuel, TrendingUp, DollarSign, Droplet, Plus, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import AddFuelDepositModal from './AddFuelDepositModal'

interface Truck {
    id: string
    plateNumber: string
    model: string
}

interface FuelLog {
    id: string
    date: Date
    liters: number
    cost: number
    efficiency: number | null
    truck: Truck
}

interface FuelDeposit {
    id: string
    date: Date
    liters: number
    pricePerLiter: number
    totalCost: number
    supplier: string | null
    recordedBy: string
}

interface FuelClientProps {
    logs: FuelLog[]
    deposits: FuelDeposit[]
    trucks: Truck[]
    canLogFuel: boolean
    canManageFuel: boolean
    logFuelAction: (formData: FormData) => Promise<{ success: true } | { error: string }>
}

export default function FuelClient({ logs, deposits, trucks, canLogFuel, canManageFuel, logFuelAction }: FuelClientProps) {
    const [showDepositModal, setShowDepositModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'issuance' | 'deposits'>('issuance')
    const [logError, setLogError] = useState<string | null>(null)

    const totalFuel = logs.reduce((acc, log) => acc + log.liters, 0)
    const totalCost = logs.reduce((acc, log) => acc + log.cost, 0)
    const totalDeposited = deposits.reduce((acc, d) => acc + d.liters, 0)
    const currentStock = totalDeposited - totalFuel

    const efficiencyLogs = logs.filter(log => log.efficiency !== null)
    const avgEfficiency = efficiencyLogs.length > 0
        ? efficiencyLogs.reduce((acc, log) => acc + (log.efficiency || 0), 0) / efficiencyLogs.length
        : 0

    const handleLogFuel = async (formData: FormData) => {
        setLogError(null)
        const result = await logFuelAction(formData)
        if ('error' in result) {
            setLogError(result.error)
        }
    }

    return (
        <div className="space-y-8 w-full pb-10">
            {/* Header */}
            <div className="border-b border-gray-200 pb-5 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Diesel & Fuel Intelligence</h1>
                    <p className="text-gray-500 mt-2 text-lg">Track fuel usage, deposits, costs, and vehicle efficiency across your fleet.</p>
                </div>
                {canManageFuel && (
                    <button
                        onClick={() => setShowDepositModal(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-lg shadow-emerald-100"
                    >
                        <Plus size={18} />
                        Record Deposit
                    </button>
                )}
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-emerald-50 rounded-xl text-emerald-600 ring-1 ring-emerald-100">
                            <Package size={28} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Current Stock</div>
                            <div className={cn(
                                "text-3xl font-bold mt-1",
                                currentStock > 0 ? "text-emerald-600" : "text-red-600"
                            )}>
                                {currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-lg text-gray-400 font-normal">L</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-orange-50 rounded-xl text-orange-600 ring-1 ring-orange-100">
                            <Droplet size={28} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Issued</div>
                            <div className="text-3xl font-bold text-gray-900 mt-1">{totalFuel.toLocaleString()} <span className="text-lg text-gray-400 font-normal">L</span></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-green-50 rounded-xl text-green-600 ring-1 ring-green-100">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Cost</div>
                            <div className="text-3xl font-bold text-gray-900 mt-1">₦{totalCost.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-center gap-5">
                        <div className="p-4 bg-blue-50 rounded-xl text-blue-600 ring-1 ring-blue-100">
                            <TrendingUp size={28} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Avg. Efficiency</div>
                            <div className="text-3xl font-bold text-gray-900 mt-1">{avgEfficiency.toFixed(2)} <span className="text-lg text-gray-400 font-normal">km/L</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('issuance')}
                    className={cn(
                        "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                        activeTab === 'issuance'
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    )}
                >
                    Fuel Issuance
                </button>
                <button
                    onClick={() => setActiveTab('deposits')}
                    className={cn(
                        "px-5 py-2 rounded-lg text-sm font-medium transition-all",
                        activeTab === 'deposits'
                            ? "bg-white text-gray-900 shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                    )}
                >
                    Fuel Deposits
                    <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold">
                        {deposits.length}
                    </span>
                </button>
            </div>

            {/* Issuance Tab */}
            {activeTab === 'issuance' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Log Fuel Form */}
                    {canLogFuel && (
                        <div className="lg:col-span-1">
                            <div className="bg-white border border-gray-100 rounded-xl shadow-sm sticky top-24 overflow-hidden">
                                <div className="bg-gray-50/50 px-6 py-4 border-b border-gray-100">
                                    <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <Fuel className="text-blue-600" size={20} />
                                        Log Fuel Issuance
                                    </h2>
                                </div>

                                <div className="p-6">
                                    <form action={handleLogFuel} className="space-y-5">
                                        {logError && (
                                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                                                {logError}
                                            </div>
                                        )}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Select Truck
                                            </label>
                                            <select
                                                name="truckId"
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 hover:bg-white"
                                                required
                                            >
                                                <option value="">Choose a truck...</option>
                                                {trucks.map(truck => (
                                                    <option key={truck.id} value={truck.id}>{truck.plateNumber} ({truck.model})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Liters Issued
                                            </label>
                                            <div className="relative">
                                                <input
                                                    name="liters"
                                                    type="number"
                                                    step="0.1"
                                                    placeholder="0.0"
                                                    className="w-full pl-4 pr-12 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    required
                                                />
                                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 font-medium">L</div>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Total Cost
                                            </label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-medium">₦</div>
                                                <input
                                                    name="cost"
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                Current Mileage
                                            </label>
                                            <div className="relative">
                                                <input
                                                    name="mileage"
                                                    type="number"
                                                    placeholder="0"
                                                    className="w-full pl-4 pr-12 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    required
                                                />
                                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 font-medium">km</div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                                                <TrendingUp size={12} />
                                                Used to calculate efficiency since last fill
                                            </p>
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-lg shadow-blue-100 active:scale-[0.98] transform duration-100"
                                        >
                                            Save Log Entry
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fuel Logs List */}
                    <div className={canLogFuel ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-gray-900">Recent Fuel Logs</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Truck</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Liters</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Efficiency</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center justify-center text-gray-400">
                                                        <div className="p-3 bg-gray-50 rounded-full mb-3">
                                                            <Droplet size={24} className="text-gray-300" />
                                                        </div>
                                                        <p className="text-base font-medium text-gray-900">No fuel records found</p>
                                                        <p className="text-sm mt-1">Start logging fuel usage to see data here.</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            logs.map((log) => (
                                                <tr key={log.id} className="hover:bg-gray-50/80 transition-colors group">
                                                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap font-medium">
                                                        {new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                                                        <div className="flex flex-col">
                                                            <span>{log.truck.plateNumber}</span>
                                                            <span className="text-xs text-gray-400 font-normal">{log.truck.model}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                        <span className="font-medium text-gray-900">{log.liters}</span> L
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                        ₦{log.cost.toLocaleString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {log.efficiency ? (
                                                            <span className={cn(
                                                                "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 ring-inset",
                                                                log.efficiency > 3
                                                                    ? "bg-green-50 text-green-700 ring-green-600/20"
                                                                    : "bg-amber-50 text-amber-700 ring-amber-600/20"
                                                            )}>
                                                                {log.efficiency.toFixed(2)} km/L
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300 text-sm group-hover:text-gray-400 transition-colors">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Deposits Tab */}
            {activeTab === 'deposits' && (
                <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Fuel Deposit History</h3>
                        <div className="text-sm text-gray-500">
                            Total deposited: <span className="font-semibold text-emerald-600">{totalDeposited.toLocaleString()} L</span>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Liters</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price/Liter</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier</th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recorded By</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {deposits.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-gray-400">
                                                <div className="p-3 bg-gray-50 rounded-full mb-3">
                                                    <Package size={24} className="text-gray-300" />
                                                </div>
                                                <p className="text-base font-medium text-gray-900">No deposits recorded</p>
                                                <p className="text-sm mt-1">Record fuel purchases to track your stock levels.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    deposits.map((deposit) => (
                                        <tr key={deposit.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap font-medium">
                                                {new Date(deposit.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                <span className="font-semibold text-emerald-600">{deposit.liters.toLocaleString()}</span> <span className="text-gray-400">L</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                ₦{deposit.pricePerLiter.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">
                                                ₦{deposit.totalCost.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                {deposit.supplier || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                                {deposit.recordedBy}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Deposit Modal */}
            {showDepositModal && (
                <AddFuelDepositModal onClose={() => setShowDepositModal(false)} />
            )}
        </div>
    )
}
