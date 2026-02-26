import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const hashedPassword = await bcrypt.hash('password123', 10)

    // Super Admin
    await prisma.user.upsert({
        where: { email: 'admin@wetanddry.ng' },
        update: {},
        create: {
            email: 'admin@wetanddry.ng',
            name: 'Super Admin',
            password: hashedPassword,
            role: 'Super Admin',
        },
    })

    // Operations Manager
    await prisma.user.upsert({
        where: { email: 'manager@wetndry.com' },
        update: {},
        create: {
            email: 'manager@wetndry.com',
            name: 'Ops Manager',
            password: hashedPassword,
            role: 'Operations Manager',
        },
    })

    console.log('Seed data created.')
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
