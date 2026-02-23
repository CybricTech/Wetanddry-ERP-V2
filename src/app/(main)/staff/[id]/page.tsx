import { getStaffById } from '@/lib/actions/staff'
import StaffForm from '@/components/staff/StaffForm'
import StaffDocuments from '@/components/staff/StaffDocuments'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'

export default async function StaffDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const [{ data: staff }, session] = await Promise.all([
        getStaffById(id),
        auth()
    ])

    if (!staff) {
        notFound()
    }

    const canManageStaff = session?.user?.role ? hasPermission(session.user.role, 'manage_staff') : false

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4">
                <Link
                    href="/staff"
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                >
                    <ArrowLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{staff.firstName} {staff.lastName}</h1>
                    <p className="text-gray-600 mt-1">{staff.role} • {staff.department}</p>
                </div>
            </div>

            <StaffForm initialData={{ ...staff, email: staff.email ?? undefined }} isEditing />

            <StaffDocuments staffId={staff.id} documents={staff.documents} canManageStaff={canManageStaff} />
        </div>
    )
}
