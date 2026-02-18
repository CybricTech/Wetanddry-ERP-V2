'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'

export interface SearchResult {
    id: string
    title: string
    subtitle: string
    category: 'truck' | 'inventory' | 'staff' | 'client' | 'order'
    href: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
    const session = await auth()
    if (!session?.user?.role || !query || query.trim().length < 2) {
        return []
    }

    const q = query.trim()
    const results: SearchResult[] = []

    try {
        // Search in parallel
        const [trucks, inventoryItems, staffMembers, clients, orders] = await Promise.all([
            prisma.truck.findMany({
                where: {
                    OR: [
                        { plateNumber: { contains: q, mode: 'insensitive' } },
                        { model: { contains: q, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, plateNumber: true, model: true, status: true }
            }),
            prisma.inventoryItem.findMany({
                where: {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { sku: { contains: q, mode: 'insensitive' } },
                        { category: { contains: q, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, name: true, category: true, quantity: true, unit: true }
            }),
            prisma.staff.findMany({
                where: {
                    OR: [
                        { firstName: { contains: q, mode: 'insensitive' } },
                        { lastName: { contains: q, mode: 'insensitive' } },
                        { role: { contains: q, mode: 'insensitive' } },
                        { department: { contains: q, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, firstName: true, lastName: true, role: true, department: true }
            }),
            prisma.client.findMany({
                where: {
                    OR: [
                        { name: { contains: q, mode: 'insensitive' } },
                        { code: { contains: q, mode: 'insensitive' } },
                        { email: { contains: q, mode: 'insensitive' } },
                    ]
                },
                take: 5,
                select: { id: true, name: true, code: true, category: true }
            }),
            prisma.salesOrder.findMany({
                where: {
                    OR: [
                        { orderNumber: { contains: q, mode: 'insensitive' } },
                        { client: { name: { contains: q, mode: 'insensitive' } } },
                    ]
                },
                take: 5,
                select: { id: true, orderNumber: true, status: true, client: { select: { name: true } } }
            }),
        ])

        // Map results
        for (const t of trucks) {
            results.push({
                id: t.id,
                title: t.plateNumber,
                subtitle: `${t.model} · ${t.status}`,
                category: 'truck',
                href: `/trucks/${t.id}`,
            })
        }

        for (const i of inventoryItems) {
            results.push({
                id: i.id,
                title: i.name,
                subtitle: `${i.category} · ${i.quantity} ${i.unit}`,
                category: 'inventory',
                href: '/inventory',
            })
        }

        for (const s of staffMembers) {
            results.push({
                id: s.id,
                title: `${s.firstName} ${s.lastName}`,
                subtitle: `${s.role} · ${s.department}`,
                category: 'staff',
                href: `/staff/${s.id}`,
            })
        }

        for (const c of clients) {
            results.push({
                id: c.id,
                title: c.name,
                subtitle: `${c.code} · ${c.category}`,
                category: 'client',
                href: '/crm',
            })
        }

        for (const o of orders) {
            results.push({
                id: o.id,
                title: o.orderNumber,
                subtitle: `${o.client.name} · ${o.status}`,
                category: 'order',
                href: '/orders',
            })
        }

        return results
    } catch (error) {
        console.error('Global search error:', error)
        return []
    }
}
