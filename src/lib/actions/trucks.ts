'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'

// ============ TRUCK CRUD OPERATIONS ============

export async function createTruck(formData: FormData) {
    const plateNumber = formData.get('plateNumber') as string
    const model = formData.get('model') as string
    const capacity = formData.get('capacity') as string
    const purchaseDate = formData.get('purchaseDate') as string
    const mileage = formData.get('mileage') as string
    const status = formData.get('status') as string

    if (!plateNumber || !model || !capacity || !purchaseDate) {
        throw new Error('Missing required fields')
    }

    await prisma.truck.create({
        data: {
            plateNumber,
            model,
            capacity,
            purchaseDate: new Date(purchaseDate),
            mileage: parseInt(mileage) || 0,
            status: status || 'Available',
        },
    })

    revalidatePath('/trucks')
    redirect('/trucks')
}

export async function getTrucks() {
    return await prisma.truck.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
            maintenanceSchedules: {
                where: { isActive: true }
            },
            parts: {
                where: { status: 'Active' }
            }
        }
    })
}

export async function getTruck(id: string) {
    return await prisma.truck.findUnique({
        where: { id },
        include: {
            maintenanceRecords: {
                orderBy: { date: 'desc' },
            },
            maintenanceSchedules: {
                orderBy: { nextDueDate: 'asc' },
            },
            parts: {
                orderBy: { installedDate: 'desc' },
            },
            fuelLogs: {
                orderBy: { date: 'desc' },
                take: 10
            }
        },
    })
}

export async function updateTruck(id: string, formData: FormData) {
    const plateNumber = formData.get('plateNumber') as string
    const model = formData.get('model') as string
    const capacity = formData.get('capacity') as string
    const purchaseDate = formData.get('purchaseDate') as string
    const mileage = formData.get('mileage') as string
    const status = formData.get('status') as string

    await prisma.truck.update({
        where: { id },
        data: {
            plateNumber,
            model,
            capacity,
            purchaseDate: new Date(purchaseDate),
            mileage: parseInt(mileage) || 0,
            status,
        },
    })

    revalidatePath('/trucks')
    revalidatePath(`/trucks/${id}`)
    redirect(`/trucks/${id}`)
}

export async function deleteTruck(id: string) {
    await prisma.truck.delete({
        where: { id },
    })

    revalidatePath('/trucks')
    redirect('/trucks')
}

export async function updateTruckMileage(id: string, mileage: number) {
    await prisma.truck.update({
        where: { id },
        data: { mileage },
    })
    revalidatePath(`/trucks/${id}`)
    revalidatePath('/trucks')
}

// ============ MAINTENANCE RECORDS ============

export async function createMaintenanceRecord(formData: FormData) {
    const truckId = formData.get('truckId') as string
    const type = formData.get('type') as string
    const date = formData.get('date') as string
    const cost = formData.get('cost') as string
    const mileageAtService = formData.get('mileageAtService') as string
    const status = formData.get('status') as string
    const notes = formData.get('notes') as string
    const performedBy = formData.get('performedBy') as string

    if (!truckId || !type || !date || !cost) {
        throw new Error('Missing required fields')
    }

    await prisma.maintenanceRecord.create({
        data: {
            truckId,
            type,
            date: new Date(date),
            cost: parseFloat(cost),
            mileageAtService: mileageAtService ? parseInt(mileageAtService) : null,
            status: status || 'Completed',
            notes: notes || null,
            performedBy: performedBy || null,
        },
    })

    // Update truck's last service date
    await prisma.truck.update({
        where: { id: truckId },
        data: { 
            lastServiceDate: new Date(date),
            mileage: mileageAtService ? parseInt(mileageAtService) : undefined
        },
    })

    revalidatePath(`/trucks/${truckId}`)
    revalidatePath('/trucks')
}

export async function getMaintenanceRecords(truckId?: string) {
    return await prisma.maintenanceRecord.findMany({
        where: truckId ? { truckId } : undefined,
        include: {
            truck: true,
        },
        orderBy: { date: 'desc' },
    })
}

// ============ MAINTENANCE SCHEDULER ============

export async function createMaintenanceSchedule(formData: FormData) {
    const truckId = formData.get('truckId') as string
    const type = formData.get('type') as string
    const intervalType = formData.get('intervalType') as string
    const intervalDays = formData.get('intervalDays') as string
    const intervalMileage = formData.get('intervalMileage') as string
    const nextDueDate = formData.get('nextDueDate') as string
    const nextDueMileage = formData.get('nextDueMileage') as string
    const priority = formData.get('priority') as string
    const notes = formData.get('notes') as string

    if (!truckId || !type || !intervalType) {
        throw new Error('Missing required fields')
    }

    await prisma.maintenanceSchedule.create({
        data: {
            truckId,
            type,
            intervalType,
            intervalDays: intervalDays ? parseInt(intervalDays) : null,
            intervalMileage: intervalMileage ? parseInt(intervalMileage) : null,
            nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
            nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : null,
            priority: priority || 'Normal',
            notes: notes || null,
            isActive: true,
        },
    })

    revalidatePath(`/trucks/${truckId}`)
    revalidatePath('/trucks')
}

