'use client'

import { useState } from 'react'
import { Fuel, TrendingUp, DollarSign, Droplet, Plus, Package, Zap, BarChart3, AlertTriangle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import AddFuelDepositModal from './AddFuelDepositModal'
import AddEquipmentModal from './AddEquipmentModal'

interface Truck {
    id: string
    plateNumber: string
    model: string
}

interface EquipmentItem {
    id: string
    name: string
    type: string
}

interface FuelLog {
    id: string
    date: Date
    liters: number
    cost: number
    mileage: number | null
    efficiency: number | null
    truck: Truck | null
    equipment: EquipmentItem | null
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
    equipment: EquipmentItem[]
    canLogFuel: boolean
    canManageFuel: boolean
    logFuelAction: (formData: FormData) => Promise<{ success: true } | { error: string }>
}

export default function FuelClient({ logs, deposits, trucks, equipment, canLogFuel, canManageFuel, logFuelAction }: FuelClientProps) {
    const [showDepositModal, setShowDepositModal] = useState(false)
    const [showEquipmentModal, setShowEquipmentModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'issuance' | 'deposits' | 'reconciliation'>('issuance')
    const [logError, setLogError] = useState<string | null>(null)
    const [targetType, setTargetType] = useState<'truck' | 'equipment'>('truck')
    const [issuanceLiters, setIssuanceLiters] = useState<number>(0)

    const totalFuel = logs.reduce((acc, log) => acc + log.liters, 0)
    const totalCost = logs.reduce((acc, log) => acc + log.cost, 0)
    const totalDeposited = deposits.reduce((acc, d) => acc + d.liters, 0)
    const totalDepositCost = deposits.reduce((acc, d) => acc + d.totalCost, 0)
    const currentStock = totalDeposited - totalFuel
    const blendedCostPerLiter = totalDeposited > 0 ? totalDepositCost / totalDeposited : 0

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

    // Build reconciliation timeline (deposits + issuances sorted by date)
    const reconciliationEntries = [
        ...deposits.map(d => ({
            id: d.id,
            date: new Date(d.date),
            type: 'deposit' as const,
            liters: d.liters,
            cost: d.totalCost,
            pricePerLiter: d.pricePerLiter,
            description: d.supplier ? `Deposit from ${d.supplier}` : 'Fuel Deposit',
        })),
        ...logs.map(l => ({
            id: l.id,
            date: new Date(l.date),
            type: 'issuance' as const,
            liters: l.liters,
            cost: l.cost,
            pricePerLiter: l.liters > 0 ? l.cost / l.liters : 0,
            description: l.truck
                ? `Issued to ${l.truck.plateNumber}`
                : l.equipment
                    ? `Issued to ${l.equipment.name} (${l.equipment.type})`
                    : 'Fuel Issuance',
        })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime())

    // Calculate running balance for reconciliation
    const reconWithBalance = (() => {
        const sorted = [...reconciliationEntries].sort((a, b) => a.date.getTime() - b.date.getTime())
        let balance = 0
        const entries = sorted.map(entry => {
            if (entry.type === 'deposit') {
                balance += entry.liters
            } else {
                balance -= entry.liters
            }
            return { ...entry, runningBalance: balance }
        })
        return entries.reverse()
    })()

    return (
        <div className="space-y-8 w-full pb-10">
            {/* Header */}
            <div className="border-b border-gray-200 pb-5 flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Diesel & Fuel Intelligence</h1>
                    <p className="text-gray-500 mt-2 text-lg">Track fuel usage, deposits, costs, and equipment efficiency.</p>
                </div>
                <div className="flex items-center gap-3">
                    {canManageFuel && (
                        <>
                            <button
                                onClick={() => setShowEquipmentModal(true)}
                                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                            >
                                <Zap size={16} />
                                Add Equipment
                            </button>
                            <button
                                onClick={() => setShowDepositModal(true)}
                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-medium shadow-lg shadow-emerald-100"
                            >
                                <Plus size={18} />
                                Record Deposit
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 ring-1 ring-emerald-100">
                            <Package size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Current Stock</div>
                            <div className={cn("text-2xl font-bold mt-0.5", currentStock > 0 ? "text-emerald-600" : "text-red-600")}>
                                {currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-sm text-gray-400 font-normal">L</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-orange-50 rounded-xl text-orange-600 ring-1 ring-orange-100">
                            <Droplet size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Issued</div>
                            <div className="text-2xl font-bold text-gray-900 mt-0.5">{totalFuel.toLocaleString()} <span className="text-sm text-gray-400 font-normal">L</span></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-50 rounded-xl text-green-600 ring-1 ring-green-100">
                            <DollarSign size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Spent</div>
                            <div className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(totalDepositCost)}</div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-violet-50 rounded-xl text-violet-600 ring-1 ring-violet-100">
                            <BarChart3 size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Blended Cost</div>
                            <div className="text-2xl font-bold text-gray-900 mt-0.5">{formatCurrency(blendedCostPerLiter)} <span className="text-sm text-gray-400 font-normal">/L</span></div>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 rounded-xl text-blue-600 ring-1 ring-blue-100">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg. Efficiency</div>
                            <div className="text-2xl font-bold text-gray-900 mt-0.5">{avgEfficiency.toFixed(2)} <span className="text-sm text-gray-400 font-normal">km/L</span></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {(['issuance', 'deposits', 'reconciliation'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={cn(
                            "px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                            activeTab === tab
                                ? "bg-white text-gray-900 shadow-sm"
                                : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        {tab === 'issuance' ? 'Fuel Issuance' : tab === 'deposits' ? 'Fuel Deposits' : 'Reconciliation'}
                        {tab === 'deposits' && (
                            <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-semibold">
                                {deposits.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ===== ISSUANCE TAB ===== */}
            {activeTab === 'issuance' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{logError}</div>
                                        )}

                                        {currentStock <= 0 && (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm p-3 rounded-lg flex items-start gap-2">
                                                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="font-medium">No fuel in stock</p>
                                                    <p className="text-xs text-amber-600 mt-0.5">Record a fuel deposit before issuing fuel.</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Target Type Toggle */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Issue To</label>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetType('truck')}
                                                    className={cn(
                                                        "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                                                        targetType === 'truck'
                                                            ? "bg-blue-50 border-blue-200 text-blue-700"
                                                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                                    )}
                                                >
                                                    🚛 Truck
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setTargetType('equipment')}
                                                    className={cn(
                                                        "flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-all",
                                                        targetType === 'equipment'
                                                            ? "bg-violet-50 border-violet-200 text-violet-700"
                                                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                                                    )}
                                                >
                                                    ⚡ Equipment
                                                </button>
                                            </div>
                                            <input type="hidden" name="targetType" value={targetType} />
                                        </div>

                                        {/* Target Selector */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                                {targetType === 'truck' ? 'Select Truck' : 'Select Equipment'}
                                            </label>
                                            <select
                                                name="targetId"
                                                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all bg-gray-50/50 hover:bg-white"
                                                required
                                            >
                                                <option value="">
                                                    {targetType === 'truck' ? 'Choose a truck...' : 'Choose equipment...'}
                                                </option>
                                                {targetType === 'truck'
                                                    ? trucks.map(t => (
                                                        <option key={t.id} value={t.id}>{t.plateNumber} ({t.model})</option>
                                                    ))
                                                    : equipment.map(e => (
                                                        <option key={e.id} value={e.id}>{e.name} ({e.type})</option>
                                                    ))
                                                }
                                            </select>
                                            {targetType === 'equipment' && equipment.length === 0 && (
                                                <p className="text-xs text-amber-600 mt-1.5">No equipment registered. Add equipment first.</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Liters Issued</label>
                                            <div className="relative">
                                                <input name="liters" type="number" step="0.1" placeholder="0.0" required
                                                    max={currentStock > 0 ? currentStock : undefined}
                                                    onChange={(e) => setIssuanceLiters(parseFloat(e.target.value) || 0)}
                                                    className="w-full pl-4 pr-12 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                />
                                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 font-medium">L</div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1.5">
                                                Available: <span className={cn("font-semibold", currentStock > 0 ? "text-emerald-600" : "text-red-600")}>{currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</span>
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Estimated Cost</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 font-medium">₦</div>
                                                <div className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 font-medium">
                                                    {(issuanceLiters * blendedCostPerLiter).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1.5">
                                                Based on blended rate: <span className="font-semibold text-gray-700">{formatCurrency(blendedCostPerLiter)}/L</span>
                                            </p>
                                        </div>

                                        {/* Mileage - only for trucks */}
                                        {targetType === 'truck' && (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Mileage</label>
                                                <div className="relative">
                                                    <input name="mileage" type="number" placeholder="0" required
                                                        className="w-full pl-4 pr-12 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                                    />
                                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-gray-400 font-medium">km</div>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
                                                    <TrendingUp size={12} />
                                                    Used to calculate efficiency since last fill
                                                </p>
                                            </div>
                                        )}

                                        <button type="submit"
                                            disabled={currentStock <= 0}
                                            className={cn(
                                                "w-full py-2.5 text-white rounded-lg font-medium transition-colors transform duration-100",
                                                currentStock > 0
                                                    ? "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100 active:scale-[0.98]"
                                                    : "bg-gray-300 cursor-not-allowed"
                                            )}
                                        >
                                            {currentStock <= 0 ? 'No Stock Available' : 'Save Log Entry'}
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Fuel Logs List */}
                    <div className={canLogFuel ? "lg:col-span-2" : "lg:col-span-3"}>
                        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-gray-100">
                                <h3 className="text-lg font-semibold text-gray-900">Recent Fuel Logs</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Issued To</th>
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
                                                        <div className="p-3 bg-gray-50 rounded-full mb-3"><Droplet size={24} className="text-gray-300" /></div>
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
                                                        {log.truck ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-blue-600">🚛</span>
                                                                <div className="flex flex-col">
                                                                    <span>{log.truck.plateNumber}</span>
                                                                    <span className="text-xs text-gray-400 font-normal">{log.truck.model}</span>
                                                                </div>
                                                            </div>
                                                        ) : log.equipment ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-violet-600">⚡</span>
                                                                <div className="flex flex-col">
                                                                    <span>{log.equipment.name}</span>
                                                                    <span className="text-xs text-gray-400 font-normal">{log.equipment.type}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                        <span className="font-medium text-gray-900">{log.liters}</span> L
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                        {formatCurrency(log.cost)}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        {log.efficiency ? (
                                                            <span className={cn(
                                                                "inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ring-1 ring-inset",
                                                                log.efficiency > 3 ? "bg-green-50 text-green-700 ring-green-600/20" : "bg-amber-50 text-amber-700 ring-amber-600/20"
                                                            )}>
                                                                {log.efficiency.toFixed(2)} km/L
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-300 text-sm group-hover:text-gray-400 transition-colors">—</span>
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

            {/* ===== DEPOSITS TAB ===== */}
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
                                                <div className="p-3 bg-gray-50 rounded-full mb-3"><Package size={24} className="text-gray-300" /></div>
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
                                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">{formatCurrency(deposit.pricePerLiter)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">{formatCurrency(deposit.totalCost)}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                                                {deposit.supplier || <span className="text-gray-300">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">{deposit.recordedBy}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ===== RECONCILIATION TAB ===== */}
            {activeTab === 'reconciliation' && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-5 rounded-xl text-white shadow-lg">
                            <div className="text-sm opacity-80 font-medium">Total Deposited</div>
                            <div className="text-3xl font-bold mt-1">{totalDeposited.toLocaleString()} L</div>
                            <div className="text-sm opacity-70 mt-1">{formatCurrency(totalDepositCost)} total spent</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-5 rounded-xl text-white shadow-lg">
                            <div className="text-sm opacity-80 font-medium">Total Issued</div>
                            <div className="text-3xl font-bold mt-1">{totalFuel.toLocaleString()} L</div>
                            <div className="text-sm opacity-70 mt-1">{formatCurrency(totalCost)} total value</div>
                        </div>
                        <div className={cn(
                            "p-5 rounded-xl text-white shadow-lg",
                            currentStock >= 0 ? "bg-gradient-to-br from-blue-500 to-blue-700" : "bg-gradient-to-br from-red-500 to-red-700"
                        )}>
                            <div className="text-sm opacity-80 font-medium">Remaining Balance</div>
                            <div className="text-3xl font-bold mt-1">{currentStock.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</div>
                            <div className="text-sm opacity-70 mt-1">Blended cost: {formatCurrency(blendedCostPerLiter)}/L</div>
                        </div>
                    </div>

                    {/* Reconciliation Timeline Table */}
                    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
                        <div className="px-6 py-5 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
                            <p className="text-sm text-gray-500 mt-1">All deposits and issuances with running balance</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Liters</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {reconWithBalance.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center">
                                                <p className="text-gray-500">No transactions yet.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        reconWithBalance.map((entry) => (
                                            <tr key={`${entry.type}-${entry.id}`} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-3.5 text-sm text-gray-600 whitespace-nowrap font-medium">
                                                    {entry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td className="px-6 py-3.5 whitespace-nowrap">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full",
                                                        entry.type === 'deposit'
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "bg-orange-50 text-orange-700"
                                                    )}>
                                                        {entry.type === 'deposit' ? '↓ IN' : '↑ OUT'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3.5 text-sm text-gray-700">{entry.description}</td>
                                                <td className={cn(
                                                    "px-6 py-3.5 text-sm font-semibold text-right whitespace-nowrap",
                                                    entry.type === 'deposit' ? "text-emerald-600" : "text-orange-600"
                                                )}>
                                                    {entry.type === 'deposit' ? '+' : '-'}{entry.liters.toLocaleString()} L
                                                </td>
                                                <td className="px-6 py-3.5 text-sm text-gray-600 text-right whitespace-nowrap">
                                                    {formatCurrency(entry.cost)}
                                                </td>
                                                <td className={cn(
                                                    "px-6 py-3.5 text-sm font-bold text-right whitespace-nowrap",
                                                    entry.runningBalance >= 0 ? "text-gray-900" : "text-red-600"
                                                )}>
                                                    {entry.runningBalance.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showDepositModal && <AddFuelDepositModal onClose={() => setShowDepositModal(false)} />}
            {showEquipmentModal && <AddEquipmentModal onClose={() => setShowEquipmentModal(false)} />}
        </div>
    )
}
