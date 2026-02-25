import { auth } from '@/auth';
import { getTrucks } from '@/lib/actions/trucks';
import { getInventoryStats } from '@/lib/actions/inventory';
import { getFuelLogs } from '@/lib/actions/fuel';
import { getExceptions } from '@/lib/actions/exceptions';
import { getRecipes } from '@/lib/actions/production';
import {
    Truck, Package, Droplet, AlertOctagon, Factory,
    TrendingUp, Activity, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';

// Dashboard data refreshes every 30 seconds
export const revalidate = 30;

export default async function Dashboard() {
    const session = await auth();

    // Parallel data fetching
    const [trucks, inventory, fuelLogs, exceptions, recipes] = await Promise.all([
        getTrucks(),
        getInventoryStats(),
        getFuelLogs(),
        getExceptions(),
        getRecipes()
    ]);

    // Derived Stats
    const activeTrucks = trucks.filter(t => t.status === 'Available' || t.status === 'In Use').length;
    const maintenanceTrucks = trucks.filter(t => t.status === 'Maintenance').length;
    const lowStockItems = inventory.lowStockItems;
    const totalFuelCost = fuelLogs.reduce((acc, log) => acc + log.cost, 0);
    const unresolvedExceptions = exceptions.filter(e => !e.resolved).length;

    return (
        <div className="space-y-8">
            {/* Welcome Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                    <p className="text-gray-600 mt-1">Welcome back, {session?.user?.name || 'User'}</p>
                </div>
                <div className="text-sm text-gray-500 bg-white px-4 py-2 rounded-full border border-gray-200 shadow-sm">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard
                    title="Fleet Status"
                    value={`${activeTrucks}/${trucks.length}`}
                    subtext={`${maintenanceTrucks} in maintenance`}
                    icon={<Truck className="text-blue-600" />}
                    color="bg-blue-50"
                    link="/trucks"
                />
                <DashboardCard
                    title="Inventory Alerts"
                    value={lowStockItems.toString()}
                    subtext="Items below threshold"
                    icon={<Package className="text-orange-600" />}
                    color="bg-orange-50"
                    link="/inventory"
                    alert={lowStockItems > 0}
                />
                <DashboardCard
                    title="Fuel Cost (Total)"
                    value={formatCurrency(totalFuelCost)}
                    subtext="Lifetime expenditure"
                    icon={<Droplet className="text-green-600" />}
                    color="bg-green-50"
                    link="/fuel"
                />
                <DashboardCard
                    title="Open Issues"
                    value={unresolvedExceptions.toString()}
                    subtext="Unresolved exceptions"
                    icon={<AlertOctagon className="text-red-600" />}
                    color="bg-red-50"
                    link="/exceptions"
                    alert={unresolvedExceptions > 0}
                />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Recent Activity / Quick Actions */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Quick Actions */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <QuickActionLink href="/production" icon={<Factory />} label="Start Production" color="bg-indigo-50 text-indigo-600 hover:bg-indigo-100" />
                            <QuickActionLink href="/fuel" icon={<Droplet />} label="Log Fuel" color="bg-emerald-50 text-emerald-600 hover:bg-emerald-100" />
                            <QuickActionLink href="/trucks/add" icon={<Truck />} label="Add Truck" color="bg-blue-50 text-blue-600 hover:bg-blue-100" />
                            <QuickActionLink href="/exceptions" icon={<AlertOctagon />} label="Report Issue" color="bg-rose-50 text-rose-600 hover:bg-rose-100" />
                        </div>
                    </div>

                    {/* Recent Exceptions Table */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Recent Exceptions</h3>
                            <Link href="/exceptions" className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reason</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {exceptions.slice(0, 5).map(ex => (
                                        <tr key={ex.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{ex.type}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{ex.reason}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ex.resolved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {ex.resolved ? 'Resolved' : 'Pending'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {exceptions.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-gray-500">No exceptions reported.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Side Panel: Inventory & Production */}
                <div className="space-y-8">

                    {/* Silo Status */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Silo Levels</h3>
                        <div className="space-y-4">
                            {/* Use siloStats from getInventoryStats - accurate silo data from StorageLocation */}
                            {inventory.siloStats.length === 0 ? (
                                <p className="text-sm text-gray-500">No silos configured.</p>
                            ) : (
                                inventory.siloStats.map(silo => (
                                    <div key={silo.id}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="font-medium text-gray-700">{silo.name}</span>
                                            <span className="text-gray-500">
                                                {silo.currentLevel.toLocaleString()} {silo.unit}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${silo.status === 'Low' ? 'bg-red-500' :
                                                    silo.status === 'High' ? 'bg-amber-500' :
                                                        silo.status === 'Empty' ? 'bg-gray-300' :
                                                            'bg-blue-600'
                                                    }`}
                                                style={{ width: `${Math.min(100, silo.percentage)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <Link href="/inventory" className="block mt-4 text-center text-sm text-blue-600 hover:text-blue-700 font-medium">
                            Manage Inventory
                        </Link>
                    </div>

                    {/* Available Recipes */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Production Recipes</h3>
                        <div className="space-y-3">
                            {recipes.slice(0, 4).map(recipe => (
                                <div key={recipe.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <span className="text-sm font-medium text-gray-900">{recipe.name}</span>
                                    <Link href="/production" className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                                        <ArrowRight size={16} />
                                    </Link>
                                </div>
                            ))}
                            {recipes.length === 0 && (
                                <p className="text-sm text-gray-500">No recipes found.</p>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}

function DashboardCard({ title, value, subtext, icon, color, link, alert }: any) {
    return (
        <Link href={link} className="block group">
            <div className={`bg-white rounded-2xl p-6 border transition-all duration-200 hover:shadow-md ${alert ? 'border-red-200 ring-2 ring-red-50' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl ${color} transition-transform group-hover:scale-110 duration-200`}>
                        {icon}
                    </div>
                    {alert && <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>}
                </div>
                <div>
                    <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{value}</h3>
                    <div className="text-sm font-medium text-gray-900 mt-1">{title}</div>
                    <p className="text-sm text-gray-500 mt-0.5">{subtext}</p>
                </div>
            </div>
        </Link>
    );
}

function QuickActionLink({ href, icon, label, color }: any) {
    return (
        <Link
            href={href}
            className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200 ${color}`}
        >
            <div className="mb-2">{icon}</div>
            <span className="text-sm font-semibold text-center">{label}</span>
        </Link>
    );
}
