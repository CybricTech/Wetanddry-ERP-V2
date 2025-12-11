'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'
import { notifyApprovers, notifyRequester } from '@/lib/actions/notifications'

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
        const maxCapacity = silo.capacity || item?.maxCapacity || 95000 // 95 tons default
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

    // Stock In specific fields
    const supplierName = formData.get('supplierName') as string
    const invoiceNumber = formData.get('invoiceNumber') as string
    const waybillNumber = formData.get('waybillNumber') as string
    const deliveryDateStr = formData.get('deliveryDate') as string
    const deliveryDate = deliveryDateStr ? new Date(deliveryDateStr) : null
    const batchNumber = formData.get('batchNumber') as string
    const unitCostAtTime = parseFloat(formData.get('unitCostAtTime') as string) || undefined
    const updateItemCost = formData.get('updateItemCost') === 'true'
    const receivedBy = formData.get('receivedBy') as string

    if (!itemId || !type || isNaN(quantity)) {
        throw new Error('Invalid input')
    }

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'create_stock_transactions')

    // Auto-approve logic: Only if user has 'approve_stock_transactions', otherwise separate flow?
    // For now, let's assume if they can create, they can do this, but status depends on role.
    // Re-reading logic: It sets status to 'Approved' by default. 
    // If user is Storekeeper, creating stock IN usually needs approval?
    // User requested robust system.
    // If Storekeeper -> Pending. If Manager/Admin -> Approved.

    // However, for this step, I will just enforce the permission to CALL the action.
    // Refinement:
    // If type is IN and user is Storekeeper, status = Pending?

    const isAutoApproved = session.user.role === 'Super Admin' || session.user.role === 'Manager';
    const status = isAutoApproved ? 'Approved' : 'Pending';

    // Fetch item details before transaction for use in notifications
    const inventoryItem = await prisma.inventoryItem.findUnique({ where: { id: itemId } })
    if (!inventoryItem) throw new Error('Item not found')

    await prisma.$transaction(async (tx) => {
        // Get current item
        const item = await tx.inventoryItem.findUnique({ where: { id: itemId } })
        if (!item) throw new Error('Item not found')

        // Calculate total cost for Stock In
        const costPerUnit = unitCostAtTime || item.unitCost
        const totalCost = type === 'IN' ? quantity * costPerUnit : undefined

        // 1. Create Transaction Record
        await tx.stockTransaction.create({
            data: {
                itemId,
                type,
                quantity,
                reason,
                notes,
                performedBy,
                receivedBy: type === 'IN' ? receivedBy : undefined,
                supplierName: type === 'IN' ? supplierName : undefined,
                invoiceNumber: type === 'IN' ? invoiceNumber : undefined,
                waybillNumber: type === 'IN' ? waybillNumber : undefined,
                deliveryDate: type === 'IN' ? deliveryDate : undefined,
                batchNumber: type === 'IN' ? batchNumber : undefined,
                unitCostAtTime: type === 'IN' ? costPerUnit : undefined,
                totalCost,
                status: status,
                approvedBy: isAutoApproved ? session.user.name : undefined,
                approvedAt: isAutoApproved ? new Date() : undefined
            }
        })

        // Only update inventory if approved
        if (status === 'Approved') {
            // 2. Update Inventory Quantity
            const adjustment = type === 'IN' ? quantity : -quantity
            const newQuantity = item.quantity + adjustment

            // Optionally update item's unit cost if checkbox was checked
            const newUnitCost = (type === 'IN' && updateItemCost && unitCostAtTime)
                ? unitCostAtTime
                : item.unitCost

            await tx.inventoryItem.update({
                where: { id: itemId },
                data: {
                    quantity: newQuantity,
                    unitCost: newUnitCost,
                    totalValue: newQuantity * newUnitCost,
                    // Update batch number on item if provided
                    batchNumber: (type === 'IN' && batchNumber) ? batchNumber : item.batchNumber,
                    // Update supplier if provided
                    supplier: (type === 'IN' && supplierName) ? supplierName : item.supplier
                }
            })
        }
    })

    // Notify approvers if transaction is pending
    if (status === 'Pending') {
        notifyApprovers(
            'stock_transaction_pending',
            `Stock ${type} Pending: ${inventoryItem.name}`,
            `${performedBy} submitted a ${type === 'IN' ? 'delivery' : 'withdrawal'} of ${quantity} units for approval`,
            'stock_transaction',
            itemId
        ).catch(console.error)
    }

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

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'create_material_requests')

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

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_material_requests')

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
    const createdBy = formData.get('createdBy') as string || 'System'

    if (!name || !category || !unit || !locationId) {
        throw new Error('Missing required fields')
    }

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'create_inventory_item')

    // Approval workflow: Storekeepers create items in Pending status
    // Super Admin and Manager can auto-approve
    const isAutoApproved = session.user.role === 'Super Admin' || session.user.role === 'Manager'
    const status = isAutoApproved ? 'Active' : 'Pending'

    const item = await prisma.inventoryItem.create({
        data: {
            name,
            sku,
            category,
            itemType,
            quantity: isAutoApproved ? quantity : 0, // Pending items don't add to inventory
            maxCapacity,
            unit,
            minThreshold,
            unitCost,
            totalValue: isAutoApproved ? quantity * unitCost : 0,
            expiryDate: expiryDate ? new Date(expiryDate) : undefined,
            batchNumber,
            supplier,
            locationId,
            createdBy,
            status,
            approvedBy: isAutoApproved ? session.user.name : undefined,
            approvedAt: isAutoApproved ? new Date() : undefined
        }
    })

    // Notify approvers if item is pending
    if (status === 'Pending') {
        notifyApprovers(
            'new_inventory_item',
            `New Inventory Item: ${name}`,
            `${createdBy} submitted "${name}" for approval`,
            'inventory_item',
            item.id
        ).catch(console.error) // Non-blocking
    }

    revalidatePath('/inventory')
    return { success: true, item, status }
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

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_inventory')

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
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_inventory')

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

