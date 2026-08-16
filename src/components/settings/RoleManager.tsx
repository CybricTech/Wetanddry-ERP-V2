'use client';

import { useState } from 'react';
import { Shield, Plus, Edit2, Trash2, Lock, Users as UsersIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PAGE_PERMISSIONS, BEHAVIOUR_FLAGS } from '@/lib/permissions';
import { deleteRole, getRoles } from '@/lib/actions/roles';
import RoleEditorModal, { type EditableRole } from './RoleEditorModal';
import { badgeFor } from './roleColors';

export default function RoleManager({ initialRoles }: { initialRoles: EditableRole[] }) {
    const [roles, setRoles] = useState<EditableRole[]>(initialRoles);
    const [editing, setEditing] = useState<EditableRole | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const refresh = async () => {
        const result = await getRoles();
        if (result.success) setRoles(result.data as EditableRole[]);
    };

    const handleDelete = async (role: EditableRole) => {
        if (!confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;

        setDeletingId(role.id);
        try {
            const result = await deleteRole(role.id);
            if (result.success) {
                setRoles((prev) => prev.filter((r) => r.id !== role.id));
                toast.success(`Role "${role.name}" deleted`);
            } else {
                toast.error(result.error || 'Failed to delete role');
            }
        } catch (error) {
            console.error(error);
            toast.error('An unexpected error occurred');
        } finally {
            setDeletingId(null);
        }
    };

    const pageSummary = (role: EditableRole) => {
        const granted = PAGE_PERMISSIONS.filter((p) => role.permissions.includes(p.permission));
        if (granted.length === 0) return 'No pages beyond Dashboard and Settings';
        if (granted.length === PAGE_PERMISSIONS.length) return 'All pages';
        return granted.map((p) => p.label).join(', ');
    };

    return (
        <>
            <div className="flex items-start justify-between gap-4 mb-4">
                <p className="text-sm text-gray-500 max-w-xl">
                    Roles decide which pages a user can reach. Built-in roles are fixed; create a
                    custom role to grant a narrower set of pages.
                </p>
                <button
                    onClick={() => {
                        setEditing(null);
                        setModalOpen(true);
                    }}
                    className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-lg shadow-blue-500/25 transition-[background-color,transform] duration-150 ease-out-strong active:scale-[0.97]"
                >
                    <Plus size={20} />
                    New Role
                </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                {roles.map((role, i) => (
                    <div
                        key={role.id}
                        style={{ animationDelay: `${i * 40}ms` }}
                        className="animate-rise-in bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <span
                                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${badgeFor(role.color)}`}
                                >
                                    <Shield size={12} className="mr-1" />
                                    {role.name}
                                </span>
                                {role.description && (
                                    <p className="text-sm text-gray-500 mt-2 line-clamp-2">{role.description}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => {
                                        setEditing(role);
                                        setModalOpen(true);
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-150 active:scale-95"
                                    title={role.isBuiltIn ? 'View role' : 'Edit role'}
                                >
                                    <Edit2 size={18} />
                                </button>
                                {role.isBuiltIn ? (
                                    <span className="p-1.5 text-gray-300" title="Built-in roles cannot be deleted">
                                        <Lock size={18} />
                                    </span>
                                ) : (
                                    <button
                                        onClick={() => handleDelete(role)}
                                        disabled={deletingId === role.id}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-150 active:scale-95 disabled:opacity-50"
                                        title="Delete role"
                                    >
                                        {deletingId === role.id ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={18} />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
                            <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-700">Pages: </span>
                                {pageSummary(role)}
                            </p>
                            {BEHAVIOUR_FLAGS.filter((f) => role.permissions.includes(f.permission)).map((f) => (
                                <p key={f.permission} className="text-xs text-amber-700">
                                    {f.label}
                                </p>
                            ))}
                            <p className="text-xs text-gray-400 flex items-center gap-1.5 pt-1">
                                <UsersIcon size={12} />
                                <span className="tabular-nums">{role.userCount}</span>
                                {role.userCount === 1 ? 'user' : 'users'}
                            </p>
                        </div>
                    </div>
                ))}
            </div>

            {roles.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
                    No roles found. Run the role seed script to create the built-in roles.
                </div>
            )}

            <RoleEditorModal
                open={modalOpen}
                role={editing}
                onClose={() => setModalOpen(false)}
                onSaved={refresh}
            />
        </>
    );
}
