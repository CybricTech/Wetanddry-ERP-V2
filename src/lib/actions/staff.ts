'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { uploadToCloudinary, deleteFromCloudinary } from '@/lib/cloudinary'
import { auth } from '@/auth'
import { checkPermission } from '@/lib/permissions'

// Schema for Staff validation
const StaffSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    role: z.string().min(1, 'Role is required'),
    department: z.string().min(1, 'Department is required'),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().min(1, 'Phone number is required'),
    address: z.string().min(1, 'Address is required'),
    status: z.string().default('Active'),
    joinedDate: z.coerce.date(),
})

export type StaffData = z.infer<typeof StaffSchema>

export async function getStaffList(query?: string, status?: string) {
    const where: any = {}

    if (query) {
        where.OR = [
            { firstName: { contains: query } }, // Case insensitive is default in SQLite? No, usually need mode: 'insensitive' for Postgres, but SQLite is mixed. Prisma handles it?
            { lastName: { contains: query } },
            { email: { contains: query } },
            { role: { contains: query } },
        ]
    }

    if (status && status !== 'All') {
        where.status = status
    }

    try {
        const staff = await prisma.staff.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: { documents: true }
                }
            }
        })
        return { success: true, data: staff }
    } catch (error) {
        console.error('Error fetching staff list:', error)
        return { success: false, error: 'Failed to fetch staff list' }
    }
}

export async function getStaffById(id: string) {
    try {
        const staff = await prisma.staff.findUnique({
            where: { id },
            include: {
                documents: true
            }
        })

        if (!staff) return { success: false, error: 'Staff not found' }

        return { success: true, data: staff }
    } catch (error) {
        console.error('Error fetching staff:', error)
        return { success: false, error: 'Failed to fetch staff details' }
    }
}

export async function createStaff(data: StaffData) {
    const session = await auth()
    if (!session?.user?.role) return { success: false, error: 'Unauthorized' }
    try {
        checkPermission(session.user.role, 'manage_staff')
    } catch (e) {
        return { success: false, error: 'Unauthorized' }
    }

    const validated = StaffSchema.safeParse(data)

    if (!validated.success) {
        return { success: false, error: validated.error.flatten().fieldErrors }
    }

    try {
        const staff = await prisma.staff.create({
            data: validated.data
        })

        revalidatePath('/staff')
        return { success: true, data: staff }
    } catch (error) {
        console.error('Error creating staff:', error)
        return { success: false, error: 'Failed to create staff record' }
    }
}

export async function updateStaff(id: string, data: Partial<StaffData>) {
    const session = await auth()
    if (!session?.user?.role) return { success: false, error: 'Unauthorized' }
    try {
        checkPermission(session.user.role, 'manage_staff')
    } catch (e) {
        return { success: false, error: 'Unauthorized' }
    }

    // For partial updates, we might need a partial schema or just trust the input (with some validation)
    // Here we'll just use the partial of the schema
    const PartialSchema = StaffSchema.partial()
    const validated = PartialSchema.safeParse(data)

    if (!validated.success) {
        return { success: false, error: validated.error.flatten().fieldErrors }
    }

    try {
        const staff = await prisma.staff.update({
            where: { id },
            data: validated.data
        })

        revalidatePath('/staff')
        revalidatePath(`/staff/${id}`)
        return { success: true, data: staff }
    } catch (error) {
        console.error('Error updating staff:', error)
        return { success: false, error: 'Failed to update staff record' }
    }
}

export async function toggleStaffStatus(id: string, currentStatus: string) {
    // Simple toggle logic or set specific status
    // If we want to "Archive", maybe set to "Terminated" or have an "Archived" status?
    // The requirement says "Deactivate/Archive", let's assume setting to "Terminated" or "Inactive"

    // For now, let's just allow setting the status directly via updateStaff, 
    // but this action could be for a quick toggle if needed.
    // Let's implement a specific archive action.

    const session = await auth()
    if (!session?.user?.role) return { success: false, error: 'Unauthorized' }
    try {
        checkPermission(session.user.role, 'manage_staff')
    } catch (e) {
        return { success: false, error: 'Unauthorized' }
    }

    const newStatus = currentStatus === 'Active' ? 'Terminated' : 'Active' // Example toggle

    try {
        const staff = await prisma.staff.update({
            where: { id },
            data: { status: newStatus }
        })
        revalidatePath('/staff')
        revalidatePath(`/staff/${id}`)
        return { success: true, data: staff }
    } catch (error) {
        return { success: false, error: 'Failed to update status' }
    }
}

export async function uploadStaffDocument(formData: FormData) {
    const session = await auth()
    if (!session?.user?.role) return { success: false, error: 'Unauthorized' }
    try {
        checkPermission(session.user.role, 'manage_staff')
    } catch (e) {
        return { success: false, error: 'Unauthorized' }
    }

    const file = formData.get('file') as File
    const staffId = formData.get('staffId') as string
    const name = formData.get('name') as string
    const type = formData.get('type') as string
    const notes = formData.get('notes') as string
    const expiryDateStr = formData.get('expiryDate') as string

    if (!file || !staffId || !name || !type) {
        return { success: false, error: 'Missing required fields' }
    }

    try {
        console.log('Starting upload to Cloudinary...')
        // Use 'raw' for PDFs - they will be stored as files, not images
        const uploadResult = await uploadToCloudinary(file, 'staff-registry', 'raw')
        console.log('Upload successful:', uploadResult)

        const doc = await prisma.staffDocument.create({
            data: {
                staffId,
                name,
                type,
                url: uploadResult.secure_url,
                cloudinaryPublicId: uploadResult.public_id,
                notes: notes || undefined,
                expiryDate: expiryDateStr ? new Date(expiryDateStr) : undefined
            }
        })

        revalidatePath(`/staff/${staffId}`)
        return { success: true, data: doc }
    } catch (error) {
        console.error('Error uploading document:', error)
        return { success: false, error: 'Failed to upload document' }
    }
}

export async function addStaffDocument(staffId: string, documentData: {
    name: string,
    type: string,
    url: string,
    cloudinaryPublicId: string,
    expiryDate?: Date,
    notes?: string
}) {
    try {
        const doc = await prisma.staffDocument.create({
            data: {
                staffId,
                ...documentData
            }
        })

        revalidatePath(`/staff/${staffId}`)
        return { success: true, data: doc }
    } catch (error) {
        console.error('Error adding document:', error)
        return { success: false, error: 'Failed to add document' }
    }
}

export async function deleteStaffDocument(documentId: string) {
    const session = await auth()
    if (!session?.user?.role) return { success: false, error: 'Unauthorized' }
    try {
        checkPermission(session.user.role, 'manage_staff')
    } catch (e) {
        return { success: false, error: 'Unauthorized' }
    }

    try {
        const doc = await prisma.staffDocument.delete({
            where: { id: documentId }
        })

        // Clean up file from Cloudinary (non-fatal if it fails)
        if (doc.cloudinaryPublicId) {
            await deleteFromCloudinary(doc.cloudinaryPublicId).catch(() => {
                console.warn('Failed to delete Cloudinary file:', doc.cloudinaryPublicId)
            })
        }

        revalidatePath(`/staff/${doc.staffId}`)
        return { success: true, data: doc }
    } catch (error) {
        console.error('Error deleting document:', error)
        return { success: false, error: 'Failed to delete document' }
    }
}
