'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'
import { checkAndActivateOrder } from './orders'
import { formatCurrency } from '@/lib/utils'

// ==================== PAYMENT RECORDING ====================

// Record a payment against an order
export async function recordPayment(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const orderId = formData.get('orderId') as string
    const amount = parseFloat(formData.get('amount') as string)
    const paymentMethod = formData.get('paymentMethod') as string
    const referenceNumber = formData.get('referenceNumber') as string | null
    const notes = formData.get('notes') as string | null
    const paymentDate = formData.get('paymentDate') as string | null

    if (!orderId) throw new Error('Order is required')
    if (isNaN(amount) || amount <= 0) throw new Error('Valid payment amount required')
    if (!paymentMethod) throw new Error('Payment method is required')

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')
    if (['Closed', 'Cancelled'].includes(order.status)) {
        throw new Error('Cannot record payments on closed or cancelled orders')
    }

    const payment = await prisma.$transaction(async (tx) => {
        // Create payment record
        const newPayment = await tx.payment.create({
            data: {
                orderId,
                amount,
                paymentMethod,
                referenceNumber: referenceNumber || null,
                notes: notes || null,
                paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
                receivedBy: session.user.name || 'Unknown',
                status: 'Received'
            }
        })

        // Update order's amountPaid
        const payments = await tx.payment.findMany({
            where: { orderId, status: { not: 'Bounced' } }
        })
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

        await tx.salesOrder.update({
            where: { id: orderId },
            data: { amountPaid: totalPaid }
        })

        return newPayment
    })

    // Check if order should be activated
    await checkAndActivateOrder(orderId)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/finance')
    return { success: true, payment }
}

