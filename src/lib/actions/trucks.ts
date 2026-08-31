'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary'
import { auth } from '@/auth'
import { checkPermission, hasPermission } from '@/lib/permissions'
import { recomputeTruckDerivedValues } from '@/lib/truck-mileage'
import { createEditRequest } from '@/lib/actions/edit-requests'
import { getApplier } from '@/lib/edit-requests/registry'
import { pickEditable } from '@/lib/edit-requests/core'
import {
    notifyMaintenanceDue,
    notifyDocumentExpiring,
    notifySparePartsLow,
    notifyApprovers,
    notifyRequester
} from '@/lib/actions/notifications'

// ============ TRUCK CRUD OPERATIONS ============

export async function createTruck(formData: FormData) {
    const plateNumber = formData.get('plateNumber') as string
    const model = formData.get('model') as string
    const capacity = formData.get('capacity') as string
    const purchaseDate = formData.get('purchaseDate') as string
    const mileage = formData.get('mileage') as string
    const status = formData.get('status') as string

    if (!plateNumber || !model || !purchaseDate) {
        throw new Error('Missing required fields')
    }

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_fleet')

    await prisma.truck.create({
        data: {
            plateNumber,
            model,

            capacity: capacity || null,
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
    const truck = await prisma.truck.findUnique({
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
            },
            documents: {
                orderBy: { createdAt: 'desc' }
            }
        },
    })

    return truck
}

export async function updateTruck(id: string, formData: FormData) {
    const plateNumber = formData.get('plateNumber') as string
    const model = formData.get('model') as string
    const capacity = formData.get('capacity') as string
    const purchaseDate = formData.get('purchaseDate') as string
    const mileage = formData.get('mileage') as string
    const status = formData.get('status') as string

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_fleet')

    await prisma.truck.update({
        where: { id },
        data: {
            plateNumber,
            model,

            capacity: capacity || null,
            purchaseDate: new Date(purchaseDate),
            // The form odometer is the one mileage source with no history of its own -
            // maintenance records and fuel logs each keep theirs - so it is stamped here
            // to survive recomputeTruckDerivedValues().
            mileage: parseInt(mileage) || 0,
            manualMileage: parseInt(mileage) || 0,
            manualMileageAt: new Date(),
            status,
        },
    })

    revalidatePath('/trucks')
    revalidatePath(`/trucks/${id}`)
    redirect(`/trucks/${id}`)
}

export async function deleteTruck(id: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_fleet')

    await prisma.truck.delete({
        where: { id },
    })

    revalidatePath('/trucks')
    redirect('/trucks')
}

// ============ MAINTENANCE RECORDS ============

export async function createMaintenanceRecord(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
        const truckId = formData.get('truckId') as string
        const type = formData.get('type') as string
        const date = formData.get('date') as string
        const cost = formData.get('cost') as string
        const mileageAtService = formData.get('mileageAtService') as string
        const status = formData.get('status') as string
        const notes = formData.get('notes') as string
        const performedBy = formData.get('performedBy') as string

        if (!truckId || !type || !date || !cost) {
            return { error: 'Missing required fields' }
        }

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        // Users who can approve do not queue behind themselves.
        const isAutoApproved = hasPermission(session.user.role, 'approve_maintenance')
        const actor = session.user.name || session.user.email || 'System'

        const record = await prisma.maintenanceRecord.create({
            data: {
                truckId,
                type,
                date: new Date(date),
                cost: parseFloat(cost),
                mileageAtService: mileageAtService ? parseInt(mileageAtService) : null,
                status: status || 'Completed',
                notes: notes || null,
                performedBy: performedBy || null,
                approvalStatus: isAutoApproved ? 'Approved' : 'Pending',
                requestedBy: actor,
                approvedBy: isAutoApproved ? actor : null,
                approvedAt: isAutoApproved ? new Date() : null,
            },
        })

        if (isAutoApproved) {
            // Side effects belong to approval, not creation - a pending record must not
            // move the truck's service history. recomputeTruckDerivedValues is the one
            // place that does it, shared with approveMaintenanceRecord().
            await recomputeTruckDerivedValues(record.truckId)
        } else {
            const truck = await prisma.truck.findUnique({ where: { id: truckId } })
            notifyApprovers(
                'maintenance_approval_pending',
                `Maintenance approval needed: ${truck?.plateNumber ?? 'truck'}`,
                `${actor} logged "${type}" costing ${parseFloat(cost).toLocaleString()} and needs your approval.`,
                'maintenance_record',
                record.id
            ).catch(console.error)
        }

        revalidatePath(`/trucks/${truckId}`)
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to create maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to create maintenance record' }
    }
}

