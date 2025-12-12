'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, Permission, Role } from '@/lib/permissions';
import { useEffect, useRef } from 'react';

export function usePermissions() {
    const { data: session, status, update } = useSession();
    const userRole = session?.user?.role;
    const previousRoleRef = useRef<string | undefined>(undefined);

    // Force session refresh when component mounts to catch any stale data
    useEffect(() => {
        // Only update if we have a session and the role has changed
        if (status === 'authenticated' && previousRoleRef.current !== userRole) {
            previousRoleRef.current = userRole;
        }
    }, [status, userRole]);

    // Force update session on mount to ensure fresh data after login
    useEffect(() => {
        if (status === 'authenticated') {
            // Trigger a session update to ensure we have the latest data
            update();
        }
    }, []); // Only on mount

    const can = (permission: Permission): boolean => {
        // During loading, deny all permissions to prevent flash of wrong UI
        if (status === 'loading' || status === 'unauthenticated') {
            return false;
        }
        if (!userRole) return false;
        return hasPermission(userRole, permission);
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
        isLoading: status === 'loading',
        isAuthenticated: status === 'authenticated',
        // Expose update function for manual refresh
        refreshSession: update,
    };
}
