'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'

// ==================== ORDER NUMBER GENERATION ====================

// Generate a unique order number (ORD-YYYYMM-001, ORD-YYYYMM-002, etc.)
async function generateOrderNumber(): Promise<string> {
    const now = new Date()
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const prefix = `ORD-${yearMonth}-`

    const lastOrder = await prisma.salesOrder.findFirst({
        where: {
            orderNumber: { startsWith: prefix }
        },
        orderBy: { orderNumber: 'desc' }
    })

    let nextNumber = 1
    if (lastOrder) {
        const lastNum = parseInt(lastOrder.orderNumber.split('-').pop() || '0')
        nextNumber = lastNum + 1
    }

    return `${prefix}${String(nextNumber).padStart(3, '0')}`
}

// ==================== SALES ORDER CRUD ====================

export interface OrderFilters {
    status?: string
    clientId?: string
    projectId?: string
    search?: string
    dateFrom?: Date
    dateTo?: Date
}

// Get all orders with filters
export async function getOrders(filters: OrderFilters = {}) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const { status, clientId, projectId, search, dateFrom, dateTo } = filters

    const where: any = {}

    if (status && status !== 'all') {
        where.status = status
    }
    if (clientId) {
        where.clientId = clientId
    }
    if (projectId) {
        where.projectId = projectId
    }
    if (dateFrom || dateTo) {
        where.orderDate = {}
        if (dateFrom) where.orderDate.gte = dateFrom
        if (dateTo) where.orderDate.lte = dateTo
    }
    if (search) {
        where.OR = [
            { orderNumber: { contains: search, mode: 'insensitive' } },
            { client: { name: { contains: search, mode: 'insensitive' } } },
            { notes: { contains: search, mode: 'insensitive' } }
        ]
    }

    const orders = await prisma.salesOrder.findMany({
        where,
        include: {
            client: { select: { id: true, name: true, code: true } },
            project: { select: { id: true, name: true } },
            lineItems: {
                include: { recipe: { select: { id: true, name: true, productCode: true } } }
            },
            payments: true,
            _count: { select: { lineItems: true, payments: true, productionRuns: true } }
        },
        orderBy: { orderDate: 'desc' }
    })

    // Calculate summary stats
    const stats = {
        total: orders.length,
        draft: orders.filter(o => o.status === 'Draft').length,
        pending: orders.filter(o => o.status === 'Pending').length,
        active: orders.filter(o => o.status === 'Active').length,
        fulfilled: orders.filter(o => o.status === 'Fulfilled').length,
        totalValue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
        totalPaid: orders.reduce((sum, o) => sum + o.amountPaid, 0)
    }

    return { orders, stats }
}

// Get single order with full details
export async function getOrder(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const order = await prisma.salesOrder.findUnique({
        where: { id },
        include: {
            client: true,
            project: true,
            lineItems: {
                include: { recipe: true },
                orderBy: { createdAt: 'asc' }
            },
            payments: {
                orderBy: { paymentDate: 'desc' }
            },
            paymentSchedule: {
                orderBy: { dueDate: 'asc' }
            },
            productionRuns: {
                include: { recipe: true },
                orderBy: { createdAt: 'desc' }
            }
        }
    })

    if (!order) throw new Error('Order not found')

    return order
}

// Create a new sales order
export async function createSalesOrder(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const clientId = formData.get('clientId') as string
    const projectId = formData.get('projectId') as string | null
    const requiredDate = formData.get('requiredDate') as string | null
    const deliveryAddress = formData.get('deliveryAddress') as string | null
    const notes = formData.get('notes') as string | null
    const activationThreshold = parseFloat(formData.get('activationThreshold') as string) || 0.3

    if (!clientId) throw new Error('Client is required')

    const orderNumber = await generateOrderNumber()

    const order = await prisma.salesOrder.create({
        data: {
            orderNumber,
            clientId,
            projectId: projectId || null,
            requiredDate: requiredDate ? new Date(requiredDate) : null,
            deliveryAddress: deliveryAddress || null,
            notes: notes || null,
            activationThreshold,
            status: 'Draft',
            createdBy: session.user.name || 'Unknown'
        },
        include: {
            client: { select: { id: true, name: true, code: true } },
            project: { select: { id: true, name: true } }
        }
    })

    revalidatePath('/orders')
    return { success: true, order }
}