/**
 * Applies a change immediately, bypassing the approval queue.
 *
 * Routes through the same applier the approval path uses, so an approver's direct edit
 * and a signed-off request cannot drift apart: same whitelist, same validation, same
 * coercion, same recompute.
 */
async function applyMaintenanceDirect(
    entityType: 'maintenance_record' | 'maintenance_schedule',
    id: string,
    operation: 'update' | 'delete',
    rawChanges: Record<string, unknown>
): Promise<{ success: true } | { error: string }> {
    const applier = getApplier(entityType)
    if (!applier) return { error: 'Unknown record type' }

    // Snapshotted before the write so a delete can still name its truck afterwards.
    const before = await applier.load(id)
    if (!before) return { error: 'Record not found' }

    if (operation === 'update') {
        const changes = pickEditable(rawChanges, applier.editableFields)
        if (Object.keys(changes).length === 0) return { error: 'No editable fields were changed' }
        if (applier.validate) {
            const problem = await applier.validate(changes, before)
            if (problem) return { error: problem }
        }
        await applier.applyUpdate(id, changes)
    } else {
        await applier.applyDelete(id)
    }

    if (applier.onApplied) await applier.onApplied(before, operation, rawChanges)
    for (const path of applier.revalidatePaths(before)) revalidatePath(path)
    return { success: true }
}

/**
 * True when this caller's change lands immediately rather than queueing.
 *
 * Approvers never queue behind themselves. Neither does a record that has not been
 * approved yet: it has taken no effect and already awaits sign-off, so stacking a
 * second approval on top would mean approving the same record twice.
 */
function landsImmediately(role: string, approvalStatus: string): boolean {
    return hasPermission(role, 'approve_maintenance') || approvalStatus === 'Pending'
}

export async function updateMaintenanceRecord(
    id: string,
    formData: FormData
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const type = formData.get('type') as string
        const date = formData.get('date') as string
        const cost = formData.get('cost') as string

        if (!type || !date || !cost) return { error: 'Missing required fields' }

        const mileageAtService = formData.get('mileageAtService') as string
        const changes = {
            type,
            // Stored as JSON on a queued request, so dates go in as ISO strings.
            date: new Date(date).toISOString(),
            cost: parseFloat(cost),
            mileageAtService: mileageAtService ? parseInt(mileageAtService) : null,
            status: (formData.get('status') as string) || 'Completed',
            notes: (formData.get('notes') as string) || null,
            performedBy: (formData.get('performedBy') as string) || null,
        }

        const existing = await prisma.maintenanceRecord.findUnique({
            where: { id },
            select: { approvalStatus: true },
        })
        if (!existing) return { error: 'Record not found' }
        if (existing.approvalStatus === 'Rejected') {
            return { error: 'A rejected record cannot be edited. Create a new one instead.' }
        }

        if (landsImmediately(session.user.role, existing.approvalStatus)) {
            return applyMaintenanceDirect('maintenance_record', id, 'update', changes)
        }

        const result = await createEditRequest('maintenance_record', id, 'update', changes)
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to update maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update maintenance record' }
    }
}

