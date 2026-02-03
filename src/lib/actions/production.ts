'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'
import {
    notifyProductionCompleted,
    notifyMaterialShortage,
    checkAndNotifyLowStock,
    checkAndNotifySiloCritical
} from '@/lib/actions/notifications'

// ============ RECIPE MANAGEMENT ============

export async function getRecipes() {
    return await prisma.recipe.findMany({
        include: {
            ingredients: {
                include: {
                    inventoryItem: true
                }
            }
        },
        orderBy: { productCode: 'asc' }
    })
}

// ... (keep getSilos and getProductionRuns as is, I will replace the rest efficiently)

// New Actions for Linked Recipe Management

export async function createRecipe(formData: FormData) {
    const productCode = formData.get('productCode') as string
    const name = formData.get('name') as string

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_recipes')


    // Parse ingredients with IDs
    const ingredients = [
        { name: '20mm Aggregate', id: formData.get('id_agg20') as string, qty: parseFloat(formData.get('qty_agg20') as string) || 0, unit: 'kg' },
        { name: '10mm Aggregate', id: formData.get('id_agg10') as string, qty: parseFloat(formData.get('qty_agg10') as string) || 0, unit: 'kg' },
        { name: 'Stone Dust', id: formData.get('id_stoneDust') as string, qty: parseFloat(formData.get('qty_stoneDust') as string) || 0, unit: 'kg' },
        { name: 'Cement', id: formData.get('id_cement') as string, qty: parseFloat(formData.get('qty_cement') as string) || 0, unit: 'kg' },
        { name: 'Water', id: formData.get('id_water') as string, qty: parseFloat(formData.get('qty_water') as string) || 0, unit: 'liters' },
        { name: 'Admixture', id: formData.get('id_admixture') as string, qty: parseFloat(formData.get('qty_admixture') as string) || 0, unit: 'liters' },
    ]

    if (!productCode || !name) {
        return { success: false, message: 'Product Code and Name are required' }
    }

    // Validate all IDs are present
    const missingItems = ingredients.filter(i => !i.id && i.qty > 0)
    if (missingItems.length > 0) {
        return { success: false, message: `Please select inventory items for: ${missingItems.map(i => i.name).join(', ')}` }
    }

    // Calculate total weight
    const totalWeight = ingredients.reduce((sum, i) => sum + i.qty, 0)

    try {
        await prisma.recipe.create({
            data: {
                productCode,
                name,
                totalWeight,
                ingredients: {
                    create: ingredients.map(ing => ({
                        materialName: ing.name, // Keep for display/role
                        inventoryItemId: ing.id, // The real link
                        quantity: ing.qty,
                        unit: ing.unit
                    }))
                }
            }
        })
        revalidatePath('/production')
        return { success: true, message: 'Recipe created successfully' }
    } catch (error: any) {
        if (error.code === 'P2002') return { success: false, message: 'Product Code already exists' }
        return { success: false, message: error.message || 'Failed to create recipe' }
    }
}

export async function deleteRecipe(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_recipes')

    try {
        await prisma.recipe.delete({ where: { id } })
        revalidatePath('/production')
        return { success: true }
    } catch (error) {
        return { success: false, message: 'Failed to delete recipe. It may have associated production runs.' }
    }
}

// ... (keeping other existing functions)


// Get available silos for cement (silos with cement items)
export async function getSilos() {
    const silos = await prisma.storageLocation.findMany({
        where: {
            type: 'Silo',
            isActive: true
        },
        include: {
            items: {
                where: {
                    itemType: 'Cement'
                }
            }
        },
        orderBy: { name: 'asc' }
    })

    // Return silos with their cement levels
    return silos.map(silo => {
        const cementItem = silo.items[0] // Typically one cement type per silo
        return {
            id: silo.id,
            name: silo.name,
            description: silo.description,
            capacity: silo.capacity,
            cementItem: cementItem ? {
                id: cementItem.id,
                name: cementItem.name,
                quantity: cementItem.quantity,
                unit: cementItem.unit,
                maxCapacity: cementItem.maxCapacity
            } : null
        }
    })
}

// Get production runs history
export async function getProductionRuns() {
    return await prisma.productionRun.findMany({
        include: {
            recipe: true,
            silo: true
        },
        orderBy: { createdAt: 'desc' },
        take: 50
    })
}

// Get all inventory items for checking stock levels
export async function getAllInventoryItems() {
    return await prisma.inventoryItem.findMany({
        orderBy: { name: 'asc' }
    })
}

