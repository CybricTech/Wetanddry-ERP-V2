import StaffForm from '@/components/staff/StaffForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { hasPermission } from '@/lib/permissions'

export default async function AddStaffPage() {
    // createStaff rejects callers without manage_staff, so anyone who can only
    // view the registry would fill in the whole form and lose it on Save.
    const session = await auth()
    const userRole = session?.user?.role
    if (!userRole || !hasPermission(userRole, 'manage_staff')) {
        redirect('/staff')
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
                    <h1 className="text-3xl font-bold text-gray-900">Add New Staff</h1>
                    <p className="text-gray-600 mt-1">Create a new employee record</p>
                </div>
            </div>

            <StaffForm />
        </div>
    )
}
