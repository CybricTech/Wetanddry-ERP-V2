import { getTrucks, getFleetStats, getFleetAlerts } from '@/lib/actions/trucks'
import Link from 'next/link'
import {
    Truck, Plus, Search, Filter, MoreHorizontal, MapPin, Calendar,
    Wrench, Package, AlertTriangle, CheckCircle, Clock, Gauge,
    TrendingUp, DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'

export default async function TrucksPage() {
    const [trucks, stats, alerts, session] = await Promise.all([
        getTrucks(),
        getFleetStats(),
        getFleetAlerts(),
        auth()
    ])

    const canManageFleet = session?.user?.role ? hasPermission(session.user.role, 'manage_fleet') : false

    const criticalAlerts = alerts.filter(a => a.severity === 'critical')
    const warningAlerts = alerts.filter(a => a.severity === 'warning')

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Fleet Management</h1>
                    <p className="text-gray-600 mt-1">Manage your trucks, maintenance, and assets</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/trucks/parts"
                        className="inline-flex items-center justify-center px-5 py-2.5 border border-gray-200 bg-white text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                    >
                        <Package size={20} className="mr-2" />
                        Spare Parts
                    </Link>
                    {canManageFleet && (
                        <Link
                            href="/trucks/add"
                            className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/25"
                        >
                            <Plus size={20} className="mr-2" />
                            Add New Truck
                        </Link>
                    )}
                </div>
            </div>

            {/* Fleet Alert Banner */}
            {criticalAlerts.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center animate-pulse">
                            <AlertTriangle className="text-red-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-red-900">Critical Alerts</h3>
                            <p className="text-sm text-red-700">{criticalAlerts.length} issue{criticalAlerts.length > 1 ? 's' : ''} require immediate attention</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {criticalAlerts.slice(0, 5).map((alert, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 rounded-lg text-sm text-red-800 font-medium">
                                {alert.message}
                            </span>
                        ))}
                        {criticalAlerts.length > 5 && (
                            <span className="px-3 py-1.5 text-sm text-red-600 font-medium">
                                +{criticalAlerts.length - 5} more
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Truck size={20} className="text-blue-600" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{stats.totalTrucks}</div>
                    <div className="text-sm text-gray-600">Total Trucks</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                            <CheckCircle size={20} className="text-green-600" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-green-600">{stats.availableTrucks}</div>
                    <div className="text-sm text-gray-600">Available</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <Wrench size={20} className="text-orange-600" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{stats.maintenanceTrucks}</div>
                    <div className="text-sm text-gray-600">In Maintenance</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <DollarSign size={20} className="text-purple-600" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">₦{(stats.totalMaintenanceCost / 1000).toFixed(0)}K</div>
                    <div className="text-sm text-gray-600">YTD Maintenance</div>
                </div>
            </div>

            {/* Upcoming Maintenance */}
            {warningAlerts.length > 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                            <Clock className="text-yellow-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-yellow-900">Upcoming Maintenance & Alerts</h3>
                            <p className="text-sm text-yellow-700">{warningAlerts.length} item{warningAlerts.length > 1 ? 's' : ''} need attention soon</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {warningAlerts.slice(0, 5).map((alert, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 rounded-lg text-sm text-yellow-800">
                                {alert.message}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by plate number or model..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl outline-none transition-all"
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button className="px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium flex items-center gap-2 border border-transparent hover:border-gray-200 transition-all">
                        <Filter size={18} />
                        Filter
                    </button>
                    <button className="px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium flex items-center gap-2 border border-transparent hover:border-gray-200 transition-all">
                        Status: All
                    </button>
                </div>
            </div>

            {/* Truck Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trucks.length === 0 ? (
                    <div className="col-span-full bg-white rounded-2xl border border-gray-200 p-12 text-center">
                        <Truck className="mx-auto text-gray-300 mb-4" size={64} />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No trucks in fleet</h3>
                        <p className="text-gray-500 mb-6">Get started by adding your first truck</p>
                        {canManageFleet && (
                            <Link
                                href="/trucks/add"
                                className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                            >
                                <Plus size={20} className="mr-2" />
                                Add New Truck
                            </Link>
                        )}
                    </div>
                ) : (
                    trucks.map((truck) => {
                        const hasAlerts = truck.maintenanceSchedules.some(s =>
                            s.nextDueDate && new Date(s.nextDueDate) < new Date()
                        ) || truck.parts.some(p =>
                            p.expectedReplacementDate && new Date(p.expectedReplacementDate) < new Date()
                        )

                        return (
                            <div key={truck.id} className="group bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                                {hasAlerts && (
                                    <div className="absolute top-4 right-4">
                                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                    </div>
                                )}

                                <div className="flex items-start gap-4 mb-6">
                                    <div className={cn(
                                        "w-14 h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300",
                                        truck.status === 'Available' ? "bg-green-50 text-green-600" :
                                            truck.status === 'In Use' ? "bg-blue-50 text-blue-600" :
                                                "bg-orange-50 text-orange-600"
                                    )}>
                                        <Truck size={28} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{truck.plateNumber}</h3>
                                        <p className="text-sm text-gray-500">{truck.model}</p>
                                    </div>
                                </div>

                                <div className="space-y-3 mb-6">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <MapPin size={16} /> Mileage
                                        </span>
                                        <span className="font-medium text-gray-900">{truck.mileage.toLocaleString()} km</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <Calendar size={16} /> Purchased
                                        </span>
                                        <span className="font-medium text-gray-900">{new Date(truck.purchaseDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500 flex items-center gap-2">
                                            <Gauge size={16} /> Capacity
                                        </span>
                                        <span className="font-medium text-gray-900">{truck.capacity}</span>
                                    </div>
                                </div>

                                {/* Quick Stats Row */}
                                <div className="flex items-center gap-2 mb-4">
                                    {truck.maintenanceSchedules.length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                                            <Wrench size={12} />
                                            {truck.maintenanceSchedules.length} schedules
                                        </span>
                                    )}
                                    {truck.parts.length > 0 && (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg text-xs text-gray-600">
                                            <Package size={12} />
                                            {truck.parts.length} parts
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <span className={cn(
                                        "px-3 py-1 rounded-full text-xs font-semibold",
                                        truck.status === 'Available' ? "bg-green-100 text-green-700" :
                                            truck.status === 'In Use' ? "bg-blue-100 text-blue-700" :
                                                "bg-orange-100 text-orange-700"
                                    )}>
                                        {truck.status}
                                    </span>
                                    <Link
                                        href={`/trucks/${truck.id}`}
                                        className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        View Details →
                                    </Link>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    )
}
