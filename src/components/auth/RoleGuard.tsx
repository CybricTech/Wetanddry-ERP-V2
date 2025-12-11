'use client';

import { usePermissions } from '@/hooks/use-permissions';
import { Permission, Role } from '@/lib/permissions';
import { ReactNode } from 'react';

interface RoleGuardProps {
    children: ReactNode;
    permission?: Permission;
    role?: Role;
    fallback?: ReactNode;
}

export function RoleGuard({ children, permission, role, fallback = null }: RoleGuardProps) {
    const { can, is, isLoading } = usePermissions();

    if (isLoading) {
        return null; // or a loading spinner
    }

    if (permission && !can(permission)) {
        return <>{fallback}</>;
    }

    if (role && !is(role)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
