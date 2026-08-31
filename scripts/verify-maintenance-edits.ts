/**
 * Verification for maintenance edit/delete approvals.
 *
 *   npx ts-node --project tsconfig.scripts.json -r tsconfig-paths/register scripts/verify-maintenance-edits.ts
 *
 * The `-r tsconfig-paths/register` is required: the modules under test import via the
 * `@/` alias, which plain ts-node cannot resolve. See tsconfig.scripts.json.
 */
import { PrismaClient } from '../src/generated/prisma';
import { recomputeTruckDerivedValues } from '../src/lib/truck-mileage';

const prisma = new PrismaClient();
const PLATE = '__verify_edit_approvals';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) {
        failures++;
        console.log(`  FAIL  ${label} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    } else {
        console.log(`  ok    ${label}`);
    }
}

async function cleanup() {
    const trucks = await prisma.truck.findMany({ where: { plateNumber: PLATE }, select: { id: true } });
    for (const truck of trucks) {
        const records = await prisma.maintenanceRecord.findMany({ where: { truckId: truck.id }, select: { id: true } });
        const schedules = await prisma.maintenanceSchedule.findMany({ where: { truckId: truck.id }, select: { id: true } });
        await prisma.editRequest.deleteMany({
            where: { entityId: { in: [...records, ...schedules].map((r) => r.id) } },
        });
        await prisma.fuelLog.deleteMany({ where: { truckId: truck.id } });
        await prisma.maintenanceRecord.deleteMany({ where: { truckId: truck.id } });
        await prisma.maintenanceSchedule.deleteMany({ where: { truckId: truck.id } });
    }
    await prisma.truck.deleteMany({ where: { plateNumber: PLATE } });
}

function makeTruck(extra: Record<string, unknown> = {}) {
    return prisma.truck.create({
        data: { plateNumber: PLATE, model: 'Verify', purchaseDate: new Date('2020-01-01'), mileage: 0, ...extra },
    });
}

async function main() {
    await cleanup();

    console.log('Recompute - derives from approved maintenance records');
    {
        const truck = await makeTruck();
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('mileage from approved record', after.mileage, 50_000);
        check('lastServiceDate from approved record', after.lastServiceDate?.toISOString(), new Date('2026-03-01').toISOString());
        await cleanup();
    }

    console.log('\nRecompute - a pending record contributes nothing');
    {
        const truck = await makeTruck();
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 90_000, approvalStatus: 'Pending' },
        });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('pending record ignored for mileage', after.mileage, 0);
        check('pending record leaves lastServiceDate null', after.lastServiceDate, null);
        await cleanup();
    }

    console.log('\nRecompute - never drops below a fuel reading (spec: verification 8)');
    {
        const truck = await makeTruck();
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await prisma.fuelLog.create({ data: { truckId: truck.id, liters: 100, cost: 50_000, mileage: 60_000 } });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('fuel reading wins when higher', after.mileage, 60_000);
        await cleanup();
    }

    console.log('\nRecompute - a manual reading survives (spec: verification 10)');
    {
        const truck = await makeTruck({ mileage: 80_000, manualMileage: 80_000, manualMileageAt: new Date() });
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        const after = await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } });
        check('manual reading preserved', after.mileage, 80_000);
        await cleanup();
    }

    console.log('\nRecompute - corrects downward when the source drops (spec: verification 11)');
    {
        const truck = await makeTruck();
        const record = await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 500_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        check('typo applied', (await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } })).mileage, 500_000);

        await prisma.maintenanceRecord.update({ where: { id: record.id }, data: { mileageAtService: 50_000 } });
        await recomputeTruckDerivedValues(truck.id);
        check('typo corrected downward', (await prisma.truck.findUniqueOrThrow({ where: { id: truck.id } })).mileage, 50_000);
        await cleanup();
    }

    console.log('\nRecompute - leaves FuelLog.efficiency alone (boundary with fuel-metrics.ts)');
    {
        const truck = await makeTruck();
        const log = await prisma.fuelLog.create({
            data: { truckId: truck.id, liters: 100, cost: 50_000, mileage: 60_000, efficiency: 4.2 },
        });
        await prisma.maintenanceRecord.create({
            data: { truckId: truck.id, date: new Date('2026-03-01'), type: 'Oil Change', cost: 100, mileageAtService: 50_000, approvalStatus: 'Approved' },
        });
        await recomputeTruckDerivedValues(truck.id);
        check('historical efficiency untouched', (await prisma.fuelLog.findUniqueOrThrow({ where: { id: log.id } })).efficiency, 4.2);
        await cleanup();
    }

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