export async function deleteMaintenanceRecord(
    id: string,
    reason?: string
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const existing = await prisma.maintenanceRecord.findUnique({
            where: { id },
            select: { approvalStatus: true },
        })
        if (!existing) return { error: 'Record not found' }

        if (landsImmediately(session.user.role, existing.approvalStatus)) {
            return applyMaintenanceDirect('maintenance_record', id, 'delete', {})
        }

        const result = await createEditRequest('maintenance_record', id, 'delete', {}, reason)
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to delete maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to delete maintenance record' }
    }
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

export async function createMaintenanceSchedule(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
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
            return { error: 'Missing required fields' }
        }

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const isAutoApproved = hasPermission(session.user.role, 'approve_maintenance')
        const actor = session.user.name || session.user.email || 'System'

        const schedule = await prisma.maintenanceSchedule.create({
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
                approvalStatus: isAutoApproved ? 'Approved' : 'Pending',
                requestedBy: actor,
                approvedBy: isAutoApproved ? actor : null,
                approvedAt: isAutoApproved ? new Date() : null,
            },
        })

        if (!isAutoApproved) {
            const truck = await prisma.truck.findUnique({ where: { id: truckId } })
            notifyApprovers(
                'maintenance_approval_pending',
                `Service schedule approval needed: ${truck?.plateNumber ?? 'truck'}`,
                `${actor} set up a "${type}" schedule that needs your approval before it raises alerts.`,
                'maintenance_schedule',
                schedule.id
            ).catch(console.error)
        }

        revalidatePath(`/trucks/${truckId}`)
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to create maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to create maintenance schedule' }
    }
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

// ============ MAINTENANCE APPROVALS ============

export async function getPendingMaintenanceApprovals() {
    const session = await auth()
    if (!session?.user?.role || !hasPermission(session.user.role, 'approve_maintenance')) {
        return { records: [], schedules: [] }
    }

    const [records, schedules] = await Promise.all([
        prisma.maintenanceRecord.findMany({
            where: { approvalStatus: 'Pending' },
            include: { truck: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.maintenanceSchedule.findMany({
            where: { approvalStatus: 'Pending' },
            include: { truck: true },
            orderBy: { createdAt: 'desc' },
        }),
    ])

    return { records, schedules }
}

/** Resolves the user id behind a requestedBy label so the decision can be sent back. */
async function findRequesterId(requestedBy: string | null): Promise<string | null> {
    if (!requestedBy) return null
    const user = await prisma.user.findFirst({
        where: { OR: [{ name: requestedBy }, { email: requestedBy }] },
        select: { id: true },
    })
    return user?.id ?? null
}

export async function approveMaintenanceRecord(id: string): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'approve_maintenance')

        const record = await prisma.maintenanceRecord.findUnique({
            where: { id },
            include: { truck: true },
        })
        if (!record) return { error: 'Maintenance record not found' }
        if (record.approvalStatus !== 'Pending') {
            return { error: `This record has already been ${record.approvalStatus.toLowerCase()}` }
        }

        const actor = session.user.name || session.user.email || 'System'

        await prisma.maintenanceRecord.update({
            where: { id },
            data: {
                approvalStatus: 'Approved',
                approvedBy: actor,
                approvedAt: new Date(),
                rejectionReason: null,
            },
        })

        // Deferred side effects - only now does the truck's history move, and only now
        // does a schedule this record completed advance to its next interval.
        await recomputeTruckDerivedValues(record.truckId)
        if (record.scheduleId) {
            await rollScheduleForward(record.scheduleId)
        }

        const requesterId = await findRequesterId(record.requestedBy)
        if (requesterId) {
            notifyRequester(
                requesterId,
                'maintenance_approved',
                `Maintenance approved: ${record.truck.plateNumber}`,
                `${actor} approved your "${record.type}" record.`,
                'maintenance_record',
                id
            ).catch(console.error)
        }

        revalidatePath(`/trucks/${record.truckId}`)
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to approve maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to approve maintenance record' }
    }
}