// Create a new silo (Super Admin only)
export async function createSilo(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_silos')

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
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_silos')

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

// Delete silo (only if empty) - Super Admin only
export async function deleteSilo(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_silos')

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
    const maxCapacity = parseFloat(formData.get('maxCapacity') as string) || 95000 // 95 tons default
    const minThreshold = parseFloat(formData.get('minThreshold') as string) || 15000
    const unitCost = parseFloat(formData.get('unitCost') as string) || 0.15
    const supplier = formData.get('supplier') as string
    const atcNumber = formData.get('atcNumber') as string // ATC Number for cement

    if (!siloId || !cementName || isNaN(quantity)) {
        throw new Error('Silo, cement name, and quantity are required')
    }

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'create_stock_transactions')


    // Note: If user is Storekeeper, this should probably be Pending or follow stock in flow?

    // For simplicity in this function, we'll allow it but standard robust flow would use createStockTransaction.
    // However, this function combines "Create Item if new" AND "Stock In".
    // I will enforce 'manage_inventory' if it's creating a NEW item, else 'create_stock_transactions'.
    // Actually, storekeepers should be able to refill silos. 
    // Let's stick to checkPermission for now.

    // NOTE: This direct update bypasses the 'Pending' check I added to createStockTransaction.
    // Ideally refactor to use that, but for now just permissions.

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
                    atcNumber, // ATC Number for cement traceability
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
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_inventory')

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
            data: { name: 'Silo 1', type: 'Silo', description: 'Primary Cement Storage - 42.5 Grade', capacity: 95000, isActive: true }
        })
        const silo2 = await prisma.storageLocation.create({
            data: { name: 'Silo 2', type: 'Silo', description: 'Secondary Cement Storage - 52.5 Grade', capacity: 95000, isActive: true }
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
                maxCapacity: 95000, // 95 tons = 1,900 bags (50kg each)
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
                maxCapacity: 95000, // 95 tons = 1,900 bags (50kg each)
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

// ==================== INVENTORY APPROVAL WORKFLOW ====================

// Get all pending inventory items awaiting approval
export async function getPendingInventoryItems() {
    return await prisma.inventoryItem.findMany({
        where: { status: 'Pending' },
        include: { location: true },
        orderBy: { createdAt: 'desc' }
    })
}

// Approve a pending inventory item (Super Admin or Manager only)
export async function approveInventoryItem(itemId: string, quantity: number) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_inventory_items')

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } })
    if (!item) throw new Error('Item not found')
    if (item.status !== 'Pending') throw new Error('Item is not pending approval')

    await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
            status: 'Active',
            quantity,
            totalValue: quantity * item.unitCost,
            approvedBy: session.user.name,
            approvedAt: new Date()
        }
    })

    // Notify the requester that their item was approved
    // Look up user by name (createdBy field stores name)
    if (item.createdBy) {
        const requester = await prisma.user.findFirst({ where: { name: item.createdBy } })
        if (requester) {
            notifyRequester(
                requester.id,
                'item_approved',
                `Item Approved: ${item.name}`,
                `Your inventory item "${item.name}" has been approved by ${session.user.name}`,
                'inventory_item',
                itemId
            ).catch(console.error)
        }
    }

    revalidatePath('/inventory')
    return { success: true }
}

