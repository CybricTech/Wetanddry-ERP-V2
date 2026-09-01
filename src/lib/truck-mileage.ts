// Truck values derived from other records.
//
// BOUNDARY: this module never reads or writes FuelLog.efficiency. That is owned by
// src/lib/fuel-metrics.ts, which correspondingly never touches Truck.mileage. The two
// meet only here, where the highest fuel odometer reading is one input to the truck's
// mileage - read, never written.
//
// Server-only: imports prisma. Kept out of src/lib/actions/ so it carries no
// 'use server' directive and stays callable from scripts/verify-maintenance-edits.ts,
// which has no request context and therefore cannot reach auth().
import prisma from '@/lib/prisma';

/**
 * Recomputes the values on Truck that are derived from other records.
 *
 * `lastServiceDate` is derived outright - approved maintenance records are its only
 * source. `mileage` is the max across all three odometer sources, because fuel logs
 * write it on every fill and feed efficiency, so deriving it from maintenance alone
 * would drop it below a reading already used in those figures.
 *
 * This is the single place truck values are derived. It replaces the former
 * forward-only applyMaintenanceRecordToTruck, so a correction can now move a value
 * down - which is the repair, not the risk: efficiency is a delta against
 * Truck.mileage at fill time, so an inflated odometer silently records null
 * efficiency on every later fill until it is corrected.
 *
 * Historical FuelLog.efficiency is deliberately not rewritten. Those values were
 * correct against what was known when written.
 */
export async function recomputeTruckDerivedValues(truckId: string): Promise<void> {
    const [maintenance, fuel, truck] = await Promise.all([
        prisma.maintenanceRecord.aggregate({
            where: { truckId, approvalStatus: 'Approved' },
            _max: { date: true, mileageAtService: true },
        }),
        prisma.fuelLog.aggregate({
            where: { truckId },
            _max: { mileage: true },
        }),
        prisma.truck.findUnique({
            where: { id: truckId },
            select: { manualMileage: true },
        }),
    ]);

    if (!truck) return;

    const mileage = Math.max(
        maintenance._max.mileageAtService ?? 0,
        fuel._max.mileage ?? 0,
        truck.manualMileage ?? 0,
    );

    await prisma.truck.update({
        where: { id: truckId },
        data: {
            lastServiceDate: maintenance._max.date,
            mileage,
        },
    });
}
