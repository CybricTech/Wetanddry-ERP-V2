/**
 * Verification for fuel log edit & delete approvals.
 * Spec: docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md
 * Plan: docs/superpowers/plans/2026-08-31-fuel-log-edit-approvals.md
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config scripts/verify-fuel-edits.ts
 *
 * Creates its own throwaway truck and fuel logs, prefixed __verify_, and removes them
 * on every exit path. Never asserts against pre-existing production rows.
 */
import { PrismaClient } from '../src/generated/prisma';

const prisma = new PrismaClient();
const TAG = '__verify_fuel_edits';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) return;
    failures++;
    console.log(`  FAIL  ${label}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

async function cleanup() {
    const trucks = await prisma.truck.findMany({
        where: { plateNumber: { startsWith: TAG } },
        select: { id: true },
    });
    const truckIds = trucks.map((t) => t.id);
    if (truckIds.length) {
        const logs = await prisma.fuelLog.findMany({
            where: { truckId: { in: truckIds } },
            select: { id: true },
        });
        const logIds = logs.map((l) => l.id);
        await prisma.fuelRequest.updateMany({
            where: { fuelLogId: { in: logIds } },
            data: { fuelLogId: null },
        });
        await prisma.fuelRequest.deleteMany({ where: { requestedBy: TAG } });
        await prisma.editRequest.deleteMany({ where: { entityId: { in: logIds } } });
        await prisma.fuelLog.deleteMany({ where: { truckId: { in: truckIds } } });
        await prisma.maintenanceRecord.deleteMany({ where: { truckId: { in: truckIds } } });
        await prisma.truck.deleteMany({ where: { id: { in: truckIds } } });
    }
    await prisma.editRequest.deleteMany({ where: { requestedBy: TAG } });
}

async function main() {
    await cleanup();

    console.log('Task 1 - EditRequest table');
    const row = await prisma.editRequest.create({
        data: { entityType: 'fuel_log', entityId: `${TAG}_probe`, requestedBy: TAG },
    });
    check('defaults to Pending', row.status, 'Pending');
    check('defaults to update', row.operation, 'update');
    check('proposedChanges nullable', row.proposedChanges, null);
    await prisma.editRequest.delete({ where: { id: row.id } });

    await cleanup();
    console.log(failures === 0 ? '\nPASS - all assertions held' : `\nFAIL - ${failures} assertion(s) failed`);
    process.exit(failures === 0 ? 0 : 1);
}

main()
    .catch(async (e) => {
        console.error(e);
        await cleanup().catch(() => {});
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