export async function getMaintenanceSchedules(truckId?: string) {
    return await prisma.maintenanceSchedule.findMany({
        where: truckId ? { truckId, isActive: true } : { isActive: true },
        include: {
            truck: true,
        },
        orderBy: { nextDueDate: 'asc' },
    })
}

export async function updateMaintenanceSchedule(id: string, formData: FormData) {
    const nextDueDate = formData.get('nextDueDate') as string
    const nextDueMileage = formData.get('nextDueMileage') as string
    const isActive = formData.get('isActive') === 'true'

    await prisma.maintenanceSchedule.update({
        where: { id },
        data: {
            nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
            nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : null,
            isActive,
        },
    })

    revalidatePath('/trucks')
}

export async function completeScheduledMaintenance(scheduleId: string, formData: FormData) {
    const schedule = await prisma.maintenanceSchedule.findUnique({
        where: { id: scheduleId },
        include: { truck: true }
    })

    if (!schedule) throw new Error('Schedule not found')

    const cost = formData.get('cost') as string
    const notes = formData.get('notes') as string
    const performedBy = formData.get('performedBy') as string

    // Create maintenance record
    await prisma.maintenanceRecord.create({
        data: {
            truckId: schedule.truckId,
            type: schedule.type,
            date: new Date(),
            cost: parseFloat(cost) || 0,
            mileageAtService: schedule.truck.mileage,
            status: 'Completed',
            notes: notes || null,
            performedBy: performedBy || null,
        },
    })

    // Update schedule with next due date/mileage
    const newDueDate = schedule.intervalDays 
        ? new Date(Date.now() + schedule.intervalDays * 24 * 60 * 60 * 1000)
        : null
    const newDueMileage = schedule.intervalMileage 
        ? schedule.truck.mileage + schedule.intervalMileage
        : null

    await prisma.maintenanceSchedule.update({
        where: { id: scheduleId },
        data: {
            lastCompletedDate: new Date(),
            nextDueDate: newDueDate,
            nextDueMileage: newDueMileage,
        },
    })

    // Update truck's last service date
    await prisma.truck.update({
        where: { id: schedule.truckId },
        data: { lastServiceDate: new Date() },
    })

    revalidatePath(`/trucks/${schedule.truckId}`)
    revalidatePath('/trucks')
}

// ============ COMPONENT LIFECYCLE TRACKING (PARTS) ============

export async function createPart(formData: FormData) {
    const truckId = formData.get('truckId') as string
    const partNumber = formData.get('partNumber') as string
    const name = formData.get('name') as string
    const category = formData.get('category') as string
    const position = formData.get('position') as string
    const installedDate = formData.get('installedDate') as string
    const lifespanMonths = formData.get('lifespanMonths') as string
    const lifespanMileage = formData.get('lifespanMileage') as string
    const purchasePrice = formData.get('purchasePrice') as string
    const supplier = formData.get('supplier') as string
    const warrantyExpiry = formData.get('warrantyExpiry') as string
    const notes = formData.get('notes') as string

    if (!truckId || !partNumber || !name || !category || !installedDate || !lifespanMonths) {
        throw new Error('Missing required fields')
    }

    // Get truck's current mileage
    const truck = await prisma.truck.findUnique({ where: { id: truckId } })
    
    // Calculate expected replacement date
    const installDate = new Date(installedDate)
    const expectedReplacementDate = new Date(installDate)
    expectedReplacementDate.setMonth(expectedReplacementDate.getMonth() + parseInt(lifespanMonths))

    await prisma.part.create({
        data: {
            truckId,
            partNumber,
            name,
            category,
            position: position || null,
            installedDate: installDate,
            lifespanMonths: parseInt(lifespanMonths),
            lifespanMileage: lifespanMileage ? parseInt(lifespanMileage) : null,
            mileageAtInstall: truck?.mileage || null,
            expectedReplacementDate,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
            supplier: supplier || null,
            warrantyExpiry: warrantyExpiry ? new Date(warrantyExpiry) : null,
            notes: notes || null,
            status: 'Active',
        },
    })

    revalidatePath(`/trucks/${truckId}`)
    revalidatePath('/trucks')
}

export async function getParts(truckId?: string) {
    return await prisma.part.findMany({
        where: truckId ? { truckId } : undefined,
        include: {
            truck: true,
        },
        orderBy: { installedDate: 'desc' },
    })
}

export async function updatePartStatus(id: string, status: string) {
    await prisma.part.update({
        where: { id },
        data: { status },
    })
    revalidatePath('/trucks')
}

