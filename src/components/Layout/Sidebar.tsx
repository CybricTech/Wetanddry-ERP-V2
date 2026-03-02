"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Truck, Package, Fuel, FlaskConical, Users, Settings, Menu, LogOut, AlertTriangle, Loader2, Wallet, Building2, ShoppingCart, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

import { Permission, hasPermission } from '@/lib/permissions';
import PushNotificationPrompt from '@/components/notifications/PushNotificationPrompt';

// Define menu categories with their items
interface MenuItem {
    id: string;
    name: string;
    icon: any;
    href: string;
    permission?: Permission;
}

interface MenuCategory {
    name: string;
    items: MenuItem[];
}

const menuCategories: MenuCategory[] = [
    {
        name: 'OVERVIEW',
        items: [
            { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
        ]
    },
    {
        name: 'OPERATIONS',
        items: [
            { id: 'crm', name: 'Customers', icon: Building2, href: '/crm', permission: 'view_crm' },
            { id: 'orders', name: 'Orders', icon: ShoppingCart, href: '/orders', permission: 'view_orders' },
            { id: 'trucks', name: 'Fleet', icon: Truck, href: '/trucks', permission: 'view_fleet' },
            { id: 'inventory', name: 'Inventory', icon: Package, href: '/inventory', permission: 'view_inventory' },
            { id: 'fuel', name: 'Fuel', icon: Fuel, href: '/fuel', permission: 'view_fuel_logs' },
            { id: 'production', name: 'Production', icon: FlaskConical, href: '/production', permission: 'view_recipes' },
        ]
    },
    {
        name: 'FINANCE',
        items: [
            { id: 'finance', name: 'Reports', icon: Wallet, href: '/finance', permission: 'view_financials' },
            { id: 'exceptions', name: 'Exceptions', icon: AlertTriangle, href: '/exceptions', permission: 'view_exceptions' },
        ]
    },
    {
        name: 'ADMINISTRATION',
        items: [
            { id: 'staff', name: 'Staff', icon: Users, href: '/staff', permission: 'view_staff' },
            { id: 'users', name: 'Users', icon: Users, href: '/users', permission: 'manage_users' },
            { id: 'duplicates', name: 'Duplicates', icon: Copy, href: '/settings/duplicates', permission: 'manage_system_settings' },
        ]
    },
];

interface SidebarUser {
    name?: string | null;
    email?: string | null;
    role?: string;
}

export function Sidebar({ user }: { user?: SidebarUser }) {
    const [collapsed, setCollapsed] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const pathname = usePathname();

    // Use the server-provided user role directly - no async loading needed!
    const userRole = user?.role;

    // Permission check using server-side user role
    const can = (permission: Permission): boolean => {
        if (!userRole) return false;
        return hasPermission(userRole, permission);
    };

    // Client-side sign out that properly clears the session cache
    const handleClientSignOut = async () => {
        setIsSigningOut(true);
        try {
            // Use next-auth/react's signOut which properly clears the client-side session cache
            await signOut({
                callbackUrl: '/login',
                redirect: true
            });
        } catch (error) {
            console.error('Sign out error:', error);
            setIsSigningOut(false);
        }
    };

    return (
        <>
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
                <nav className="flex-1 overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-blue-800">
                    {menuCategories.map((category) => {
                        // Filter items based on permissions
                        const visibleItems = category.items.filter(
                            (item) => !item.permission || can(item.permission)
                        );

                        // Don't render category if no visible items
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={category.name} className="mb-2">
                                {/* Category Header */}
                                {!collapsed && (
                                    <div className="px-4 py-2 text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                                        {category.name}
                                    </div>
                                )}
                                {collapsed && <div className="border-t border-blue-800 mx-3 my-2" />}

                                {/* Category Items */}
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = (pathname || '').startsWith(item.href);
                                    return (
                                        <Link
                                            key={item.id}
                                            href={item.href}
                                            className={cn(
                                                "w-full flex items-center gap-3 px-4 py-2.5 transition-colors",
                                                isActive
                                                    ? "bg-blue-800 border-l-4 border-yellow-400"
                                                    : "hover:bg-blue-800/50 border-l-4 border-transparent"
                                            )}
                                            title={collapsed ? item.name : undefined}
                                        >
                                            <Icon size={20} className="shrink-0" />
                                            {!collapsed && (
                                                <span className="text-sm font-medium whitespace-nowrap">
                                                    {item.name}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
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
                            <button
                                onClick={handleClientSignOut}
                                disabled={isSigningOut}
                                className="p-2 hover:bg-blue-800 rounded shrink-0 disabled:opacity-50"
                                title="Sign Out"
                            >
                                {isSigningOut ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <LogOut size={16} />
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-blue-900 mx-auto cursor-pointer" title={user?.name || 'User'}>
                                {user?.name?.[0] || 'U'}
                            </div>
                            <button
                                onClick={handleClientSignOut}
                                disabled={isSigningOut}
                                className="p-2 hover:bg-blue-800 rounded shrink-0 text-gray-300 hover:text-white disabled:opacity-50"
                                title="Sign Out"
                            >
                                {isSigningOut ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <LogOut size={16} />
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </aside>
            <PushNotificationPrompt />
        </>
    );
}
