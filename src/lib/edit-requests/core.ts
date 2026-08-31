// Session-free mechanics shared by every entityType. Deliberately contains no auth()
// call: everything here is directly runnable from scripts/verify-fuel-edits.ts, which
// is the only way this logic can be verified in a repo with no test framework.
import prisma from '@/lib/prisma';
import { getApplier } from './registry';
import type { EditOperation, EditRequestResult, FieldValues } from './types';

/**
 * Strips everything outside the whitelist. Called at REQUEST time, not approval time,
 * so a crafted payload never reaches the database in the first place and the stored
 * proposedChanges is exactly what an approver sees.
 */
export function pickEditable(raw: FieldValues, fields: readonly string[]): FieldValues {
    const out: FieldValues = {};
    for (const field of fields) {
        if (field in raw && raw[field] !== undefined) out[field] = raw[field];
    }
    return out;
}

/** The whitelisted subset of an entity, for previousValues and diffing. */
export function snapshotOf(entity: FieldValues, fields: readonly string[]): FieldValues {
    const out: FieldValues = {};
    for (const field of fields) out[field] = entity[field] ?? null;
    return out;
}

/**
 * Fields that moved between request time and now. Compared through JSON so a Date and
 * the ISO string it round-tripped to are treated as equal — proposedChanges is stored
 * as JSON, so previousValues has already been through that conversion.
 */
export function detectStale(
    previous: FieldValues,
    current: FieldValues,
    fields: readonly string[]
): string[] {
    const stale: string[] = [];
    for (const field of fields) {
        const a = JSON.stringify(previous[field] ?? null);
        const b = JSON.stringify(current[field] ?? null);
        if (a !== b) stale.push(field);
    }
    return stale;
}

/** The open request blocking a second one, or null. Only Pending counts. */
export async function findOpenRequest(entityType: string, entityId: string) {
    return prisma.editRequest.findFirst({
        where: { entityType, entityId, status: 'Pending' },
        orderBy: { createdAt: 'desc' },
    });
}

/**
 * Runs an approved request against the live row. Session-free on purpose — the caller
 * has already established that the actor holds the applier's approvePermission.
 *
 * Order matters: snapshot BEFORE the write, because the recompute hook needs the old
 * date and truckId to find the successor whose efficiency depended on this row.
 */
export async function applyApprovedRequest(
    requestId: string,
    opts?: { acceptStale?: boolean }
): Promise<EditRequestResult> {
    const request = await prisma.editRequest.findUnique({ where: { id: requestId } });
    if (!request) return { error: 'Edit request not found' };
    if (request.status !== 'Pending') {
        return { error: `This request has already been ${request.status.toLowerCase()}` };
    }

    const applier = getApplier(request.entityType);
    if (!applier) return { error: `No applier registered for ${request.entityType}` };

    const current = await applier.load(request.entityId);
    if (!current) return { error: 'The record this request targets no longer exists' };

    const before = { ...current };
    const operation = request.operation as EditOperation;
    const changes = (request.proposedChanges ?? {}) as FieldValues;

    if (request.previousValues) {
        const stale = detectStale(
            request.previousValues as FieldValues,
            snapshotOf(current, applier.editableFields),
            applier.editableFields
        );
        if (stale.length && !opts?.acceptStale) {
            return {
                error: `This record changed since the request was made (${stale.join(', ')}). Review the current values and confirm.`,
            };
        }
    }

    if (operation === 'update') {
        if (Object.keys(changes).length === 0) return { error: 'This request proposes no changes' };
        if (applier.validate) {
            const problem = await applier.validate(changes, current);
            if (problem) return { error: problem };
        }
        await applier.applyUpdate(request.entityId, changes);
    } else {
        await applier.applyDelete(request.entityId);
    }

    // After the write, so a delete's recompute sees the row already gone.
    if (applier.onApplied) await applier.onApplied(before, operation, changes);

    await prisma.editRequest.update({
        where: { id: request.id },
        data: { status: 'Approved', approvedAt: new Date() },
    });

    return { success: true };
}
