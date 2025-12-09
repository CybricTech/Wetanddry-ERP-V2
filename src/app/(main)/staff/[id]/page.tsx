import { getStaffById } from '@/lib/actions/staff'
import StaffForm from '@/components/staff/StaffForm'
import StaffDocuments from '@/components/staff/StaffDocuments'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

export default async function StaffDetailsPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    const { data: staff } = await getStaffById(id)

    if (!staff) {
        notFound()
    }

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

            <StaffForm initialData={staff} isEditing />

            <StaffDocuments staffId={staff.id} documents={staff.documents} />
        </div>
    )
}
