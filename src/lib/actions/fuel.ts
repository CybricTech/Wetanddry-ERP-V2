'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { checkPermission, hasPermission } from '@/lib/permissions'
import { notifyApprovers, notifyRequester } from '@/lib/actions/notifications'
import { getFuelStockPosition, costOf } from '@/lib/fuel-stock'
import { createEditRequest, getPendingEditRequests } from '@/lib/actions/edit-requests'
import { applyApprovedRequest, pickEditable, snapshotOf } from '@/lib/edit-requests/core'
import { fuelLogApplier } from '@/lib/edit-requests/fuel-log'


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


/**
 * Writes the FuelLog for an approved issuance and moves the truck's odometer. This is
 * the only place a FuelLog is created, so efficiency is computed identically whether an
 * approver issued fuel directly or signed off on someone else's request.
 */
async function issueFuel(params: {
    truckId: string | null
    equipmentId: string | null
    liters: number
    cost: number
    mileage: number | null
}) {
    const { truckId, equipmentId, liters, cost, mileage } = params

    if (truckId) {
        const truck = await prisma.truck.findUnique({ where: { id: truckId } })
        if (!truck) throw new Error('Truck not found')

        // Only a forward odometer reading yields a meaningful km/L figure.
        const efficiency =
            mileage !== null && mileage > truck.mileage ? (mileage - truck.mileage) / liters : null

        return await prisma.$transaction(async (tx) => {
            const log = await tx.fuelLog.create({
                data: { truckId, liters, cost, mileage, efficiency },
            })

            if (mileage !== null && mileage > truck.mileage) {
                await tx.truck.update({ where: { id: truckId }, data: { mileage } })
            }

            return log
        })
    }

    const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId! } })
    if (!equipment) throw new Error('Equipment not found')

    return await prisma.fuelLog.create({
        data: { equipmentId, liters, cost },
    })
}

/**
 * Submits a fuel request. Anyone with `log_fuel` may do this; the fuel itself is only
 * issued once an approver signs off, so pending requests leave consumption, efficiency
 * and reconciliation figures untouched. Approvers skip the queue and issue directly.
 */
