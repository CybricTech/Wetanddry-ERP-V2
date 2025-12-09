'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
    ArrowLeft, Truck, Calendar, Edit, CheckCircle, AlertCircle,
    Plus, Wrench, Cog, CalendarClock, AlertTriangle, Clock,
    Gauge, MapPin, DollarSign, Battery, CircleDot
} from 'lucide-react'
import { cn } from '@/lib/utils'
import AddMaintenanceModal from './AddMaintenanceModal'
import ScheduleMaintenanceModal from './ScheduleMaintenanceModal'
import AddPartModal from './AddPartModal'

interface TruckData {
    id: string
    plateNumber: string
    model: string
    capacity: string
    status: string
    purchaseDate: Date
    mileage: number
    lastServiceDate: Date | null
    nextServiceDate: Date | null
    nextServiceMileage: number | null
    maintenanceRecords: {
        id: string
        date: Date
        type: string
        cost: number
        mileageAtService: number | null
        status: string
        notes: string | null
        performedBy: string | null
    }[]
    maintenanceSchedules: {
        id: string
        type: string
        intervalType: string
        intervalDays: number | null
        intervalMileage: number | null
        nextDueDate: Date | null
        nextDueMileage: number | null
        priority: string
        isActive: boolean
    }[]
    parts: {
        id: string
        partNumber: string
        name: string
        category: string
        position: string | null
        installedDate: Date
        lifespanMonths: number
        lifespanMileage: number | null
        expectedReplacementDate: Date | null
        purchasePrice: number | null
        status: string
    }[]
    fuelLogs: {
        id: string
        date: Date
        liters: number
        cost: number
        mileage: number
        efficiency: number | null
    }[]
}

interface TruckDetailsClientProps {
    truck: TruckData
}

