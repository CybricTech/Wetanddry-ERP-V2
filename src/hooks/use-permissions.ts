'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, Permission, Role } from '@/lib/permissions';
import { useEffect, useRef } from 'react';

export function usePermissions() {
    const { data: session, status, update } = useSession();
    const userRole = session?.user?.role;
    const previousRoleRef = useRef<string | undefined>(undefined);

    useEffect(() => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3cab5abe-e0f9-44cf-bf14-ae1d88ca5246', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'initial',
                hypothesisId: 'H1',
                location: 'use-permissions.ts:12',
                message: 'session status change',
                data: { status, userRole },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion
    }, [status, userRole]);

    // Force session refresh when component mounts to catch any stale data
    useEffect(() => {
        // Only update if we have a session and the role has changed
        if (status === 'authenticated' && previousRoleRef.current !== userRole) {
            previousRoleRef.current = userRole;
        }
    }, [status, userRole]);

    // Force update session on mount to ensure fresh data after login
    useEffect(() => {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3cab5abe-e0f9-44cf-bf14-ae1d88ca5246', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'initial',
                hypothesisId: 'H3',
                location: 'use-permissions.ts:mount',
                message: 'mount effect - checking if update() will be called',
                data: { status, willCallUpdate: status === 'authenticated' },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion
        if (status === 'authenticated') {
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/3cab5abe-e0f9-44cf-bf14-ae1d88ca5246', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: 'debug-session',
                    runId: 'initial',
                    hypothesisId: 'H3',
                    location: 'use-permissions.ts:update',
                    message: 'calling session update()',
                    data: { status, userRole },
                    timestamp: Date.now(),
                }),
            }).catch(() => { });
            // #endregion
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
        const result = hasPermission(userRole, permission);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/3cab5abe-e0f9-44cf-bf14-ae1d88ca5246', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: 'debug-session',
                runId: 'initial',
                hypothesisId: 'H2',
                location: 'use-permissions.ts:33',
                message: 'permission check',
                data: { permission, status, userRole, result },
                timestamp: Date.now(),
            }),
        }).catch(() => { });
        // #endregion
        return result;
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
