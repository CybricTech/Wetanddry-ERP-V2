'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    Search, Filter, MoreHorizontal, Mail, Phone,
    MapPin, User, FileText, CheckCircle, XCircle, AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Define interface locally since Prisma generation failed
export interface Staff {
    id: string
    firstName: string
    lastName: string
    role: string
    department: string
    email: string | null
    phone: string
    address: string
    status: string
    joinedDate: Date
    _count?: {
        documents: number
    }
}

interface StaffListProps {
    initialStaff: Staff[]
}

export default function StaffList({ initialStaff }: StaffListProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '')
    const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'All')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        const params = new URLSearchParams(searchParams)
        if (searchTerm) params.set('q', searchTerm)
        else params.delete('q')

        if (statusFilter && statusFilter !== 'All') params.set('status', statusFilter)
        else params.delete('status')

        router.push(`/staff?${params.toString()}`)
    }

    const handleStatusChange = (status: string) => {
        setStatusFilter(status)
        const params = new URLSearchParams(searchParams)
        if (searchTerm) params.set('q', searchTerm)

        if (status && status !== 'All') params.set('status', status)
        else params.delete('status')

        router.push(`/staff?${params.toString()}`)
    }

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
                        placeholder="Search staff by name, role, or email..."
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border-transparent focus:bg-white border focus:border-blue-500 rounded-xl outline-none transition-all"
                    />
                </form>
                <div className="flex gap-3 w-full md:w-auto">
                    <div className="relative group">
                        <button className="px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 font-medium flex items-center gap-2 border border-transparent hover:border-gray-200 transition-all">
                            <Filter size={18} />
                            Status: {statusFilter}
                        </button>
                        {/* Simple Dropdown for demo */}
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 hidden group-hover:block z-10">
                            {['All', 'Active', 'On Leave', 'Terminated', 'Contract'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                    className="w-full text-left px-4 py-2 hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Staff Table */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100">
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role & Department</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documents</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {initialStaff.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <User className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                        <p className="text-lg font-medium text-gray-900">No staff members found</p>
                                        <p className="text-sm">Try adjusting your search or add a new staff member.</p>
                                    </td>
                                </tr>
                            ) : (
                                initialStaff.map((staff) => (
                                    <tr key={staff.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">
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
                                            <div className="flex flex-col gap-1">
                                                {staff.email && (
                                                    <div className="flex items-center text-xs text-gray-600">
                                                        <Mail size={12} className="mr-1.5" />
                                                        {staff.email}
                                                    </div>
                                                )}
                                                <div className="flex items-center text-xs text-gray-600">
                                                    <Phone size={12} className="mr-1.5" />
                                                    {staff.phone}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={cn(
                                                "px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1",
                                                staff.status === 'Active' ? "bg-green-100 text-green-700" :
                                                    staff.status === 'On Leave' ? "bg-yellow-100 text-yellow-700" :
                                                        staff.status === 'Terminated' ? "bg-red-100 text-red-700" :
                                                            "bg-gray-100 text-gray-700"
                                            )}>
                                                {staff.status === 'Active' && <CheckCircle size={12} />}
                                                {staff.status === 'On Leave' && <AlertCircle size={12} />}
                                                {staff.status === 'Terminated' && <XCircle size={12} />}
                                                {staff.status}
                                            </span>
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
