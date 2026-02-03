'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'

// ==================== STOCK RECONCILIATION ====================

// Start a new reconciliation session
export async function startReconciliation(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions') // Manager+ only

    const locationId = formData.get('locationId') as string | null
    const notes = formData.get('notes') as string | null

    // Get all inventory items for the location (or all if no location specified)
    const where: any = { status: 'Active' }
    if (locationId) where.locationId = locationId

    const items = await prisma.inventoryItem.findMany({
        where,
        include: { location: true }
    })

    // Create reconciliation session with items pre-populated
    const reconciliation = await prisma.$transaction(async (tx) => {
        const recon = await tx.stockReconciliation.create({
            data: {
                locationId: locationId || null,
                performedBy: session.user.name || 'Unknown',
                status: 'Draft',
                notes: notes || null
            }
        })

        // Create reconciliation items with current system quantities
        for (const item of items) {
            await tx.reconciliationItem.create({
                data: {
                    reconciliationId: recon.id,
                    inventoryItemId: item.id,
                    systemQuantity: item.quantity,
                    physicalQuantity: item.quantity, // Default to system (user will override)
                    variance: 0,
                    varianceValue: 0
                }
            })
        }

        return recon
    })

    revalidatePath('/inventory')
    return { success: true, reconciliationId: reconciliation.id }
}

// Get reconciliation details
export async function getReconciliation(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const reconciliation = await prisma.stockReconciliation.findUnique({
        where: { id },
        include: {
            location: true,
            items: {
                include: {
                    inventoryItem: {
                        include: { location: true }
                    }
                },
                orderBy: { inventoryItem: { name: 'asc' } }
            }
        }
    })

    if (!reconciliation) throw new Error('Reconciliation not found')

    return reconciliation
}

// Get all reconciliations
export async function getReconciliations(status?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const where: any = {}
    if (status && status !== 'all') where.status = status

    return prisma.stockReconciliation.findMany({
        where,
        include: {
            location: { select: { id: true, name: true, type: true } },
            _count: { select: { items: true } }
        },
        orderBy: { reconciliationDate: 'desc' }
    })
}

// Update physical count for a reconciliation item
export async function updatePhysicalCount(itemId: string, physicalQuantity: number, reason?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    const item = await prisma.reconciliationItem.findUnique({
        where: { id: itemId },
        include: {
            reconciliation: true,
            inventoryItem: true
        }
    })
    if (!item) throw new Error('Item not found')
    if (item.reconciliation.status !== 'Draft' && item.reconciliation.status !== 'In Progress') {
        throw new Error('Cannot modify completed reconciliation')
    }

    const variance = physicalQuantity - item.systemQuantity
    const varianceValue = variance * item.inventoryItem.unitCost

    await prisma.reconciliationItem.update({
        where: { id: itemId },
        data: {
            physicalQuantity,
            variance,
            varianceValue,
            reason: reason || null
        }
    })

    // Update reconciliation totals
    await recalculateReconciliationTotals(item.reconciliationId)

    revalidatePath('/inventory')
    return { success: true, variance, varianceValue }
}

// Bulk update physical counts
export async function bulkUpdatePhysicalCounts(updates: Array<{ itemId: string; physicalQuantity: number; reason?: string }>) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    let reconciliationId: string | null = null

    for (const update of updates) {
        const item = await prisma.reconciliationItem.findUnique({
            where: { id: update.itemId },
            include: { inventoryItem: true }
        })
        if (!item) continue

        reconciliationId = item.reconciliationId

        const variance = update.physicalQuantity - item.systemQuantity
        const varianceValue = variance * item.inventoryItem.unitCost

        await prisma.reconciliationItem.update({
            where: { id: update.itemId },
            data: {
                physicalQuantity: update.physicalQuantity,
                variance,
                varianceValue,
                reason: update.reason || null
            }
        })
    }

    if (reconciliationId) {
        await recalculateReconciliationTotals(reconciliationId)
    }

    revalidatePath('/inventory')
    return { success: true }
}

// Helper to recalculate reconciliation totals
async function recalculateReconciliationTotals(reconciliationId: string) {
    const items = await prisma.reconciliationItem.findMany({
        where: { reconciliationId }
    })

    const totalVariance = items.reduce((sum, item) => sum + Math.abs(item.variance), 0)
    const varianceValue = items.reduce((sum, item) => sum + item.varianceValue, 0)

    await prisma.stockReconciliation.update({
        where: { id: reconciliationId },
        data: { totalVariance, varianceValue }
    })
}

