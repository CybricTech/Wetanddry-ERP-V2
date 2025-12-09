import StaffForm from '@/components/staff/StaffForm'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function AddStaffPage() {
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
