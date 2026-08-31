// Efficiency recompute for fuel logs.
//
// BOUNDARY: this module never reads or writes Truck.mileage. The truck odometer is
// owned by separate concurrent work; see "The odometer seam" in
// docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md.
import prisma from '@/lib/prisma';

export interface FuelLogSnapshot {
    id: string;
    truckId: string | null;
    date: Date;
}

/**
 * The next fill on the same truck after `date`, ordered (date asc, createdAt asc).
 * Its stored efficiency was computed as a delta from the log at `excludeId`, so it is
 * the only other row whose inputs change when that log moves or is deleted.
 */
export async function findSuccessorLogId(
    truckId: string,
    date: Date,
    excludeId: string
): Promise<string | null> {
    const successor = await prisma.fuelLog.findFirst({
        where: { truckId, id: { not: excludeId }, date: { gte: date } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: { id: true },
    });
    return successor?.id ?? null;
}

/**
 * Reconstructs the write-time formula at the log's own point in time.
 *
 * issueFuel compares against Truck.mileage, which is the running maximum across fuel
 * and approved maintenance readings. `baseline` rebuilds exactly that maximum as it
 * stood before this fill — without reading Truck, which this module must not do.
 *
 * A log with no prior reading has no recoverable starting odometer and resolves to
 * null. Callers therefore only invoke this when mileage, liters, or date changed.
 */
export async function recomputeFuelLogEfficiency(logId: string): Promise<void> {
    const log = await prisma.fuelLog.findUnique({
        where: { id: logId },
        select: { id: true, truckId: true, date: true, liters: true, mileage: true },
    });
    if (!log) return;

    // Equipment fills carry no odometer, so km/L is not defined for them.
    if (!log.truckId || log.mileage === null) {
        await prisma.fuelLog.update({ where: { id: log.id }, data: { efficiency: null } });
        return;
    }

    const [priorFuel, priorService] = await Promise.all([
        prisma.fuelLog.aggregate({
            _max: { mileage: true },
            where: { truckId: log.truckId, id: { not: log.id }, date: { lt: log.date } },
        }),
        prisma.maintenanceRecord.aggregate({
            _max: { mileageAtService: true },
            where: { truckId: log.truckId, approvalStatus: 'Approved', date: { lt: log.date } },
        }),
    ]);

    const candidates = [priorFuel._max.mileage, priorService._max.mileageAtService].filter(
        (v): v is number => v !== null && v !== undefined
    );
    const baseline = candidates.length ? Math.max(...candidates) : null;

    const efficiency =
        baseline !== null && log.mileage > baseline && log.liters > 0
            ? (log.mileage - baseline) / log.liters
            : null;

    await prisma.fuelLog.update({ where: { id: log.id }, data: { efficiency } });
}

/**
 * Approach B: recompute the changed log and its immediate successor, nothing else.
 *
 * Takes the log as it stood BEFORE the change, because an edit may move its date (so
 * the successor differs before and after) and a delete leaves nothing to read. Both
 * positions are collected and de-duplicated, so update and delete share one path.
 */
export async function recomputeAfterFuelLogChange(before: FuelLogSnapshot): Promise<void> {
    const affected = new Set<string>();

    if (before.truckId) {
        const oldSuccessor = await findSuccessorLogId(before.truckId, before.date, before.id);
        if (oldSuccessor) affected.add(oldSuccessor);
    }

    const still = await prisma.fuelLog.findUnique({
        where: { id: before.id },
        select: { id: true, truckId: true, date: true },
    });

    if (still) {
        affected.add(still.id);
        if (still.truckId) {
            const newSuccessor = await findSuccessorLogId(still.truckId, still.date, still.id);
            if (newSuccessor) affected.add(newSuccessor);
        }
    }

    for (const id of affected) {
        await recomputeFuelLogEfficiency(id);
    }
}