export async function createFuelRequest(formData: FormData): Promise<{ success: true; approved: boolean } | { error: string }> {
    try {
        const targetType = formData.get('targetType') as string // 'truck' or 'equipment'
        const targetId = formData.get('targetId') as string
        const liters = parseFloat(formData.get('liters') as string)
        const mileageStr = formData.get('mileage') as string
        const newMileage = mileageStr ? parseInt(mileageStr) : null
        const purpose = ((formData.get('purpose') as string) || '').trim() || null
        const notes = ((formData.get('notes') as string) || '').trim() || null

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'log_fuel')

        if (!targetId || isNaN(liters) || liters <= 0) {
            return { error: 'Invalid input. Please fill all required fields.' }
        }
        if (targetType !== 'truck' && targetType !== 'equipment') {
            return { error: 'Select a truck or a piece of equipment' }
        }
        if (targetType === 'truck' && (newMileage === null || isNaN(newMileage))) {
            return { error: 'Mileage is required for truck fuel issuance.' }
        }

        const truckId = targetType === 'truck' ? targetId : null
        const equipmentId = targetType === 'equipment' ? targetId : null

        // Confirm the target exists before anything is written, so a bad id fails as a
        // clean validation error rather than a foreign-key crash.
        if (truckId && !(await prisma.truck.findUnique({ where: { id: truckId } }))) {
            return { error: 'Truck not found' }
        }
        if (equipmentId && !(await prisma.equipment.findUnique({ where: { id: equipmentId } }))) {
            return { error: 'Equipment not found' }
        }

        const { currentStock, blendedCostPerLiter } = await getFuelStockPosition()
        const cost = costOf(liters, blendedCostPerLiter)
        const isApprover = hasPermission(session.user.role, 'approve_fuel_requests')
        const requestedBy = session.user.name || session.user.email || 'System'

        // Stock is only binding at the moment fuel actually leaves the tank. A request
        // beyond current stock is allowed - it may well be approved after a delivery.
        if (isApprover && liters > currentStock) {
            return {
                error: currentStock <= 0
                    ? `Cannot issue fuel. Current stock is 0 L. Please record a deposit first.`
                    : `Insufficient fuel stock. Current stock: ${currentStock.toFixed(1)} L, requested: ${liters} L.`
            }
        }

        if (isApprover) {
            const log = await issueFuel({
                truckId,
                equipmentId,
                liters,
                cost,
                mileage: truckId ? newMileage : null,
            })

            await prisma.fuelRequest.create({
                data: {
                    truckId,
                    equipmentId,
                    liters,
                    estimatedCost: cost,
                    mileage: truckId ? newMileage : null,
                    purpose,
                    notes,
                    status: 'Approved',
                    requestedBy,
                    requestedById: session.user.id ?? null,
                    approvedBy: requestedBy,
                    approvedAt: new Date(),
                    fuelLogId: log.id,
                },
            })

            revalidatePath('/fuel')
            revalidatePath('/trucks')
            return { success: true, approved: true }
        }

        const request = await prisma.fuelRequest.create({
            data: {
                truckId,
                equipmentId,
                liters,
                estimatedCost: cost,
                mileage: truckId ? newMileage : null,
                purpose,
                notes,
                status: 'Pending',
                requestedBy,
                requestedById: session.user.id ?? null,
            },
            include: { truck: true, equipment: true },
        })

        const targetLabel = request.truck?.plateNumber ?? request.equipment?.name ?? 'target'
        notifyApprovers(
            'fuel_request_pending',
            `Fuel request: ${targetLabel}`,
            `${requestedBy} requested ${liters} L for ${targetLabel}${purpose ? ` (${purpose})` : ''}.`,
            'fuel_request',
            request.id
        ).catch(console.error)

        revalidatePath('/fuel')
        return { success: true, approved: false }
    } catch (error) {
        console.error('Failed to create fuel request:', error)
        return { error: error instanceof Error ? error.message : 'Failed to submit fuel request' }
    }
}

/**
 * Retained so any caller still wired to the old direct-logging action keeps working.
 * It now submits a request like everyone else.
 */
export async function logFuel(formData: FormData): Promise<{ success: true } | { error: string }> {
    const result = await createFuelRequest(formData)
    if ('error' in result) return result
    return { success: true }
}

// ============ FUEL REQUEST APPROVALS ============

