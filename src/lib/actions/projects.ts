'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'

// ==================== PROJECT CRUD ====================

// Get all projects with filters
export async function getProjects(filters?: { clientId?: string; status?: string; search?: string }) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const where: any = {}

    if (filters?.clientId) {
        where.clientId = filters.clientId
    }
    if (filters?.status && filters.status !== 'all') {
        where.status = filters.status
    }
    if (filters?.search) {
        where.OR = [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { description: { contains: filters.search, mode: 'insensitive' } },
            { client: { name: { contains: filters.search, mode: 'insensitive' } } }
        ]
    }

    const projects = await prisma.project.findMany({
        where,
        include: {
            client: { select: { id: true, name: true, code: true } },
            _count: { select: { orders: true, prepayments: true } }
        },
        orderBy: { createdAt: 'desc' }
    })

    // Get additional stats for each project
    const projectsWithStats = await Promise.all(projects.map(async (project) => {
        const [orders, prepayments] = await Promise.all([
            prisma.salesOrder.findMany({
                where: { projectId: project.id },
                select: { totalAmount: true, amountPaid: true }
            }),
            prisma.prepayment.findMany({
                where: { projectId: project.id, status: 'Received' },
                select: { amount: true }
            })
        ])

        return {
            ...project,
            stats: {
                totalOrderValue: orders.reduce((sum, o) => sum + o.totalAmount, 0),
                totalPaid: orders.reduce((sum, o) => sum + o.amountPaid, 0),
                totalPrepayments: prepayments.reduce((sum, p) => sum + p.amount, 0)
            }
        }
    }))

    return projectsWithStats
}

// Get single project with full details
export async function getProject(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const project = await prisma.project.findUnique({
        where: { id },
        include: {
            client: true,
            orders: {
                include: {
                    lineItems: { include: { recipe: true } },
                    payments: true,
                    _count: { select: { productionRuns: true } }
                },
                orderBy: { orderDate: 'desc' }
            },
            prepayments: {
                orderBy: { receivedDate: 'desc' }
            }
        }
    })

    if (!project) throw new Error('Project not found')

    // Calculate project totals
    const summary = {
        totalOrderValue: project.orders.reduce((sum, o) => sum + o.totalAmount, 0),
        totalAmountPaid: project.orders.reduce((sum, o) => sum + o.amountPaid, 0),
        totalPrepayments: project.prepayments.filter(p => p.status === 'Received').reduce((sum, p) => sum + p.amount, 0),
        orderCount: project.orders.length,
        activeOrders: project.orders.filter(o => o.status === 'Active').length,
        completedOrders: project.orders.filter(o => ['Fulfilled', 'Closed'].includes(o.status)).length
    }

    return { ...project, summary }
}

// Create a new project
export async function createProject(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const clientId = formData.get('clientId') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const startDate = formData.get('startDate') as string | null
    const endDate = formData.get('endDate') as string | null

    if (!clientId) throw new Error('Client is required')
    if (!name) throw new Error('Project name is required')

    const project = await prisma.project.create({
        data: {
            clientId,
            name,
            description: description || null,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            status: 'Active',
            createdBy: session.user.name || 'Unknown'
        },
        include: {
            client: { select: { id: true, name: true, code: true } }
        }
    })

    revalidatePath('/crm')
    revalidatePath('/projects')
    return { success: true, project }
}

// Update project
export async function updateProject(id: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const name = formData.get('name') as string
    const description = formData.get('description') as string | null
    const startDate = formData.get('startDate') as string | null
    const endDate = formData.get('endDate') as string | null
    const status = formData.get('status') as string | null

    const project = await prisma.project.update({
        where: { id },
        data: {
            name,
            description: description || null,
            startDate: startDate ? new Date(startDate) : null,
            endDate: endDate ? new Date(endDate) : null,
            status: status || undefined
        }
    })

    revalidatePath('/crm')
    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    return { success: true, project }
}

// Update project status
export async function updateProjectStatus(id: string, status: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const validStatuses = ['Active', 'Completed', 'On Hold', 'Cancelled']
    if (!validStatuses.includes(status)) {
        throw new Error('Invalid status')
    }

    const project = await prisma.project.update({
        where: { id },
        data: { status }
    })

    revalidatePath('/crm')
    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    return { success: true, project }
}

// Get projects for dropdown (simplified)
export async function getProjectsForSelect(clientId?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const where: any = { status: 'Active' }
    if (clientId) where.clientId = clientId

    return prisma.project.findMany({
        where,
        select: {
            id: true,
            name: true,
            client: { select: { name: true } }
        },
        orderBy: { name: 'asc' }
    })
}

// Link an order to a project
export async function linkOrderToProject(orderId: string, projectId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_clients')

    const order = await prisma.salesOrder.findUnique({ where: { id: orderId } })
    if (!order) throw new Error('Order not found')

    const project = await prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new Error('Project not found')

    // Ensure same client
    if (order.clientId !== project.clientId) {
        throw new Error('Order and project must belong to the same client')
    }

    await prisma.salesOrder.update({
        where: { id: orderId },
        data: { projectId }
    })

    revalidatePath('/orders')
    revalidatePath(`/orders/${orderId}`)
    revalidatePath(`/projects/${projectId}`)
    return { success: true }
}
