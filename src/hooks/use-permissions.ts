'use client';

import { useSession } from 'next-auth/react';
import { hasPermissionIn, Permission, Role } from '@/lib/permissions';
import { useEffect } from 'react';

export function usePermissions() {
    const { data: session, status, update } = useSession();
    const userRole = session?.user?.role;

    // Resolved server-side in the session callback. The browser cannot read the
    // database, so custom roles are only visible through this list - do not call
    // hasPermission() here, it would only see the four built-in roles.
    const permissions = session?.user?.permissions;

    // Force update session on mount to ensure fresh data after login
    useEffect(() => {
        if (status === 'authenticated') {
            update();
        }
    }, []); // Only on mount

    const can = (permission: Permission): boolean => {
        // During loading, deny all permissions to prevent flash of wrong UI
        if (status === 'loading' || status === 'unauthenticated') {
            return false;
        }
        return hasPermissionIn(permissions, permission);
    };

    const is = (role: Role): boolean => {
        // During loading, return false to prevent flash of wrong UI
        if (status === 'loading' || status === 'unauthenticated') {
            return false;
        }
        return userRole === role;
    };

    return {
        can,
        is,
        role: userRole,
        permissions,
        isLoading: status === 'loading',
        isAuthenticated: status === 'authenticated',
        // Expose update function for manual refresh
        refreshSession: update,
    };
}
