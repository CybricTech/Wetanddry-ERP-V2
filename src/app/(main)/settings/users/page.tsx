import { getUsers } from '@/lib/actions/users';
import { getRoles } from '@/lib/actions/roles';
import UsersAndRoles from '@/components/settings/UsersAndRoles';
import type { EditableRole } from '@/components/settings/RoleEditorModal';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/permissions';

export default async function SettingsUsersPage() {
    const session = await auth();
    if (!session?.user) redirect('/login');

    if (!hasPermission(session.user.role || '', 'manage_users')) {
        redirect('/settings/account');
    }

    const [usersResult, rolesResult] = await Promise.all([getUsers(), getRoles()]);
    const users = usersResult.success ? usersResult.data || [] : [];
    const roles = rolesResult.success ? (rolesResult.data as EditableRole[]) : [];

    return <UsersAndRoles initialUsers={users} initialRoles={roles} />;
}
