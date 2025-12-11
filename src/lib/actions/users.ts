'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'
import { Role } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Validation schema for user creation
const CreateUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.string().refine(
        (val) => Object.values(Role).includes(val as Role),
        'Invalid role'
    ),
})

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

    // Basic validation that role is valid
    const validRoles = Object.values(Role).map(r => r.toString())
    if (!validRoles.includes(newRole)) {
        return { success: false, error: 'Invalid role' }
    }

    // Prevent changing own role to non-admin (safety measure)
    if (session.user.id === userId && newRole !== Role.SUPER_ADMIN) {
        return { success: false, error: 'Cannot downgrade your own admin privileges' }
    }

    try {
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                role: newRole,
                updatedBy: session.user.id, // Audit: who made this change
            }
        })
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
