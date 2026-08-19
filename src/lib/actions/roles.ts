'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { z } from 'zod'
import {
    checkPermission,
    PAGE_PERMISSIONS,
    BEHAVIOUR_FLAGS,
    APPROVAL_PERMISSIONS,
    ROLE_COLORS,
    type Permission,
} from '@/lib/permissions'
import { invalidateRoleCache } from '@/lib/roles.server'

// Only permissions the role editor actually offers may be written. Anything else
// is dropped, so a crafted request cannot grant itself manage_users.
const ASSIGNABLE: ReadonlySet<string> = new Set<string>([
    ...PAGE_PERMISSIONS.map((p) => p.permission),
    ...BEHAVIOUR_FLAGS.map((f) => f.permission),
    ...APPROVAL_PERMISSIONS.map((p) => p.permission),
])

const RoleInput = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(40),
    description: z.string().trim().max(200).optional().nullable(),
    color: z.enum(ROLE_COLORS),
    permissions: z.array(z.string()),
})

function sanitise(permissions: string[]): Permission[] {
    return permissions.filter((p) => ASSIGNABLE.has(p)) as Permission[]
}

/** Every action here is Super Admin only, enforced server-side. */
async function requireRoleAdmin() {
    const session = await auth()
    if (!session?.user?.role) throw new Error('Unauthorized')
    checkPermission(session.user.role, 'manage_users')
    return session
}

export async function getRoles() {
    try {
        await requireRoleAdmin()
    } catch {
        return { success: false as const, error: 'Unauthorized' }
    }

    try {
        const [roles, users] = await Promise.all([
            prisma.role.findMany({ orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }] }),
            prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
        ])

        const counts = new Map(users.map((u) => [u.role, u._count.role]))
        return {
            success: true as const,
            data: roles.map((r) => ({ ...r, userCount: counts.get(r.name) ?? 0 })),
        }
    } catch (error) {
        console.error('Error fetching roles:', error)
        return { success: false as const, error: 'Failed to fetch roles' }
    }
}

export async function createRole(input: unknown) {
    try {
        await requireRoleAdmin()
    } catch {
        return { success: false as const, error: 'Unauthorized' }
    }

    const parsed = RoleInput.safeParse(input)
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }
    const { name, description, color, permissions } = parsed.data

    try {
        const existing = await prisma.role.findUnique({ where: { name } })
        if (existing) return { success: false as const, error: 'A role with that name already exists' }

        const role = await prisma.role.create({
            data: {
                name,
                description: description || null,
                color,
                isBuiltIn: false,
                permissions: sanitise(permissions),
            },
        })

        invalidateRoleCache()
        revalidatePath('/settings/users')
        return { success: true as const, data: role }
    } catch (error) {
        console.error('Error creating role:', error)
        return { success: false as const, error: 'Failed to create role' }
    }
}

export async function updateRole(id: string, input: unknown) {
    try {
        await requireRoleAdmin()
    } catch {
        return { success: false as const, error: 'Unauthorized' }
    }

    const parsed = RoleInput.safeParse(input)
    if (!parsed.success) {
        return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }
    const { name, description, color, permissions } = parsed.data

    try {
        const role = await prisma.role.findUnique({ where: { id } })
        if (!role) return { success: false as const, error: 'Role not found' }

        if (role.isBuiltIn && name !== role.name) {
            return { success: false as const, error: 'Built-in roles cannot be renamed' }
        }

        if (name !== role.name) {
            const clash = await prisma.role.findUnique({ where: { name } })
            if (clash) return { success: false as const, error: 'A role with that name already exists' }
        }

        // User.role stores the role name rather than a foreign key, so a rename
        // has to be carried across to every assigned user in the same transaction
        // or those users would be left pointing at a role that no longer exists.
        await prisma.$transaction([
            prisma.role.update({
                where: { id },
                data: {
                    name,
                    description: description || null,
                    color,
                    // Built-in permission sets are owned by the code; only the
                    // presentation fields above are editable for them.
                    ...(role.isBuiltIn ? {} : { permissions: sanitise(permissions) }),
                },
            }),
            ...(name !== role.name
                ? [prisma.user.updateMany({ where: { role: role.name }, data: { role: name } })]
                : []),
        ])

        invalidateRoleCache()
        revalidatePath('/settings/users')
        return { success: true as const }
    } catch (error) {
        console.error('Error updating role:', error)
        return { success: false as const, error: 'Failed to update role' }
    }
}

export async function deleteRole(id: string) {
    try {
        await requireRoleAdmin()
    } catch {
        return { success: false as const, error: 'Unauthorized' }
    }

    try {
        const role = await prisma.role.findUnique({ where: { id } })
        if (!role) return { success: false as const, error: 'Role not found' }
        if (role.isBuiltIn) return { success: false as const, error: 'Built-in roles cannot be deleted' }

        const assigned = await prisma.user.count({ where: { role: role.name } })
        if (assigned > 0) {
            return {
                success: false as const,
                error: `${assigned} user${assigned === 1 ? ' is' : 's are'} still assigned to this role. Reassign them first.`,
            }
        }

        await prisma.role.delete({ where: { id } })

        invalidateRoleCache()
        revalidatePath('/settings/users')
        return { success: true as const }
    } catch (error) {
        console.error('Error deleting role:', error)
        return { success: false as const, error: 'Failed to delete role' }
    }
}

/** Role names valid for assigning to a user, including custom roles. */
export async function getAssignableRoleNames(): Promise<string[]> {
    try {
        const roles = await prisma.role.findMany({ select: { name: true }, orderBy: { name: 'asc' } })
        return roles.map((r) => r.name)
    } catch {
        return []
    }
}
