'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission, hasPermission } from '@/lib/permissions'


export async function getFuelLogs() {
    const session = await auth()
    if (!session?.user?.role || !hasPermission(session.user.role, 'view_fuel_logs')) {
        return []
    }

    return await prisma.fuelLog.findMany({
        include: { truck: true, equipment: true },
        orderBy: { date: 'desc' }
    })
}

export async function logFuel(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
        const targetType = formData.get('targetType') as string // 'truck' or 'equipment'
        const targetId = formData.get('targetId') as string
        const liters = parseFloat(formData.get('liters') as string)
        const cost = parseFloat(formData.get('cost') as string)
        const mileageStr = formData.get('mileage') as string
        const newMileage = mileageStr ? parseInt(mileageStr) : null

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'log_fuel')

        if (!targetId || isNaN(liters) || isNaN(cost)) {
            return { error: 'Invalid input. Please fill all required fields.' }
        }

        if (targetType === 'truck') {
            if (newMileage === null || isNaN(newMileage)) {
                return { error: 'Mileage is required for truck fuel issuance.' }
            }

            const truck = await prisma.truck.findUnique({
                where: { id: targetId }
            })

            if (!truck) return { error: 'Truck not found' }

            let efficiency = null
            if (newMileage > truck.mileage) {
                const distance = newMileage - truck.mileage
                efficiency = distance / liters
            }

            await prisma.$transaction(async (tx) => {
                await tx.fuelLog.create({
                    data: {
                        truckId: targetId,
                        liters,
                        cost,
                        mileage: newMileage,
                        efficiency
                    }
                })

                await tx.truck.update({
                    where: { id: targetId },
                    data: { mileage: newMileage }
                })
            })
        } else {
            // Equipment issuance
            const equipment = await prisma.equipment.findUnique({
                where: { id: targetId }
            })

            if (!equipment) return { error: 'Equipment not found' }

            await prisma.fuelLog.create({
                data: {
                    equipmentId: targetId,
                    liters,
                    cost,
                }
            })
        }

        revalidatePath('/fuel')
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to log fuel:', error)
        return { error: error instanceof Error ? error.message : 'Failed to log fuel' }
    }
}

// ============ EQUIPMENT ============

export async function getEquipment() {
    const session = await auth()
    if (!session?.user?.role || !hasPermission(session.user.role, 'view_fuel_logs')) {
        return []
    }

    return await prisma.equipment.findMany({
        where: { status: 'Active' },
        orderBy: { name: 'asc' }
    })
}

export async function createEquipment(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
        const name = formData.get('name') as string
        const type = formData.get('type') as string
        const notes = formData.get('notes') as string

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_fuel')

        if (!name || !type) {
            return { error: 'Name and type are required.' }
        }

        await prisma.equipment.create({
            data: {
                name,
                type,
                notes: notes || null,
            }
        })

        revalidatePath('/fuel')
        return { success: true }
    } catch (error) {
        console.error('Failed to create equipment:', error)
        return { error: error instanceof Error ? error.message : 'Failed to create equipment' }
    }
}

// ============ FUEL DEPOSITS ============

export async function getFuelDeposits() {
    const session = await auth()
    if (!session?.user?.role || !hasPermission(session.user.role, 'view_fuel_logs')) {
        return []
    }

    return await prisma.fuelDeposit.findMany({
        orderBy: { date: 'desc' }
    })
}

export async function createFuelDeposit(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
        const liters = parseFloat(formData.get('liters') as string)
        const pricePerLiter = parseFloat(formData.get('pricePerLiter') as string)
        const supplier = formData.get('supplier') as string
        const notes = formData.get('notes') as string
        const dateStr = formData.get('date') as string

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_fuel')

        if (isNaN(liters) || liters <= 0 || isNaN(pricePerLiter) || pricePerLiter <= 0) {
            return { error: 'Please enter valid liters and price per liter.' }
        }

        const totalCost = liters * pricePerLiter

        await prisma.fuelDeposit.create({
            data: {
                date: dateStr ? new Date(dateStr) : new Date(),
                liters,
                pricePerLiter,
                totalCost,
                supplier: supplier || null,
                notes: notes || null,
                recordedBy: session.user.name || session.user.email || 'Unknown',
            }
        })

        revalidatePath('/fuel')
        return { success: true }
    } catch (error) {
        console.error('Failed to create fuel deposit:', error)
        return { error: error instanceof Error ? error.message : 'Failed to record fuel deposit' }
    }
}