// Mark payment as bounced
export async function markPaymentBounced(paymentId: string, reason?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_expenses') // Manager+ only

    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: { order: true }
    })
    if (!payment) throw new Error('Payment not found')

    await prisma.$transaction(async (tx) => {
        await tx.payment.update({
            where: { id: paymentId },
            data: {
                status: 'Bounced',
                notes: reason ? `${payment.notes || ''}\n\nBounced: ${reason}`.trim() : payment.notes
            }
        })

        // Recalculate order's amountPaid excluding bounced
        const payments = await tx.payment.findMany({
            where: { orderId: payment.orderId, status: { not: 'Bounced' } }
        })
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

        await tx.salesOrder.update({
            where: { id: payment.orderId },
            data: { amountPaid: totalPaid }
        })
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${payment.orderId}`)
    return { success: true }
}

// Verify payment
export async function verifyPayment(paymentId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_expenses')

    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) throw new Error('Payment not found')

    await prisma.payment.update({
        where: { id: paymentId },
        data: { status: 'Verified' }
    })

    revalidatePath(`/orders/${payment.orderId}`)
    return { success: true }
}

// ==================== PREPAYMENT / WALLET ====================

// Record a prepayment/deposit from a client
export async function recordPrepayment(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const clientId = formData.get('clientId') as string
    const projectId = formData.get('projectId') as string | null
    const amount = parseFloat(formData.get('amount') as string)
    const paymentMethod = formData.get('paymentMethod') as string
    const referenceNumber = formData.get('referenceNumber') as string | null
    const notes = formData.get('notes') as string | null
    const receivedDate = formData.get('receivedDate') as string | null

    if (!clientId) throw new Error('Client is required')
    if (isNaN(amount) || amount <= 0) throw new Error('Valid amount required')
    if (!paymentMethod) throw new Error('Payment method is required')

    const prepayment = await prisma.$transaction(async (tx) => {
        const newPrepayment = await tx.prepayment.create({
            data: {
                clientId,
                projectId: projectId || null,
                amount,
                paymentMethod,
                referenceNumber: referenceNumber || null,
                notes: notes || null,
                receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
                receivedBy: session.user.name || 'Unknown',
                status: 'Received'
            }
        })

        // Update client wallet balance
        await tx.client.update({
            where: { id: clientId },
            data: { walletBalance: { increment: amount } }
        })

        return newPrepayment
    })

    revalidatePath('/crm')
    revalidatePath(`/crm/${clientId}`)
    return { success: true, prepayment }
}

// Apply prepayment to an order
export async function applyPrepaymentToOrder(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const orderId = formData.get('orderId') as string
    const amount = parseFloat(formData.get('amount') as string)

    if (!orderId) throw new Error('Order is required')
    if (isNaN(amount) || amount <= 0) throw new Error('Valid amount required')

    const order = await prisma.salesOrder.findUnique({
        where: { id: orderId },
        include: { client: true }
    })
    if (!order) throw new Error('Order not found')

    // Check client has enough wallet balance
    if (order.client.walletBalance < amount) {
        throw new Error(`Insufficient wallet balance. Available: ${formatCurrency(order.client.walletBalance)}`)
    }

    await prisma.$transaction(async (tx) => {
        // Create payment record from prepayment
        await tx.payment.create({
            data: {
                orderId,
                amount,
                paymentMethod: 'Prepayment Drawdown',
                receivedBy: session.user.name || 'Unknown',
                status: 'Verified',
                notes: 'Applied from client wallet balance'
            }
        })

        // Deduct from client wallet
        await tx.client.update({
            where: { id: order.clientId },
            data: { walletBalance: { decrement: amount } }
        })

        // Update order's amountPaid
        const payments = await tx.payment.findMany({
            where: { orderId, status: { not: 'Bounced' } }
        })
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)

        await tx.salesOrder.update({
            where: { id: orderId },
            data: { amountPaid: totalPaid }
        })
    })

    // Check if order should be activated
    await checkAndActivateOrder(orderId)

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/crm')
    return { success: true }
}

// Get client's prepayment history
export async function getClientPrepayments(clientId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const prepayments = await prisma.prepayment.findMany({
        where: { clientId },
        include: { project: { select: { id: true, name: true } } },
        orderBy: { receivedDate: 'desc' }
    })

    const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { walletBalance: true }
    })

    return {
        prepayments,
        walletBalance: client?.walletBalance || 0,
        totalReceived: prepayments.reduce((sum, p) => sum + p.amount, 0)
    }
}

// Refund prepayment
export async function refundPrepayment(prepaymentId: string, reason?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_expenses') // Manager+ only

    const prepayment = await prisma.prepayment.findUnique({
        where: { id: prepaymentId },
        include: { client: true }
    })
    if (!prepayment) throw new Error('Prepayment not found')
    if (prepayment.status !== 'Received') throw new Error('Only received prepayments can be refunded')

    // Check if client has enough balance to refund
    if (prepayment.client.walletBalance < prepayment.amount) {
        throw new Error('Insufficient wallet balance for full refund. Some prepayment may have been applied to orders.')
    }

    await prisma.$transaction(async (tx) => {
        await tx.prepayment.update({
            where: { id: prepaymentId },
            data: {
                status: 'Refunded',
                notes: reason ? `${prepayment.notes || ''}\n\nRefund reason: ${reason}`.trim() : prepayment.notes
            }
        })

        await tx.client.update({
            where: { id: prepayment.clientId },
            data: { walletBalance: { decrement: prepayment.amount } }
        })
    })

    revalidatePath('/crm')
    revalidatePath(`/crm/${prepayment.clientId}`)
    return { success: true }
}

// ==================== PAYMENT SCHEDULES ====================

// Create payment schedule for an order
export async function createPaymentSchedule(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const orderId = formData.get('orderId') as string
    const scheduleData = formData.get('schedule') as string // JSON array of {dueDate, amount, description}

    if (!orderId) throw new Error('Order is required')

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')

    let schedule: Array<{ dueDate: string; amount: number; description?: string }>
    try {
        schedule = JSON.parse(scheduleData)
    } catch {
        throw new Error('Invalid schedule data')
    }

    // Validate schedule total matches order total
    const scheduleTotal = schedule.reduce((sum, item) => sum + item.amount, 0)
    if (Math.abs(scheduleTotal - order.totalAmount) > 0.01) {
        throw new Error(`Schedule total (${formatCurrency(scheduleTotal)}) must match order total (${formatCurrency(order.totalAmount)})`)
    }

    // Delete existing schedule items and create new ones
    await prisma.$transaction(async (tx) => {
        await tx.paymentScheduleItem.deleteMany({ where: { orderId } })

        for (const item of schedule) {
            await tx.paymentScheduleItem.create({
                data: {
                    orderId,
                    dueDate: new Date(item.dueDate),
                    amount: item.amount,
                    description: item.description || null
                }
            })
        }
    })

    revalidatePath(`/orders/${orderId}`)
    return { success: true }
}

// Mark schedule item as paid
export async function markScheduleItemPaid(scheduleItemId: string, paymentId?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const item = await prisma.paymentScheduleItem.findUnique({ where: { id: scheduleItemId } })
    if (!item) throw new Error('Schedule item not found')

    await prisma.paymentScheduleItem.update({
        where: { id: scheduleItemId },
        data: {
            status: 'Paid',
            paidDate: new Date(),
            paymentId: paymentId || null
        }
    })

    revalidatePath(`/orders/${item.orderId}`)
    return { success: true }
}

// Add a single payment schedule item
export async function addPaymentScheduleItem(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const orderId = formData.get('orderId') as string
    const dueDate = formData.get('dueDate') as string
    const amount = parseFloat(formData.get('amount') as string)
    const description = formData.get('description') as string | null

    if (!orderId) throw new Error('Order is required')
    if (!dueDate) throw new Error('Due date is required')
    if (isNaN(amount) || amount <= 0) throw new Error('Valid amount required')

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')

    const item = await prisma.paymentScheduleItem.create({
        data: {
            orderId,
            dueDate: new Date(dueDate),
            amount,
            description: description || null,
            status: 'Pending'
        }
    })

    revalidatePath(`/orders/${orderId}`)
    revalidatePath('/orders')
    return { success: true, item }
}

// Remove a payment schedule item
export async function removePaymentScheduleItem(itemId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const item = await prisma.paymentScheduleItem.findUnique({ where: { id: itemId } })
    if (!item) throw new Error('Schedule item not found')

    // Only allow removing pending items
    if (item.status === 'Paid') {
        throw new Error('Cannot remove paid schedule items')
    }

    await prisma.paymentScheduleItem.delete({ where: { id: itemId } })

    revalidatePath(`/orders/${item.orderId}`)
    revalidatePath('/orders')
    return { success: true }
}

// Get payment schedule for an order
export async function getOrderPaymentSchedule(orderId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const scheduleItems = await prisma.paymentScheduleItem.findMany({
        where: { orderId },
        orderBy: { dueDate: 'asc' }
    })

    const total = scheduleItems.reduce((sum, item) => sum + item.amount, 0)

    return {
        items: scheduleItems,
        total,
        count: scheduleItems.length
    }
}

export async function getOverduePayments() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const now = new Date()

    const overdueItems = await prisma.paymentScheduleItem.findMany({
        where: {
            status: 'Pending',
            dueDate: { lt: now }
        },
        include: {
            order: {
                include: {
                    client: { select: { id: true, name: true, code: true, phone: true } }
                }
            }
        },
        orderBy: { dueDate: 'asc' }
    })

    // Update status to Overdue
    await prisma.paymentScheduleItem.updateMany({
        where: {
            status: 'Pending',
            dueDate: { lt: now }
        },
        data: { status: 'Overdue' }
    })

    return overdueItems.map(item => ({
        ...item,
        daysOverdue: Math.floor((now.getTime() - item.dueDate.getTime()) / (1000 * 60 * 60 * 24))
    }))
}

// ==================== PAYMENT ANALYTICS ====================

// Get payment analytics
export async function getPaymentAnalytics(period: '7days' | '30days' | '90days' = '30days') {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const days = period === '7days' ? 7 : period === '30days' ? 30 : 90
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const [payments, prepayments] = await Promise.all([
        prisma.payment.findMany({
            where: { paymentDate: { gte: startDate }, status: { not: 'Bounced' } }
        }),
        prisma.prepayment.findMany({
            where: { receivedDate: { gte: startDate }, status: 'Received' }
        })
    ])

    const totalPayments = payments.reduce((sum, p) => sum + p.amount, 0)
    const totalPrepayments = prepayments.reduce((sum, p) => sum + p.amount, 0)

    const byMethod = payments.reduce((acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount
        return acc
    }, {} as Record<string, number>)

    return {
        period,
        totalPayments,
        paymentCount: payments.length,
        totalPrepayments,
        prepaymentCount: prepayments.length,
        totalReceived: totalPayments + totalPrepayments,
        byMethod,
        averagePayment: payments.length > 0 ? totalPayments / payments.length : 0
    }
}
