import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function backup() {
    console.log('Starting backup...');

    const data = {
        users: await prisma.user.findMany(),
        staff: await prisma.staff.findMany(),
        trucks: await prisma.truck.findMany(),
        truckDocuments: await prisma.truckDocument.findMany(),
        inventoryItems: await prisma.inventoryItem.findMany(),
        stockTransactions: await prisma.stockTransaction.findMany(),
        recipes: await prisma.recipe.findMany(),
        productionRuns: await prisma.productionRun.findMany(),
        maintenanceRecords: await prisma.maintenanceRecord.findMany(),
        fuelLogs: await prisma.fuelLog.findMany(),
        storageLocations: await prisma.storageLocation.findMany(),
    };

    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(backupDir, `backup-${timestamp}.json`);

    fs.writeFileSync(filename, JSON.stringify(data, null, 2));

    console.log(`Backup completed successfully to ${filename}`);
    console.log(`Backed up:
    - ${data.users.length} user(s)
    - ${data.trucks.length} truck(s)
    - ${data.inventoryItems.length} inventory item(s)
  `);
}

backup()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