export async function createProductionRun(formData: FormData) {
    try {
        const session = await auth()
        if (!session?.user?.role) return { success: false, message: 'Unauthorized' }
        try {
            checkPermission(session.user.role, 'log_production')
        } catch (e) {
            return { success: false, message: 'Unauthorized: Missing log_production permission' }
        }

        const recipeId = formData.get('recipeId') as string
        const quantity = parseFloat(formData.get('quantity') as string)
        const siloId = formData.get('siloId') as string
        const notes = formData.get('notes') as string
        const operatorName = formData.get('operatorName') as string

        // CRM Integration - Client fields
        const clientId = formData.get('clientId') as string | null
        const orderRef = formData.get('orderRef') as string | null
        const deliveryAddress = formData.get('deliveryAddress') as string | null

        if (!recipeId || isNaN(quantity) || quantity <= 0) {
            return { success: false, message: 'Invalid input: Recipe and quantity are required' }
        }

        if (!siloId) {
            return { success: false, message: 'Silo selection is required' }
        }

        const recipe = await prisma.recipe.findUnique({
            where: { id: recipeId },
            include: {
                ingredients: {
                    include: { inventoryItem: true } // Fetch the specific linked item
                }
            }
        })

        if (!recipe) return { success: false, message: 'Recipe not found' }

        // Find the selected silo and its cement item
        const silo = await prisma.storageLocation.findUnique({
            where: { id: siloId },
            include: {
                items: {
                    where: { itemType: 'Cement' }
                }
            }
        })

        if (!silo || silo.type !== 'Silo') {
            return { success: false, message: 'Invalid silo selected' }
        }

        const siloItem = silo.items[0]
        if (!siloItem) {
            return { success: false, message: `No cement found in ${silo.name}. Please add cement first.` }
        }

        // Transaction: Deduct stock and record production
        let totalCementUsed = 0
        const deductions: { item: string; quantity: number; unit: string }[] = []

        const productionRun = await prisma.$transaction(async (tx) => {
            // 1. Check and Deduct Stock for each ingredient
            for (const ingredient of recipe.ingredients) {
                const requiredAmount = ingredient.quantity * quantity
                const isCement = ingredient.materialName.toLowerCase().includes('cement')

                if (isCement) {
                    // Cement Logic: Must come from the *selected silo*, ignoring the recipe's default cement link if different?
                    // Actually, the recipe likely links to a generic "Bulk Cement" item or a specific one. 
                    // But in production, we override with the specific Silo Item.

                    if (siloItem.quantity < requiredAmount) {
                        throw new Error(`Insufficient cement in ${silo.name}. Required: ${requiredAmount.toLocaleString()} ${ingredient.unit}, Available: ${siloItem.quantity.toLocaleString()} ${siloItem.unit}`)
                    }

                    await tx.inventoryItem.update({
                        where: { id: siloItem.id },
                        data: { quantity: { decrement: requiredAmount } }
                    })

                    await tx.stockTransaction.create({
                        data: {
                            itemId: siloItem.id,
                            type: 'OUT',
                            quantity: requiredAmount,
                            reason: `Production: ${recipe.name} - ${quantity}m³ (Silo: ${silo.name})`,
                            status: 'Approved',
                            performedBy: operatorName || 'System',
                            approvedBy: 'System',
                            approvedAt: new Date()
                        }
                    })

                    totalCementUsed = requiredAmount
                    deductions.push({ item: siloItem.name, quantity: requiredAmount, unit: siloItem.unit })

                } else {
                    // Non-cement ingredients: Use the DIRECTLY LINKED inventory item
                    const item = ingredient.inventoryItem

                    if (!item) {
                        throw new Error(`Inventory link missing for ${ingredient.materialName}`)
                    }

                    if (item.quantity < requiredAmount) {
                        throw new Error(`Insufficient stock for ${item.name}. Required: ${requiredAmount.toLocaleString()} ${ingredient.unit}, Available: ${item.quantity.toLocaleString()} ${item.unit}`)
                    }

                    await tx.inventoryItem.update({
                        where: { id: item.id },
                        data: { quantity: { decrement: requiredAmount } }
                    })

                    await tx.stockTransaction.create({
                        data: {
                            itemId: item.id,
                            type: 'OUT',
                            quantity: requiredAmount,
                            reason: `Production: ${recipe.name} - ${quantity}m³`,
                            status: 'Approved',
                            performedBy: operatorName || 'System',
                            approvedBy: 'System',
                            approvedAt: new Date()
                        }
                    })

                    deductions.push({ item: item.name, quantity: requiredAmount, unit: ingredient.unit })
                }
            }

            // 2. Create Production Run Record
            return await tx.productionRun.create({
                data: {
                    recipeId,
                    siloId,
                    quantity,
                    cementUsed: totalCementUsed,
                    status: 'Completed',
                    notes,
                    operatorName,
                    // CRM Integration
                    clientId: clientId || null,
                    orderRef: orderRef || null,
                    deliveryAddress: deliveryAddress || null
                },
                include: {
                    recipe: true,
                    silo: true,
                    client: true
                }
            })
        })

        // Notify about production completion
        notifyProductionCompleted(
            productionRun.id,
            productionRun.recipe.name,
            quantity,
            operatorName || 'System'
        ).catch(console.error)

        // Check for low stock and critical silo levels after production
        checkAndNotifyLowStock().catch(console.error)
        checkAndNotifySiloCritical(siloId).catch(console.error)

        revalidatePath('/production')
        return {
            success: true,
            message: 'Production run executed successfully',
            run: productionRun,
            deductions
        }

    } catch (error: any) {
        // Check if error is due to insufficient stock - notify about shortage
        if (error.message?.includes('Insufficient')) {
            // Extract item name from error message
            const match = error.message.match(/Insufficient (?:stock for |cement in )?([^.]+)/i)
            const itemName = match ? match[1] : 'materials'

            // Get recipe name for notification
            const recipeId = formData.get('recipeId') as string
            const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } })

            if (recipe) {
                notifyMaterialShortage(
                    recipe.name,
                    itemName,
                    0, // We don't have exact numbers in catch block
                    0,
                    ''
                ).catch(console.error)
            }
        }
        return { success: false, message: error.message || 'An unexpected error occurred during production' }
    }
}

