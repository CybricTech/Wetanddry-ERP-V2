'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Save, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createStaff, updateStaff, uploadStaffDocument, StaffData } from '@/lib/actions/staff'

// Schema matching the server action validation
const StaffSchema = z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    role: z.string().min(1, 'Role is required'),
    department: z.string().min(1, 'Department is required'),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    phone: z.string().min(1, 'Phone number is required'),
    address: z.string().min(1, 'Address is required'),
    status: z.string().default('Active'),
    joinedDate: z.string().min(1, 'Joined date is required'), // Input type="date" returns string
})

type StaffFormValues = z.infer<typeof StaffSchema>

interface StaffFormProps {
    initialData?: StaffData & { id: string }
    isEditing?: boolean
}

export default function StaffForm({ initialData, isEditing = false }: StaffFormProps) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [file, setFile] = useState<File | null>(null)

    const defaultValues = initialData ? {
        ...initialData,
        joinedDate: initialData.joinedDate instanceof Date
            ? initialData.joinedDate.toISOString().split('T')[0]
            : new Date(initialData.joinedDate).toISOString().split('T')[0]
    } : {
        status: 'Active',
        joinedDate: new Date().toISOString().split('T')[0]
    }

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<StaffFormValues>({
        resolver: zodResolver(StaffSchema),
        defaultValues: defaultValues as any // Type assertion needed for date string handling
    })

    const onSubmit = async (data: StaffFormValues) => {
        setIsSubmitting(true)
        setError(null)

        try {
            const payload = {
                ...data,
                joinedDate: new Date(data.joinedDate)
            }

            const result = isEditing && initialData
                ? await updateStaff(initialData.id, payload)
                : await createStaff(payload)

            if (result.success) {
                // If we have a file and it's a new staff (or even edit), upload it
                if (file && result.data?.id) {
                    const formData = new FormData()
                    formData.append('file', file)
                    formData.append('staffId', result.data.id)
                    formData.append('name', 'ID Document') // Default name
                    formData.append('type', 'ID') // Default type

                    const uploadResult = await uploadStaffDocument(formData)
                    if (!uploadResult.success) {
                        // If upload fails, we still redirect but maybe log it or could show a toast
                        console.error('Failed to upload document:', uploadResult.error)
                        // We could set error here, but staff is created. 
                        // Let's just proceed for now.
                    }
                }

                router.push('/staff')
                router.refresh()
            } else {
                setError(typeof result.error === 'string' ? result.error : 'Failed to save staff record')
            }
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Personal Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">First Name</label>
                        <input
                            {...register('firstName')}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                            placeholder="e.g. John"
                        />
                        {errors.firstName && <p className="text-red-500 text-xs">{errors.firstName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Last Name</label>
                        <input
                            {...register('lastName')}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                            placeholder="e.g. Doe"
                        />
                        {errors.lastName && <p className="text-red-500 text-xs">{errors.lastName.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            {...register('email')}
                            type="email"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                            placeholder="john.doe@company.com"
                        />
                        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Phone Number</label>
                        <input
                            {...register('phone')}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                            placeholder="+234..."
                        />
                        {errors.phone && <p className="text-red-500 text-xs">{errors.phone.message}</p>}
                    </div>

                    <div className="col-span-full space-y-2">
                        <label className="text-sm font-medium text-gray-700">Home Address</label>
                        <textarea
                            {...register('address')}
                            rows={3}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all resize-none"
                            placeholder="Full residential address"
                        />
                        {errors.address && <p className="text-red-500 text-xs">{errors.address.message}</p>}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Employment Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Department</label>
                        <select
                            {...register('department')}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                        >
                            <option value="">Select Department</option>
                            <option value="Operations">Operations</option>
                            <option value="Logistics">Logistics</option>
                            <option value="Maintenance">Maintenance</option>
                            <option value="HR">HR</option>
                            <option value="Finance">Finance</option>
                            <option value="Management">Management</option>
                        </select>
                        {errors.department && <p className="text-red-500 text-xs">{errors.department.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Role / Job Title</label>
                        <input
                            {...register('role')}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                            placeholder="e.g. Truck Driver"
                        />
                        {errors.role && <p className="text-red-500 text-xs">{errors.role.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Employment Status</label>
                        <select
                            {...register('status')}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                        >
                            <option value="Active">Active</option>
                            <option value="On Leave">On Leave</option>
                            <option value="Contract">Contract</option>
                            <option value="Terminated">Terminated</option>
                        </select>
                        {errors.status && <p className="text-red-500 text-xs">{errors.status.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Date Joined</label>
                        <input
                            {...register('joinedDate')}
                            type="date"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none transition-all"
                        />
                        {errors.joinedDate && <p className="text-red-500 text-xs">{errors.joinedDate.message}</p>}
                    </div>
                </div>
            </div>

            {/* Document Upload Section */}
            {!isEditing && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6 md:p-8 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">ID Document (Optional)</h2>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Upload ID Card / Passport</label>
                        <input
                            type="file"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 outline-none file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            accept=".pdf"
                        />
                        <p className="text-xs text-gray-500">Upload a clear copy of the staff member's ID (PDF only).</p>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-4">
                <Link
                    href="/staff"
                    className="px-6 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </Link>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="animate-spin mr-2" size={18} />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2" size={18} />
                            Save Staff Record
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
