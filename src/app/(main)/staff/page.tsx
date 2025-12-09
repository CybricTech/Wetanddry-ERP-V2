import { getStaffList } from '@/lib/actions/staff'
import StaffList from '@/components/staff/StaffList'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'

export default async function StaffPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string }>
}) {
    const params = await searchParams
    const query = params.q
    const status = params.status

    const { data: staff } = await getStaffList(query, status)

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Staff Registry</h1>
                    <p className="text-gray-600 mt-1">Manage employee records, roles, and documents</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/staff/add"
                        className="inline-flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-500/25"
                    >
                        <Plus size={20} className="mr-2" />
                        Add New Staff
                    </Link>
                </div>
            </div>

            {/* Stats Cards could go here */}

            {/* Staff List */}
            <StaffList initialStaff={staff || []} />
        </div>
    )
}
