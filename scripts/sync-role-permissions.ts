/**
 * Re-syncs the four built-in roles in the database from ROLE_PERMISSIONS.
 *
 * Roles are stored in the database and the cache in src/lib/permissions.ts
 * prefers a stored role over the built-in table, so editing ROLE_PERMISSIONS
 * alone does NOT change what a built-in role can do until this has run.
 * Custom roles are never touched.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/sync-role-permissions.ts
 */
import { PrismaClient } from '../src/generated/prisma';
import { Role, ROLE_PERMISSIONS } from '../src/lib/permissions';

const prisma = new PrismaClient();

async function main() {
    for (const name of Object.values(Role)) {
        const permissions = ROLE_PERMISSIONS[name];
        const before = await prisma.role.findUnique({
            where: { name },
            select: { permissions: true },
        });

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

        const had = new Set(before?.permissions ?? []);
        const added = permissions.filter((p) => !had.has(p));
        const removed = (before?.permissions ?? []).filter((p) => !permissions.includes(p as never));

        console.log(`${name}: ${permissions.length} permissions` + (before ? '' : ' (created)'));
        if (added.length) console.log(`  + ${added.join(', ')}`);
        if (removed.length) console.log(`  - ${removed.join(', ')}`);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
