'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User, Bell, Shield, Building2, Copy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hasPermissionIn, type Permission } from '@/lib/permissions'

const settingsLinks = [
    { href: '/settings/account', label: 'Account', icon: User, description: 'Profile & password' },
    { href: '/settings/notifications', label: 'Notifications', icon: Bell, description: 'Alerts & push notifications' },
    { href: '/settings/users', label: 'Users', icon: Users, description: 'Manage user accounts', permission: 'manage_users' as const },
    { href: '/settings/system', label: 'System', icon: Building2, description: 'Company & currency', permission: 'manage_system_settings' as const },
    { href: '/settings/security', label: 'Security', icon: Shield, description: 'Password & access policies', permission: 'manage_system_settings' as const },
    { href: '/settings/duplicates', label: 'Duplicates', icon: Copy, description: 'Duplicate detection alerts', permission: 'manage_system_settings' as const },
]

export default function SettingsNav({ permissions }: { permissions: Permission[] }) {
    const pathname = usePathname()

    const visibleLinks = settingsLinks.filter(
        link => !link.permission || hasPermissionIn(permissions, link.permission)
    )

    return (
        <nav className="lg:w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-2">
                    {visibleLinks.map(link => {
                        const Icon = link.icon
                        const isActive = pathname === link.href
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                                    isActive
                                        ? "bg-blue-50 text-blue-700"
                                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                )}
                            >
                                <Icon size={18} className={isActive ? "text-blue-600" : "text-gray-400"} />
                                <div>
                                    <div className="text-sm font-medium">{link.label}</div>
                                    <div className="text-xs text-gray-400">{link.description}</div>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
