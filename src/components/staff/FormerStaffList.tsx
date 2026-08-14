'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, Filter, UserMinus, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FormerStaff {
    id: string
    firstName: string
    lastName: string
    role: string
    department: string
    joinedDate: Date
    exitType: string | null
    exitDate: Date | null
    exitReason: string | null
    _count?: {
        documents: number
    }
}

interface FormerStaffListProps {
    initialStaff: FormerStaff[]
    exitTypes: readonly string[]
}

export default function FormerStaffList({ initialStaff, exitTypes }: FormerStaffListProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [searchTerm, setSearchTerm] = useState(searchParams?.get('q') || '')
    const [typeFilter, setTypeFilter] = useState(searchParams?.get('exitType') || 'All')

    const pushParams = (q: string, exitType: string) => {
        const params = new URLSearchParams()
        if (q) params.set('q', q)
        if (exitType && exitType !== 'All') params.set('exitType', exitType)
        router.push(`/staff/former?${params.toString()}`)
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        pushParams(searchTerm, typeFilter)
    }

    const handleTypeChange = (exitType: string) => {
        setTypeFilter(exitType)
        pushParams(searchTerm, exitType)
    }

    const badgeClass = (exitType: string | null) =>
        exitType === 'Retired' ? 'bg-blue-100 text-blue-700'
            : exitType === 'Dismissed' ? 'bg-red-100 text-red-700'
                : exitType === 'Resigned' ? 'bg-amber-100 text-amber-700'
                    : 'bg-gray-100 text-gray-700'

    return (
        <div className="space-y-6">
            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                <form onSubmit={handleSearch} className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search former staff by name, role, or email..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl outline-none transition-all"
                    />
                </form>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <button className="px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium flex items-center gap-2 border border-transparent hover:border-gray-200 transition-all">
                            <Filter size={18} />
                            Exit Type: {typeFilter}
                        </button>
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 hidden group-hover:block z-10">
                            {['All', ...exitTypes].map((exitType) => (
                                <button
                                    key={exitType}
                                    onClick={() => handleTypeChange(exitType)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                                >
                                    {exitType}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Former Staff Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role & Department</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Exit Type</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Exit Date</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {initialStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <UserMinus className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                        <p className="text-lg font-medium text-gray-900">No former staff on record</p>
                                        <p className="text-sm">Staff appear here once they have been offboarded.</p>
                                    </td>
                                </tr>
                            ) : (
                                initialStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg">
                                                    {staff.firstName[0]}{staff.lastName[0]}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-bold text-gray-900">{staff.firstName} {staff.lastName}</div>
                                                    <div className="text-xs text-gray-500">Joined {new Date(staff.joinedDate).toLocaleDateString()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm text-gray-900 font-medium">{staff.role}</div>
                                            <div className="text-xs text-gray-500">{staff.department}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-medium",
                                                badgeClass(staff.exitType)
                                            )}>
                                                {staff.exitType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {staff.exitDate ? new Date(staff.exitDate).toLocaleDateString() : '—'}
                                        </td>
                                        <td className="px-6 py-4 max-w-xs">
                                            <p className="text-sm text-gray-600 truncate" title={staff.exitReason || ''}>
                                                {staff.exitReason || '—'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center text-sm text-gray-500">
                                                <FileText size={16} className="mr-1.5 text-gray-400" />
                                                {staff._count?.documents || 0} files
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <Link
                                                href={`/staff/${staff.id}`}
                                                className="text-blue-600 hover:text-blue-900 font-semibold hover:underline"
                                            >
                                                View Details
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
