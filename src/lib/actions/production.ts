'use server'



import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

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
        const recipeId = formData.get('recipeId') as string
        const quantity = parseFloat(formData.get('quantity') as string)
        const siloId = formData.get('siloId') as string
        const notes = formData.get('notes') as string
        const operatorName = formData.get('operatorName') as string

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
                    operatorName
                },
                include: {
                    recipe: true,
                    silo: true
                }
            })
        })

        revalidatePath('/production')
        return {
            success: true,
            message: 'Production run executed successfully',
            run: productionRun,
            deductions
        }

    } catch (error: any) {
        return { success: false, message: error.message || 'An unexpected error occurred during production' }
    }
}

// seedRecipes removed as per user request to manual input only
