"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Truck, Package, Fuel, FlaskConical, Users, Settings, Menu, LogOut, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

const modules = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'trucks', name: 'Truck & Asset Management', icon: Truck, href: '/trucks' },
    { id: 'inventory', name: 'Inventory Management', icon: Package, href: '/inventory' },
    { id: 'fuel', name: 'Diesel Management', icon: Fuel, href: '/fuel' },
    { id: 'production', name: 'Mixology (Recipes)', icon: FlaskConical, href: '/production' },
    { id: 'exceptions', name: 'Exception Handling', icon: AlertTriangle, href: '/exceptions' },
    // { id: 'users', name: 'User Management', icon: Users, href: '/users' },
    // { id: 'settings', name: 'Settings', icon: Settings, href: '/settings' },
];

import { handleSignOut } from '@/lib/actions/auth';

export function Sidebar({ user }: { user?: any }) {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

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
                            <p className="text-xs text-blue-300 truncate">{user?.email || 'No Email'}</p>
                        </div>
                        <form action={handleSignOut}>
                            <button type="submit" className="p-2 hover:bg-blue-800 rounded shrink-0" title="Sign Out">
                                <LogOut size={16} />
                            </button>
                        </form>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center font-bold text-blue-900 mx-auto cursor-pointer" title={user?.name}>
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