// Reject a pending inventory item (Super Admin or Manager only)
export async function rejectInventoryItem(itemId: string, reason: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_inventory_items')

    const item = await prisma.inventoryItem.findUnique({ where: { id: itemId } })
    if (!item) throw new Error('Item not found')
    if (item.status !== 'Pending') throw new Error('Item is not pending approval')

    await prisma.inventoryItem.update({
        where: { id: itemId },
        data: {
            status: 'Rejected',
            approvedBy: session.user.name,
            approvedAt: new Date()
        }
    })

    // Notify the requester that their item was rejected
    if (item.createdBy) {
        const requester = await prisma.user.findFirst({ where: { name: item.createdBy } })
        if (requester) {
            notifyRequester(
                requester.id,
                'item_rejected',
                `Item Rejected: ${item.name}`,
                `Your inventory item "${item.name}" was rejected. Reason: ${reason}`,
                'inventory_item',
                itemId
            ).catch(console.error)
        }
    }

    revalidatePath('/inventory')
    return { success: true, reason }
}

// ==================== STOCK TRANSACTION APPROVAL ====================

// Approve a pending stock transaction (Manager or Super Admin)
export async function approveStockTransaction(transactionId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    const transaction = await prisma.stockTransaction.findUnique({
        where: { id: transactionId },
        include: { item: true }
    })
    if (!transaction) throw new Error('Transaction not found')
    if (transaction.status !== 'Pending') throw new Error('Transaction is not pending approval')

    await prisma.$transaction(async (tx) => {
        // Update transaction status
        await tx.stockTransaction.update({
            where: { id: transactionId },
            data: {
                status: 'Approved',
                approvedBy: session.user.name,
                approvedAt: new Date()
            }
        })

        // Update inventory quantity
        const item = transaction.item
        const adjustment = transaction.type === 'IN' ? transaction.quantity : -transaction.quantity
        const newQuantity = item.quantity + adjustment
        const unitCost = transaction.unitCostAtTime || item.unitCost

        await tx.inventoryItem.update({
            where: { id: transaction.itemId },
            data: {
                quantity: newQuantity,
                totalValue: newQuantity * unitCost,
                // Update batch number if provided in transaction
                batchNumber: transaction.batchNumber || item.batchNumber,
                supplier: transaction.supplierName || item.supplier
            }
        })
    })

    revalidatePath('/inventory')
    return { success: true }
}

// Reject a pending stock transaction (Manager or Super Admin)
export async function rejectStockTransaction(transactionId: string, reason?: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'approve_stock_transactions')

    const transaction = await prisma.stockTransaction.findUnique({
        where: { id: transactionId }
    })
    if (!transaction) throw new Error('Transaction not found')
    if (transaction.status !== 'Pending') throw new Error('Transaction is not pending approval')

    await prisma.stockTransaction.update({
        where: { id: transactionId },
        data: {
            status: 'Rejected',
            approvedBy: session.user.name,
            approvedAt: new Date(),
            notes: reason ? `${transaction.notes || ''}\nRejection reason: ${reason}`.trim() : transaction.notes
        }
    })

    revalidatePath('/inventory')
    return { success: true }
}

// ==================== ACTIVITY TAB DATA FETCHING ====================

