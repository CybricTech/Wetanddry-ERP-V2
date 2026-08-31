import prisma from '@/lib/prisma';
import type { EntityApplier, FieldValues } from './types';

function coerce(changes: FieldValues): FieldValues {
    const out: FieldValues = {};
    if ('type' in changes) out.type = changes.type;
    if ('intervalType' in changes) out.intervalType = changes.intervalType;
    if ('priority' in changes) out.priority = changes.priority;
    if ('notes' in changes) out.notes = (changes.notes as string) || null;
    if ('isActive' in changes) out.isActive = Boolean(changes.isActive);
    if ('nextDueDate' in changes) {
        const raw = changes.nextDueDate;
        out.nextDueDate = raw === null || raw === '' ? null : new Date(raw as string);
    }
    for (const field of ['intervalDays', 'intervalMileage', 'nextDueMileage'] as const) {
        if (field in changes) {
            const raw = changes[field];
            out[field] = raw === null || raw === '' ? null : Number(raw);
        }
    }
    return out;
}

export const maintenanceScheduleApplier: EntityApplier = {
    requestPermission: 'manage_maintenance',
    approvePermission: 'approve_maintenance',

    // truckId absent for the same reason as on maintenance_record: a schedule belongs
    // to one truck for its whole life. approvalStatus is absent - this path edits the
    // schedule, never its own sign-off.
    editableFields: [
        'type', 'intervalType', 'intervalDays', 'intervalMileage',
        'nextDueDate', 'nextDueMileage', 'priority', 'isActive', 'notes',
    ],

    async load(id) {
        const schedule = await prisma.maintenanceSchedule.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                intervalType: true,
                intervalDays: true,
                intervalMileage: true,
                nextDueDate: true,
                nextDueMileage: true,
                priority: true,
                isActive: true,
                notes: true,
                truckId: true,
                truck: { select: { plateNumber: true } },
            },
        });
        return schedule as FieldValues | null;
    },

    async validate(changes, current) {
        const intervalType = (changes.intervalType ?? current.intervalType) as string;

        // A schedule with no interval for its own type can never come due, so it would
        // sit inert forever without ever saying so.
        const days = 'intervalDays' in changes ? changes.intervalDays : current.intervalDays;
        const mileage = 'intervalMileage' in changes ? changes.intervalMileage : current.intervalMileage;

        if ((intervalType === 'date' || intervalType === 'both') && !days) {
            return 'A date-based schedule needs an interval in days';
        }
        if ((intervalType === 'mileage' || intervalType === 'both') && !mileage) {
            return 'A mileage-based schedule needs an interval in kilometres';
        }
        return null;
    },

    async applyUpdate(id, changes) {
        await prisma.maintenanceSchedule.update({ where: { id }, data: coerce(changes) });
    },

    async applyDelete(id) {
        // MaintenanceRecord.scheduleId is a bare string, not an FK: the schema states
        // the schedule may be deleted while its service history stays. Do not cascade -
        // the dangling id on past records is intentional.
        await prisma.maintenanceSchedule.delete({ where: { id } });
    },

    noun: 'Service schedule',

    notifications: {
        pending: 'maintenance_edit_pending',
        approved: 'maintenance_edit_approved',
        rejected: 'maintenance_edit_rejected',
    },

    revalidatePaths: (entity) =>
        entity.truckId ? ['/trucks', `/trucks/${entity.truckId}`] : ['/trucks'],

    describe(entity) {
        const plate = (entity.truck as { plateNumber?: string } | null)?.plateNumber ?? 'a truck';
        return `the ${entity.type} schedule on ${plate}`;
    },

    // No onApplied: a schedule feeds due-date alerts, not Truck.mileage or
    // lastServiceDate, so nothing derived needs recomputing when one changes.
};