export async function rejectMaintenanceRecord(id: string, reason: string): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'approve_maintenance')

        const trimmedReason = (reason || '').trim()
        if (!trimmedReason) return { error: 'A reason is required to reject a record' }

        const record = await prisma.maintenanceRecord.findUnique({
            where: { id },
            include: { truck: true },
        })
        if (!record) return { error: 'Maintenance record not found' }
        if (record.approvalStatus !== 'Pending') {
            return { error: `This record has already been ${record.approvalStatus.toLowerCase()}` }
        }

        const actor = session.user.name || session.user.email || 'System'

        await prisma.maintenanceRecord.update({
            where: { id },
            data: {
                approvalStatus: 'Rejected',
                approvedBy: actor,
                approvedAt: new Date(),
                rejectionReason: trimmedReason,
            },
        })

        const requesterId = await findRequesterId(record.requestedBy)
        if (requesterId) {
            notifyRequester(
                requesterId,
                'maintenance_rejected',
                `Maintenance rejected: ${record.truck.plateNumber}`,
                `${actor} rejected your "${record.type}" record: ${trimmedReason}`,
                'maintenance_record',
                id
            ).catch(console.error)
        }

        revalidatePath(`/trucks/${record.truckId}`)
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to reject maintenance record:', error)
        return { error: error instanceof Error ? error.message : 'Failed to reject maintenance record' }
    }
}

export async function approveMaintenanceSchedule(id: string): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'approve_maintenance')

        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            include: { truck: true },
        })
        if (!schedule) return { error: 'Schedule not found' }
        if (schedule.approvalStatus !== 'Pending') {
            return { error: `This schedule has already been ${schedule.approvalStatus.toLowerCase()}` }
        }

        const actor = session.user.name || session.user.email || 'System'

        await prisma.maintenanceSchedule.update({
            where: { id },
            data: {
                approvalStatus: 'Approved',
                approvedBy: actor,
                approvedAt: new Date(),
                rejectionReason: null,
            },
        })

        const requesterId = await findRequesterId(schedule.requestedBy)
        if (requesterId) {
            notifyRequester(
                requesterId,
                'maintenance_approved',
                `Service schedule approved: ${schedule.truck.plateNumber}`,
                `${actor} approved your "${schedule.type}" schedule. It will now raise service alerts.`,
                'maintenance_schedule',
                id
            ).catch(console.error)
        }

        revalidatePath(`/trucks/${schedule.truckId}`)
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to approve maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to approve schedule' }
    }
}

export async function rejectMaintenanceSchedule(id: string, reason: string): Promise<{ success: true } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'approve_maintenance')

        const trimmedReason = (reason || '').trim()
        if (!trimmedReason) return { error: 'A reason is required to reject a schedule' }

        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            include: { truck: true },
        })
        if (!schedule) return { error: 'Schedule not found' }
        if (schedule.approvalStatus !== 'Pending') {
            return { error: `This schedule has already been ${schedule.approvalStatus.toLowerCase()}` }
        }

        const actor = session.user.name || session.user.email || 'System'

        await prisma.maintenanceSchedule.update({
            where: { id },
            data: {
                approvalStatus: 'Rejected',
                approvedBy: actor,
                approvedAt: new Date(),
                rejectionReason: trimmedReason,
                isActive: false,
            },
        })

        const requesterId = await findRequesterId(schedule.requestedBy)
        if (requesterId) {
            notifyRequester(
                requesterId,
                'maintenance_rejected',
                `Service schedule rejected: ${schedule.truck.plateNumber}`,
                `${actor} rejected your "${schedule.type}" schedule: ${trimmedReason}`,
                'maintenance_schedule',
                id
            ).catch(console.error)
        }

        revalidatePath(`/trucks/${schedule.truckId}`)
        revalidatePath('/trucks')
        return { success: true }
    } catch (error) {
        console.error('Failed to reject maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to reject schedule' }
    }
}