export async function getFuelRequests(status?: string) {
    const session = await auth()
    if (!session?.user?.role || !hasPermission(session.user.role, 'view_fuel_logs')) {
        return []
    }

    // Approvers see the whole queue; everyone else sees only what they submitted.
    const isApprover = hasPermission(session.user.role, 'approve_fuel_requests')

    return await prisma.fuelRequest.findMany({
        where: {
            ...(status && status !== 'All' ? { status } : {}),
            ...(isApprover ? {} : { requestedById: session.user.id ?? '__none__' }),
        },
        include: { truck: true, equipment: true },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
}

export async function approveFuelRequest(
    id: string,
    formData?: FormData
): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'approve_fuel_requests')

        const request = await prisma.fuelRequest.findUnique({
            where: { id },
            include: { truck: true, equipment: true },
        })
        if (!request) return { error: 'Fuel request not found' }
        if (request.status !== 'Pending') {
            return { error: `This request has already been ${request.status.toLowerCase()}` }
        }

        // The approver may cut the volume down before releasing it.
        const approvedLitersRaw = formData?.get('liters') as string | null
        const approvedLiters = approvedLitersRaw ? parseFloat(approvedLitersRaw) : request.liters
        if (isNaN(approvedLiters) || approvedLiters <= 0) {
            return { error: 'Approved litres must be greater than zero' }
        }

        const mileageRaw = formData?.get('mileage') as string | null
        const mileage = request.truckId
            ? mileageRaw
                ? parseInt(mileageRaw)
                : request.mileage
            : null
        if (request.truckId && (mileage === null || isNaN(mileage))) {
            return { error: 'Mileage is required to issue fuel to a truck' }
        }

        const { currentStock, blendedCostPerLiter } = await getFuelStockPosition()
        if (approvedLiters > currentStock) {
            return {
                error: currentStock <= 0
                    ? 'Cannot issue fuel. Current stock is 0 L. Please record a deposit first.'
                    : `Insufficient fuel stock. Current stock: ${currentStock.toFixed(1)} L, approving: ${approvedLiters} L.`
            }
        }

        const costRaw = formData?.get('cost') as string | null
        const parsedCost = costRaw ? parseFloat(costRaw) : NaN
        const cost = !isNaN(parsedCost) ? parsedCost : costOf(approvedLiters, blendedCostPerLiter)

        const actor = session.user.name || session.user.email || 'System'
        const adjusted = approvedLiters !== request.liters
        const adjustmentNote = adjusted
            ? `Requested ${request.liters} L, approved ${approvedLiters} L.`
            : null

        const log = await issueFuel({
            truckId: request.truckId,
            equipmentId: request.equipmentId,
            liters: approvedLiters,
            cost,
            mileage,
        })

        await prisma.fuelRequest.update({
            where: { id },
            data: {
                status: 'Approved',
                liters: approvedLiters,
                mileage,
                approvedBy: actor,
                approvedAt: new Date(),
                rejectionReason: null,
                fuelLogId: log.id,
                notes: [request.notes, adjustmentNote].filter(Boolean).join(' | ') || null,
            },
        })

        if (request.requestedById) {
            const targetLabel = request.truck?.plateNumber ?? request.equipment?.name ?? 'target'
            notifyRequester(
                request.requestedById,
                'fuel_request_approved',
                `Fuel approved: ${targetLabel}`,
                `${actor} approved ${approvedLiters} L for ${targetLabel}${adjusted ? ` (you requested ${request.liters} L)` : ''}.`,
                'fuel_request',
                id
            ).catch(console.error)
        }

        revalidatePath('/fuel')
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to approve fuel request:', error)
        return { error: error instanceof Error ? error.message : 'Failed to approve fuel request' }
    }
}

export async function rejectFuelRequest(id: string, reason: string): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'approve_fuel_requests')

        const trimmedReason = (reason || '').trim()
        if (!trimmedReason) return { error: 'A reason is required to reject a request' }

        const request = await prisma.fuelRequest.findUnique({
            where: { id },
            include: { truck: true, equipment: true },
        })
        if (!request) return { error: 'Fuel request not found' }
        if (request.status !== 'Pending') {
            return { error: `This request has already been ${request.status.toLowerCase()}` }
        }

        const actor = session.user.name || session.user.email || 'System'

        await prisma.fuelRequest.update({
            where: { id },
            data: {
                status: 'Rejected',
                approvedBy: actor,
                approvedAt: new Date(),
                rejectionReason: trimmedReason,
            },
        })

        if (request.requestedById) {
            const targetLabel = request.truck?.plateNumber ?? request.equipment?.name ?? 'target'
            notifyRequester(
                request.requestedById,
                'fuel_request_rejected',
                `Fuel request rejected: ${targetLabel}`,
                `${actor} rejected your request for ${request.liters} L: ${trimmedReason}`,
                'fuel_request',
                id
            ).catch(console.error)
        }

        revalidatePath('/fuel')
        return { success: true }
    } catch (error) {
        console.error('Failed to reject fuel request:', error)
        return { error: error instanceof Error ? error.message : 'Failed to reject fuel request' }
    }
}

