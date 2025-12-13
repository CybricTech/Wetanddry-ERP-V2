'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission, hasPermission } from '@/lib/permissions'

// ==================== CLIENT CODE GENERATION ====================

/**
 * Generate a unique client code (CLI-001, CLI-002, etc.)
 */
async function generateClientCode(): Promise<string> {
    const lastClient = await prisma.client.findFirst({
        orderBy: { code: 'desc' },
        select: { code: true }
    })

    if (!lastClient) {
        return 'CLI-001'
    }

    // Extract number from code (e.g., "CLI-042" -> 42)
    const lastNumber = parseInt(lastClient.code.replace('CLI-', ''), 10)
    const nextNumber = lastNumber + 1
    return `CLI-${nextNumber.toString().padStart(3, '0')}`
}

// ==================== CLIENT CRUD OPERATIONS ====================

/**
 * Get all clients with summary stats
 */
export async function getClients(filters?: {
    status?: string
    category?: string
    search?: string
}) {
    try {
        const session = await auth()
        if (!session?.user?.role) {
            console.error('[getClients] No user session or role')
            return []
        }

        // Use hasPermission instead of checkPermission to avoid throwing
        if (!hasPermission(session.user.role, 'view_crm')) {
            console.error('[getClients] User lacks view_crm permission:', session.user.role)
            return []
        }

        const where: any = {}

        if (filters?.status && filters.status !== 'all') {
            where.status = filters.status
        }

        if (filters?.category && filters.category !== 'all') {
            where.category = filters.category
        }

        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { code: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
                { phone: { contains: filters.search } }
            ]
        }

        const clients = await prisma.client.findMany({
            where,
            include: {
                contacts: {
                    where: { isPrimary: true },
                    take: 1
                },
                _count: {
                    select: {
                        productionRuns: true,
                        expenses: true,
                        exceptionLogs: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        })

        // Calculate total production volume per client
        const clientsWithStats = await Promise.all(
            clients.map(async (client) => {
                const productionStats = await prisma.productionRun.aggregate({
                    where: { clientId: client.id },
                    _sum: { quantity: true },
                    _count: true
                })

                const expenseStats = await prisma.expense.aggregate({
                    where: { clientId: client.id, status: 'Approved' },
                    _sum: { amount: true }
                })

                return {
                    ...client,
                    primaryContact: client.contacts[0] || null,
                    stats: {
                        totalProductionRuns: productionStats._count,
                        totalProductionVolume: productionStats._sum.quantity || 0,
                        totalExpenses: expenseStats._sum.amount || 0
                    }
                }
            })
        )

        return clientsWithStats
    } catch (error) {
        console.error('[getClients] Error fetching clients:', error)
        return []
    }
}

/**
 * Get a single client with full details
 */
export async function getClient(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'view_crm')

    const client = await prisma.client.findUnique({
        where: { id },
        include: {
            contacts: {
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
            },
            documents: {
                orderBy: { createdAt: 'desc' }
            },
            productionRuns: {
                include: {
                    recipe: true,
                    silo: true
                },
                orderBy: { createdAt: 'desc' },
                take: 20
            },
            expenses: {
                orderBy: { date: 'desc' },
                take: 20
            },
            exceptionLogs: {
                include: {
                    recipe: true,
                    truck: true
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    })

    if (!client) {
        throw new Error('Client not found')
    }

    // Calculate financial summary
    const [productionStats, expenseStats, approvedExpenses] = await Promise.all([
        prisma.productionRun.aggregate({
            where: { clientId: id },
            _sum: { quantity: true },
            _count: true
        }),
        prisma.expense.aggregate({
            where: { clientId: id },
            _sum: { amount: true },
            _count: true
        }),
        prisma.expense.aggregate({
            where: { clientId: id, status: 'Approved' },
            _sum: { amount: true }
        })
    ])

    return {
        ...client,
        summary: {
            totalProductionRuns: productionStats._count,
            totalProductionVolume: productionStats._sum.quantity || 0,
            totalExpensesRecorded: expenseStats._sum.amount || 0,
            totalExpensesApproved: approvedExpenses._sum.amount || 0,
            pendingExpenseCount: await prisma.expense.count({
                where: { clientId: id, status: 'Pending' }
            })
        }
    }
}

/**
 * Create a new client
 */
export async function createClient(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const name = formData.get('name') as string
    const type = formData.get('type') as string || 'Business'
    const email = formData.get('email') as string | null
    const phone = formData.get('phone') as string
    const altPhone = formData.get('altPhone') as string | null
    const address = formData.get('address') as string
    const city = formData.get('city') as string
    const state = formData.get('state') as string
    const taxId = formData.get('taxId') as string | null
    const paymentTerms = formData.get('paymentTerms') as string || 'Net 30'
    const creditLimit = formData.get('creditLimit') ? parseFloat(formData.get('creditLimit') as string) : null
    const category = formData.get('category') as string || 'Regular'
    const notes = formData.get('notes') as string | null

    // Validation
    if (!name || !phone || !address || !city || !state) {
        return { success: false, message: 'Please fill in all required fields' }
    }

    try {
        const code = await generateClientCode()

        const client = await prisma.client.create({
            data: {
                code,
                name,
                type,
                email: email || null,
                phone,
                altPhone: altPhone || null,
                address,
                city,
                state,
                taxId: taxId || null,
                paymentTerms,
                creditLimit,
                category,
                notes: notes || null,
                createdBy: session.user.name || session.user.email || 'Unknown'
            }
        })

        // If primary contact info provided, create it
        const contactName = formData.get('contactName') as string
        const contactRole = formData.get('contactRole') as string
        const contactEmail = formData.get('contactEmail') as string
        const contactPhone = formData.get('contactPhone') as string

        if (contactName && contactPhone) {
            await prisma.clientContact.create({
                data: {
                    clientId: client.id,
                    name: contactName,
                    role: contactRole || null,
                    email: contactEmail || null,
                    phone: contactPhone,
                    isPrimary: true
                }
            })
        }

        revalidatePath('/crm')
        return { success: true, message: 'Client created successfully', clientId: client.id }
    } catch (error: any) {
        console.error('Error creating client:', error)
        return { success: false, message: error.message || 'Failed to create client' }
    }
}

/**
 * Update an existing client
 */
export async function updateClient(id: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const email = formData.get('email') as string | null
    const phone = formData.get('phone') as string
    const altPhone = formData.get('altPhone') as string | null
    const address = formData.get('address') as string
    const city = formData.get('city') as string
    const state = formData.get('state') as string
    const taxId = formData.get('taxId') as string | null
    const paymentTerms = formData.get('paymentTerms') as string
    const creditLimit = formData.get('creditLimit') ? parseFloat(formData.get('creditLimit') as string) : null
    const category = formData.get('category') as string
    const status = formData.get('status') as string
    const notes = formData.get('notes') as string | null

    if (!name || !phone || !address || !city || !state) {
        return { success: false, message: 'Please fill in all required fields' }
    }

    try {
        await prisma.client.update({
            where: { id },
            data: {
                name,
                type,
                email: email || null,
                phone,
                altPhone: altPhone || null,
                address,
                city,
                state,
                taxId: taxId || null,
                paymentTerms,
                creditLimit,
                category,
                status,
                notes: notes || null
            }
        })

        revalidatePath('/crm')
        revalidatePath(`/crm/${id}`)
        return { success: true, message: 'Client updated successfully' }
    } catch (error: any) {
        console.error('Error updating client:', error)
        return { success: false, message: error.message || 'Failed to update client' }
    }
}

/**
 * Delete/Deactivate a client (soft delete)
 */
export async function deleteClient(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    try {
        // Soft delete - set status to Inactive
        await prisma.client.update({
            where: { id },
            data: { status: 'Inactive' }
        })

        revalidatePath('/crm')
        return { success: true, message: 'Client deactivated successfully' }
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to deactivate client' }
    }
}

// ==================== CLIENT CONTACTS ====================

export async function addClientContact(clientId: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const name = formData.get('name') as string
    const role = formData.get('role') as string | null
    const email = formData.get('email') as string | null
    const phone = formData.get('phone') as string
    const isPrimary = formData.get('isPrimary') === 'true'

    if (!name || !phone) {
        return { success: false, message: 'Name and phone are required' }
    }

    try {
        // If setting as primary, unset other primaries
        if (isPrimary) {
            await prisma.clientContact.updateMany({
                where: { clientId },
                data: { isPrimary: false }
            })
        }

        await prisma.clientContact.create({
            data: {
                clientId,
                name,
                role: role || null,
                email: email || null,
                phone,
                isPrimary
            }
        })

        revalidatePath(`/crm/${clientId}`)
        return { success: true, message: 'Contact added successfully' }
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to add contact' }
    }
}

export async function deleteClientContact(contactId: string, clientId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    try {
        await prisma.clientContact.delete({
            where: { id: contactId }
        })

        revalidatePath(`/crm/${clientId}`)
        return { success: true, message: 'Contact deleted successfully' }
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to delete contact' }
    }
}

// ==================== EXPENSE MANAGEMENT ====================

/**
 * Get all expenses with filters
 */
export async function getExpenses(filters?: {
    category?: string
    status?: string
    clientId?: string
    dateFrom?: Date
    dateTo?: Date
}) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'view_crm')

    const where: any = {}

    if (filters?.category && filters.category !== 'all') {
        where.category = filters.category
    }

    if (filters?.status && filters.status !== 'all') {
        where.status = filters.status
    }

    if (filters?.clientId) {
        where.clientId = filters.clientId
    }

    if (filters?.dateFrom || filters?.dateTo) {
        where.date = {}
        if (filters.dateFrom) where.date.gte = filters.dateFrom
        if (filters.dateTo) where.date.lte = filters.dateTo
    }

    return await prisma.expense.findMany({
        where,
        include: {
            client: {
                select: { id: true, code: true, name: true }
            },
            truck: {
                select: { id: true, plateNumber: true }
            }
        },
        orderBy: { date: 'desc' }
    })
}

/**
 * Get expense breakdown for analytics
 */
export async function getExpenseAnalytics(period: '7days' | '30days' | '90days' | 'year' = '30days') {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'view_expense_reports')

    const days = period === '7days' ? 7 : period === '30days' ? 30 : period === '90days' ? 90 : 365
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const expenses = await prisma.expense.findMany({
        where: {
            date: { gte: startDate },
            status: 'Approved'
        },
        include: {
            client: { select: { id: true, code: true, name: true } }
        }
    })

    // Aggregate by category
    const byCategory = expenses.reduce((acc, exp) => {
        if (!acc[exp.category]) {
            acc[exp.category] = { count: 0, total: 0 }
        }
        acc[exp.category].count++
        acc[exp.category].total += exp.amount
        return acc
    }, {} as Record<string, { count: number; total: number }>)

    // Aggregate by client
    const byClient = expenses.reduce((acc, exp) => {
        const clientKey = exp.client?.name || 'General (No Client)'
        if (!acc[clientKey]) {
            acc[clientKey] = { count: 0, total: 0, clientId: exp.clientId }
        }
        acc[clientKey].count++
        acc[clientKey].total += exp.amount
        return acc
    }, {} as Record<string, { count: number; total: number; clientId: string | null }>)

    const totalAmount = expenses.reduce((sum, exp) => sum + exp.amount, 0)

    return {
        period: { days, startDate, endDate: new Date() },
        summary: {
            totalExpenses: totalAmount,
            expenseCount: expenses.length,
            avgExpenseAmount: expenses.length > 0 ? totalAmount / expenses.length : 0
        },
        byCategory: Object.entries(byCategory)
            .map(([name, data]) => ({
                name,
                ...data,
                percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total),
        byClient: Object.entries(byClient)
            .map(([name, data]) => ({
                name,
                ...data,
                percentage: totalAmount > 0 ? (data.total / totalAmount) * 100 : 0
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
    }
}

/**
 * Create a new expense
 */
export async function createExpense(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_expenses')

    const category = formData.get('category') as string
    const description = formData.get('description') as string
    const amount = parseFloat(formData.get('amount') as string)
    const date = formData.get('date') ? new Date(formData.get('date') as string) : new Date()
    const invoiceNumber = formData.get('invoiceNumber') as string | null
    const clientId = formData.get('clientId') as string | null
    const truckId = formData.get('truckId') as string | null
    const notes = formData.get('notes') as string | null

    if (!category || !description || isNaN(amount) || amount <= 0) {
        return { success: false, message: 'Please fill in all required fields with valid values' }
    }

    try {
        await prisma.expense.create({
            data: {
                category,
                description,
                amount,
                date,
                invoiceNumber: invoiceNumber || null,
                clientId: clientId || null,
                truckId: truckId || null,
                notes: notes || null,
                recordedBy: session.user.name || session.user.email || 'Unknown',
                status: 'Pending'
            }
        })

        revalidatePath('/crm')
        revalidatePath('/finance')
        return { success: true, message: 'Expense recorded successfully' }
    } catch (error: any) {
        console.error('Error creating expense:', error)
        return { success: false, message: error.message || 'Failed to record expense' }
    }
}

/**
 * Approve an expense
 */
export async function approveExpense(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_expenses')

    // Only Manager and Super Admin can approve
    if (!['Super Admin', 'Manager'].includes(session.user.role)) {
        return { success: false, message: 'Only Managers can approve expenses' }
    }

    try {
        await prisma.expense.update({
            where: { id },
            data: {
                status: 'Approved',
                approvedBy: session.user.name || session.user.email,
                approvedAt: new Date()
            }
        })

        revalidatePath('/crm')
        revalidatePath('/finance')
        return { success: true, message: 'Expense approved' }
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to approve expense' }
    }
}

/**
 * Reject an expense
 */
export async function rejectExpense(id: string, reason: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_expenses')

    if (!['Super Admin', 'Manager'].includes(session.user.role)) {
        return { success: false, message: 'Only Managers can reject expenses' }
    }

    try {
        await prisma.expense.update({
            where: { id },
            data: {
                status: 'Rejected',
                rejectionReason: reason,
                approvedBy: session.user.name || session.user.email,
                approvedAt: new Date()
            }
        })

        revalidatePath('/crm')
        return { success: true, message: 'Expense rejected' }
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to reject expense' }
    }
}

// ==================== CLIENT ANALYTICS ====================

/**
 * Get client production history
 */
export async function getClientProductionHistory(clientId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'view_crm')

    return await prisma.productionRun.findMany({
        where: { clientId },
        include: {
            recipe: true,
            silo: true
        },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Get top clients by production volume
 */
export async function getTopClientsByProduction(limit: number = 10) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'view_crm')

    const clients = await prisma.client.findMany({
        where: { status: 'Active' },
        include: {
            productionRuns: {
                select: { quantity: true }
            }
        }
    })

    const ranked = clients
        .map(client => ({
            id: client.id,
            code: client.code,
            name: client.name,
            category: client.category,
            totalVolume: client.productionRuns.reduce((sum, run) => sum + run.quantity, 0),
            runCount: client.productionRuns.length
        }))
        .filter(c => c.totalVolume > 0)
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, limit)

    return ranked
}

/**
 * Get clients list for dropdowns (simplified)
 */
export async function getClientsForSelect() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    return await prisma.client.findMany({
        where: { status: 'Active' },
        select: {
            id: true,
            code: true,
            name: true,
            category: true
        },
        orderBy: { name: 'asc' }
    })
}
