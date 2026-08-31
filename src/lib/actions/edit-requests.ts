'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'
import { findOpenRequest, pickEditable, snapshotOf, applyApprovedRequest } from '@/lib/edit-requests/core'
import { getApplier } from '@/lib/edit-requests/registry'
import { notifyApprovers, notifyRequester } from '@/lib/actions/notifications'
import type { EditOperation, EditRequestResult, FieldValues } from '@/lib/edit-requests/types'

// A 'use server' module may only export async functions. All shared logic lives in
// src/lib/edit-requests/, which the verification script imports directly.

/**
 * Submits a proposed change. The whitelist is applied HERE, at request time, so a
 * crafted payload never reaches the database and the stored proposedChanges is exactly
 * what an approver will see.
 *
 * Callers holding the approve permission never reach this - fuel.ts applies directly.
 */
export async function createEditRequest(
    entityType: string,
    entityId: string,
    operation: EditOperation,
    rawChanges: FieldValues,
    reason?: string
): Promise<EditRequestResult> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }

    const applier = getApplier(entityType)
    if (!applier) return { error: 'Unknown record type' }
    if (!hasPermission(role, applier.requestPermission)) return { error: 'Unauthorized' }

    const current = await applier.load(entityId)
    if (!current) return { error: 'Record not found' }

    const open = await findOpenRequest(entityType, entityId)
    if (open) {
        return { error: `${open.requestedBy} already has a change awaiting approval on this record.` }
    }

    const changes = pickEditable(rawChanges, applier.editableFields)
    if (operation === 'update' && Object.keys(changes).length === 0) {
        return { error: 'No editable fields were changed' }
    }
    if (operation === 'delete' && !reason?.trim()) {
        return { error: 'A reason is required to request deletion' }
    }

    const created = await prisma.editRequest.create({
        data: {
            entityType,
            entityId,
            operation,
            proposedChanges: operation === 'update' ? (changes as object) : undefined,
            previousValues: snapshotOf(current, applier.editableFields) as object,
            rejectionReason: operation === 'delete' ? reason!.trim() : undefined,
            requestedBy: session.user.name || session.user.email || role,
            requestedById: session.user.id ?? undefined,
        },
    })

    await notifyApprovers(
        'fuel_edit_pending',
        operation === 'delete' ? 'Fuel log deletion requested' : 'Fuel log edit requested',
        `${created.requestedBy} requested ${operation === 'delete' ? 'deletion of' : 'a change to'} ${applier.describe(current)}.`,
        'edit_request',
        created.id
    )

    revalidatePath('/fuel')
    return { success: true }
}

export async function approveEditRequest(
    id: string,
    opts?: { acceptStale?: boolean }
): Promise<EditRequestResult> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }

    const request = await prisma.editRequest.findUnique({ where: { id } })
    if (!request) return { error: 'Edit request not found' }

    const applier = getApplier(request.entityType)
    if (!applier) return { error: 'Unknown record type' }
    if (!hasPermission(role, applier.approvePermission)) return { error: 'Unauthorized' }

    const result = await applyApprovedRequest(id, opts)
    if ('error' in result) return result

    await prisma.editRequest.update({
        where: { id },
        data: { approvedBy: session.user.name || session.user.email || role },
    })

    if (request.requestedById) {
        await notifyRequester(
            request.requestedById,
            'fuel_edit_approved',
            'Fuel log change approved',
            `Your ${request.operation === 'delete' ? 'deletion' : 'edit'} request was approved.`,
            'edit_request',
            request.id
        )
    }

    revalidatePath('/fuel')
    return { success: true }
}

export async function rejectEditRequest(id: string, reason: string): Promise<EditRequestResult> {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return { error: 'Unauthorized' }
    if (!reason?.trim()) return { error: 'A reason is required' }

    const request = await prisma.editRequest.findUnique({ where: { id } })
    if (!request) return { error: 'Edit request not found' }
    if (request.status !== 'Pending') {
        return { error: `This request has already been ${request.status.toLowerCase()}` }
    }

    const applier = getApplier(request.entityType)
    if (!applier) return { error: 'Unknown record type' }
    if (!hasPermission(role, applier.approvePermission)) return { error: 'Unauthorized' }

    // The live record is deliberately untouched. Rejected rows stay for audit.
    await prisma.editRequest.update({
        where: { id },
        data: {
            status: 'Rejected',
            rejectionReason: reason.trim(),
            approvedBy: session.user.name || session.user.email || role,
            approvedAt: new Date(),
        },
    })

    if (request.requestedById) {
        await notifyRequester(
            request.requestedById,
            'fuel_edit_rejected',
            'Fuel log change rejected',
            `Your ${request.operation === 'delete' ? 'deletion' : 'edit'} request was rejected: ${reason.trim()}`,
            'edit_request',
            request.id
        )
    }

    revalidatePath('/fuel')
    return { success: true }
}

export async function getEditRequestsFor(entityType: string, entityId: string) {
    const session = await auth()
    if (!session?.user?.role) return []
    const applier = getApplier(entityType)
    if (!applier || !hasPermission(session.user.role, applier.requestPermission)) return []

    return prisma.editRequest.findMany({
        where: { entityType, entityId },
        orderBy: { createdAt: 'desc' },
    })
}

/**
 * Pending requests the caller may act on. Approvers see everything; a requester sees
 * only their own, so they can tell a submitted change from a landed one.
 */
export async function getPendingEditRequests(entityType?: string) {
    const session = await auth()
    const role = session?.user?.role
    if (!role) return []

    const applier = entityType ? getApplier(entityType) : null
    if (entityType && !applier) return []

    const canApprove = applier ? hasPermission(role, applier.approvePermission) : false
    if (applier && !canApprove && !hasPermission(role, applier.requestPermission)) return []

    return prisma.editRequest.findMany({
        where: {
            status: 'Pending',
            ...(entityType ? { entityType } : {}),
            ...(canApprove ? {} : { requestedById: session.user.id ?? '__none__' }),
        },
        orderBy: { createdAt: 'desc' },
    })
}
