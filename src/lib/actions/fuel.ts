'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission, hasPermission } from '@/lib/permissions'


export async function getFuelLogs() {
    const session = await auth()
    // Gracefully handle missing role or missing permission
    if (!session?.user?.role || !hasPermission(session.user.role, 'view_fuel_logs')) {
        return []
    }

    return await prisma.fuelLog.findMany({
        include: { truck: true },
        orderBy: { date: 'desc' }
    })
}

export async function logFuel(formData: FormData) {
    const truckId = formData.get('truckId') as string
    const liters = parseFloat(formData.get('liters') as string)
    const cost = parseFloat(formData.get('cost') as string)
    const newMileage = parseInt(formData.get('mileage') as string)

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'log_fuel')


    if (!truckId || isNaN(liters) || isNaN(cost) || isNaN(newMileage)) {
        throw new Error('Invalid input')
    }

    // Fetch truck to get previous mileage
    const truck = await prisma.truck.findUnique({
        where: { id: truckId }
    })

    if (!truck) throw new Error('Truck not found')

    let efficiency = null

    // Calculate efficiency if mileage has increased
    if (newMileage > truck.mileage) {
        const distance = newMileage - truck.mileage
        efficiency = distance / liters // km per liter
    }

    // Transaction: Create Log + Update Truck Mileage
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
}