// Start processing reconciliation (Draft -> In Progress)
export async function startProcessingReconciliation(reconciliationId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    const recon = await prisma.stockReconciliation.findUnique({ where: { id: reconciliationId } })
    if (!recon) throw new Error('Reconciliation not found')
    if (recon.status !== 'Draft') throw new Error('Reconciliation must be in Draft status')

    await prisma.stockReconciliation.update({
        where: { id: reconciliationId },
        data: { status: 'In Progress' }
    })

    revalidatePath('/inventory')
    return { success: true }
}

// Approve and complete reconciliation
export async function approveReconciliation(reconciliationId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    const recon = await prisma.stockReconciliation.findUnique({
        where: { id: reconciliationId },
        include: { items: { include: { inventoryItem: true } } }
    })
    if (!recon) throw new Error('Reconciliation not found')
    if (recon.status !== 'In Progress') throw new Error('Reconciliation must be In Progress to approve')

    // Post adjustments for items with variance
    await prisma.$transaction(async (tx) => {
        for (const item of recon.items) {
            if (item.variance !== 0 && !item.adjustmentPosted) {
                // Create stock adjustment transaction
                const transaction = await tx.stockTransaction.create({
                    data: {
                        itemId: item.inventoryItemId,
                        type: 'ADJUSTMENT',
                        quantity: item.variance, // Positive for gain, negative for loss
                        reason: item.reason || (item.variance > 0 ? 'Stock Gain (Reconciliation)' : 'Stock Loss (Reconciliation)'),
                        status: 'Approved',
                        performedBy: session.user.name || 'Unknown',
                        approvedBy: session.user.name || 'Unknown',
                        approvedAt: new Date(),
                        notes: `Physical count reconciliation. System: ${item.systemQuantity}, Physical: ${item.physicalQuantity}`
                    }
                })

                // Update inventory item quantity
                await tx.inventoryItem.update({
                    where: { id: item.inventoryItemId },
                    data: {
                        quantity: item.physicalQuantity,
                        totalValue: item.physicalQuantity * item.inventoryItem.unitCost
                    }
                })

                // Mark reconciliation item as posted
                await tx.reconciliationItem.update({
                    where: { id: item.id },
                    data: {
                        adjustmentPosted: true,
                        transactionId: transaction.id
                    }
                })
            }
        }

        // Complete reconciliation
        await tx.stockReconciliation.update({
            where: { id: reconciliationId },
            data: {
                status: 'Completed',
                approvedBy: session.user.name || 'Unknown',
                approvedAt: new Date()
            }
        })
    })

    revalidatePath('/inventory')
    return { success: true }
}

// Cancel reconciliation
export async function cancelReconciliation(reconciliationId: string, reason?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    const recon = await prisma.stockReconciliation.findUnique({ where: { id: reconciliationId } })
    if (!recon) throw new Error('Reconciliation not found')
    if (recon.status === 'Completed') throw new Error('Cannot cancel completed reconciliation')

    await prisma.stockReconciliation.update({
        where: { id: reconciliationId },
        data: {
            status: 'Cancelled',
            notes: reason ? `${recon.notes || ''}\n\nCancelled: ${reason}`.trim() : recon.notes
        }
    })

    revalidatePath('/inventory')
    return { success: true }
}

// Get reconciliation summary/report
export async function getReconciliationReport(reconciliationId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const recon = await prisma.stockReconciliation.findUnique({
        where: { id: reconciliationId },
        include: {
            location: true,
            items: {
                include: {
                    inventoryItem: { include: { location: true } }
                }
            }
        }
    })
    if (!recon) throw new Error('Reconciliation not found')

    const itemsWithVariance = recon.items.filter(i => i.variance !== 0)
    const gains = itemsWithVariance.filter(i => i.variance > 0)
    const losses = itemsWithVariance.filter(i => i.variance < 0)

    return {
        reconciliation: recon,
        summary: {
            totalItems: recon.items.length,
            itemsWithVariance: itemsWithVariance.length,
            itemsMatched: recon.items.length - itemsWithVariance.length,
            totalGains: gains.length,
            totalGainValue: gains.reduce((sum, i) => sum + i.varianceValue, 0),
            totalLosses: losses.length,
            totalLossValue: Math.abs(losses.reduce((sum, i) => sum + i.varianceValue, 0)),
            netVarianceValue: recon.varianceValue
        },
        gains,
        losses
    }
}
