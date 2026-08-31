// Session-free mechanics shared by every entityType. Deliberately contains no auth()
// call: everything here is directly runnable from scripts/verify-fuel-edits.ts, which
// is the only way this logic can be verified in a repo with no test framework.
import prisma from '@/lib/prisma';
import type { FieldValues } from './types';

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
