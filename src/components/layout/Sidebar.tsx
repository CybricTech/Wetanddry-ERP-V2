"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Truck, Package, Fuel, FlaskConical, Users, Settings, Menu, LogOut, AlertTriangle, Loader2, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Permission, hasPermission } from '@/lib/permissions';

const modules: { id: string; name: string; icon: any; href: string; permission?: Permission }[] = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'trucks', name: 'Truck & Asset Management', icon: Truck, href: '/trucks', permission: 'view_fleet' },
    { id: 'inventory', name: 'Inventory Management', icon: Package, href: '/inventory', permission: 'view_inventory' },
    { id: 'fuel', name: 'Diesel Management', icon: Fuel, href: '/fuel', permission: 'view_fuel_logs' },
    { id: 'production', name: 'Mixology (Recipes)', icon: FlaskConical, href: '/production', permission: 'view_recipes' },
    { id: 'finance', name: 'Finance & Reports', icon: Wallet, href: '/finance', permission: 'view_financials' },
    { id: 'exceptions', name: 'Exception Handling', icon: AlertTriangle, href: '/exceptions', permission: 'view_exceptions' },
    { id: 'staff', name: 'Staff Registry', icon: Users, href: '/staff', permission: 'view_staff' },
    { id: 'users', name: 'User Management', icon: Users, href: '/users', permission: 'manage_users' },
    // { id: 'settings', name: 'Settings', icon: Settings, href: '/settings', permission: 'manage_system_settings' },
];

import { handleSignOut } from '@/lib/actions/auth';

interface SidebarUser {
    name?: string | null;
    email?: string | null;
    role?: string;
}

export function Sidebar({ user }: { user?: SidebarUser }) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    // Use the server-provided user role directly - no async loading needed!
    const userRole = user?.role;

    // Permission check using server-side user role
    const can = (permission: Permission): boolean => {
        if (!userRole) return false;
        return hasPermission(userRole, permission);
    };

    return (
        <aside className={cn(
            "bg-blue-900 text-white transition-all duration-300 flex flex-col h-screen sticky top-0",
            collapsed ? "w-20" : "w-64"
        )}>
            {/* Logo Area */}
            <div className="p-4 border-b border-blue-800 flex items-center justify-between">
                {!collapsed && (
                    <div className="overflow-hidden whitespace-nowrap">
                        <h1 className="text-xl font-bold">Wet & Dry Ltd</h1>
                        <p className="text-xs text-blue-300">Enterprise Management</p>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-2 hover:bg-blue-800 rounded ml-auto"
                >
                    <Menu size={20} />
                </button>
            </div>

            {/* Navigation Menu */}
            <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-blue-800">
                {modules.map((module) => {
                    // Filter based on permission using server-side role
                    if (module.permission && !can(module.permission)) {
                        return null;
                    }

                    const Icon = module.icon;
                    const isActive = (pathname || '').startsWith(module.href);
                    return (
                        <Link
                            key={module.id}
                            href={module.href}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 transition-colors",
                                isActive
                                    ? "bg-blue-800 border-l-4 border-yellow-400"
                                    : "hover:bg-blue-800/50 border-l-4 border-transparent"
                            )}
                            title={collapsed ? module.name : undefined}
                        >
                            <Icon size={20} className="shrink-0" />
                            {!collapsed && <span className="text-sm font-medium whitespace-nowrap">{module.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* User Profile Area */}
            <div className="p-4 border-t border-blue-800">
                {!collapsed ? (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-blue-900 shrink-0">
                            {user?.name?.[0] || 'U'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
                            <p className="text-xs text-blue-300 truncate">{userRole || 'No Role'}</p>
                        </div>
                        <form action={handleSignOut}>
                            <button type="submit" className="p-2 hover:bg-blue-800 rounded shrink-0" title="Sign Out">
                                <LogOut size={16} />
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-blue-900 mx-auto cursor-pointer" title={user?.name || 'User'}>
                            {user?.name?.[0] || 'U'}
                        </div>
                        <form action={handleSignOut}>
                            <button type="submit" className="p-2 hover:bg-blue-800 rounded shrink-0 text-gray-300 hover:text-white" title="Sign Out">
                                <LogOut size={16} />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </aside>
    );
}