// Update order details
export async function updateSalesOrder(id: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const order = await prisma.salesOrder.findUnique({ where: { id } })
    if (!order) throw new Error('Order not found')

    // Only allow editing Draft orders
    if (order.status !== 'Draft') {
        throw new Error('Only draft orders can be edited')
    }

    const requiredDate = formData.get('requiredDate') as string | null
    const deliveryAddress = formData.get('deliveryAddress') as string | null
    const notes = formData.get('notes') as string | null
    const activationThreshold = parseFloat(formData.get('activationThreshold') as string) || order.activationThreshold

    const updated = await prisma.salesOrder.update({
        where: { id },
        data: {
            requiredDate: requiredDate ? new Date(requiredDate) : null,
            deliveryAddress: deliveryAddress || null,
            notes: notes || null,
            activationThreshold
        }
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${id}`)
    return { success: true, order: updated }
}

// ==================== ORDER LINE ITEMS ====================

// Add line item to order
export async function addOrderLineItem(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const orderId = formData.get('orderId') as string
    const recipeId = formData.get('recipeId') as string
    const cubicMeters = parseFloat(formData.get('cubicMeters') as string)
    const unitPrice = parseFloat(formData.get('unitPrice') as string)

    if (!orderId || !recipeId) throw new Error('Order and Recipe are required')
    if (isNaN(cubicMeters) || cubicMeters <= 0) throw new Error('Valid cubic meters required')
    if (isNaN(unitPrice) || unitPrice <= 0) throw new Error('Valid unit price required')

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')
    if (order.status !== 'Draft') throw new Error('Can only add items to draft orders')

    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })
    if (!recipe) throw new Error('Recipe not found')

    const lineTotal = cubicMeters * unitPrice

    await prisma.$transaction(async (tx) => {
        // Create line item
        await tx.orderLineItem.create({
            data: {
                orderId,
                recipeId,
                cubicMeters,
                unitPrice,
                lineTotal,
                productType: `${recipe.productCode} - ${recipe.name}`
            }
        })

        // Recalculate order total
        const lineItems = await tx.orderLineItem.findMany({ where: { orderId } })
        const totalAmount = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)

        await tx.salesOrder.update({
            where: { id: orderId },
            data: { totalAmount }
        })
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    return { success: true }
}

// Remove line item from order
export async function removeOrderLineItem(lineItemId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const lineItem = await prisma.orderLineItem.findUnique({
        where: { id: lineItemId },
        include: { order: true }
    })
    if (!lineItem) throw new Error('Line item not found')
    if (lineItem.order.status !== 'Draft') throw new Error('Can only remove items from draft orders')

    await prisma.$transaction(async (tx) => {
        await tx.orderLineItem.delete({ where: { id: lineItemId } })

        // Recalculate order total
        const lineItems = await tx.orderLineItem.findMany({ where: { orderId: lineItem.orderId } })
        const totalAmount = lineItems.reduce((sum, item) => sum + item.lineTotal, 0)

        await tx.salesOrder.update({
            where: { id: lineItem.orderId },
            data: { totalAmount }
        })
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${lineItem.orderId}`)
    return { success: true }
}

// ==================== ORDER STATUS WORKFLOW ====================

// Submit order (Draft -> Pending)
export async function submitOrder(orderId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: { lineItems: true }
    })
    if (!order) throw new Error('Order not found')
    if (order.status !== 'Draft') throw new Error('Order must be in Draft status to submit')
    if (order.lineItems.length === 0) throw new Error('Order must have at least one line item')

    const updated = await prisma.salesOrder.update({
        where: { id: orderId },
        data: { status: 'Pending' }
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    return { success: true, order: updated }
}

// Check and activate order if payment threshold met
export async function checkAndActivateOrder(orderId: string) {
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) return { activated: false }
    if (order.status !== 'Pending') return { activated: false }

    const paidPercentage = order.totalAmount > 0 ? order.amountPaid / order.totalAmount : 0

    if (paidPercentage >= order.activationThreshold) {
        await prisma.salesOrder.update({
            where: { id: orderId },
            data: {
                status: 'Active',
                approvedAt: new Date()
            }
        })

        revalidatePath('/orders')
        revalidatePath(`/orders/${orderId}`)
        return { activated: true, paidPercentage }
    }

    return { activated: false, paidPercentage, requiredPercentage: order.activationThreshold }
}

