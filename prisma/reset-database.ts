import { PrismaClient } from '../src/generated/prisma'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function resetDatabase() {
    console.log('⚠️  Resetting database - deleting ALL data...\n')

    // Delete in order to respect foreign key constraints (children first)

    // Notifications & Preferences
    console.log('Deleting notifications & preferences...')
    await prisma.notification.deleteMany()
    await prisma.userNotificationPreference.deleteMany()

    // Production Material Usage
    console.log('Deleting production material usage...')
    await prisma.productionMaterialUsage.deleteMany()

    // Stock Reconciliation
    console.log('Deleting stock reconciliation data...')
    await prisma.reconciliationItem.deleteMany()
    await prisma.stockReconciliation.deleteMany()

    // Material Price History
    console.log('Deleting material price history...')
    await prisma.materialPriceHistory.deleteMany()

    // Sales Orders & Payments
    console.log('Deleting sales order data...')
    await prisma.paymentScheduleItem.deleteMany()
    await prisma.payment.deleteMany()
    await prisma.orderLineItem.deleteMany()

    // Production Runs
    console.log('Deleting production data...')
    await prisma.productionRun.deleteMany()

    // Sales Orders (after line items, payments, production runs)
    await prisma.salesOrder.deleteMany()

    // Prepayments & Projects
    console.log('Deleting prepayments & projects...')
    await prisma.prepayment.deleteMany()
    await prisma.project.deleteMany()

    // Expenses
    console.log('Deleting expenses...')
    await prisma.expense.deleteMany()

    // Recipes
    console.log('Deleting recipe data...')
    await prisma.recipeIngredient.deleteMany()
    await prisma.recipe.deleteMany()

    // Inventory
    console.log('Deleting inventory data...')
    await prisma.materialRequest.deleteMany()
    await prisma.stockTransaction.deleteMany()
    await prisma.inventoryItem.deleteMany()
    await prisma.storageLocation.deleteMany()

    // Fuel & Equipment
    console.log('Deleting fuel & equipment data...')
    await prisma.fuelLog.deleteMany()
    await prisma.fuelDeposit.deleteMany()
    await prisma.equipment.deleteMany()

    // Exceptions
    console.log('Deleting exception logs...')
    await prisma.exceptionLog.deleteMany()

    // Fleet Management
    console.log('Deleting fleet data...')
    await prisma.maintenanceSchedule.deleteMany()
    await prisma.maintenanceRecord.deleteMany()
    await prisma.part.deleteMany()
    await prisma.truckDocument.deleteMany()
    await prisma.truck.deleteMany()

    // Spare Parts
    console.log('Deleting spare parts inventory...')
    await prisma.sparePartInventory.deleteMany()

    // Staff
    console.log('Deleting staff data...')
    await prisma.staffDocument.deleteMany()
    await prisma.staff.deleteMany()

    // Clients (after all client-related data is deleted)
    console.log('Deleting clients...')
    await prisma.clientDocument.deleteMany()
    await prisma.clientContact.deleteMany()
    await prisma.client.deleteMany()

    // Users
    console.log('Deleting users...')
    await prisma.user.deleteMany()

    console.log('\n✅ All data deleted successfully!\n')

    // Re-seed with the admin user
    console.log('🌱 Creating Super Admin user...')
    const hashedPassword = await bcrypt.hash('password123', 10)

    await prisma.user.create({
        data: {
            email: 'admin@wetanddry.ng',
            name: 'Super Admin',
            password: hashedPassword,
            role: 'Super Admin',
        },
    })

    console.log('✅ Super Admin user created:')
    console.log('   Email: admin@wetanddry.ng')
    console.log('   Password: password123')
    console.log('\n🚀 Database is ready for production!')
}

resetDatabase()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error('❌ Error resetting database:', e)
        await prisma.$disconnect()
        process.exit(1)
    })