export async function replacePart(oldPartId: string, formData: FormData) {
    const oldPart = await prisma.part.findUnique({ where: { id: oldPartId } })
    if (!oldPart) throw new Error('Part not found')

    // Mark old part as replaced
    await prisma.part.update({
        where: { id: oldPartId },
        data: { status: 'Replaced' },
    })

    // Create new part
    await createPart(formData)
}

// ============ SPARE PARTS INVENTORY ============

export async function createSparePart(formData: FormData) {
    const partNumber = formData.get('partNumber') as string
    const name = formData.get('name') as string
    const category = formData.get('category') as string
    const description = formData.get('description') as string
    const quantity = formData.get('quantity') as string
    const minQuantity = formData.get('minQuantity') as string
    const purchasePrice = formData.get('purchasePrice') as string
    const supplier = formData.get('supplier') as string
    const location = formData.get('location') as string

    if (!partNumber || !name || !category || !purchasePrice) {
        throw new Error('Missing required fields')
    }

    await prisma.sparePartInventory.create({
        data: {
            partNumber,
            name,
            category,
            description: description || null,
            quantity: parseInt(quantity) || 0,
            minQuantity: parseInt(minQuantity) || 1,
            purchasePrice: parseFloat(purchasePrice),
            supplier: supplier || null,
            location: location || null,
            lastRestocked: new Date(),
        },
    })

    revalidatePath('/trucks/parts')
}

export async function getSpareParts() {
    return await prisma.sparePartInventory.findMany({
        orderBy: { name: 'asc' },
    })
}

export async function updateSparePartQuantity(id: string, quantity: number) {
    await prisma.sparePartInventory.update({
        where: { id },
        data: { 
            quantity,
            lastRestocked: new Date()
        },
    })
    revalidatePath('/trucks/parts')
}

export async function getLowStockParts() {
    const parts = await prisma.sparePartInventory.findMany()
    return parts.filter(part => part.quantity <= part.minQuantity)
}

// ============ FLEET ANALYTICS & ALERTS ============

export async function getFleetAlerts() {
    const now = new Date()
    const alerts: { type: string; severity: string; message: string; truckId?: string; itemId?: string }[] = []

    // Check for overdue maintenance
    const overdueSchedules = await prisma.maintenanceSchedule.findMany({
        where: {
            isActive: true,
            OR: [
                { nextDueDate: { lt: now } },
            ]
        },
        include: { truck: true }
    })

    for (const schedule of overdueSchedules) {
        alerts.push({
            type: 'maintenance',
            severity: schedule.priority === 'Critical' ? 'critical' : 'warning',
            message: `${schedule.type} overdue for ${schedule.truck.plateNumber}`,
            truckId: schedule.truckId,
            itemId: schedule.id
        })
    }

    // Check for parts due for replacement
    const partsNearExpiry = await prisma.part.findMany({
        where: {
            status: 'Active',
            expectedReplacementDate: { lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) } // Within 30 days
        },
        include: { truck: true }
    })

    for (const part of partsNearExpiry) {
        const isOverdue = part.expectedReplacementDate && part.expectedReplacementDate < now
        alerts.push({
            type: 'part',
            severity: isOverdue ? 'critical' : 'warning',
            message: `${part.name} on ${part.truck.plateNumber} ${isOverdue ? 'needs immediate replacement' : 'due for replacement soon'}`,
            truckId: part.truckId,
            itemId: part.id
        })
    }

    // Check for low stock spare parts
    const lowStockParts = await getLowStockParts()
    for (const part of lowStockParts) {
        alerts.push({
            type: 'inventory',
            severity: part.quantity === 0 ? 'critical' : 'warning',
            message: `${part.name} (${part.partNumber}) is ${part.quantity === 0 ? 'out of stock' : 'low on stock'} (${part.quantity}/${part.minQuantity})`,
            itemId: part.id
        })
    }

    return alerts
}

export async function getFleetStats() {
    const trucks = await prisma.truck.findMany()
    const maintenanceRecords = await prisma.maintenanceRecord.findMany({
        where: {
            date: {
                gte: new Date(new Date().getFullYear(), 0, 1) // This year
            }
        }
    })

    const totalTrucks = trucks.length
    const availableTrucks = trucks.filter(t => t.status === 'Available').length
    const inUseTrucks = trucks.filter(t => t.status === 'In Use').length
    const maintenanceTrucks = trucks.filter(t => t.status === 'Maintenance').length
    
    const totalMaintenanceCost = maintenanceRecords.reduce((sum, r) => sum + r.cost, 0)
    const avgMaintenanceCost = maintenanceRecords.length > 0 
        ? totalMaintenanceCost / maintenanceRecords.length 
        : 0

    return {
        totalTrucks,
        availableTrucks,
        inUseTrucks,
        maintenanceTrucks,
        totalMaintenanceCost,
        avgMaintenanceCost,
        maintenanceCount: maintenanceRecords.length
    }
}
