'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

// ==================== INVENTORY STATS & QUERIES ====================

export async function getInventoryStats() {
    const items = await prisma.inventoryItem.findMany({
        include: { location: true },
        orderBy: { updatedAt: 'desc' }
    })

    const totalItems = items.length
    const lowStockItems = items.filter(item => item.quantity <= item.minThreshold).length
    const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0)

    // Calculate expiring items (within 30 days)
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const expiringItems = items.filter(item =>
        item.expiryDate && new Date(item.expiryDate) <= thirtyDaysFromNow
    ).length

    // Get silo statistics
    const silos = await prisma.storageLocation.findMany({
        where: { type: 'Silo', isActive: true },
        include: { items: { where: { itemType: 'Cement' } } }
    })

    const siloStats = silos.map(silo => {
        const item = silo.items[0]
        const quantity = item?.quantity || 0
        const maxCapacity = silo.capacity || item?.maxCapacity || 80000
        const percentage = (quantity / maxCapacity) * 100

        return {
            id: silo.id,
            name: silo.name,
            itemName: item?.name || '',
            currentLevel: quantity,
            maxCapacity,
            percentage,
            unit: item?.unit || 'kg',
            status: !item ? 'Empty' : quantity <= (item.minThreshold || 15000) ? 'Low' : quantity >= maxCapacity * 0.9 ? 'High' : 'Optimal'
        }
    })

    // Group items by category
    const categorizedItems = {
        assets: items.filter(i => i.category === 'Asset'),
        consumables: items.filter(i => i.category === 'Consumable'),
        equipment: items.filter(i => i.category === 'Equipment'),
        rawMaterials: items.filter(i => i.category === 'Raw Material')
    }

    return {
        items,
        totalItems,
        lowStockItems,
        totalValue,
        expiringItems,
        siloStats,
        categorizedItems
    }
}

export async function getStorageLocations() {
    return await prisma.storageLocation.findMany({
        include: {
            items: true
        },
        orderBy: { name: 'asc' }
    })
}