export async function cancelFuelRequest(id: string): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.id) return { error: 'Unauthorized' }

        const request = await prisma.fuelRequest.findUnique({ where: { id } })
        if (!request) return { error: 'Fuel request not found' }
        if (request.status !== 'Pending') {
            return { error: 'Only a pending request can be cancelled' }
        }
        // Cancelling is the requester's own withdrawal, not an approval decision.
        if (request.requestedById !== session.user.id) {
            return { error: 'You can only cancel your own requests' }
        }

        await prisma.fuelRequest.update({
            where: { id },
            data: { status: 'Cancelled' },
        })

        revalidatePath('/fuel')
        return { success: true }
    } catch (error) {
        console.error('Failed to cancel fuel request:', error)
        return { error: error instanceof Error ? error.message : 'Failed to cancel fuel request' }
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

// ==================== FUEL LOG EDIT & DELETE APPROVALS ====================
// Spec: docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md

/**
 * Proposes an edit to a fuel log. Mirrors createFuelRequest: an approver skips the
 * queue and the change lands immediately; everyone else with page access submits a
 * request that waits. The check is on the permission, never the role name.
 */
export async function requestFuelLogEdit(
    id: string,
    formData: FormData
): Promise<{ success: true; applied: boolean } | { error: string }> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }
    if (!hasPermission(role, 'view_fuel_logs')) return { error: 'Unauthorized' }

    const raw: Record<string, unknown> = {}
    for (const field of fuelLogApplier.editableFields) {
        const value = formData.get(field)
        if (value !== null && value !== '') raw[field] = value
    }

    if (!hasPermission(role, 'approve_fuel_requests')) {
        const result = await createEditRequest('fuel_log', id, 'update', raw)
        if ('error' in result) return result
        revalidatePath('/fuel')
        return { success: true, applied: false }
    }

    // Approver path: create the request already decided, so the audit trail is
    // identical whether a change was queued or applied directly.
    const current = await fuelLogApplier.load(id)
    if (!current) return { error: 'Fuel log not found' }

    const changes = pickEditable(raw, fuelLogApplier.editableFields)
    if (Object.keys(changes).length === 0) return { error: 'No editable fields were changed' }

    const request = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log',
            entityId: id,
            operation: 'update',
            proposedChanges: changes as object,
            previousValues: snapshotOf(current, fuelLogApplier.editableFields) as object,
            requestedBy: session.user.name || session.user.email || role,
            requestedById: session.user.id ?? undefined,
        },
    })

    const applied = await applyApprovedRequest(request.id, { acceptStale: true })
    if ('error' in applied) {
        await prisma.editRequest.delete({ where: { id: request.id } })
        return applied
    }
    await prisma.editRequest.update({
        where: { id: request.id },
        data: { approvedBy: session.user.name || session.user.email || role },
    })

    revalidatePath('/fuel')
    return { success: true, applied: true }
}

/** Proposes deletion of a fuel log. Same approver split as requestFuelLogEdit. */
export async function requestFuelLogDelete(
    id: string,
    reason: string
): Promise<{ success: true; applied: boolean } | { error: string }> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }
    if (!hasPermission(role, 'view_fuel_logs')) return { error: 'Unauthorized' }
    if (!reason?.trim()) return { error: 'A reason is required to delete a fuel log' }

    if (!hasPermission(role, 'approve_fuel_requests')) {
        const result = await createEditRequest('fuel_log', id, 'delete', {}, reason)
        if ('error' in result) return result
        revalidatePath('/fuel')
        return { success: true, applied: false }
    }

    const current = await fuelLogApplier.load(id)
    if (!current) return { error: 'Fuel log not found' }

    const request = await prisma.editRequest.create({
        data: {
            entityType: 'fuel_log',
            entityId: id,
            operation: 'delete',
            previousValues: snapshotOf(current, fuelLogApplier.editableFields) as object,
            rejectionReason: reason.trim(),
            requestedBy: session.user.name || session.user.email || role,
            requestedById: session.user.id ?? undefined,
        },
    })

    const applied = await applyApprovedRequest(request.id, { acceptStale: true })
    if ('error' in applied) {
        await prisma.editRequest.delete({ where: { id: request.id } })
        return applied
    }
    await prisma.editRequest.update({
        where: { id: request.id },
        data: { approvedBy: session.user.name || session.user.email || role },
    })

    revalidatePath('/fuel')
    return { success: true, applied: true }
}

/** Pending fuel log edit requests, scoped by getPendingEditRequests' own visibility rules. */
export async function getFuelLogEditRequests() {
    return getPendingEditRequests('fuel_log')
}
