/**
 * Verification for fuel log edit & delete approvals.
 * Spec: docs/superpowers/specs/2026-08-31-fuel-log-edit-approvals-design.md
 * Plan: docs/superpowers/plans/2026-08-31-fuel-log-edit-approvals.md
 *
 *   TS_NODE_BASEURL=. npx ts-node --compiler-options '{"module":"CommonJS"}' -r dotenv/config -r tsconfig-paths/register scripts/verify-fuel-edits.ts
 *
 * Creates its own throwaway truck and fuel logs, prefixed __verify_, and removes them
 * on every exit path. Never asserts against pre-existing production rows.
 */
import { PrismaClient } from '../src/generated/prisma';
import { recomputeFuelLogEfficiency, findSuccessorLogId } from '../src/lib/fuel-metrics';
import { pickEditable, snapshotOf, detectStale, findOpenRequest } from '../src/lib/edit-requests/core';
import { getApplier } from '../src/lib/edit-requests/registry';
import { getFuelStockPosition } from '../src/lib/fuel-stock';

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

    console.log('\nTask 2 - efficiency recompute');
    const truck = await prisma.truck.create({
        data: { plateNumber: `${TAG}_A`, model: 'Verify', purchaseDate: new Date('2026-01-01'), mileage: 0 },
    });
    const d = (day: number) => new Date(`2026-03-${String(day).padStart(2, '0')}T00:00:00.000Z`);
    // Three fills: 1000 -> 1500 -> 2000 km, 100 L each.
    const l1 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(1), liters: 100, cost: 1, mileage: 1000, efficiency: null } });
    const l2 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(2), liters: 100, cost: 1, mileage: 1500, efficiency: null } });
    const l3 = await prisma.fuelLog.create({ data: { truckId: truck.id, date: d(3), liters: 100, cost: 1, mileage: 2000, efficiency: null } });

    await recomputeFuelLogEfficiency(l2.id);
    check('l2 = (1500-1000)/100', (await prisma.fuelLog.findUnique({ where: { id: l2.id } }))!.efficiency, 5);

    await recomputeFuelLogEfficiency(l1.id);
    check('first fill has no baseline', (await prisma.fuelLog.findUnique({ where: { id: l1.id } }))!.efficiency, null);

    check('successor of l2 is l3', await findSuccessorLogId(truck.id, d(2), l2.id), l3.id);
    check('l3 has no successor', await findSuccessorLogId(truck.id, d(3), l3.id), null);

    // A maintenance reading between two fills becomes the baseline.
    await prisma.maintenanceRecord.create({
        data: { truckId: truck.id, date: d(2), type: 'Service', cost: 0, mileageAtService: 1700, approvalStatus: 'Approved' },
    });
    await recomputeFuelLogEfficiency(l3.id);
    check('l3 baselines off maintenance 1700', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, 3);

    // A Pending maintenance reading must be ignored.
    await prisma.maintenanceRecord.create({
        data: { truckId: truck.id, date: d(2), type: 'Service', cost: 0, mileageAtService: 1900, approvalStatus: 'Pending' },
    });
    await recomputeFuelLogEfficiency(l3.id);
    check('pending maintenance ignored', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, 3);

    // Non-forward odometer yields null, not a negative figure.
    await prisma.fuelLog.update({ where: { id: l3.id }, data: { mileage: 1600 } });
    await recomputeFuelLogEfficiency(l3.id);
    check('backwards odometer -> null', (await prisma.fuelLog.findUnique({ where: { id: l3.id } }))!.efficiency, null);

    check('BOUNDARY: Truck.mileage untouched by recompute', (await prisma.truck.findUnique({ where: { id: truck.id } }))!.mileage, 0);

    console.log('\nTask 3 - whitelist, snapshot, staleness');
    const applier = getApplier('fuel_log')!;
    check('fuel_log applier registered', applier !== null && applier !== undefined, true);
    check('request gate', applier.requestPermission, 'view_fuel_logs');
    check('approve gate', applier.approvePermission, 'approve_fuel_requests');

    const stripped = pickEditable(
        {
            liters: 50, cost: 10, mileage: 2100, date: '2026-03-04T00:00:00.000Z',
            truckId: 'hijack', equipmentId: 'hijack', efficiency: 999, id: 'hijack',
            createdAt: 'hijack', updatedAt: 'hijack',
        },
        applier.editableFields
    );
    check('keeps only whitelisted keys', Object.keys(stripped).sort(), ['cost', 'date', 'liters', 'mileage']);
    check('truckId stripped', 'truckId' in stripped, false);
    check('efficiency stripped', 'efficiency' in stripped, false);
    check('id stripped', 'id' in stripped, false);

    const loaded = (await applier.load(l2.id))!;
    check(
        'load returns whitelisted fields',
        Object.keys(snapshotOf(loaded, applier.editableFields)).sort(),
        ['cost', 'date', 'liters', 'mileage']
    );

    const prev = snapshotOf(loaded, applier.editableFields);
    check('identical snapshot is not stale', detectStale(prev, prev, applier.editableFields), []);
    check('changed liters is stale', detectStale(prev, { ...prev, liters: 999 }, applier.editableFields), ['liters']);

    check('no open request yet', await findOpenRequest('fuel_log', l2.id), null);
    const open = await prisma.editRequest.create({
        data: { entityType: 'fuel_log', entityId: l2.id, requestedBy: TAG, proposedChanges: { liters: 90 } },
    });
    check('open request found', (await findOpenRequest('fuel_log', l2.id))?.id, open.id);
    await prisma.editRequest.update({ where: { id: open.id }, data: { status: 'Rejected' } });
    check('rejected is not open', await findOpenRequest('fuel_log', l2.id), null);
    await prisma.editRequest.delete({ where: { id: open.id } });

    console.log('\nTask 3 - stock guard');
    const { currentStock } = await getFuelStockPosition();
    const raise = await applier.validate!({ liters: (loaded.liters as number) + currentStock + 10 }, loaded);
    check('raising liters past stock is refused', typeof raise === 'string', true);
    check('lowering liters is allowed', await applier.validate!({ liters: 1 }, loaded), null);
    check('zero liters refused', typeof (await applier.validate!({ liters: 0 }, loaded)) === 'string', true);
    check('cost-only edit allowed', await applier.validate!({ cost: 42 }, loaded), null);

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
