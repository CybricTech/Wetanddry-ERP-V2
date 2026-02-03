'use client'

import React, { useState, useTransition } from 'react'
import {
    ShoppingCart, Plus, Search, Filter, Eye, Edit, Trash2,
    CheckCircle, Clock, AlertCircle, Package, DollarSign,
    Calendar, Building2, FileText, ChevronRight, X
} from 'lucide-react'
import { hasPermission } from '@/lib/permissions'
import {
    createSalesOrder,
    addOrderLineItem,
    removeOrderLineItem,
    submitOrder,
    cancelOrder,
    getOrder
} from '@/lib/actions/orders'
import { recordPayment, applyPrepaymentToOrder } from '@/lib/actions/payments'

// ==================== TYPE DEFINITIONS ====================

interface Order {
    id: string
    orderNumber: string
    clientId: string
    client: { id: string; name: string; code: string }
    projectId: string | null
    project: { id: string; name: string } | null
    orderDate: Date
    requiredDate: Date | null
    deliveryAddress: string | null
    status: string
    totalAmount: number
    amountPaid: number
    activationThreshold: number
    notes: string | null
    lineItems: OrderLineItem[]
    payments: Payment[]
    _count: { lineItems: number; payments: number; productionRuns: number }
}

interface OrderLineItem {
    id: string
    recipeId: string
    recipe: { id: string; name: string; productCode: string }
    cubicMeters: number
    unitPrice: number
    lineTotal: number
    productType: string
    deliveredQty: number
    status: string
}

interface Payment {
    id: string
    amount: number
    paymentDate: Date
    paymentMethod: string
    status: string
}

interface Stats {
    total: number
    draft: number
    pending: number
    active: number
    fulfilled: number
    totalValue: number
    totalPaid: number
}

// ==================== MAIN COMPONENT ====================

interface OrdersClientProps {
    initialOrders: Order[]
    initialStats: Stats
    clients: { id: string; code: string; name: string }[]
    recipes: { id: string; productCode: string; name: string }[]
    projects: { id: string; name: string }[]
    userRole: string
    userName: string
}