/**
 * Was gated only on manage_maintenance and wrote straight through, which let a Manager
 * change an approved schedule's due date with no sign-off - an approve-by-the-back-door
 * around the creation-approval flow. Now takes the same split as every other
 * maintenance write.
 */
export async function updateMaintenanceSchedule(
    id: string,
    formData: FormData
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const nextDueDate = formData.get('nextDueDate') as string
        const nextDueMileage = formData.get('nextDueMileage') as string

        const changes = {
            nextDueDate: nextDueDate ? new Date(nextDueDate).toISOString() : null,
            nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : null,
            isActive: formData.get('isActive') === 'true',
        }

        const existing = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            select: { approvalStatus: true },
        })
        if (!existing) return { error: 'Schedule not found' }
        if (existing.approvalStatus === 'Rejected') {
            return { error: 'A rejected schedule cannot be edited. Create a new one instead.' }
        }

        if (landsImmediately(session.user.role, existing.approvalStatus)) {
            return applyMaintenanceDirect('maintenance_schedule', id, 'update', changes)
        }

        const result = await createEditRequest('maintenance_schedule', id, 'update', changes)
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to update maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to update maintenance schedule' }
    }
}

export async function deleteMaintenanceSchedule(
    id: string,
    reason?: string
): Promise<{ success: true; queued?: boolean } | { error: string }> {
    try {
        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

        const existing = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            select: { approvalStatus: true },
        })
        if (!existing) return { error: 'Schedule not found' }

        if (landsImmediately(session.user.role, existing.approvalStatus)) {
            return applyMaintenanceDirect('maintenance_schedule', id, 'delete', {})
        }

        const result = await createEditRequest('maintenance_schedule', id, 'delete', {}, reason)
        if ('error' in result) return result
        return { success: true, queued: true }
    } catch (error) {
        console.error('Failed to delete maintenance schedule:', error)
        return { error: error instanceof Error ? error.message : 'Failed to delete maintenance schedule' }
    }
}

export async function completeScheduledMaintenance(scheduleId: string, formData: FormData) {
    const schedule = await prisma.maintenanceSchedule.findUnique({
        where: { id: scheduleId },
        include: { truck: true }
    })

    if (!schedule) throw new Error('Schedule not found')

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_maintenance')

    if (schedule.approvalStatus !== 'Approved') {
        throw new Error('This schedule is still awaiting approval and cannot be completed')
    }

    const notes = formData.get('notes') as string
    const performedBy = formData.get('performedBy') as string
    const cost = formData.get('cost') as string

    // The record this produces follows the same approval rule as a manually logged
    // one: an approver's completion stands, anyone else's waits for sign-off.
    const isAutoApproved = hasPermission(session.user.role, 'approve_maintenance')
    const actor = session.user.name || session.user.email || 'System'

    const record = await prisma.maintenanceRecord.create({
        data: {
            truckId: schedule.truckId,
            type: schedule.type,
            date: new Date(),
            cost: parseFloat(cost) || 0,
            mileageAtService: schedule.truck.mileage,
            status: 'Completed',
            notes: notes || null,
            performedBy: performedBy || null,
            scheduleId,
            approvalStatus: isAutoApproved ? 'Approved' : 'Pending',
            requestedBy: actor,
            approvedBy: isAutoApproved ? actor : null,
            approvedAt: isAutoApproved ? new Date() : null,
        },
    })

    if (!isAutoApproved) {
        notifyApprovers(
            'maintenance_approval_pending',
            `Maintenance approval needed: ${schedule.truck.plateNumber}`,
            `${actor} completed the scheduled "${schedule.type}" and it needs your approval.`,
            'maintenance_record',
            record.id
        ).catch(console.error)
    }

    // Rolling the schedule forward and touching the truck are both consequences of the
    // service being accepted, so an unapproved completion leaves the schedule due. It
    // rolls forward when the record is approved instead.
    if (isAutoApproved) {
        await rollScheduleForward(scheduleId)
        await recomputeTruckDerivedValues(schedule.truckId)
    }

    revalidatePath(`/trucks/${schedule.truckId}`)
    revalidatePath('/trucks')
}

