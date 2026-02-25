import { getSpareParts, getLowStockParts } from '@/lib/actions/trucks'
import Link from 'next/link'
import { Package, Plus, AlertTriangle, Search, Filter, ArrowLeft } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import AddSparePartButton from '@/components/trucks/AddSparePartButton'

export default async function SparePartsPage() {
    const spareParts = await getSpareParts()
    const lowStockParts = await getLowStockParts()

    return (
        <div className="space-y-8">
            {/* Back Link */}
            <Link
                href="/trucks"
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition-colors"
            >
                <ArrowLeft size={20} />
                <span className="font-medium">Back to Fleet</span>
            </Link>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Spare Parts Inventory</h1>
                    <p className="text-gray-600 mt-1">Track and manage spare parts for fleet maintenance</p>
                </div>
                <AddSparePartButton />
            </div>

            {/* Low Stock Alert */}
            {lowStockParts.length > 0 && (
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <AlertTriangle className="text-orange-600" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-orange-900">Low Stock Alert</h3>
                            <p className="text-sm text-orange-700">{lowStockParts.length} part{lowStockParts.length > 1 ? 's' : ''} need restocking</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {lowStockParts.map(part => (
                            <span key={part.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/60 rounded-lg text-sm text-orange-800">
                                <span className="font-medium">{part.name}</span>
                                <span className="text-orange-600">({part.quantity}/{part.minQuantity})</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-blue-600" />
                        </div>
                        <span className="text-gray-600 text-sm">Total Parts</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{spareParts.length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-green-600" />
                        </div>
                        <span className="text-gray-600 text-sm">In Stock</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {spareParts.filter(p => p.quantity > p.minQuantity).length}
                    </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                            <AlertTriangle size={20} className="text-orange-600" />
                        </div>
                        <span className="text-gray-600 text-sm">Low Stock</span>
                    </div>
                    <div className="text-2xl font-bold text-orange-600">{lowStockParts.length}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                            <Package size={20} className="text-purple-600" />
                        </div>
                        <span className="text-gray-600 text-sm">Total Value</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(spareParts.reduce((sum, p) => sum + (p.purchasePrice * p.quantity), 0))}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by part name or number..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl outline-none transition-all"
                    />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button className="px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium flex items-center gap-2 border border-transparent hover:border-gray-200 transition-all">
                        <Filter size={18} />
                        Category
                    </button>
                </div>
            </div>

            {/* Parts Table */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Part</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Part Number</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Category</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Quantity</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Location</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {spareParts.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-16 text-center">
                                        <Package className="mx-auto text-gray-300 mb-4" size={48} />
                                        <p className="text-gray-500 text-lg mb-2">No spare parts in inventory</p>
                                        <p className="text-gray-400 text-sm">Add your first spare part to get started</p>
                                    </td>
                                </tr>
                            ) : (
                                spareParts.map((part) => {
                                    const isLowStock = part.quantity <= part.minQuantity
                                    const isOutOfStock = part.quantity === 0

                                    return (
                                        <tr key={part.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center",
                                                        isOutOfStock ? "bg-red-100" : isLowStock ? "bg-orange-100" : "bg-blue-100"
                                                    )}>
                                                        <Package size={18} className={cn(
                                                            isOutOfStock ? "text-red-600" : isLowStock ? "text-orange-600" : "text-blue-600"
                                                        )} />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{part.name}</div>
                                                        {part.description && (
                                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{part.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono text-gray-600">{part.partNumber}</td>
                                            <td className="px-6 py-4">
                                                <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
                                                    {part.category}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "font-medium",
                                                        isOutOfStock ? "text-red-600" : isLowStock ? "text-orange-600" : "text-gray-900"
                                                    )}>
                                                        {part.quantity}
                                                    </span>
                                                    <span className="text-gray-400 text-sm">/ min {part.minQuantity}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                                {formatCurrency(part.purchasePrice)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{part.supplier || '-'}</td>
                                            <td className="px-6 py-4 text-sm text-gray-600">{part.location || '-'}</td>
                                            <td className="px-6 py-4">
                                                <span className={cn(
                                                    "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full",
                                                    isOutOfStock
                                                        ? "bg-red-100 text-red-700"
                                                        : isLowStock
                                                            ? "bg-orange-100 text-orange-700"
                                                            : "bg-green-100 text-green-700"
                                                )}>
                                                    {isOutOfStock ? 'Out of Stock' : isLowStock ? 'Low Stock' : 'In Stock'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
