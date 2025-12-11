'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, Permission, Role } from '@/lib/permissions';

export function usePermissions() {
    const { data: session, status } = useSession();
    const userRole = session?.user?.role;

    const can = (permission: Permission) => {
        if (!userRole) return false;
        return hasPermission(userRole, permission);
    };

    const is = (role: Role) => {
        return userRole === role;
    };

    return {
        can,
        is,
        role: userRole,
        isLoading: status === 'loading',
        isAuthenticated: status === 'authenticated',
    };
}