// Mark order as fulfilled
export async function fulfillOrder(orderId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: { lineItems: true }
    })
    if (!order) throw new Error('Order not found')
    if (order.status !== 'Active') throw new Error('Order must be Active to fulfill')

    // Check all line items are at least partially delivered
    const allDelivered = order.lineItems.every(item => item.deliveredQty >= item.cubicMeters)
    if (!allDelivered) {
        // Mark as partially fulfilled - update line item statuses
        await prisma.orderLineItem.updateMany({
            where: { orderId, deliveredQty: { gt: 0 } },
            data: { status: 'Partial' }
        })
    }

    const updated = await prisma.salesOrder.update({
        where: { id: orderId },
        data: { status: 'Fulfilled' }
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    return { success: true, order: updated }
}

// Close order
export async function closeOrder(orderId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_expenses') // Manager+ only

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')
    if (order.status !== 'Fulfilled') throw new Error('Order must be Fulfilled to close')

    const updated = await prisma.salesOrder.update({
        where: { id: orderId },
        data: { status: 'Closed' }
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    return { success: true, order: updated }
}

// Cancel order
export async function cancelOrder(orderId: string, reason?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_expenses') // Manager+ only

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')
    if (['Fulfilled', 'Closed'].includes(order.status)) {
        throw new Error('Cannot cancel fulfilled or closed orders')
    }

    const updated = await prisma.salesOrder.update({
        where: { id: orderId },
        data: {
            status: 'Cancelled',
            notes: reason ? `${order.notes || ''}\n\nCancellation reason: ${reason}`.trim() : order.notes
        }
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    return { success: true, order: updated }
}

// Update delivered quantity for a line item (from production)
export async function updateLineItemDelivery(lineItemId: string, deliveredQty: number) {
    const lineItem = await prisma.orderLineItem.findUnique({ where: { id: lineItemId } })
    if (!lineItem) throw new Error('Line item not found')

    let status = 'Pending'
    if (deliveredQty >= lineItem.cubicMeters) {
        status = 'Fulfilled'
    } else if (deliveredQty > 0) {
        status = 'Partial'
    }

    await prisma.orderLineItem.update({
        where: { id: lineItemId },
        data: { deliveredQty, status }
    })

    revalidatePath(`/orders/${lineItem.orderId}`)
    return { success: true }
}

// ==================== ORDER HELPERS ====================

// Get orders for dropdown selection (simplified)
export async function getOrdersForSelect(clientId?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const where: any = { status: { in: ['Active', 'Pending'] } }
    if (clientId) where.clientId = clientId

    return prisma.salesOrder.findMany({
        where,
        select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            client: { select: { name: true } }
        },
        orderBy: { orderNumber: 'desc' }
    })
}

// Get order analytics
export async function getOrderAnalytics(period: '7days' | '30days' | '90days' = '30days') {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const days = period === '7days' ? 7 : period === '30days' ? 30 : 90
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const orders = await prisma.salesOrder.findMany({
        where: { orderDate: { gte: startDate } },
        include: {
            lineItems: true,
            payments: true
        }
    })

    const totalOrders = orders.length
    const totalValue = orders.reduce((sum, o) => sum + o.totalAmount, 0)
    const totalPaid = orders.reduce((sum, o) => sum + o.amountPaid, 0)
    const totalCubicMeters = orders.reduce((sum, o) =>
        sum + o.lineItems.reduce((s, li) => s + li.cubicMeters, 0), 0)

    const byStatus = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    return {
        period,
        totalOrders,
        totalValue,
        totalPaid,
        outstandingAmount: totalValue - totalPaid,
        totalCubicMeters,
        byStatus,
        averageOrderValue: totalOrders > 0 ? totalValue / totalOrders : 0
    }
}
