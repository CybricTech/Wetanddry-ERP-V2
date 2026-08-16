/**
 * Seeds the four built-in roles into the Role table from ROLE_PERMISSIONS.
 * Safe to run repeatedly - it upserts, and never touches custom roles.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/seed-roles.ts
 */
import { PrismaClient } from '../src/generated/prisma';
import { Role, ROLE_PERMISSIONS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
    for (const name of Object.values(Role)) {
        const permissions = ROLE_PERMISSIONS[name];
        await prisma.role.upsert({
            where: { name },
            update: { permissions, isBuiltIn: true },
            create: {
                name,
                permissions,
                isBuiltIn: true,
                description: `Built-in ${name} role`,
                color: name === Role.SUPER_ADMIN ? 'purple' : 'blue',
            },
        });
        console.log(`  ${name}: ${permissions.length} permissions`);
    }

    const total = await prisma.role.count();
    console.log(`Done. ${total} roles in table.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
