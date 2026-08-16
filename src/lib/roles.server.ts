// Server-only: importing this from a client component will fail the build via the
// prisma import below. Consider adding the `server-only` package for an explicit
// guard if this is ever imported indirectly.
import prisma from '@/lib/prisma';
import {
    Role,
    ROLE_PERMISSIONS,
    primeRoleCache,
    type Permission,
} from '@/lib/permissions';

// Roles change rarely and are read on every request, so they are cached in module
// scope. This is global configuration rather than per-user state, so there is no
// cross-request leakage concern. Writes call invalidateRoleCache(); the TTL is a
// backstop for multi-instance deployments where one instance made the write.
const TTL_MS = 60_000;

let loadedAt = 0;
let inFlight: Promise<void> | null = null;

async function load(): Promise<void> {
    const roles = await prisma.role.findMany({
        select: { name: true, permissions: true },
    });
    primeRoleCache(roles);
    loadedAt = Date.now();
}

/**
 * Ensures the role cache is populated before any synchronous hasPermission call.
 * Called from the NextAuth session callback, which every guarded path reaches via
 * `await auth()`. Concurrent callers share one query.
 *
 * On failure the cache is left as-is and hasPermission falls back to the built-in
 * role table, so a database blip degrades custom roles rather than locking
 * everyone out.
 */
export async function ensureRolesLoaded(): Promise<void> {
    if (Date.now() - loadedAt < TTL_MS) return;
    if (inFlight) return inFlight;

    inFlight = load()
        .catch((error) => {
            console.error('Failed to load roles; falling back to built-in roles:', error);
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
}

/** Call after any write to a role so the next request re-reads it. */
export function invalidateRoleCache(): void {
    loadedAt = 0;
}

/**
 * Resolves a role name to its permissions, loading from the database first.
 * Use this instead of the synchronous hasPermission when you need the full list,
 * such as when building the session payload for the client.
 */
export async function getPermissionsFor(roleName: string): Promise<Permission[]> {
    await ensureRolesLoaded();

    const role = await prisma.role
        .findUnique({ where: { name: roleName }, select: { permissions: true } })
        .catch(() => null);

    if (role) return role.permissions as Permission[];

    const builtIn = Object.values(Role).find((r) => r === roleName);
    return builtIn ? [...ROLE_PERMISSIONS[builtIn]] : [];
}

/** Seeds the four built-in roles from ROLE_PERMISSIONS. Safe to run repeatedly. */
export async function seedBuiltInRoles(): Promise<void> {
    for (const name of Object.values(Role)) {
        const permissions = ROLE_PERMISSIONS[name];
        await prisma.role.upsert({
            where: { name },
            // Built-in permission sets stay owned by the code, so re-seeding
            // repairs drift. Custom roles are never touched here.
            update: { permissions, isBuiltIn: true },
            create: {
                name,
                permissions,
                isBuiltIn: true,
                description: `Built-in ${name} role`,
                color: name === Role.SUPER_ADMIN ? 'purple' : 'blue',
            },
        });
    }
    invalidateRoleCache();
}
