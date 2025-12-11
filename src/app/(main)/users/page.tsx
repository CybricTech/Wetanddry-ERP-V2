import { getUsers } from '@/lib/actions/users';
import UserList from './UserList';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Role } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default async function UsersPage() {
    const result = await getUsers();
    const users = result.success ? result.data || [] : [];

    return (
        <RoleGuard
            role={Role.SUPER_ADMIN}
            fallback={
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                    <div className="bg-red-50 p-4 rounded-full mb-4">
                        <ShieldAlert className="h-12 w-12 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
                    <p className="text-gray-600 max-w-md mb-8">
                        You do not have permission to view this page. Only Super Administrators can manage users.
                    </p>
                    <Link
                        href="/dashboard"
                        className="px-6 py-3 bg-white text-blue-600 font-medium rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            }
        >
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
                        <p className="text-gray-600 mt-1">Manage system access and roles</p>
                    </div>
                    <div className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 font-medium">
                        {users.length} Active Users
                    </div>
                </div>

                <UserList initialUsers={users} />
            </div>
        </RoleGuard>
    );
}