/** Advances a schedule to its next due date/mileage after an accepted service. */
async function rollScheduleForward(scheduleId: string) {
    const schedule = await prisma.maintenanceSchedule.findUnique({
        where: { id: scheduleId },
        include: { truck: true },
    })
    if (!schedule) return

    await prisma.maintenanceSchedule.update({
        where: { id: scheduleId },
        data: {
            lastCompletedDate: new Date(),
            nextDueDate: schedule.intervalDays
                ? new Date(Date.now() + schedule.intervalDays * 24 * 60 * 60 * 1000)
                : null,
            nextDueMileage: schedule.intervalMileage
                ? schedule.truck.mileage + schedule.intervalMileage
                : null,
        },
    })
}

// ============ COMPONENT LIFECYCLE TRACKING (PARTS) ============

export async function createPart(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
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
            return { error: 'Missing required fields' }
        }

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_maintenance')

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
        return { success: true }
    } catch (error) {
        console.error('Failed to create part:', error)
        return { error: error instanceof Error ? error.message : 'Failed to add component' }
    }
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
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_maintenance')

    await prisma.part.update({
        where: { id },
        data: { status },
    })
    revalidatePath('/trucks')
}

export async function replacePart(oldPartId: string, formData: FormData) {
    const oldPart = await prisma.part.findUnique({ where: { id: oldPartId } })
    if (!oldPart) throw new Error('Part not found')

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_maintenance')

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

    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_inventory')

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
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_inventory')

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
            approvalStatus: 'Approved', // A pending schedule is inert until signed off
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
            // Pending and rejected records are excluded: unapproved spend must not
            // land in fleet cost totals.
            approvalStatus: 'Approved',
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

// ============ TRUCK DOCUMENTS ============

export async function uploadTruckDocument(formData: FormData): Promise<{ success: true } | { error: string }> {
    try {
        const truckId = formData.get('truckId') as string
        const name = formData.get('name') as string
        const type = formData.get('type') as string
        const expiryDate = formData.get('expiryDate') as string
        const notes = formData.get('notes') as string
        const file = formData.get('file') as File

        if (!truckId || !name || !type || !file) {
            return { error: 'Missing required fields' }
        }

        const session = await auth()
        if (!session?.user?.role) return { error: 'Unauthorized' }
        checkPermission(session.user.role, 'manage_truck_documents')

        const uploadResult = await uploadToCloudinary(file, 'wet-and-dry/truck-documents')

        await prisma.truckDocument.create({
            data: {
                truckId,
                name,
                type,
                url: uploadResult.secure_url,
                cloudinaryPublicId: uploadResult.public_id,
                expiryDate: expiryDate ? new Date(expiryDate) : null,
                notes: notes || null,
            },
        })

        revalidatePath(`/trucks/${truckId}`)
        return { success: true }
    } catch (error) {
        console.error('Failed to upload document:', error)
        return { error: error instanceof Error ? error.message : 'Failed to upload document' }
    }
}

export async function deleteTruckDocument(id: string, truckId: string) {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_truck_documents')

    try {
        const document = await prisma.truckDocument.findUnique({ where: { id } })
        if (!document) throw new Error('Document not found')

        await deleteFromCloudinary(document.cloudinaryPublicId)

        await prisma.truckDocument.delete({ where: { id } })

        revalidatePath(`/trucks/${truckId}`)
    } catch (error) {
        console.error('Failed to delete document:', error)
        throw new Error('Failed to delete document')
    }
}

// ============ SCHEDULED FLEET ALERT CHECKS ============

// Check for maintenance due (by date) and send notifications
export async function checkMaintenanceDueByDate() {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    try {
        const dueSchedules = await prisma.maintenanceSchedule.findMany({
            where: {
                isActive: true,
                approvalStatus: 'Approved', // A pending schedule is inert until signed off
                nextDueDate: {
                    lte: sevenDaysFromNow,
                    gte: now
                }
            },
            include: { truck: true }
        })

        for (const schedule of dueSchedules) {
            const daysUntil = Math.ceil((schedule.nextDueDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            await notifyMaintenanceDue(
                schedule.truckId,
                schedule.truck.plateNumber,
                schedule.type,
                'date',
                `Due in ${daysUntil} days (${schedule.nextDueDate!.toLocaleDateString()})`
            )
        }

        return { success: true, count: dueSchedules.length }
    } catch (error) {
        console.error('[Fleet] Failed to check maintenance due dates:', error)
        return { success: false, error: 'Failed to check maintenance' }
    }
}

// Check for maintenance due (by mileage) and send notifications
export async function checkMaintenanceDueByMileage() {
    try {
        const schedules = await prisma.maintenanceSchedule.findMany({
            where: {
                isActive: true,
                approvalStatus: 'Approved', // A pending schedule is inert until signed off
                nextDueMileage: { not: null }
            },
            include: { truck: true }
        })

        let notificationsSent = 0

        for (const schedule of schedules) {
            const currentMileage = schedule.truck.mileage
            const dueMileage = schedule.nextDueMileage!

            // Alert when within 500km of due mileage
            if (currentMileage >= dueMileage - 500) {
                await notifyMaintenanceDue(
                    schedule.truckId,
                    schedule.truck.plateNumber,
                    schedule.type,
                    'mileage',
                    `Current: ${currentMileage.toLocaleString()} km, Due at: ${dueMileage.toLocaleString()} km`
                )
                notificationsSent++
            }
        }

        return { success: true, count: notificationsSent }
    } catch (error) {
        console.error('[Fleet] Failed to check maintenance mileage:', error)
        return { success: false, error: 'Failed to check maintenance' }
    }
}

// Check for expiring documents and send notifications
export async function checkExpiringDocuments() {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    try {
        const expiringDocs = await prisma.truckDocument.findMany({
            where: {
                expiryDate: {
                    lte: thirtyDaysFromNow,
                    gte: now
                }
            },
            include: { truck: true }
        })

        for (const doc of expiringDocs) {
            await notifyDocumentExpiring(
                doc.truckId,
                doc.truck.plateNumber,
                doc.type,
                doc.expiryDate!
            )
        }

        return { success: true, count: expiringDocs.length }
    } catch (error) {
        console.error('[Fleet] Failed to check expiring documents:', error)
        return { success: false, error: 'Failed to check documents' }
    }
}

// Check for low spare parts and send notifications
export async function checkLowSpareParts() {
    try {
        // Fetch all parts and filter manually (Prisma doesn't support field-to-field comparison)
        const allParts = await prisma.sparePartInventory.findMany()
        const partsToNotify = allParts.filter(part => part.quantity <= part.minQuantity)

        for (const part of partsToNotify) {
            await notifySparePartsLow(
                part.id,
                part.name,
                part.quantity,
                part.minQuantity
            )
        }

        return { success: true, count: partsToNotify.length }
    } catch (error) {
        console.error('[Fleet] Failed to check spare parts:', error)
        return { success: false, error: 'Failed to check spare parts' }
    }
}

// Run all fleet alert checks (can be called via cron job)
export async function runFleetAlertChecks() {
    console.log('[Fleet] Running scheduled fleet alert checks...')

    const results = {
        maintenanceDate: await checkMaintenanceDueByDate(),
        maintenanceMileage: await checkMaintenanceDueByMileage(),
        expiringDocuments: await checkExpiringDocuments(),
        lowSpareParts: await checkLowSpareParts(),
    }

    console.log('[Fleet] Fleet alert checks complete:', results)
    return results
}