export async function getInventoryItemById(id: string) {
    return await prisma.inventoryItem.findUnique({
        where: { id },
        include: {
            location: true,
            transactions: {
                orderBy: { createdAt: 'desc' },
                take: 20
            },
            materialRequests: {
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    })
}

export async function getExpiringItems() {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    return await prisma.inventoryItem.findMany({
        where: {
            expiryDate: {
                lte: thirtyDaysFromNow,
                gte: now
            }
        },
        include: { location: true },
        orderBy: { expiryDate: 'asc' }
    })
}

export async function getExpiredItems() {
    const now = new Date()

    return await prisma.inventoryItem.findMany({
        where: {
            expiryDate: {
                lt: now
            }
        },
        include: { location: true },
        orderBy: { expiryDate: 'asc' }
    })
}

// ==================== STOCK TRANSACTIONS ====================

export async function createStockTransaction(formData: FormData) {
    const itemId = formData.get('itemId') as string
    const type = formData.get('type') as string // IN or OUT
    const quantity = parseFloat(formData.get('quantity') as string)
    const reason = formData.get('reason') as string
    const notes = formData.get('notes') as string
    const performedBy = formData.get('performedBy') as string || 'System'

    if (!itemId || !type || isNaN(quantity)) {
        throw new Error('Invalid input')
    }

    // Transaction logic with approval
    await prisma.$transaction(async (tx) => {
        // 1. Create Transaction Record
        await tx.stockTransaction.create({
            data: {
                itemId,
                type,
                quantity,
                reason,
                notes,
                performedBy,
                status: 'Approved', // Auto-approve for now (can be made configurable)
                approvedBy: 'System',
                approvedAt: new Date()
            }
        })

        // 2. Update Inventory Quantity
        const adjustment = type === 'IN' ? quantity : -quantity
        const item = await tx.inventoryItem.findUnique({ where: { id: itemId } })
        if (!item) throw new Error('Item not found')

        const newQuantity = item.quantity + adjustment
        await tx.inventoryItem.update({
            where: { id: itemId },
            data: {
                quantity: newQuantity,
                totalValue: newQuantity * item.unitCost
            }
        })
    })

    revalidatePath('/inventory')
    return { success: true }
}

// ==================== MATERIAL REQUEST WORKFLOW ====================

export async function createMaterialRequest(formData: FormData) {
    const requestType = formData.get('requestType') as string
    const itemId = formData.get('itemId') as string
    const quantity = parseFloat(formData.get('quantity') as string)
    const reason = formData.get('reason') as string
    const priority = formData.get('priority') as string || 'Normal'
    const requestedBy = formData.get('requestedBy') as string || 'Storekeeper'
    const notes = formData.get('notes') as string

    if (!requestType || !itemId || isNaN(quantity)) {
        throw new Error('Invalid input')
    }

    const request = await prisma.materialRequest.create({
        data: {
            requestType,
            itemId,
            quantity,
            reason,
            priority,
            requestedBy,
            notes,
            status: 'Pending'
        }
    })

    revalidatePath('/inventory')
    revalidatePath('/inventory/requests')
    return { success: true, requestId: request.id }
}

export async function getMaterialRequests(status?: string) {
    return await prisma.materialRequest.findMany({
        where: status ? { status } : undefined,
        include: {
            item: {
                include: { location: true }
            }
        },
        orderBy: [
            { priority: 'desc' },
            { createdAt: 'desc' }
        ]
    })
}

export async function approveMaterialRequest(requestId: string, approvedBy: string) {
    const request = await prisma.materialRequest.findUnique({
        where: { id: requestId },
        include: { item: true }
    })

    if (!request) throw new Error('Request not found')
    if (request.status !== 'Pending') throw new Error('Request is not pending')

    await prisma.$transaction(async (tx) => {
        // Update request status
        await tx.materialRequest.update({
            where: { id: requestId },
            data: {
                status: 'Approved',
                approvedBy,
                approvedAt: new Date()
            }
        })

        // Create stock transaction
        const transactionType = request.requestType === 'Stock In' ? 'IN' : 'OUT'
        await tx.stockTransaction.create({
            data: {
                itemId: request.itemId,
                type: transactionType,
                quantity: request.quantity,
                reason: `Approved Request: ${request.reason || 'N/A'}`,
                status: 'Approved',
                performedBy: request.requestedBy,
                approvedBy,
                approvedAt: new Date()
            }
        })

        // Update inventory
        const adjustment = transactionType === 'IN' ? request.quantity : -request.quantity
        const newQuantity = request.item.quantity + adjustment
        await tx.inventoryItem.update({
            where: { id: request.itemId },
            data: {
                quantity: newQuantity,
                totalValue: newQuantity * request.item.unitCost
            }
        })

        // Mark as completed
        await tx.materialRequest.update({
            where: { id: requestId },
            data: {
                status: 'Completed',
                completedAt: new Date()
            }
        })
    })

    revalidatePath('/inventory')
    revalidatePath('/inventory/requests')
    return { success: true }
}

export async function rejectMaterialRequest(requestId: string, rejectedBy: string, rejectionReason: string) {
    await prisma.materialRequest.update({
        where: { id: requestId },
        data: {
            status: 'Rejected',
            approvedBy: rejectedBy,
            approvedAt: new Date(),
            rejectionReason
        }
    })

    revalidatePath('/inventory')
    revalidatePath('/inventory/requests')
    return { success: true }
}

// ==================== INVENTORY ITEM CRUD ====================

export async function createInventoryItem(formData: FormData) {
    const name = formData.get('name') as string
    const sku = formData.get('sku') as string
    const category = formData.get('category') as string
    const itemType = formData.get('itemType') as string || 'General'
    const quantity = parseFloat(formData.get('quantity') as string) || 0
    const maxCapacity = parseFloat(formData.get('maxCapacity') as string) || undefined
    const unit = formData.get('unit') as string
    const minThreshold = parseFloat(formData.get('minThreshold') as string) || 0
    const unitCost = parseFloat(formData.get('unitCost') as string) || 0
    const expiryDate = formData.get('expiryDate') as string
    const batchNumber = formData.get('batchNumber') as string
    const supplier = formData.get('supplier') as string
    const locationId = formData.get('locationId') as string

    if (!name || !category || !unit || !locationId) {
        throw new Error('Missing required fields')
    }

    const item = await prisma.inventoryItem.create({
        data: {
            name,
            sku,
            category,
            itemType,
            quantity,
            maxCapacity,
            unit,
            minThreshold,
            unitCost,
            totalValue: quantity * unitCost,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            batchNumber,
            supplier,
            locationId
        }
    })

    revalidatePath('/inventory')
    return { success: true, item }
}

export async function updateInventoryItem(id: string, formData: FormData) {
    const name = formData.get('name') as string
    const sku = formData.get('sku') as string
    const category = formData.get('category') as string
    const itemType = formData.get('itemType') as string
    const maxCapacity = parseFloat(formData.get('maxCapacity') as string) || undefined
    const unit = formData.get('unit') as string
    const minThreshold = parseFloat(formData.get('minThreshold') as string) || 0
    const unitCost = parseFloat(formData.get('unitCost') as string) || 0
    const expiryDate = formData.get('expiryDate') as string
    const batchNumber = formData.get('batchNumber') as string
    const supplier = formData.get('supplier') as string
    const locationId = formData.get('locationId') as string

    const item = await prisma.inventoryItem.findUnique({ where: { id } })
    if (!item) throw new Error('Item not found')

    await prisma.inventoryItem.update({
        where: { id },
        data: {
            name,
            sku,
            category,
            itemType,
            maxCapacity,
            unit,
            minThreshold,
            unitCost,
            totalValue: item.quantity * unitCost,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            batchNumber,
            supplier,
            locationId
        }
    })

    revalidatePath('/inventory')
    return { success: true }
}

export async function deleteInventoryItem(id: string) {
    await prisma.inventoryItem.delete({
        where: { id }
    })

    revalidatePath('/inventory')
    return { success: true }
}

// ==================== SILO MANAGEMENT ====================

// Get all silos with their cement items
export async function getSilosWithCement() {
    const silos = await prisma.storageLocation.findMany({
        where: { type: 'Silo' },
        include: {
            items: {
                where: { itemType: 'Cement' }
            }
        },
        orderBy: { name: 'asc' }
    })

    return silos.map(silo => {
        const cementItem = silo.items[0]
        const percentage = cementItem?.maxCapacity
            ? (cementItem.quantity / cementItem.maxCapacity) * 100
            : 0

        return {
            id: silo.id,
            name: silo.name,
            description: silo.description,
            capacity: silo.capacity,
            isActive: silo.isActive,
            createdAt: silo.createdAt,
            cementItem: cementItem ? {
                id: cementItem.id,
                name: cementItem.name,
                quantity: cementItem.quantity,
                maxCapacity: cementItem.maxCapacity,
                unit: cementItem.unit,
                minThreshold: cementItem.minThreshold,
                supplier: cementItem.supplier
            } : null,
            percentage,
            status: !cementItem
                ? 'Empty'
                : percentage < 20
                    ? 'Low'
                    : percentage > 90
                        ? 'High'
                        : 'Optimal'
        }
    })
}

// Create a new silo
export async function createSilo(formData: FormData) {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const capacity = parseFloat(formData.get('capacity') as string) || null

    if (!name) {
        throw new Error('Silo name is required')
    }

    // Check for duplicate name
    const existing = await prisma.storageLocation.findUnique({
        where: { name }
    })
    if (existing) {
        throw new Error(`A storage location with name "${name}" already exists`)
    }

    const silo = await prisma.storageLocation.create({
        data: {
            name,
            type: 'Silo',
            description,
            capacity,
            isActive: true
        }
    })

    revalidatePath('/inventory')
    return { success: true, silo }
}

// Update silo information
export async function updateSilo(id: string, formData: FormData) {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const capacity = parseFloat(formData.get('capacity') as string) || null
    const isActive = formData.get('isActive') === 'true'

    if (!name) {
        throw new Error('Silo name is required')
    }

    // Check for duplicate name (excluding current silo)
    const existing = await prisma.storageLocation.findFirst({
        where: {
            name,
            id: { not: id }
        }
    })
    if (existing) {
        throw new Error(`A storage location with name "${name}" already exists`)
    }

    await prisma.storageLocation.update({
        where: { id },
        data: {
            name,
            description,
            capacity,
            isActive
        }
    })

    revalidatePath('/inventory')
    return { success: true }
}

// Delete silo (only if empty)
export async function deleteSilo(id: string) {
    const silo = await prisma.storageLocation.findUnique({
        where: { id },
        include: {
            items: true,
            productionRuns: true
        }
    })

    if (!silo) {
        throw new Error('Silo not found')
    }

    if (silo.type !== 'Silo') {
        throw new Error('This is not a silo')
    }

    // Check if silo has items with quantity > 0
    const hasStock = silo.items.some(item => item.quantity > 0)
    if (hasStock) {
        throw new Error('Cannot delete silo with remaining stock. Please empty the silo first.')
    }

    // Check if silo has production history
    if (silo.productionRuns.length > 0) {
        // Just deactivate instead of deleting to preserve history
        await prisma.storageLocation.update({
            where: { id },
            data: { isActive: false }
        })
        revalidatePath('/inventory')
        return { success: true, message: 'Silo deactivated (has production history)' }
    }

    // Delete associated items first (they should be empty)
    await prisma.inventoryItem.deleteMany({
        where: { locationId: id }
    })

    // Delete the silo
    await prisma.storageLocation.delete({
        where: { id }
    })

    revalidatePath('/inventory')
    return { success: true, message: 'Silo deleted successfully' }
}

// Add cement to a silo (creates or updates cement item)
export async function addCementToSilo(formData: FormData) {
    const siloId = formData.get('siloId') as string
    const cementName = formData.get('cementName') as string
    const quantity = parseFloat(formData.get('quantity') as string)
    const maxCapacity = parseFloat(formData.get('maxCapacity') as string) || 80000
    const minThreshold = parseFloat(formData.get('minThreshold') as string) || 15000
    const unitCost = parseFloat(formData.get('unitCost') as string) || 0.15
    const supplier = formData.get('supplier') as string

    if (!siloId || !cementName || isNaN(quantity)) {
        throw new Error('Silo, cement name, and quantity are required')
    }

    const silo = await prisma.storageLocation.findUnique({
        where: { id: siloId },
        include: { items: { where: { itemType: 'Cement' } } }
    })

    if (!silo || silo.type !== 'Silo') {
        throw new Error('Invalid silo selected')
    }

    // Check if silo already has cement
    const existingCement = silo.items[0]

    if (existingCement) {
        // Update existing cement quantity (stock in)
        await prisma.$transaction(async (tx) => {
            await tx.inventoryItem.update({
                where: { id: existingCement.id },
                data: {
                    quantity: { increment: quantity },
                    totalValue: (existingCement.quantity + quantity) * existingCement.unitCost
                }
            })

            await tx.stockTransaction.create({
                data: {
                    itemId: existingCement.id,
                    type: 'IN',
                    quantity,
                    reason: `Cement delivery to ${silo.name}`,
                    status: 'Approved',
                    performedBy: 'Storekeeper',
                    approvedBy: 'System',
                    approvedAt: new Date()
                }
            })
        })
    } else {
        // Create new cement item in silo
        const sku = `CEM-${Date.now().toString(36).toUpperCase()}`
        await prisma.inventoryItem.create({
            data: {
                name: cementName,
                sku,
                category: 'Raw Material',
                itemType: 'Cement',
                quantity,
                maxCapacity,
                unit: 'kg',
                minThreshold,
                unitCost,
                totalValue: quantity * unitCost,
                supplier,
                locationId: siloId
            }
        })
    }

    revalidatePath('/inventory')
    revalidatePath('/production')
    return { success: true }
}

// Create general storage location (warehouse, shelf, etc.)
export async function createStorageLocation(formData: FormData) {
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const description = formData.get('description') as string

    if (!name || !type) {
        throw new Error('Name and type are required')
    }

    // Check for duplicate name
    const existing = await prisma.storageLocation.findUnique({
        where: { name }
    })
    if (existing) {
        throw new Error(`A storage location with name "${name}" already exists`)
    }

    const location = await prisma.storageLocation.create({
        data: {
            name,
            type,
            description,
            isActive: true
        }
    })

    revalidatePath('/inventory')
    return { success: true, location }
}


// ==================== SEEDING ====================

export async function seedInitialInventory() {
    const count = await prisma.storageLocation.count()
    if (count === 0) {
        // Create Storage Locations
        const silo1 = await prisma.storageLocation.create({
            data: { name: 'Silo 1', type: 'Silo', description: 'Primary Cement Storage - 42.5 Grade', capacity: 80000, isActive: true }
        })
        const silo2 = await prisma.storageLocation.create({
            data: { name: 'Silo 2', type: 'Silo', description: 'Secondary Cement Storage - 52.5 Grade', capacity: 80000, isActive: true }
        })
        const warehouse = await prisma.storageLocation.create({
            data: { name: 'Main Warehouse', type: 'Warehouse', description: 'General Storage for Aggregates & Additives', isActive: true }
        })
        const chemRoom = await prisma.storageLocation.create({
            data: { name: 'Chemical Storage', type: 'Shelf', description: 'Temperature Controlled Admixture Storage', isActive: true }
        })

        // Create Silo Items with proper tracking
        await prisma.inventoryItem.create({
            data: {
                name: 'Portland Cement (Grade 42.5)',
                sku: 'CEM-42-001',
                category: 'Raw Material',
                itemType: 'Cement',
                quantity: 45000,
                maxCapacity: 80000,
                unit: 'kg',
                minThreshold: 15000,
                unitCost: 0.15,
                totalValue: 45000 * 0.15,
                supplier: 'Dangote Cement Ltd',
                locationId: silo1.id
            }
        })

        await prisma.inventoryItem.create({
            data: {
                name: 'Portland Cement (Grade 52.5)',
                sku: 'CEM-52-001',
                category: 'Raw Material',
                itemType: 'Cement',
                quantity: 32000,
                maxCapacity: 80000,
                unit: 'kg',
                minThreshold: 15000,
                unitCost: 0.18,
                totalValue: 32000 * 0.18,
                supplier: 'BUA Cement',
                locationId: silo2.id
            }
        })

        // Create Aggregate Items
        await prisma.inventoryItem.create({
            data: {
                name: 'Coarse Aggregate (20mm)',
                sku: 'AGG-20-001',
                category: 'Raw Material',
                itemType: 'Aggregate',
                quantity: 85000,
                maxCapacity: 150000,
                unit: 'kg',
                minThreshold: 25000,
                unitCost: 0.05,
                totalValue: 85000 * 0.05,
                supplier: 'Local Quarry',
                locationId: warehouse.id
            }
        })

        await prisma.inventoryItem.create({
            data: {
                name: 'Fine Sand',
                sku: 'SND-001',
                category: 'Raw Material',
                itemType: 'Aggregate',
                quantity: 65000,
                maxCapacity: 120000,
                unit: 'kg',
                minThreshold: 20000,
                unitCost: 0.03,
                totalValue: 65000 * 0.03,
                supplier: 'River Sand Suppliers',
                locationId: warehouse.id
            }
        })

        // Create Consumable Items with Expiry Dates
        await prisma.inventoryItem.create({
            data: {
                name: 'Sika ViscoCrete 5920',
                sku: 'ADM-VC-001',
                category: 'Consumable',
                itemType: 'Admixture',
                quantity: 450,
                unit: 'liters',
                minThreshold: 100,
                unitCost: 8.50,
                totalValue: 450 * 8.50,
                expiryDate: new Date('2025-06-15'),
                batchNumber: 'VC-2024-B127',
                supplier: 'Sika Nigeria',
                locationId: chemRoom.id
            }
        })

        await prisma.inventoryItem.create({
            data: {
                name: 'Plasticizer Additive',
                sku: 'ADM-PL-001',
                category: 'Consumable',
                itemType: 'Admixture',
                quantity: 180,
                unit: 'liters',
                minThreshold: 50,
                unitCost: 12.00,
                totalValue: 180 * 12.00,
                expiryDate: new Date('2025-03-30'),
                batchNumber: 'PL-2024-A089',
                supplier: 'BASF Chemicals',
                locationId: chemRoom.id
            }
        })

        await prisma.inventoryItem.create({
            data: {
                name: 'Set Retarder',
                sku: 'ADM-SR-001',
                category: 'Consumable',
                itemType: 'Admixture',
                quantity: 75,
                unit: 'liters',
                minThreshold: 30,
                unitCost: 15.00,
                totalValue: 75 * 15.00,
                expiryDate: new Date('2024-12-20'),
                batchNumber: 'SR-2024-C045',
                supplier: 'BASF Chemicals',
                locationId: chemRoom.id
            }
        })

        // Create Equipment Items
        await prisma.inventoryItem.create({
            data: {
                name: 'Concrete Test Cylinders',
                sku: 'EQP-TC-001',
                category: 'Equipment',
                itemType: 'General',
                quantity: 150,
                unit: 'pcs',
                minThreshold: 50,
                unitCost: 5.00,
                totalValue: 150 * 5.00,
                supplier: 'QA Supplies Ltd',
                locationId: warehouse.id
            }
        })

        await prisma.inventoryItem.create({
            data: {
                name: 'Heavy Duty Tarpaulin',
                sku: 'EQP-TRP-001',
                category: 'Equipment',
                itemType: 'General',
                quantity: 25,
                unit: 'pcs',
                minThreshold: 10,
                unitCost: 75.00,
                totalValue: 25 * 75.00,
                supplier: 'Industrial Supplies',
                locationId: warehouse.id
            }
        })
    }
}

export async function getTransactionHistory(itemId?: string) {
    return await prisma.stockTransaction.findMany({
        where: itemId ? { itemId } : undefined,
        include: {
            item: {
                include: { location: true }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
    })
}
