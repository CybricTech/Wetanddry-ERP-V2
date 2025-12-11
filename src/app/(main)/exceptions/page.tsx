import React from 'react';
import { getExceptions, logException, resolveException } from '@/lib/actions/exceptions';
import { getTrucks } from '@/lib/actions/trucks';
import { getRecipes } from '@/lib/actions/production';
import { AlertOctagon, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { auth } from '@/auth';
import { hasPermission } from '@/lib/permissions';

export default async function ExceptionsPage() {
    const [exceptions, trucks, recipes, session] = await Promise.all([
        getExceptions(),
        getTrucks(),
        getRecipes(),
        auth()
    ]);

    const canCreateException = session?.user?.role ? hasPermission(session.user.role, 'create_exception') : false;
    const canManageExceptions = session?.user?.role ? hasPermission(session.user.role, 'manage_exceptions') : false;

    const totalDumps = exceptions.filter(e => e.type === 'Dump').length;
    const totalDiverts = exceptions.filter(e => e.type === 'Divert').length;
    const unresolved = exceptions.filter(e => !e.resolved).length;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Exception Handling</h1>
                    <p className="text-gray-600 mt-1">Report and track production dumps and diverts</p>
                </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-full text-red-600">
                        <XCircle size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Total Dumps</div>
                        <div className="text-2xl font-bold text-gray-900">{totalDumps}</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-yellow-100 rounded-full text-yellow-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Total Diverts</div>
                        <div className="text-2xl font-bold text-gray-900">{totalDiverts}</div>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-full text-orange-600">
                        <AlertOctagon size={24} />
                    </div>
                    <div>
                        <div className="text-sm text-gray-600">Unresolved Issues</div>
                        <div className="text-2xl font-bold text-gray-900">{unresolved}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Report Form - Only shown to users with create_exception permission */}
                {canCreateException && (
                    <div className="lg:col-span-1">
                        <div className="bg-white border border-gray-200 rounded-lg p-6 sticky top-24">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <AlertOctagon className="text-red-600" />
                                Report Exception
                            </h2>

                            <form action={logException} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type
                                    </label>
                                    <select
                                        name="type"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Select Type...</option>
                                        <option value="Dump">Dump (Waste)</option>
                                        <option value="Divert">Divert (Re-routed)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Reason
                                    </label>
                                    <select
                                        name="reason"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">Select Reason...</option>
                                        <option value="Bad Mix">Bad Mix Quality</option>
                                        <option value="Truck Breakdown">Truck Breakdown</option>
                                        <option value="Client Rejection">Client Rejection</option>
                                        <option value="Traffic Delay">Traffic Delay (Expired)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Quantity (m³)
                                    </label>
                                    <input
                                        name="quantity"
                                        type="number"
                                        step="0.1"
                                        placeholder="e.g., 6.0"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Related Truck (Optional)
                                    </label>
                                    <select
                                        name="truckId"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">None</option>
                                        {trucks.map(truck => (
                                            <option key={truck.id} value={truck.id}>{truck.plateNumber}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Related Recipe (Optional)
                                    </label>
                                    <select
                                        name="recipeId"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">None</option>
                                        {recipes.map(recipe => (
                                            <option key={recipe.id} value={recipe.id}>{recipe.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Notes
                                    </label>
                                    <textarea
                                        name="notes"
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Additional details..."
                                    ></textarea>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                                >
                                    Submit Report
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* Exception List */}
                <div className={canCreateException ? "lg:col-span-2" : "lg:col-span-3"}>
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Exception History</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Reason</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Qty</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {exceptions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                No exceptions reported.
                                            </td>
                                        </tr>
                                    ) : (
                                        exceptions.map((ex) => (
                                            <tr key={ex.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 text-sm text-gray-900">{ex.createdAt.toLocaleDateString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={cn(
                                                        "inline-block px-2 py-1 text-xs font-semibold rounded-full",
                                                        ex.type === 'Dump' ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                                                    )}>
                                                        {ex.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-700">{ex.reason}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{ex.quantity} {ex.unit}</td>
                                                <td className="px-6 py-4">
                                                    {ex.resolved ? (
                                                        <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                                                            <CheckCircle size={14} /> Resolved
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                                                            <AlertTriangle size={14} /> Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {!ex.resolved && canManageExceptions && (
                                                        <form action={resolveException.bind(null, ex.id)}>
                                                            <button className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                                                                Mark Resolved
                                                            </button>
                                                        </form>
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
