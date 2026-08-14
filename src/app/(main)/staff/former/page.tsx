import { getFormerStaffList } from '@/lib/actions/staff'
import { EXIT_TYPES } from '@/lib/constants/staff'
import FormerStaffList from '@/components/staff/FormerStaffList'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function FormerStaffPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; exitType?: string }>
}) {
    const params = await searchParams
    const { data: staff } = await getFormerStaffList(params.q, params.exitType)

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/staff"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                    >
                        <ArrowLeft size={24} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Former Staff</h1>
                        <p className="text-gray-600 mt-1">
                            Archived records of everyone who has left — retired, dismissed, resigned, or otherwise
                        </p>
                    </div>
                </div>
            </div>

            <FormerStaffList initialStaff={staff || []} exitTypes={EXIT_TYPES} />
        </div>
    )
}
