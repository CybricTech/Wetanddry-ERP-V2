'use client';

import { useState } from 'react';
import { Users as UsersIcon, Shield } from 'lucide-react';
import UserList from '@/app/(main)/users/UserList';
import RoleManager from './RoleManager';
import type { EditableRole } from './RoleEditorModal';

interface User {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt?: string | Date;
}

const TABS = [
    { id: 'users' as const, label: 'Users', icon: UsersIcon },
    { id: 'roles' as const, label: 'Roles', icon: Shield },
];

export default function UsersAndRoles({
    initialUsers,
    initialRoles,
}: {
    initialUsers: User[];
    initialRoles: EditableRole[];
}) {
    const [tab, setTab] = useState<'users' | 'roles'>('users');

    const roleMeta = Object.fromEntries(initialRoles.map((r) => [r.name, r.color]));

    return (
        <div>
            {/* Tab switching happens often, so the indicator moves but the panels
                do not animate in and out. */}
            <div className="inline-flex p-1 bg-gray-100 rounded-xl mb-5" role="tablist">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setTab(t.id)}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ${
                                active
                                    ? 'bg-white text-blue-900 shadow-sm'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Icon size={16} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === 'users' ? (
                <UserList
                    initialUsers={initialUsers}
                    roleNames={initialRoles.map((r) => r.name)}
                    roleColors={roleMeta}
                />
            ) : (
                <RoleManager initialRoles={initialRoles} />
            )}
        </div>
    );
}