export default function TruckDetailsClient({ truck }: TruckDetailsClientProps) {
    const [showMaintenanceModal, setShowMaintenanceModal] = useState(false)
    const [showScheduleModal, setShowScheduleModal] = useState(false)
    const [showPartModal, setShowPartModal] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'maintenance' | 'components' | 'schedules'>('overview')

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Available': return 'bg-green-100 text-green-800 border-green-200'
            case 'In Use': return 'bg-blue-100 text-blue-800 border-blue-200'
            case 'Maintenance': return 'bg-red-100 text-red-800 border-red-200'
            default: return 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'Critical': return 'bg-red-100 text-red-700'
            case 'High': return 'bg-orange-100 text-orange-700'
            case 'Normal': return 'bg-blue-100 text-blue-700'
            case 'Low': return 'bg-gray-100 text-gray-700'
            default: return 'bg-gray-100 text-gray-700'
        }
    }

    const getPartStatusColor = (status: string, expectedDate: Date | null) => {
        if (status === 'Replaced') return 'bg-gray-100 text-gray-600'
        if (expectedDate && new Date(expectedDate) < new Date()) {
            return 'bg-red-100 text-red-700'
        }
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        if (expectedDate && new Date(expectedDate) < thirtyDaysFromNow) {
            return 'bg-orange-100 text-orange-700'
        }
        return 'bg-green-100 text-green-700'
    }

    // Calculate alerts
    const overdueSchedules = truck.maintenanceSchedules.filter(s =>
        s.isActive && s.nextDueDate && new Date(s.nextDueDate) < new Date()
    )
    const partsDueForReplacement = truck.parts.filter(p =>
        p.status === 'Active' && p.expectedReplacementDate && new Date(p.expectedReplacementDate) < new Date()
    )
    const partsNearingReplacement = truck.parts.filter(p => {
        if (p.status !== 'Active' || !p.expectedReplacementDate) return false
        const date = new Date(p.expectedReplacementDate)
        const now = new Date()
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        return date > now && date < thirtyDays
    })

    const totalAlerts = overdueSchedules.length + partsDueForReplacement.length

    // Calculate maintenance cost this year
    const thisYear = new Date().getFullYear()
    const maintenanceCostThisYear = truck.maintenanceRecords
        .filter(r => new Date(r.date).getFullYear() === thisYear)
        .reduce((sum, r) => sum + r.cost, 0)

    return (
        <div className="space-y-6">
            {/* Back Link */}
            <Link
                href="/trucks"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
                <ArrowLeft size={20} />
                <span className="font-medium">Back to Fleet</span>
            </Link>

            {/* Header Card */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="flex items-start gap-5">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Truck size={40} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{truck.plateNumber}</h1>
                            <p className="text-gray-600 mt-1">{truck.model}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-3">
                                <span className={cn(
                                    "inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full border",
                                    getStatusColor(truck.status)
                                )}>
                                    {truck.status}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                    <Gauge size={16} /> {truck.capacity}
                                </span>
                                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                                    <MapPin size={16} /> {truck.mileage.toLocaleString()} km
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setShowScheduleModal(true)}
                            className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium transition-all"
                        >
                            <CalendarClock size={18} />
                            Schedule Maintenance
                        </button>
                        <button
                            onClick={() => setShowMaintenanceModal(true)}
                            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                        >
                            <Plus size={18} />
                            Add Record
                        </button>
                    </div>
                </div>
            </div>

            {/* Alerts Section */}
            {totalAlerts > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <AlertTriangle className="text-red-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-red-900">Action Required</h3>
                            <p className="text-sm text-red-700">{totalAlerts} alert{totalAlerts > 1 ? 's' : ''} need attention</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {overdueSchedules.map(s => (
                            <div key={s.id} className="flex items-center gap-2 text-sm text-red-800 bg-white/50 rounded-lg px-3 py-2">
                                <Clock size={14} />
                                <span className="font-medium">{s.type}</span> is overdue
                                {s.nextDueDate && (
                                    <span className="text-red-600">
                                        (was due {new Date(s.nextDueDate).toLocaleDateString()})
                                    </span>
                                )}
                            </div>
                        ))}
                        {partsDueForReplacement.map(p => (
                            <div key={p.id} className="flex items-center gap-2 text-sm text-red-800 bg-white/50 rounded-lg px-3 py-2">
                                <CircleDot size={14} />
                                <span className="font-medium">{p.name}</span> needs replacement
                                {p.position && <span className="text-red-600">({p.position})</span>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 border-b border-gray-200">
                {[
                    { id: 'overview', label: 'Overview', icon: Truck },
                    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
                    { id: 'components', label: 'Components', icon: Cog },
                    { id: 'schedules', label: 'Schedules', icon: CalendarClock },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 -mb-px transition-colors",
                            activeTab === tab.id
                                ? "border-blue-600 text-blue-600"
                                : "border-transparent text-gray-500 hover:text-gray-700"
                        )}
                    >
                        <tab.icon size={18} />
                        {tab.label}
                        {tab.id === 'components' && partsNearingReplacement.length > 0 && (
                            <span className="bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                                {partsNearingReplacement.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Truck Info */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <Truck size={20} className="text-blue-600" />
                            Truck Information
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Plate Number</span>
                                <span className="font-medium text-gray-900">{truck.plateNumber}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Model</span>
                                <span className="font-medium text-gray-900">{truck.model}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Capacity</span>
                                <span className="font-medium text-gray-900">{truck.capacity}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Purchase Date</span>
                                <span className="font-medium text-gray-900">
                                    {new Date(truck.purchaseDate).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Current Mileage</span>
                                <span className="font-medium text-gray-900">{truck.mileage.toLocaleString()} km</span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-gray-600">Last Service</span>
                                <span className="font-medium text-gray-900">
                                    {truck.lastServiceDate
                                        ? new Date(truck.lastServiceDate).toLocaleDateString()
                                        : 'No records'
                                    }
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl p-6 shadow-lg shadow-blue-500/25">
                            <div className="flex items-center gap-3 mb-2">
                                <DollarSign size={24} />
                                <span className="text-blue-100">Maintenance Cost (This Year)</span>
                            </div>
                            <div className="text-3xl font-bold">
                                ₦{maintenanceCostThisYear.toLocaleString()}
                            </div>
                            <div className="text-blue-100 text-sm mt-1">
                                {truck.maintenanceRecords.filter(r => new Date(r.date).getFullYear() === thisYear).length} services performed
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-2xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Component Status</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-4 bg-green-50 rounded-xl">
                                    <div className="text-2xl font-bold text-green-700">
                                        {truck.parts.filter(p => p.status === 'Active').length}
                                    </div>
                                    <div className="text-sm text-green-600">Active</div>
                                </div>
                                <div className="text-center p-4 bg-orange-50 rounded-xl">
                                    <div className="text-2xl font-bold text-orange-700">
                                        {partsNearingReplacement.length}
                                    </div>
                                    <div className="text-sm text-orange-600">Due Soon</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'maintenance' && (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Maintenance History</h3>
                        <button
                            onClick={() => setShowMaintenanceModal(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 flex items-center gap-2 text-sm font-medium transition-all"
                        >
                            <Plus size={16} />
                            Add Record
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mileage</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cost</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {truck.maintenanceRecords.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Wrench className="mx-auto text-gray-300 mb-3" size={40} />
                                            <p className="text-gray-500">No maintenance records yet</p>
                                            <button
                                                onClick={() => setShowMaintenanceModal(true)}
                                                className="mt-3 text-blue-600 hover:text-blue-700 font-medium text-sm"
                                            >
                                                Add first record →
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    truck.maintenanceRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                {new Date(record.date).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{record.type}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {record.mileageAtService?.toLocaleString() || '-'} km
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                ₦{record.cost.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                {record.notes || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'components' && (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Component Lifecycle Tracking</h3>
                        <button
                            onClick={() => setShowPartModal(true)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 flex items-center gap-2 text-sm font-medium transition-all"
                        >
                            <Plus size={16} />
                            Add Component
                        </button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Component</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Part #</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Position</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Installed</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expected Replacement</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {truck.parts.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Cog className="mx-auto text-gray-300 mb-3" size={40} />
                                            <p className="text-gray-500">No components tracked yet</p>
                                            <button
                                                onClick={() => setShowPartModal(true)}
                                                className="mt-3 text-purple-600 hover:text-purple-700 font-medium text-sm"
                                            >
                                                Add first component →
                                            </button>
                                        </td>
                                    </tr>
                                ) : (
                                    truck.parts.map((part) => (
                                        <tr key={part.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                                        {part.category === 'Tire' && <CircleDot size={16} className="text-purple-600" />}
                                                        {part.category === 'Battery' && <Battery size={16} className="text-purple-600" />}
                                                        {!['Tire', 'Battery'].includes(part.category) && <Cog size={16} className="text-purple-600" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{part.name}</div>
                                                        <div className="text-xs text-gray-500">{part.category}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 font-mono">{part.partNumber}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{part.position || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(part.installedDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {part.expectedReplacementDate
                                                    ? new Date(part.expectedReplacementDate).toLocaleDateString()
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "inline-block px-2.5 py-1 text-xs font-semibold rounded-full",
                                                    getPartStatusColor(part.status, part.expectedReplacementDate)
                                                )}>
                                                    {part.status === 'Active'
                                                        ? (part.expectedReplacementDate && new Date(part.expectedReplacementDate) < new Date()
                                                            ? 'Needs Replacement'
                                                            : 'Active')
                                                        : part.status
                                                    }
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'schedules' && (
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div className="p-5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Maintenance Schedules</h3>
                        <button
                            onClick={() => setShowScheduleModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center gap-2 text-sm font-medium transition-all"
                        >
                            <Plus size={16} />
                            Add Schedule
                        </button>
                    </div>
                    <div className="p-6 grid gap-4">
                        {truck.maintenanceSchedules.length === 0 ? (
                            <div className="text-center py-12">
                                <CalendarClock className="mx-auto text-gray-300 mb-3" size={40} />
                                <p className="text-gray-500">No maintenance schedules yet</p>
                                <button
                                    onClick={() => setShowScheduleModal(true)}
                                    className="mt-3 text-green-600 hover:text-green-700 font-medium text-sm"
                                >
                                    Create first schedule →
                                </button>
                            </div>
                        ) : (
                            truck.maintenanceSchedules.map((schedule) => {
                                const isOverdue = schedule.nextDueDate && new Date(schedule.nextDueDate) < new Date()
                                return (
                                    <div
                                        key={schedule.id}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all",
                                            isOverdue
                                                ? "bg-red-50 border-red-200"
                                                : "bg-gray-50 border-gray-200 hover:border-gray-300"
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                "w-10 h-10 rounded-xl flex items-center justify-center",
                                                isOverdue ? "bg-red-100" : "bg-green-100"
                                            )}>
                                                <CalendarClock size={20} className={isOverdue ? "text-red-600" : "text-green-600"} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">{schedule.type}</div>
                                                <div className="text-sm text-gray-500">
                                                    {schedule.intervalType === 'date' && `Every ${schedule.intervalDays} days`}
                                                    {schedule.intervalType === 'mileage' && `Every ${schedule.intervalMileage?.toLocaleString()} km`}
                                                    {schedule.intervalType === 'both' && `Every ${schedule.intervalDays} days or ${schedule.intervalMileage?.toLocaleString()} km`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className={cn(
                                                    "text-sm font-medium",
                                                    isOverdue ? "text-red-700" : "text-gray-700"
                                                )}>
                                                    {schedule.nextDueDate
                                                        ? `Due ${new Date(schedule.nextDueDate).toLocaleDateString()}`
                                                        : schedule.nextDueMileage
                                                            ? `Due at ${schedule.nextDueMileage.toLocaleString()} km`
                                                            : 'Not scheduled'
                                                    }
                                                </div>
                                                {isOverdue && (
                                                    <div className="text-xs text-red-600 font-medium">OVERDUE</div>
                                                )}
                                            </div>
                                            <span className={cn(
                                                "px-2.5 py-1 text-xs font-semibold rounded-full",
                                                getPriorityColor(schedule.priority)
                                            )}>
                                                {schedule.priority}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showMaintenanceModal && (
                <AddMaintenanceModal
                    truckId={truck.id}
                    truckMileage={truck.mileage}
                    onClose={() => setShowMaintenanceModal(false)}
                />
            )}
            {showScheduleModal && (
                <ScheduleMaintenanceModal
                    truckId={truck.id}
                    truckMileage={truck.mileage}
                    onClose={() => setShowScheduleModal(false)}
                />
            )}
            {showPartModal && (
                <AddPartModal
                    truckId={truck.id}
                    truckMileage={truck.mileage}
                    onClose={() => setShowPartModal(false)}
                />
            )}
        </div>
    )
}