// seedRecipes removed as per user request to manual input only

// ==================== PRODUCTION SCHEDULING & VARIANCE ====================

// Schedule a future production run
export async function scheduleProductionRun(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'log_production')

    const recipeId = formData.get('recipeId') as string
    const siloId = formData.get('siloId') as string
    const plannedQuantity = parseFloat(formData.get('plannedQuantity') as string)
    const scheduledDate = formData.get('scheduledDate') as string
    const plannedStartTime = formData.get('plannedStartTime') as string | null
    const plannedEndTime = formData.get('plannedEndTime') as string | null
    const clientId = formData.get('clientId') as string | null
    const orderId = formData.get('orderId') as string | null
    const notes = formData.get('notes') as string | null

    if (!recipeId || !siloId || isNaN(plannedQuantity) || !scheduledDate) {
        throw new Error('Recipe, silo, quantity, and scheduled date are required')
    }

    const recipe = await prisma.recipe.findUnique({
        where: { id: recipeId },
        include: { ingredients: { include: { inventoryItem: true } } }
    })
    if (!recipe) throw new Error('Recipe not found')

    // Create scheduled production run with planned material usages
    const run = await prisma.$transaction(async (tx) => {
        const productionRun = await tx.productionRun.create({
            data: {
                recipeId,
                siloId,
                plannedQuantity,
                quantity: 0, // Actual will be filled when executed
                scheduledDate: new Date(scheduledDate),
                plannedStartTime: plannedStartTime ? new Date(plannedStartTime) : null,
                plannedEndTime: plannedEndTime ? new Date(plannedEndTime) : null,
                status: 'Scheduled',
                clientId: clientId || null,
                orderId: orderId || null,
                notes: notes || null,
                operatorName: session.user.name || 'Unknown'
            }
        })

        // Create planned material usages
        for (const ingredient of recipe.ingredients) {
            const plannedQty = ingredient.quantity * plannedQuantity
            await tx.productionMaterialUsage.create({
                data: {
                    productionRunId: productionRun.id,
                    inventoryItemId: ingredient.inventoryItem.id,
                    plannedQuantity: plannedQty,
                    unitCostAtTime: ingredient.inventoryItem.unitCost
                }
            })
        }

        return productionRun
    })

    revalidatePath('/production')
    return { success: true, productionRun: run }
}

// Reschedule a production run
export async function rescheduleProductionRun(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'log_production')

    const productionRunId = formData.get('productionRunId') as string
    const newScheduledDate = formData.get('newScheduledDate') as string
    const delayReason = formData.get('delayReason') as string

    if (!productionRunId || !newScheduledDate) {
        throw new Error('Production run ID and new date are required')
    }

    const run = await prisma.productionRun.findUnique({ where: { id: productionRunId } })
    if (!run) throw new Error('Production run not found')
    if (!['Scheduled', 'Delayed'].includes(run.status)) {
        throw new Error('Can only reschedule scheduled or delayed runs')
    }

    await prisma.productionRun.update({
        where: { id: productionRunId },
        data: {
            scheduledDate: new Date(newScheduledDate),
            rescheduledFrom: run.scheduledDate,
            delayReason: delayReason || null,
            status: 'Rescheduled'
        }
    })

    revalidatePath('/production')
    return { success: true }
}