export default function OrdersClient({
    initialOrders,
    initialStats,
    clients,
    recipes,
    projects,
    userRole,
    userName
}: OrdersClientProps) {
    const [orders, setOrders] = useState<Order[]>(initialOrders)
    const [stats, setStats] = useState<Stats>(initialStats)
    const [filter, setFilter] = useState({ status: 'all', search: '' })
    const [isPending, startTransition] = useTransition()
    const [showNewOrderModal, setShowNewOrderModal] = useState(false)
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
    const [showOrderDetail, setShowOrderDetail] = useState(false)

    const canManageOrders = hasPermission(userRole, 'manage_orders')
    const canApproveOrders = hasPermission(userRole, 'approve_orders')

    const filteredOrders = orders.filter(order => {
        if (filter.status !== 'all' && order.status !== filter.status) return false
        if (filter.search) {
            const search = filter.search.toLowerCase()
            return (
                order.orderNumber.toLowerCase().includes(search) ||
                order.client.name.toLowerCase().includes(search) ||
                (order.notes?.toLowerCase().includes(search) || false)
            )
        }
        return true
    })

    const refreshOrders = async () => {
        const { getOrders } = await import('@/lib/actions/orders')
        const result = await getOrders()
        setOrders(result.orders)
        setStats(result.stats)
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'Draft': 'bg-gray-100 text-gray-700',
            'Pending': 'bg-yellow-100 text-yellow-700',
            'Active': 'bg-green-100 text-green-700',
            'Fulfilled': 'bg-blue-100 text-blue-700',
            'Closed': 'bg-purple-100 text-purple-700',
            'Cancelled': 'bg-red-100 text-red-700'
        }
        return styles[status] || 'bg-gray-100 text-gray-700'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <ShoppingCart className="w-7 h-7 text-indigo-600" />
                        Sales Orders
                    </h1>
                    <p className="text-gray-500 mt-1">Manage customer orders and track fulfillment</p>
                </div>
                {canManageOrders && (
                    <button
                        onClick={() => setShowNewOrderModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        New Order
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <StatCard label="Total Orders" value={stats.total} icon={<FileText className="w-5 h-5" />} color="bg-gray-100 text-gray-600" />
                <StatCard label="Draft" value={stats.draft} icon={<Edit className="w-5 h-5" />} color="bg-gray-100 text-gray-600" />
                <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-5 h-5" />} color="bg-yellow-100 text-yellow-600" />
                <StatCard label="Active" value={stats.active} icon={<CheckCircle className="w-5 h-5" />} color="bg-green-100 text-green-600" />
                <StatCard label="Value" value={`₦${(stats.totalValue / 1000000).toFixed(1)}M`} icon={<DollarSign className="w-5 h-5" />} color="bg-indigo-100 text-indigo-600" />
                <StatCard label="Paid" value={`₦${(stats.totalPaid / 1000000).toFixed(1)}M`} icon={<DollarSign className="w-5 h-5" />} color="bg-emerald-100 text-emerald-600" />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={filter.search}
                        onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <select
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                    <option value="all">All Status</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Fulfilled">Fulfilled</option>
                    <option value="Closed">Closed</option>
                    <option value="Cancelled">Cancelled</option>
                </select>
            </div>

            {/* Orders Table */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredOrders.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                                        {filter.search || filter.status !== 'all' ? 'No orders match your filters' : 'No orders yet'}
                                    </td>
                                </tr>
                            ) : (
                                filteredOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-indigo-600">{order.orderNumber}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div>
                                                <div className="font-medium text-gray-900">{order.client.name}</div>
                                                <div className="text-sm text-gray-500">{order.client.code}</div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">
                                            {new Date(order.orderDate).toLocaleDateString()}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 text-sm">
                                                <Package className="w-4 h-4 text-gray-400" />
                                                {order._count.lineItems}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-medium">₦{order.totalAmount.toLocaleString()}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-sm">
                                                <div>₦{order.amountPaid.toLocaleString()}</div>
                                                <div className="text-gray-500">
                                                    {order.totalAmount > 0 ? Math.round((order.amountPaid / order.totalAmount) * 100) : 0}%
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status)}`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                onClick={() => {
                                                    setSelectedOrder(order)
                                                    setShowOrderDetail(true)
                                                }}
                                                className="text-indigo-600 hover:text-indigo-800"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* New Order Modal */}
            {showNewOrderModal && (
                <NewOrderModal
                    clients={clients}
                    projects={projects}
                    onClose={() => setShowNewOrderModal(false)}
                    onSuccess={() => {
                        setShowNewOrderModal(false)
                        startTransition(refreshOrders)
                    }}
                />
            )}

            {/* Order Detail Modal */}
            {showOrderDetail && selectedOrder && (
                <OrderDetailModal
                    order={selectedOrder}
                    recipes={recipes}
                    clients={clients}
                    canManage={canManageOrders}
                    canApprove={canApproveOrders}
                    onClose={() => {
                        setShowOrderDetail(false)
                        setSelectedOrder(null)
                    }}
                    onRefresh={() => startTransition(refreshOrders)}
                />
            )}
        </div>
    )
}

// ==================== STAT CARD ====================

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
    return (
        <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
                <div>
                    <div className="text-2xl font-bold text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500">{label}</div>
                </div>
            </div>
        </div>
    )
}

// ==================== NEW ORDER MODAL ====================

function NewOrderModal({
    clients,
    projects,
    onClose,
    onSuccess
}: {
    clients: { id: string; code: string; name: string }[]
    projects: { id: string; name: string }[]
    onClose: () => void
    onSuccess: () => void
}) {
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState('')

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)

        startTransition(async () => {
            try {
                const result = await createSalesOrder(formData)
                if (result.success) {
                    onSuccess()
                } else {
                    setError('Failed to create order')
                }
            } catch (err: any) {
                setError(err.message || 'An error occurred')
            }
        })
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold">New Sales Order</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
                        <select name="clientId" required className="w-full border rounded-lg px-3 py-2">
                            <option value="">Select Client</option>
                            {clients.map(c => (
                                <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Project (Optional)</label>
                        <select name="projectId" className="w-full border rounded-lg px-3 py-2">
                            <option value="">No Project</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Required Date</label>
                        <input type="date" name="requiredDate" className="w-full border rounded-lg px-3 py-2" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                        <textarea name="deliveryAddress" rows={2} className="w-full border rounded-lg px-3 py-2" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Activation Threshold (%)</label>
                        <input type="number" name="activationThreshold" defaultValue="30" min="0" max="100" step="5" className="w-full border rounded-lg px-3 py-2" />
                        <p className="text-xs text-gray-500 mt-1">Order activates when this % is paid</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea name="notes" rows={2} className="w-full border rounded-lg px-3 py-2" />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Cancel
                        </button>
                        <button type="submit" disabled={isPending} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                            {isPending ? 'Creating...' : 'Create Order'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// ==================== ORDER DETAIL MODAL ====================

function OrderDetailModal({
    order,
    recipes,
    clients,
    canManage,
    canApprove,
    onClose,
    onRefresh
}: {
    order: Order
    recipes: { id: string; productCode: string; name: string }[]
    clients: { id: string; code: string; name: string }[]
    canManage: boolean
    canApprove: boolean
    onClose: () => void
    onRefresh: () => void
}) {
    const [activeTab, setActiveTab] = useState<'details' | 'items' | 'payments'>('details')
    const [isPending, startTransition] = useTransition()
    const [showAddItem, setShowAddItem] = useState(false)
    const [showAddPayment, setShowAddPayment] = useState(false)
    const [orderData, setOrderData] = useState(order)

    const loadOrderDetails = async () => {
        try {
            const fullOrder = await getOrder(order.id)
            setOrderData(fullOrder as any)
        } catch (e) { }
    }

    React.useEffect(() => {
        loadOrderDetails()
    }, [])

    const handleSubmitOrder = () => {
        startTransition(async () => {
            try {
                await submitOrder(order.id)
                loadOrderDetails()
                onRefresh()
            } catch (e) { }
        })
    }

    const handleCancelOrder = () => {
        if (!confirm('Are you sure you want to cancel this order?')) return
        startTransition(async () => {
            try {
                await cancelOrder(order.id, 'Cancelled by user')
                loadOrderDetails()
                onRefresh()
            } catch (e) { }
        })
    }

    const handleAddLineItem = (formData: FormData) => {
        formData.append('orderId', order.id)
        startTransition(async () => {
            try {
                await addOrderLineItem(formData)
                setShowAddItem(false)
                loadOrderDetails()
                onRefresh()
            } catch (e) { }
        })
    }

    const handleRemoveLineItem = (id: string) => {
        startTransition(async () => {
            try {
                await removeOrderLineItem(id)
                loadOrderDetails()
                onRefresh()
            } catch (e) { }
        })
    }

    const handleRecordPayment = (formData: FormData) => {
        formData.append('orderId', order.id)
        startTransition(async () => {
            try {
                await recordPayment(formData)
                setShowAddPayment(false)
                loadOrderDetails()
                onRefresh()
            } catch (e) { }
        })
    }

    const paidPercent = orderData.totalAmount > 0 ? (orderData.amountPaid / orderData.totalAmount) * 100 : 0

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-lg font-semibold">{orderData.orderNumber}</h2>
                        <p className="text-sm text-gray-500">{orderData.client.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 text-sm font-medium rounded-full ${orderData.status === 'Active' ? 'bg-green-100 text-green-700' :
                                orderData.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                    orderData.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                                        'bg-blue-100 text-blue-700'
                            }`}>
                            {orderData.status}
                        </span>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    {['details', 'items', 'payments'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'details' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <InfoRow label="Order Date" value={new Date(orderData.orderDate).toLocaleDateString()} />
                                <InfoRow label="Required Date" value={orderData.requiredDate ? new Date(orderData.requiredDate).toLocaleDateString() : '-'} />
                                <InfoRow label="Project" value={orderData.project?.name || '-'} />
                                <InfoRow label="Delivery Address" value={orderData.deliveryAddress || '-'} />
                            </div>

                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-gray-600">Payment Progress</span>
                                    <span className="font-medium">{paidPercent.toFixed(0)}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.min(paidPercent, 100)}%` }} />
                                </div>
                                <div className="flex justify-between text-sm mt-2">
                                    <span>₦{orderData.amountPaid.toLocaleString()} paid</span>
                                    <span>₦{orderData.totalAmount.toLocaleString()} total</span>
                                </div>
                            </div>

                            {orderData.notes && (
                                <div>
                                    <label className="text-sm text-gray-500">Notes</label>
                                    <p className="text-gray-900">{orderData.notes}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'items' && (
                        <div className="space-y-4">
                            {canManage && orderData.status === 'Draft' && (
                                <button
                                    onClick={() => setShowAddItem(true)}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                >
                                    <Plus className="w-4 h-4" /> Add Item
                                </button>
                            )}

                            {orderData.lineItems?.length > 0 ? (
                                <table className="w-full">
                                    <thead className="text-left text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="pb-2">Product</th>
                                            <th className="pb-2">Qty (m³)</th>
                                            <th className="pb-2">Unit Price</th>
                                            <th className="pb-2">Total</th>
                                            <th className="pb-2">Delivered</th>
                                            {canManage && orderData.status === 'Draft' && <th className="pb-2"></th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {orderData.lineItems.map(item => (
                                            <tr key={item.id}>
                                                <td className="py-2">{item.productType}</td>
                                                <td className="py-2">{item.cubicMeters}</td>
                                                <td className="py-2">₦{item.unitPrice.toLocaleString()}</td>
                                                <td className="py-2">₦{item.lineTotal.toLocaleString()}</td>
                                                <td className="py-2">{item.deliveredQty} m³</td>
                                                {canManage && orderData.status === 'Draft' && (
                                                    <td className="py-2">
                                                        <button onClick={() => handleRemoveLineItem(item.id)} className="text-red-600 hover:text-red-800">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No line items yet</p>
                            )}

                            {showAddItem && (
                                <AddLineItemForm
                                    recipes={recipes}
                                    onSubmit={handleAddLineItem}
                                    onCancel={() => setShowAddItem(false)}
                                    isPending={isPending}
                                />
                            )}
                        </div>
                    )}

                    {activeTab === 'payments' && (
                        <div className="space-y-4">
                            {canManage && !['Closed', 'Cancelled'].includes(orderData.status) && (
                                <button
                                    onClick={() => setShowAddPayment(true)}
                                    className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                    <Plus className="w-4 h-4" /> Record Payment
                                </button>
                            )}

                            {orderData.payments?.length > 0 ? (
                                <table className="w-full">
                                    <thead className="text-left text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="pb-2">Date</th>
                                            <th className="pb-2">Amount</th>
                                            <th className="pb-2">Method</th>
                                            <th className="pb-2">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {orderData.payments.map(payment => (
                                            <tr key={payment.id}>
                                                <td className="py-2">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                                                <td className="py-2 font-medium">₦{payment.amount.toLocaleString()}</td>
                                                <td className="py-2">{payment.paymentMethod}</td>
                                                <td className="py-2">
                                                    <span className={`px-2 py-1 text-xs rounded-full ${payment.status === 'Verified' ? 'bg-green-100 text-green-700' :
                                                            payment.status === 'Bounced' ? 'bg-red-100 text-red-700' :
                                                                'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {payment.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No payments recorded</p>
                            )}

                            {showAddPayment && (
                                <AddPaymentForm
                                    onSubmit={handleRecordPayment}
                                    onCancel={() => setShowAddPayment(false)}
                                    isPending={isPending}
                                    outstandingAmount={orderData.totalAmount - orderData.amountPaid}
                                />
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center p-4 border-t bg-gray-50">
                    <div>
                        {canManage && orderData.status === 'Draft' && orderData.lineItems?.length > 0 && (
                            <button
                                onClick={handleSubmitOrder}
                                disabled={isPending}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                            >
                                Submit Order
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {canApprove && ['Draft', 'Pending'].includes(orderData.status) && (
                            <button
                                onClick={handleCancelOrder}
                                disabled={isPending}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                                Cancel Order
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper Components

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <label className="text-xs text-gray-500">{label}</label>
            <p className="text-gray-900">{value}</p>
        </div>
    )
}

function AddLineItemForm({
    recipes,
    onSubmit,
    onCancel,
    isPending
}: {
    recipes: { id: string; productCode: string; name: string }[]
    onSubmit: (formData: FormData) => void
    onCancel: () => void
    isPending: boolean
}) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        onSubmit(new FormData(e.currentTarget))
    }

    return (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-sm text-gray-600">Product</label>
                    <select name="recipeId" required className="w-full border rounded px-2 py-1">
                        <option value="">Select</option>
                        {recipes.map(r => (
                            <option key={r.id} value={r.id}>{r.productCode} - {r.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm text-gray-600">Quantity (m³)</label>
                    <input type="number" name="cubicMeters" step="0.5" min="0.5" required className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                    <label className="text-sm text-gray-600">Unit Price (₦)</label>
                    <input type="number" name="unitPrice" step="100" min="0" required className="w-full border rounded px-2 py-1" />
                </div>
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={isPending} className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50">
                    Add
                </button>
                <button type="button" onClick={onCancel} className="px-3 py-1 text-gray-600 text-sm hover:bg-gray-200 rounded">
                    Cancel
                </button>
            </div>
        </form>
    )
}

function AddPaymentForm({
    onSubmit,
    onCancel,
    isPending,
    outstandingAmount
}: {
    onSubmit: (formData: FormData) => void
    onCancel: () => void
    isPending: boolean
    outstandingAmount: number
}) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        onSubmit(new FormData(e.currentTarget))
    }

    return (
        <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg p-4 space-y-3">
            <p className="text-sm text-gray-600">Outstanding: ₦{outstandingAmount.toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-sm text-gray-600">Amount (₦)</label>
                    <input type="number" name="amount" step="100" min="0" required className="w-full border rounded px-2 py-1" />
                </div>
                <div>
                    <label className="text-sm text-gray-600">Method</label>
                    <select name="paymentMethod" required className="w-full border rounded px-2 py-1">
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                    </select>
                </div>
            </div>
            <div>
                <label className="text-sm text-gray-600">Reference</label>
                <input type="text" name="referenceNumber" className="w-full border rounded px-2 py-1" />
            </div>
            <div className="flex gap-2">
                <button type="submit" disabled={isPending} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50">
                    Record
                </button>
                <button type="button" onClick={onCancel} className="px-3 py-1 text-gray-600 text-sm hover:bg-gray-200 rounded">
                    Cancel
                </button>
            </div>
        </form>
    )
}