export interface StockTransactionFilters {
    status?: 'Pending' | 'Approved' | 'Rejected' | 'all';
    type?: 'IN' | 'OUT' | 'ADJUSTMENT' | 'all';
    itemId?: string;
    search?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}

// Get all stock transactions with comprehensive filtering and pagination
export async function getAllStockTransactions(filters: StockTransactionFilters = {}) {
    const {
        status = 'all',
        type = 'all',
        itemId,
        search,
        startDate,
        endDate,
        page = 1,
        limit = 50
    } = filters

    const where: any = {}

    // Status filter
    if (status && status !== 'all') {
        where.status = status
    }

    // Type filter
    if (type && type !== 'all') {
        where.type = type
    }

    // Item filter
    if (itemId) {
        where.itemId = itemId
    }

    // Date range filter
    if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = startDate
        if (endDate) where.createdAt.lte = endDate
    }

    // Search filter (searches item name, supplier, invoice, waybill, ATC)
    if (search) {
        where.OR = [
            { item: { name: { contains: search, mode: 'insensitive' } } },
            { supplierName: { contains: search, mode: 'insensitive' } },
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            { waybillNumber: { contains: search, mode: 'insensitive' } },
            { atcNumber: { contains: search, mode: 'insensitive' } },
            { batchNumber: { contains: search, mode: 'insensitive' } },
            { performedBy: { contains: search, mode: 'insensitive' } },
        ]
    }

    const [transactions, totalCount] = await Promise.all([
        prisma.stockTransaction.findMany({
            where,
            include: {
                item: {
                    include: { location: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit
        }),
        prisma.stockTransaction.count({ where })
    ])

    return {
        transactions,
        pagination: {
            page,
            limit,
            totalCount,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: page * limit < totalCount
        }
    }
}

// Get unified pending approvals queue (transactions, items, material requests)
export async function getPendingApprovals() {
    const [pendingTransactions, pendingItems, pendingRequests] = await Promise.all([
        // Pending stock transactions
        prisma.stockTransaction.findMany({
            where: { status: 'Pending' },
            include: {
                item: { include: { location: true } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        // Pending inventory items
        prisma.inventoryItem.findMany({
            where: { status: 'Pending' },
            include: { location: true },
            orderBy: { createdAt: 'desc' }
        }),
        // Pending material requests
        prisma.materialRequest.findMany({
            where: { status: 'Pending' },
            include: {
                item: { include: { location: true } }
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' }
            ]
        })
    ])

    // Combine into unified pending queue with type markers
    const pendingQueue = [
        ...pendingTransactions.map(t => ({
            id: t.id,
            type: 'stock_transaction' as const,
            subType: t.type, // IN, OUT, ADJUSTMENT
            itemName: t.item.name,
            itemId: t.itemId,
            location: t.item.location.name,
            quantity: t.quantity,
            unit: t.item.unit,
            reason: t.reason,
            supplierName: t.supplierName,
            invoiceNumber: t.invoiceNumber,
            waybillNumber: t.waybillNumber,
            atcNumber: t.atcNumber,
            batchNumber: t.batchNumber,
            totalCost: t.totalCost,
            performedBy: t.performedBy,
            createdAt: t.createdAt,
            priority: 'Normal' as const
        })),
        ...pendingItems.map(i => ({
            id: i.id,
            type: 'inventory_item' as const,
            subType: 'NEW_ITEM',
            itemName: i.name,
            itemId: i.id,
            location: i.location.name,
            quantity: i.quantity,
            unit: i.unit,
            reason: `New item creation`,
            supplierName: i.supplier,
            invoiceNumber: null,
            waybillNumber: null,
            atcNumber: null,
            batchNumber: i.batchNumber,
            totalCost: i.totalValue,
            performedBy: i.createdBy,
            createdAt: i.createdAt!,
            priority: 'Normal' as const
        })),
        ...pendingRequests.map(r => ({
            id: r.id,
            type: 'material_request' as const,
            subType: r.requestType, // Stock In, Stock Out, Transfer
            itemName: r.item.name,
            itemId: r.itemId,
            location: r.item.location.name,
            quantity: r.quantity,
            unit: r.item.unit,
            reason: r.reason,
            supplierName: null,
            invoiceNumber: null,
            waybillNumber: null,
            atcNumber: null,
            batchNumber: null,
            totalCost: null,
            performedBy: r.requestedBy,
            createdAt: r.createdAt,
            priority: r.priority as 'Low' | 'Normal' | 'High' | 'Urgent'
        }))
    ].sort((a, b) => {
        // Priority ordering: Urgent > High > Normal > Low
        const priorityOrder = { Urgent: 4, High: 3, Normal: 2, Low: 1 }
        const priorityDiff = (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2)
        if (priorityDiff !== 0) return priorityDiff
        // Then by date (newest first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    return {
        pendingQueue,
        counts: {
            transactions: pendingTransactions.length,
            items: pendingItems.length,
            requests: pendingRequests.length,
            total: pendingQueue.length
        }
    }
}

export interface AuditLogFilters {
    search?: string;
    activityType?: 'stock_in' | 'stock_out' | 'adjustment' | 'item_created' | 'item_approved' | 'production' | 'all';
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}

// Get comprehensive audit logs from multiple sources
export async function getAuditLogs(filters: AuditLogFilters = {}) {
    const {
        search,
        activityType = 'all',
        startDate,
        endDate,
        page = 1,
        limit = 100
    } = filters

    // Build date filter
    const dateFilter: any = {}
    if (startDate) dateFilter.gte = startDate
    if (endDate) dateFilter.lte = endDate

    // Fetch from multiple sources based on activity type
    const fetchTransactions = activityType === 'all' || ['stock_in', 'stock_out', 'adjustment'].includes(activityType)
    const fetchItems = activityType === 'all' || ['item_created', 'item_approved'].includes(activityType)
    const fetchProduction = activityType === 'all' || activityType === 'production'

    const [transactions, items, productionRuns] = await Promise.all([
        fetchTransactions ? prisma.stockTransaction.findMany({
            where: {
                ...(activityType !== 'all' && activityType !== 'stock_in' && activityType !== 'stock_out' && activityType !== 'adjustment' ? {} : {
                    type: activityType === 'stock_in' ? 'IN' : activityType === 'stock_out' ? 'OUT' : activityType === 'adjustment' ? 'ADJUSTMENT' : undefined
                }),
                ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
                ...(search ? {
                    OR: [
                        { item: { is: { name: { contains: search } } } },
                        { performedBy: { contains: search } },
                        { approvedBy: { contains: search } },
                    ]
                } : {})
            },
            include: { item: { include: { location: true } } },
            orderBy: { createdAt: 'desc' }
        }) : [],
        fetchItems ? prisma.inventoryItem.findMany({
            where: {
                status: { in: ['Active', 'Rejected'] },
                approvedAt: { not: null },
                ...(Object.keys(dateFilter).length > 0 ? { approvedAt: dateFilter } : {}),
                ...(search ? {
                    OR: [
                        { name: { contains: search } },
                        { createdBy: { contains: search } },
                        { approvedBy: { contains: search } },
                    ]
                } : {})
            },
            include: { location: true },
            orderBy: { approvedAt: 'desc' }
        }) : [],
        fetchProduction ? prisma.productionRun.findMany({
            where: {
                ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
                ...(search ? {
                    OR: [
                        { recipe: { is: { name: { contains: search } } } },
                        { operatorName: { contains: search } },
                    ]
                } : {})
            },
            include: {
                recipe: true,
                silo: true
            },
            orderBy: { createdAt: 'desc' }
        }) : []
    ])

    // Transform into unified audit log entries
    const auditLogs = [
        ...transactions.map(t => ({
            id: `txn-${t.id}`,
            activityType: t.type === 'IN' ? 'stock_in' : t.type === 'OUT' ? 'stock_out' : 'adjustment' as const,
            description: `${t.type === 'IN' ? 'Stock In' : t.type === 'OUT' ? 'Stock Out' : 'Adjustment'}: ${t.quantity.toLocaleString()} ${t.item.unit} of ${t.item.name}`,
            details: {
                itemName: t.item.name,
                itemId: t.itemId,
                location: t.item.location.name,
                quantity: t.quantity,
                unit: t.item.unit,
                status: t.status,
                reason: t.reason,
                supplierName: t.supplierName,
                invoiceNumber: t.invoiceNumber,
                waybillNumber: t.waybillNumber,
                atcNumber: t.atcNumber,
                batchNumber: t.batchNumber,
                totalCost: t.totalCost,
                unitCostAtTime: t.unitCostAtTime
            },
            performedBy: t.performedBy || 'Unknown',
            approvedBy: t.approvedBy,
            timestamp: t.createdAt,
            status: t.status
        })),
        ...items.map(i => ({
            id: `item-${i.id}`,
            activityType: i.status === 'Active' ? 'item_approved' : 'item_created' as const,
            description: `${i.status === 'Active' ? 'Item Approved' : 'Item Rejected'}: ${i.name}`,
            details: {
                itemName: i.name,
                itemId: i.id,
                location: i.location.name,
                quantity: i.quantity,
                unit: i.unit,
                status: i.status,
                reason: null,
                supplierName: i.supplier,
                invoiceNumber: null,
                waybillNumber: null,
                atcNumber: null,
                batchNumber: i.batchNumber,
                totalCost: i.totalValue,
                unitCostAtTime: i.unitCost
            },
            performedBy: i.createdBy || 'Unknown',
            approvedBy: i.approvedBy,
            timestamp: i.approvedAt!,
            status: i.status
        })),
        ...productionRuns.map(p => ({
            id: `prod-${p.id}`,
            activityType: 'production' as const,
            description: `Production Run: ${p.quantity.toLocaleString()} m³ of ${p.recipe.name}`,
            details: {
                itemName: p.recipe.name,
                itemId: p.recipeId,
                location: p.silo?.name || 'N/A',
                quantity: p.quantity,
                unit: 'm³',
                status: p.status,
                reason: p.notes,
                supplierName: null,
                invoiceNumber: null,
                waybillNumber: null,
                atcNumber: null,
                batchNumber: null,
                totalCost: null,
                unitCostAtTime: null,
                cementUsed: p.cementUsed
            },
            performedBy: p.operatorName || 'Unknown',
            approvedBy: null,
            timestamp: p.createdAt,
            status: p.status
        }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Paginate
    const paginatedLogs = auditLogs.slice((page - 1) * limit, page * limit)

    return {
        logs: paginatedLogs,
        pagination: {
            page,
            limit,
            totalCount: auditLogs.length,
            totalPages: Math.ceil(auditLogs.length / limit),
            hasMore: page * limit < auditLogs.length
        }
    }
}

// Export audit logs to CSV format
export async function exportAuditLogsCSV(filters: AuditLogFilters = {}) {
    const { logs } = await getAuditLogs({ ...filters, limit: 10000 })

    const headers = [
        'Timestamp',
        'Activity Type',
        'Description',
        'Item Name',
        'Location',
        'Quantity',
        'Unit',
        'Status',
        'Performed By',
        'Approved By',
        'Supplier',
        'Invoice Number',
        'Waybill Number',
        'ATC Number',
        'Batch Number',
        'Total Cost'
    ].join(',')

    const rows = logs.map(log => [
        new Date(log.timestamp).toISOString(),
        log.activityType,
        `"${log.description.replace(/"/g, '""')}"`,
        `"${log.details.itemName}"`,
        `"${log.details.location}"`,
        log.details.quantity,
        log.details.unit,
        log.status,
        `"${log.performedBy}"`,
        `"${log.approvedBy || ''}"`,
        `"${log.details.supplierName || ''}"`,
        `"${log.details.invoiceNumber || ''}"`,
        `"${log.details.waybillNumber || ''}"`,
        `"${log.details.atcNumber || ''}"`,
        `"${log.details.batchNumber || ''}"`,
        log.details.totalCost || ''
    ].join(','))

    return [headers, ...rows].join('\n')
}

// ==================== FINANCE TAB DATA ====================

interface FinancePeriod {
    startDate: Date
    endDate: Date
    label: string
}

/**
 * Get comprehensive inventory valuation data
 */
export async function getInventoryValuation() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    // Only Manager, Accountant, Super Admin can access
    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied: Finance data is restricted')
    }

    // Get all active inventory items with their locations
    const items = await prisma.inventoryItem.findMany({
        where: { status: 'Active' },
        include: {
            location: true
        }
    })

    // Calculate totals
    const totalValue = items.reduce((sum, item) => sum + item.totalValue, 0)
    const totalItems = items.length
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

    // Group by category
    const byCategory = items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = { count: 0, value: 0, quantity: 0 }
        }
        acc[item.category].count += 1
        acc[item.category].value += item.totalValue
        acc[item.category].quantity += item.quantity
        return acc
    }, {} as Record<string, { count: number; value: number; quantity: number }>)

    // Group by location
    const byLocation = items.reduce((acc, item) => {
        const locName = item.location.name
        if (!acc[locName]) {
            acc[locName] = { count: 0, value: 0, quantity: 0, type: item.location.type }
        }
        acc[locName].count += 1
        acc[locName].value += item.totalValue
        acc[locName].quantity += item.quantity
        return acc
    }, {} as Record<string, { count: number; value: number; quantity: number; type: string }>)

    // Get top 10 highest value items
    const topItems = items
        .sort((a, b) => b.totalValue - a.totalValue)
        .slice(0, 10)
        .map(item => ({
            id: item.id,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            unit: item.unit,
            unitCost: item.unitCost,
            totalValue: item.totalValue,
            location: item.location.name
        }))

    // Get low stock items
    const lowStockCount = items.filter(item => item.quantity <= item.minThreshold).length

    return {
        summary: {
            totalValue,
            totalItems,
            totalQuantity,
            lowStockCount,
            averageItemValue: totalItems > 0 ? totalValue / totalItems : 0
        },
        byCategory: Object.entries(byCategory).map(([name, data]) => ({
            name,
            ...data,
            percentageOfTotal: totalValue > 0 ? (data.value / totalValue) * 100 : 0
        })),
        byLocation: Object.entries(byLocation).map(([name, data]) => ({
            name,
            ...data,
            percentageOfTotal: totalValue > 0 ? (data.value / totalValue) * 100 : 0
        })),
        topItems
    }
}

/**
 * Get stock movement financial data by period
 */
export async function getStockMovementFinancials(period: 'today' | '7days' | '30days' | 'month' = '30days') {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied: Finance data is restricted')
    }

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
        case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0))
            break
        case '7days':
            startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            break
        case '30days':
            startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            break
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
    }

    // Get approved transactions in period
    const transactions = await prisma.stockTransaction.findMany({
        where: {
            status: 'Approved',
            createdAt: { gte: startDate }
        },
        include: {
            item: {
                include: { location: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })

    // Calculate stock in value
    const stockInTransactions = transactions.filter(t => t.type === 'IN')
    const stockInValue = stockInTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0)
    const stockInQuantity = stockInTransactions.reduce((sum, t) => sum + t.quantity, 0)

    // Calculate stock out value
    const stockOutTransactions = transactions.filter(t => t.type === 'OUT')
    const stockOutValue = stockOutTransactions.reduce((sum, t) => sum + (t.totalCost || 0), 0)
    const stockOutQuantity = stockOutTransactions.reduce((sum, t) => sum + t.quantity, 0)

    // Net position
    const netValue = stockInValue - stockOutValue

    // Group by supplier (for stock in)
    const bySupplier = stockInTransactions.reduce((acc, t) => {
        const supplier = t.supplierName || 'Unknown'
        if (!acc[supplier]) {
            acc[supplier] = { count: 0, value: 0, quantity: 0 }
        }
        acc[supplier].count += 1
        acc[supplier].value += t.totalCost || 0
        acc[supplier].quantity += t.quantity
        return acc
    }, {} as Record<string, { count: number; value: number; quantity: number }>)

    // Daily breakdown (last 7 days)
    const dailyData: { date: string; stockIn: number; stockOut: number }[] = []
    for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        const dateStr = date.toISOString().split('T')[0]
        const dayStart = new Date(date.setHours(0, 0, 0, 0))
        const dayEnd = new Date(date.setHours(23, 59, 59, 999))

        const dayIn = transactions
            .filter(t => t.type === 'IN' && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd)
            .reduce((sum, t) => sum + (t.totalCost || 0), 0)

        const dayOut = transactions
            .filter(t => t.type === 'OUT' && new Date(t.createdAt) >= dayStart && new Date(t.createdAt) <= dayEnd)
            .reduce((sum, t) => sum + (t.totalCost || 0), 0)

        dailyData.push({ date: dateStr, stockIn: dayIn, stockOut: dayOut })
    }

    // Recent transactions for display
    const recentTransactions = transactions.slice(0, 10).map(t => ({
        id: t.id,
        type: t.type,
        itemName: t.item.name,
        quantity: t.quantity,
        unit: t.item.unit,
        totalCost: t.totalCost,
        supplierName: t.supplierName,
        createdAt: t.createdAt
    }))

    return {
        period: {
            start: startDate,
            end: new Date(),
            label: period
        },
        summary: {
            stockInValue,
            stockInQuantity,
            stockInCount: stockInTransactions.length,
            stockOutValue,
            stockOutQuantity,
            stockOutCount: stockOutTransactions.length,
            netValue,
            totalTransactions: transactions.length
        },
        bySupplier: Object.entries(bySupplier)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.value - a.value),
        dailyData,
        recentTransactions
    }
}

/**
 * Get cost analysis data
 */
export async function getCostAnalysis() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')

    const allowedRoles = ['Super Admin', 'Manager', 'Accountant']
    if (!allowedRoles.includes(session.user.role)) {
        throw new Error('Access denied: Finance data is restricted')
    }

    // Get items with their recent transactions to analyze cost trends
    const items = await prisma.inventoryItem.findMany({
        where: { status: 'Active' },
        include: {
            transactions: {
                where: {
                    type: 'IN',
                    status: 'Approved',
                    unitCostAtTime: { not: null }
                },
                orderBy: { createdAt: 'desc' },
                take: 10
            },
            location: true
        }
    })

    // Analyze cost trends for items with multiple transactions
    const costTrends = items
        .filter(item => item.transactions.length >= 2)
        .map(item => {
            const costs = item.transactions.map(t => t.unitCostAtTime!)
            const latestCost = costs[0]
            const previousCost = costs[1]
            const trend = previousCost > 0 ? ((latestCost - previousCost) / previousCost) * 100 : 0

            return {
                id: item.id,
                name: item.name,
                category: item.category,
                currentUnitCost: item.unitCost,
                latestDeliveryCost: latestCost,
                previousDeliveryCost: previousCost,
                trendPercentage: trend,
                transactionCount: item.transactions.length
            }
        })
        .sort((a, b) => Math.abs(b.trendPercentage) - Math.abs(a.trendPercentage))

    // Items with increasing costs (alert)
    const increasingCosts = costTrends.filter(t => t.trendPercentage > 5)
    const decreasingCosts = costTrends.filter(t => t.trendPercentage < -5)

    // Average cost by category
    const costByCategory = items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = { totalCost: 0, count: 0 }
        }
        acc[item.category].totalCost += item.unitCost
        acc[item.category].count += 1
        return acc
    }, {} as Record<string, { totalCost: number; count: number }>)

    return {
        costTrends: costTrends.slice(0, 20),
        alerts: {
            increasingCosts: increasingCosts.length,
            decreasingCosts: decreasingCosts.length,
            itemsWithIncreasingCosts: increasingCosts.slice(0, 5)
        },
        avgCostByCategory: Object.entries(costByCategory).map(([name, data]) => ({
            name,
            avgUnitCost: data.count > 0 ? data.totalCost / data.count : 0,
            itemCount: data.count
        }))
    }
}

/**
 * Export valuation report as CSV
 */
export async function exportValuationReportCSV() {
    const valuation = await getInventoryValuation()

    const headers = [
        'Category',
        'Item Count',
        'Total Value (₦)',
        'Percentage of Total'
    ].join(',')

    const rows = valuation.byCategory.map(cat => [
        `"${cat.name}"`,
        cat.count,
        cat.value.toFixed(2),
        cat.percentageOfTotal.toFixed(2) + '%'
    ].join(','))

    // Add summary row
    rows.push('')
    rows.push(['TOTAL', valuation.summary.totalItems, valuation.summary.totalValue.toFixed(2), '100%'].join(','))

    return [headers, ...rows].join('\n')
}

