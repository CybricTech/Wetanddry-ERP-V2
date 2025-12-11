import React from 'react';
import { getFuelLogs, logFuel } from '@/lib/actions/fuel';
import { getTrucks } from '@/lib/actions/trucks';
import { Fuel, TrendingUp, DollarSign, Droplet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

export default async function FuelPage() {
    const [logs, trucks, session] = await Promise.all([
        getFuelLogs(),
        getTrucks(),
        auth()
    ]);

    const canLogFuel = session?.user?.role ? hasPermission(session.user.role, 'log_fuel') : false;

    const totalFuel = logs.reduce((acc, log) => acc + log.liters, 0);
    const totalCost = logs.reduce((acc, log) => acc + log.cost, 0);

    // Calculate average efficiency (excluding nulls)
    const efficiencyLogs = logs.filter(log => log.efficiency !== null);
    const avgEfficiency = efficiencyLogs.length > 0
        ? efficiencyLogs.reduce((acc, log) => acc + (log.efficiency || 0), 0) / efficiencyLogs.length
        : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Diesel & Fuel Intelligence</h1>
                    <p className="text-gray-600 mt-1">Track fuel usage, costs, and vehicle efficiency</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                        <Droplet size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Total Fuel Consumed</div>
                        <div className="text-2xl font-bold text-gray-900">{totalFuel.toLocaleString()} L</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full text-green-600">
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Total Cost</div>
                        <div className="text-2xl font-bold text-gray-900">₦{totalCost.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full text-blue-600">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Avg. Efficiency</div>
                        <div className="text-2xl font-bold text-gray-900">{avgEfficiency.toFixed(2)} km/L</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Log Fuel Form - Only shown to users with log_fuel permission */}
                {canLogFuel && (
                    <div className="lg:col-span-1">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <Fuel className="text-blue-600" />
                                Log Fuel Issuance
                            </h2>

                            <form action={logFuel} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Select Truck
                                    </label>
                                    <select
                                        name="truckId"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Choose a truck...</option>
                                        {trucks.map(truck => (
                                            <option key={truck.id} value={truck.id}>{truck.plateNumber} ({truck.model})</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Liters Issued
                                    </label>
                                    <input
                                        name="liters"
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g., 50.0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Total Cost (₦)
                                    </label>
                                    <input
                                        name="cost"
                                        type="number"
                                        step="0.01"
                                        placeholder="e.g., 45000"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Current Mileage (km)
                                    </label>
                                    <input
                                        name="mileage"
                                        type="number"
                                        placeholder="e.g., 12500"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Used to calculate efficiency since last fill.</p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                                >
                                    Save Log
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Fuel Logs List */}
                <div className={canLogFuel ? "lg:col-span-2" : "lg:col-span-3"}>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Recent Fuel Logs</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Truck</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Liters</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cost</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Efficiency</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {logs.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No fuel logs found.
                                            </td>
                                        </tr>
                                    ) : (
                                        logs.map((log) => (
                                            <tr key={log.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm text-gray-900">{log.date.toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{log.truck.plateNumber}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700">{log.liters} L</td>
                                                <td className="px-6 py-4 text-sm text-gray-700">₦{log.cost.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    {log.efficiency ? (
                                                        <span className={cn(
                                                            "inline-block px-2 py-1 text-xs font-semibold rounded-full",
                                                            log.efficiency > 3 ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                                                        )}>
                                                            {log.efficiency.toFixed(2)} km/L
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">-</span>
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
        </div>
    );
}
