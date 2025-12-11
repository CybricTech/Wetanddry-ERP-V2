import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

/**
 * Prisma Client configured for hybrid local/production setup:
 * - Development: Uses local SQLite file (file:./dev.db)
 * - Production: Uses Turso (libsql://)
 * 
 * Required environment variables for production:
 * - TURSO_DATABASE_URL: Your Turso database URL (libsql://...)
 * - TURSO_AUTH_TOKEN: Your Turso authentication token
 */

const prismaClientSingleton = () => {
    // Check if we're in production with Turso credentials
    const isTurso = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN

    if (isTurso) {
        // Production: Use Turso with libSQL adapter
        const libsql = createClient({
            url: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN,
        })
        const adapter = new PrismaLibSQL(libsql)
        return new PrismaClient({ adapter })
    } else {
        // Development: Use local SQLite
        return new PrismaClient()
    }
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma
