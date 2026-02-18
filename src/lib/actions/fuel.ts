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
        include: { truck: true },
        orderBy: { date: 'desc' }
    })
}

export async function logFuel(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
        const truckId = formData.get('truckId') as string
        const liters = parseFloat(formData.get('liters') as string)
        const cost = parseFloat(formData.get('cost') as string)
        const newMileage = parseInt(formData.get('mileage') as string)

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'log_fuel')

        if (!truckId || isNaN(liters) || isNaN(cost) || isNaN(newMileage)) {
            return { error: 'Invalid input. Please fill all fields correctly.' }
        }

        const truck = await prisma.truck.findUnique({
            where: { id: truckId }
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
                    truckId,
                    liters,
                    cost,
                    mileage: newMileage,
                    efficiency
                }
            })

            await tx.truck.update({
                where: { id: truckId },
                data: { mileage: newMileage }
            })
        })

        revalidatePath('/fuel')
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to log fuel:', error)
        return { error: error instanceof Error ? error.message : 'Failed to log fuel' }
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