// Start a scheduled production run
export async function startProductionRun(productionRunId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'log_production')

    const run = await prisma.productionRun.findUnique({ where: { id: productionRunId } })
    if (!run) throw new Error('Production run not found')
    if (!['Scheduled', 'Rescheduled'].includes(run.status)) {
        throw new Error('Can only start scheduled or rescheduled runs')
    }

    await prisma.productionRun.update({
        where: { id: productionRunId },
        data: {
            actualStartTime: new Date(),
            status: 'In Progress'
        }
    })

    revalidatePath('/production')
    return { success: true }
}

// Complete a production run with actual quantities
export async function completeProductionRunWithVariance(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'log_production')

    const productionRunId = formData.get('productionRunId') as string
    const actualQuantity = parseFloat(formData.get('actualQuantity') as string)
    const materialUsages = formData.get('materialUsages') as string // JSON

    if (!productionRunId || isNaN(actualQuantity)) {
        throw new Error('Production run ID and actual quantity are required')
    }

    const run = await prisma.productionRun.findUnique({
        where: { id: productionRunId },
        include: { materialUsages: { include: { inventoryItem: true } } }
    })
    if (!run) throw new Error('Production run not found')
    if (run.status !== 'In Progress') throw new Error('Can only complete runs that are in progress')

    // Parse material usages if provided
    let usages: Array<{ materialUsageId: string; actualQuantity: number }> = []
    try {
        usages = JSON.parse(materialUsages || '[]')
    } catch { /* ignore */ }

    await prisma.$transaction(async (tx) => {
        // Update actual material usages and calculate variances
        for (const usage of run.materialUsages) {
            const actualUsage = usages.find(u => u.materialUsageId === usage.id)
            const actualQty = actualUsage?.actualQuantity ?? usage.plannedQuantity
            const variance = actualQty - usage.plannedQuantity

            await tx.productionMaterialUsage.update({
                where: { id: usage.id },
                data: {
                    actualQuantity: actualQty,
                    variance
                }
            })

            // Deduct from inventory
            await tx.inventoryItem.update({
                where: { id: usage.inventoryItemId },
                data: { quantity: { decrement: actualQty } }
            })

            // Create stock transaction
            await tx.stockTransaction.create({
                data: {
                    itemId: usage.inventoryItemId,
                    type: 'OUT',
                    quantity: actualQty,
                    reason: `Production Run ${run.id}`,
                    status: 'Approved',
                    performedBy: session.user.name || 'System',
                    approvedBy: 'System',
                    approvedAt: new Date()
                }
            })
        }

        // Update production run
        await tx.productionRun.update({
            where: { id: productionRunId },
            data: {
                quantity: actualQuantity,
                actualEndTime: new Date(),
                status: 'Completed'
            }
        })
    })

    revalidatePath('/production')
    return { success: true }
}

// Get production variance report
export async function getProductionVarianceReport(startDate?: Date, endDate?: Date) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const where: any = { status: 'Completed' }
    if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
    }

    const runs = await prisma.productionRun.findMany({
        where,
        include: {
            recipe: true,
            materialUsages: {
                include: { inventoryItem: { select: { name: true, unit: true } } }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    // Calculate variance statistics
    const runsWithVariance = runs.filter(r => r.plannedQuantity && r.plannedQuantity !== r.quantity)

    const summary = {
        totalRuns: runs.length,
        runsWithVariance: runsWithVariance.length,
        totalPlanned: runs.reduce((sum, r) => sum + (r.plannedQuantity || r.quantity), 0),
        totalActual: runs.reduce((sum, r) => sum + r.quantity, 0),
        totalVariance: runs.reduce((sum, r) => sum + (r.quantity - (r.plannedQuantity || r.quantity)), 0)
    }

    // Material usage variance
    const materialVariances = runs.flatMap(r => r.materialUsages)
        .filter(u => u.variance !== null && u.variance !== 0)
        .map(u => ({
            materialName: u.inventoryItem.name,
            planned: u.plannedQuantity,
            actual: u.actualQuantity,
            variance: u.variance,
            unit: u.inventoryItem.unit
        }))

    return { runs, summary, materialVariances }
}

// Get scheduled production runs
export async function getScheduledRuns() {
    return prisma.productionRun.findMany({
        where: {
            status: { in: ['Scheduled', 'Rescheduled', 'Delayed'] }
        },
        include: {
            recipe: true,
            silo: true,
            client: { select: { id: true, name: true } },
            order: { select: { id: true, orderNumber: true } }
        },
        orderBy: { scheduledDate: 'asc' }
    })
}
