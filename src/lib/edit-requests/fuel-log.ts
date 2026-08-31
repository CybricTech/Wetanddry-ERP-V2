import prisma from '@/lib/prisma';
import { getFuelStockPosition } from '@/lib/fuel-stock';
import { recomputeAfterFuelLogChange } from '@/lib/fuel-metrics';
import type { EditOperation, EntityApplier, FieldValues } from './types';

// Changing any of these invalidates the stored km/L. A cost-only correction does not,
// and must not trigger a recompute that could null a legitimate figure.
const EFFICIENCY_INPUTS = ['mileage', 'liters', 'date'] as const;

/**
 * proposedChanges round-trips through JSON, so a Date arrives back as an ISO string
 * and a number may arrive as a string from a form. Each applier coerces its own types.
 */
function coerce(changes: FieldValues): FieldValues {
    const out: FieldValues = {};
    if ('date' in changes) out.date = new Date(changes.date as string);
    if ('liters' in changes) out.liters = Number(changes.liters);
    if ('cost' in changes) out.cost = Number(changes.cost);
    if ('mileage' in changes) {
        const raw = changes.mileage;
        out.mileage = raw === null || raw === '' ? null : Number(raw);
    }
    return out;
}

export const fuelLogApplier: EntityApplier = {
    requestPermission: 'view_fuel_logs',
    approvePermission: 'approve_fuel_requests',

    // truckId/equipmentId are absent on purpose: reassigning a log across trucks would
    // need a recompute on two trucks. The fix for a wrong-truck log is delete + re-issue.
    // efficiency is absent because it is derived, never entered.
    editableFields: ['date', 'liters', 'cost', 'mileage'],

    async load(id) {
        const log = await prisma.fuelLog.findUnique({
            where: { id },
            select: {
                id: true,
                date: true,
                liters: true,
                cost: true,
                mileage: true,
                truckId: true,
                truck: { select: { plateNumber: true } },
                equipment: { select: { name: true } },
            },
        });
        return log as FieldValues | null;
    },

    async validate(changes, current) {
        if (!('liters' in changes)) return null;

        const next = Number(changes.liters);
        if (!Number.isFinite(next) || next <= 0) return 'Litres must be greater than zero';

        const delta = next - Number(current.liters);
        if (delta <= 0) return null; // lowering returns fuel to stock, always fine

        const { currentStock } = await getFuelStockPosition();
        if (delta > currentStock) {
            return currentStock <= 0
                ? 'Cannot increase litres. Current stock is 0 L. Record a deposit first.'
                : `Insufficient fuel stock. Current stock: ${currentStock.toFixed(1)} L, this edit needs a further ${delta.toFixed(1)} L.`;
        }
        return null;
    },

    async applyUpdate(id, changes) {
        await prisma.fuelLog.update({ where: { id }, data: coerce(changes) });
    },

    async applyDelete(id) {
        // FuelRequest.fuelLog is an optional relation with no explicit referential
        // action, so Prisma's default SetNull applies: the request keeps its Approved
        // status with fuelLogId cleared. It WAS approved; rewriting that would be a lie.
        await prisma.fuelLog.delete({ where: { id } });
    },

    noun: 'Fuel log',

    notifications: {
        pending: 'fuel_edit_pending',
        approved: 'fuel_edit_approved',
        rejected: 'fuel_edit_rejected',
    },

    revalidatePaths: () => ['/fuel'],

    describe(entity) {
        const target =
            (entity.truck as { plateNumber?: string } | null)?.plateNumber ??
            (entity.equipment as { name?: string } | null)?.name ??
            'unassigned';
        return `${entity.liters} L to ${target}`;
    },

    async onApplied(before, operation: EditOperation, changes) {
        const touchesEfficiency =
            operation === 'delete' || EFFICIENCY_INPUTS.some((field) => field in changes);
        if (!touchesEfficiency) return;

        await recomputeAfterFuelLogChange({
            id: before.id as string,
            truckId: (before.truckId as string | null) ?? null,
            date: new Date(before.date as string),
        });
    },
};
