import { PrismaClient } from '@/generated/prisma'

declare global {
    var prismaGlobal: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
    const databaseUrl = process.env.DATABASE_URL

    if (databaseUrl?.includes('neon')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { PrismaNeon } = require('@prisma/adapter-neon')
        const adapter = new PrismaNeon({ connectionString: databaseUrl })
        return new PrismaClient({ adapter } as any)
    }

    return new PrismaClient()
}

let prisma: PrismaClient

if (process.env.NODE_ENV === 'production') {
    prisma = createPrismaClient()
} else {
    if (!globalThis.prismaGlobal) {
        globalThis.prismaGlobal = createPrismaClient()
    }
    prisma = globalThis.prismaGlobal
}

export default prisma
