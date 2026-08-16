'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'
import { Role } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { notifyUserCreated, notifyRoleChanged } from '@/lib/actions/notifications'

// Validation schema for user creation. The role is checked against the Role table
// rather than the built-in enum so custom roles can be assigned; see isValidRole.
const CreateUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().min(1, 'Role is required'),
})

async function isValidRole(name: string): Promise<boolean> {
    const role = await prisma.role.findUnique({ where: { name }, select: { id: true } })
    if (role) return true
    // Fall back to the built-ins so user management keeps working if the Role
    // table has not been seeded yet.
    return Object.values(Role).includes(name as Role)
}

export async function getUsers() {
    const session = await auth()
    if (!session?.user?.role) {
        console.error('getUsers: No session or role found')
        return { success: false, error: 'Unauthorized' }
    }

    try {
        checkPermission(session.user.role, 'manage_users')
    } catch (error) {
        console.error('getUsers: Permission check failed for role:', session.user.role)
        return { success: false, error: 'Unauthorized' }
    }

    try {
        const users = await prisma.user.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            }
        })
        return { success: true, data: users }
    } catch (error) {
        console.error('Error fetching users:', error)
        return { success: false, error: 'Failed to fetch users' }
    }
}

export async function createUser(data: {
    name: string
    email: string
    password: string
    role: string
}) {
    const session = await auth()
    if (!session?.user?.role) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        checkPermission(session.user.role, 'manage_users')
    } catch (error) {
        return { success: false, error: 'Unauthorized' }
    }

    // Validate input
    const validated = CreateUserSchema.safeParse(data)
    if (!validated.success) {
        const errors = validated.error.flatten().fieldErrors
        const firstError = Object.values(errors)[0]?.[0] || 'Invalid input'
        return { success: false, error: firstError }
    }

    if (!(await isValidRole(validated.data.role))) {
        return { success: false, error: 'Invalid role' }
    }

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
        where: { email: data.email }
    })
    if (existingUser) {
        return { success: false, error: 'A user with this email already exists' }
    }

    try {
        // Hash password
        const hashedPassword = await bcrypt.hash(data.password, 10)

        const user = await prisma.user.create({
            data: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                role: data.role,
                createdBy: session.user.id, // Audit: who created this user
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
            }
        })

        // Notify super admins about the new user
        notifyUserCreated(user.id, user.name!, user.role!).catch(console.error)

        revalidatePath('/users')
        return { success: true, data: user }
    } catch (error) {
        console.error('Error creating user:', error)
        return { success: false, error: 'Failed to create user' }
    }
}

export async function updateUserRole(userId: string, newRole: string) {
    const session = await auth()
    if (!session?.user?.role) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        checkPermission(session.user.role, 'manage_users')
    } catch (error) {
        return { success: false, error: 'Unauthorized' }
    }

    if (!(await isValidRole(newRole))) {
        return { success: false, error: 'Invalid role' }
    }

    // Prevent changing own role to non-admin (safety measure)
    if (session.user.id === userId && newRole !== Role.SUPER_ADMIN) {
        return { success: false, error: 'Cannot downgrade your own admin privileges' }
    }

    try {
        // Get current user to track role change
        const currentUser = await prisma.user.findUnique({ where: { id: userId } })
        if (!currentUser) return { success: false, error: 'User not found' }
        const oldRole = currentUser.role

        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                role: newRole,
                updatedBy: session.user.id, // Audit: who made this change
            }
        })

        // Notify super admins about the role change
        if (oldRole !== newRole) {
            notifyRoleChanged(
                userId, 
                user.name!, 
                oldRole!, 
                newRole, 
                session.user.name || 'Admin'
            ).catch(console.error)
        }

        revalidatePath('/users')
        return { success: true, data: user }
    } catch (error) {
        console.error('Error updating user role:', error)
        return { success: false, error: 'Failed to update user role' }
    }
}

export async function deleteUser(userId: string) {
    const session = await auth()
    if (!session?.user?.role) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        checkPermission(session.user.role, 'manage_users')
    } catch (error) {
        return { success: false, error: 'Unauthorized' }
    }

    // Prevent deleting yourself
    if (session.user.id === userId) {
        return { success: false, error: 'Cannot delete your own account' }
    }

    try {
        await prisma.user.delete({
            where: { id: userId }
        })
        revalidatePath('/users')
        return { success: true }
    } catch (error) {
        console.error('Error deleting user:', error)
        return { success: false, error: 'Failed to delete user' }
    }
}

export async function changeUserPassword(userId: string, newPassword: string) {
    const session = await auth()
    if (!session?.user?.role) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        checkPermission(session.user.role, 'manage_users')
    } catch (error) {
        return { success: false, error: 'Unauthorized' }
    }

    // Validate password length
    if (!newPassword || newPassword.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters' }
    }

    try {
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                updatedBy: session.user.id, // Audit: who changed the password
            }
        })

        revalidatePath('/users')
        return { success: true }
    } catch (error) {
        console.error('Error changing password:', error)
        return { success: false, error: 'Failed to change password' }
    }
}
