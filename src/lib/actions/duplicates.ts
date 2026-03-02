'use server'

import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { checkPermission } from '@/lib/permissions'
import { revalidatePath } from 'next/cache'

interface DuplicateGroup {
    value: string
    ids: string[]
}

/**
 * Scan all entities for duplicates and create alerts
 */
export async function scanForDuplicates() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_system_settings')

    let alertsCreated = 0

    // 1. Scan InventoryItems by name (case-insensitive)
    const inventoryItems = await prisma.inventoryItem.findMany({
        select: { id: true, name: true },
        where: { status: { not: 'Rejected' } }
    })

    const itemNameGroups = groupByLowerCase(inventoryItems, 'name')
    for (const group of itemNameGroups) {
        alertsCreated += await createAlertsForGroup('InventoryItem', 'name', group)
    }

    // 2. Scan Clients by name
    const clients = await prisma.client.findMany({
        select: { id: true, name: true, phone: true, email: true }
    })

    const clientNameGroups = groupByLowerCase(clients, 'name')
    for (const group of clientNameGroups) {
        alertsCreated += await createAlertsForGroup('Client', 'name', group)
    }

    // 3. Scan Clients by phone (exact match, non-null)
    const clientPhoneGroups = groupByExact(
        clients.filter(c => c.phone),
        'phone'
    )
    for (const group of clientPhoneGroups) {
        alertsCreated += await createAlertsForGroup('Client', 'phone', group)
    }

    // 4. Scan Clients by email (case-insensitive, non-null)
    const clientEmailGroups = groupByLowerCase(
        clients.filter(c => c.email),
        'email'
    )
    for (const group of clientEmailGroups) {
        alertsCreated += await createAlertsForGroup('Client', 'email', group)
    }

    // 5. Scan Staff by email (case-insensitive, non-null)
    const staff = await prisma.staff.findMany({
        select: { id: true, email: true, phone: true }
    })

    const staffEmailGroups = groupByLowerCase(
        staff.filter(s => s.email),
        'email'
    )
    for (const group of staffEmailGroups) {
        alertsCreated += await createAlertsForGroup('Staff', 'email', group)
    }

    // 6. Scan Staff by phone (exact match, non-null)
    const staffPhoneGroups = groupByExact(
        staff.filter(s => s.phone),
        'phone'
    )
    for (const group of staffPhoneGroups) {
        alertsCreated += await createAlertsForGroup('Staff', 'phone', group)
    }

    revalidatePath('/settings/duplicates')

    return { alertsCreated }
}

/**
 * Get duplicate alerts with optional filtering
 */
export async function getDuplicateAlerts(status?: string, page = 1, limit = 50) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_system_settings')

    const where = status && status !== 'all' ? { status } : {}

    const [alerts, totalCount] = await Promise.all([
        prisma.duplicateAlert.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.duplicateAlert.count({ where })
    ])

    return {
        alerts,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit)
        }
    }
}

/**
 * Get count of open duplicate alerts
 */
export async function getDuplicateAlertCount() {
    const session = await auth()
    if (!session?.user?.role) return 0

    try {
        return await prisma.duplicateAlert.count({
            where: { status: 'Open' }
        })
    } catch {
        return 0
    }
}

/**
 * Resolve a duplicate alert
 */
export async function resolveDuplicateAlert(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_system_settings')

    await prisma.duplicateAlert.update({
        where: { id },
        data: {
            status: 'Resolved',
            resolvedBy: session.user.name || session.user.email || 'Unknown',
            resolvedAt: new Date()
        }
    })

    revalidatePath('/settings/duplicates')
}

/**
 * Ignore a duplicate alert
 */
export async function ignoreDuplicateAlert(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_system_settings')

    await prisma.duplicateAlert.update({
        where: { id },
        data: {
            status: 'Ignored',
            resolvedBy: session.user.name || session.user.email || 'Unknown',
            resolvedAt: new Date()
        }
    })

    revalidatePath('/settings/duplicates')
}

/**
 * Get entity details for a duplicate alert (for side-by-side comparison)
 */
export async function getDuplicateEntities(entityType: string, entityId1: string, entityId2: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    switch (entityType) {
        case 'InventoryItem': {
            const [item1, item2] = await Promise.all([
                prisma.inventoryItem.findUnique({ where: { id: entityId1 }, include: { location: true } }),
                prisma.inventoryItem.findUnique({ where: { id: entityId2 }, include: { location: true } })
            ])
            return { entity1: item1, entity2: item2 }
        }
        case 'Client': {
            const [client1, client2] = await Promise.all([
                prisma.client.findUnique({ where: { id: entityId1 } }),
                prisma.client.findUnique({ where: { id: entityId2 } })
            ])
            return { entity1: client1, entity2: client2 }
        }
        case 'Staff': {
            const [staff1, staff2] = await Promise.all([
                prisma.staff.findUnique({ where: { id: entityId1 } }),
                prisma.staff.findUnique({ where: { id: entityId2 } })
            ])
            return { entity1: staff1, entity2: staff2 }
        }
        default:
            return { entity1: null, entity2: null }
    }
}

// ==================== HELPER FUNCTIONS ====================

function groupByLowerCase<T extends Record<string, any>>(items: T[], field: string): DuplicateGroup[] {
    const groups: Record<string, string[]> = {}

    for (const item of items) {
        const value = item[field]
        if (!value) continue
        const key = value.toLowerCase().trim()
        if (!groups[key]) groups[key] = []
        groups[key].push(item.id)
    }

    return Object.entries(groups)
        .filter(([, ids]) => ids.length > 1)
        .map(([value, ids]) => ({ value, ids }))
}

function groupByExact<T extends Record<string, any>>(items: T[], field: string): DuplicateGroup[] {
    const groups: Record<string, string[]> = {}

    for (const item of items) {
        const value = item[field]
        if (!value) continue
        const key = value.trim()
        if (!groups[key]) groups[key] = []
        groups[key].push(item.id)
    }

    return Object.entries(groups)
        .filter(([, ids]) => ids.length > 1)
        .map(([value, ids]) => ({ value, ids }))
}

async function createAlertsForGroup(entityType: string, field: string, group: DuplicateGroup): Promise<number> {
    let created = 0

    // Create alerts for each pair in the group
    for (let i = 0; i < group.ids.length; i++) {
        for (let j = i + 1; j < group.ids.length; j++) {
            // Sort IDs to ensure consistent ordering
            const [id1, id2] = [group.ids[i], group.ids[j]].sort()

            try {
                await prisma.duplicateAlert.upsert({
                    where: {
                        entityType_entityId1_entityId2_field: {
                            entityType,
                            entityId1: id1,
                            entityId2: id2,
                            field
                        }
                    },
                    update: {}, // Don't update existing alerts
                    create: {
                        entityType,
                        entityId1: id1,
                        entityId2: id2,
                        field,
                        value: group.value,
                        status: 'Open'
                    }
                })
                created++
            } catch {
                // Ignore if alert already exists
            }
        }
    }

    return created
}
