import prisma from '@/lib/prisma';
import { recomputeTruckDerivedValues } from '@/lib/truck-mileage';
import type { EntityApplier, FieldValues } from './types';

/**
 * proposedChanges round-trips through JSON, so a Date arrives back as an ISO string and
 * a number may arrive as a string from a form. Each applier coerces its own types.
 */
function coerce(changes: FieldValues): FieldValues {
    const out: FieldValues = {};
    if ('type' in changes) out.type = changes.type;
    if ('status' in changes) out.status = changes.status;
    if ('notes' in changes) out.notes = (changes.notes as string) || null;
    if ('performedBy' in changes) out.performedBy = (changes.performedBy as string) || null;
    if ('date' in changes) out.date = new Date(changes.date as string);
    if ('cost' in changes) out.cost = Number(changes.cost);
    if ('mileageAtService' in changes) {
        const raw = changes.mileageAtService;
        out.mileageAtService = raw === null || raw === '' ? null : Number(raw);
    }
    return out;
}

export const maintenanceRecordApplier: EntityApplier = {
    requestPermission: 'manage_maintenance',
    approvePermission: 'approve_maintenance',

    // truckId is absent on purpose: moving a record between trucks would need a
    // recompute on both. approvalStatus and the approval audit columns are absent
    // because this path edits the service record, never its own sign-off.
    editableFields: ['type', 'date', 'cost', 'mileageAtService', 'status', 'notes', 'performedBy'],

    async load(id) {
        const record = await prisma.maintenanceRecord.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                date: true,
                cost: true,
                mileageAtService: true,
                status: true,
                notes: true,
                performedBy: true,
                truckId: true,
                truck: { select: { plateNumber: true } },
            },
        });
        return record as FieldValues | null;
    },

    async validate(changes) {
        if ('cost' in changes) {
            const cost = Number(changes.cost);
            if (!Number.isFinite(cost) || cost < 0) return 'Cost cannot be negative';
        }
        if ('mileageAtService' in changes && changes.mileageAtService != null && changes.mileageAtService !== '') {
            const mileage = Number(changes.mileageAtService);
            if (!Number.isFinite(mileage) || mileage < 0) return 'Mileage cannot be negative';
        }
        if ('date' in changes && Number.isNaN(new Date(changes.date as string).getTime())) {
            return 'Date is not valid';
        }
        return null;
    },

    async applyUpdate(id, changes) {
        await prisma.maintenanceRecord.update({ where: { id }, data: coerce(changes) });
    },

    async applyDelete(id) {
        await prisma.maintenanceRecord.delete({ where: { id } });
    },

    noun: 'Maintenance record',

    notifications: {
        pending: 'maintenance_edit_pending',
        approved: 'maintenance_edit_approved',
        rejected: 'maintenance_edit_rejected',
    },

    revalidatePaths: (entity) =>
        entity.truckId ? ['/trucks', `/trucks/${entity.truckId}`] : ['/trucks'],

    describe(entity) {
        const plate = (entity.truck as { plateNumber?: string } | null)?.plateNumber ?? 'a truck';
        return `${entity.type} on ${plate}`;
    },

    async onApplied(before) {
        // The truck's odometer and last service date are derived from its approved
        // records, so any edit or delete has to re-derive them. `before` carries the
        // truckId even after a delete, which is why the core snapshots first.
        const truckId = before.truckId as string | null;
        if (truckId) await recomputeTruckDerivedValues(truckId);
    },
};
