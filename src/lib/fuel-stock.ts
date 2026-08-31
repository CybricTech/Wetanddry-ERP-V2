// Extracted from actions/fuel.ts so non-action modules (the fuel_log edit applier)
// can use them. A 'use server' file may only export async functions, so costOf
// cannot live there and be imported.
import prisma from '@/lib/prisma';

/**
 * Current fuel stock and the blended cost per litre across all deposits. Shared by the
 * request path (for an estimate) and the approval path (for the cost actually booked),
 * so the two can never drift apart.
 */
export async function getFuelStockPosition() {
    const [depositAgg, depositCostAgg, issuanceAgg] = await Promise.all([
        prisma.fuelDeposit.aggregate({ _sum: { liters: true } }),
        prisma.fuelDeposit.aggregate({ _sum: { totalCost: true } }),
        prisma.fuelLog.aggregate({ _sum: { liters: true } }),
    ]);

    const totalDeposited = depositAgg._sum.liters ?? 0;
    const totalDepositCost = depositCostAgg._sum.totalCost ?? 0;
    const totalIssued = issuanceAgg._sum.liters ?? 0;

    return {
        currentStock: totalDeposited - totalIssued,
        blendedCostPerLiter: totalDeposited > 0 ? totalDepositCost / totalDeposited : 0,
    };
}

export function costOf(liters: number, blendedCostPerLiter: number) {
    return Math.round(liters * blendedCostPerLiter * 100) / 100;
}
