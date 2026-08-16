'use client';

import { useEffect, useState } from 'react';
import { Shield, X, Loader2, Check, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
    PAGE_PERMISSIONS,
    BEHAVIOUR_FLAGS,
    ROLE_COLORS,
    type Permission,
} from '@/lib/permissions';
import { createRole, updateRole } from '@/lib/actions/roles';
import { ROLE_SWATCH } from './roleColors';

export interface EditableRole {
    id: string;
    name: string;
    description: string | null;
    color: string;
    isBuiltIn: boolean;
    permissions: string[];
    userCount: number;
}

interface Props {
    open: boolean;
    role: EditableRole | null; // null = create
    onClose: () => void;
    onSaved: () => void;
}

export default function RoleEditorModal({ open, role, onClose, onSaved }: Props) {
    const isEdit = role !== null;
    const locked = role?.isBuiltIn ?? false;

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [color, setColor] = useState<string>('blue');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setName(role?.name ?? '');
        setDescription(role?.description ?? '');
        setColor(role?.color ?? 'blue');
        setSelected(new Set(role?.permissions ?? []));
        setSaving(false);
    }, [open, role]);

    // Escape to close is a keyboard action, so it closes immediately.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, saving, onClose]);

    if (!open) return null;

    const toggle = (permission: Permission) => {
        if (locked) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(permission)) next.delete(permission);
            else next.add(permission);
            return next;
        });
    };

    const handleSave = async () => {
        if (name.trim().length < 2) {
            toast.error('Role name must be at least 2 characters');
            return;
        }

        setSaving(true);
        const payload = {
            name: name.trim(),
            description: description.trim() || null,
            color,
            permissions: Array.from(selected),
        };

        try {
            const result = isEdit ? await updateRole(role!.id, payload) : await createRole(payload);
            if (result.success) {
                toast.success(isEdit ? 'Role updated' : `Role "${payload.name}" created`);
                onSaved();
                onClose();
            } else {
                toast.error(result.error || 'Something went wrong');
            }
        } catch (error) {
            console.error(error);
            toast.error('An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    const pageCount = PAGE_PERMISSIONS.filter((p) => selected.has(p.permission)).length;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !saving && onClose()}
        >
            {/* Modals stay origin-center: they are not anchored to a trigger. */}
            <div
                className="animate-pop-in bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={isEdit ? `Edit ${role!.name}` : 'Create role'}
            >
                <div className="p-6 bg-blue-900 text-white shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Shield size={24} />
                            <h3 className="text-xl font-bold">{isEdit ? 'Edit Role' : 'Create Role'}</h3>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={saving}
                            className="p-1 hover:bg-white/20 rounded-lg transition-colors duration-150 active:scale-95"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <p className="text-blue-200 mt-2 text-sm">
                        {locked
                            ? 'Built-in roles keep a fixed name and permission set. You can still change how the badge looks.'
                            : 'Choose the pages this role can reach, then adjust how approvals behave.'}
                    </p>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Identity */}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Role name *</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={locked || saving}
                                placeholder="e.g. Site Supervisor"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none transition-colors duration-150 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:bg-gray-50 disabled:text-gray-500"
                            />
                            {locked && (
                                <p className="mt-1.5 text-xs text-gray-500 flex items-center gap-1">
                                    <Lock size={12} /> Built-in roles cannot be renamed
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                disabled={saving}
                                placeholder="Optional"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none transition-colors duration-150 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                            />
                        </div>
                    </div>

                    {/* Badge colour */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Badge colour</label>
                        <div className="flex flex-wrap gap-2">
                            {ROLE_COLORS.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => setColor(c)}
                                    disabled={saving}
                                    aria-label={c}
                                    aria-pressed={color === c}
                                    className={`h-9 w-9 rounded-xl border-2 transition-transform duration-150 ease-out-strong active:scale-95 ${ROLE_SWATCH[c]} ${
                                        color === c ? 'border-gray-900 scale-105' : 'border-transparent'
                                    }`}
                                >
                                    {color === c && <Check size={16} className="mx-auto text-white drop-shadow" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Page access */}
                    <div>
                        <div className="flex items-baseline justify-between mb-1">
                            <h4 className="text-sm font-semibold text-gray-900">Page access</h4>
                            <span className="text-xs text-gray-500 tabular-nums">
                                {pageCount} of {PAGE_PERMISSIONS.length} selected
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                            Controls which pages appear in the sidebar and which this role can open directly.
                            Dashboard and Settings are always available.
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2">
                            {PAGE_PERMISSIONS.map((page, i) => {
                                const on = selected.has(page.permission);
                                return (
                                    <button
                                        key={page.id}
                                        type="button"
                                        onClick={() => toggle(page.permission)}
                                        disabled={locked || saving}
                                        aria-pressed={on}
                                        style={{ animationDelay: `${i * 30}ms` }}
                                        className={`animate-rise-in flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors duration-150 active:scale-[0.99] disabled:cursor-not-allowed ${
                                            on
                                                ? 'bg-blue-50 border-blue-600 text-blue-900'
                                                : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                        }`}
                                    >
                                        <span
                                            className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors duration-150 ${
                                                on ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'
                                            }`}
                                        >
                                            {on && <Check size={14} className="text-white" />}
                                        </span>
                                        <span className="text-sm font-medium">{page.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Behaviour options - deliberately separate from page access, since
                        these change how an action behaves rather than granting entry. */}
                    <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900 mt-4 mb-1">Behaviour options</h4>
                        <p className="text-xs text-gray-500 mb-3">
                            These adjust how existing actions behave. They do not grant or remove access.
                        </p>
                        <div className="space-y-2">
                            {BEHAVIOUR_FLAGS.map((flag) => {
                                const on = selected.has(flag.permission);
                                return (
                                    <button
                                        key={flag.permission}
                                        type="button"
                                        onClick={() => toggle(flag.permission)}
                                        disabled={locked || saving}
                                        aria-pressed={on}
                                        className="w-full flex items-start gap-3 px-4 py-3 rounded-xl border border-gray-200 text-left transition-colors duration-150 hover:border-gray-300 disabled:cursor-not-allowed"
                                    >
                                        <span
                                            className={`mt-0.5 h-6 w-10 rounded-full shrink-0 relative transition-colors duration-200 ease-out-strong ${
                                                on ? 'bg-amber-500' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ease-out-strong ${
                                                    on ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
                                                }`}
                                            />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-medium text-gray-900">{flag.label}</span>
                                            <span className="block text-xs text-gray-500 mt-0.5">{flag.help}</span>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="p-6 pt-4 border-t border-gray-100 flex gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors duration-150 active:scale-[0.97]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || name.trim().length < 2}
                        className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-[background-color,transform] duration-150 ease-out-strong active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100"
                    >
                        {saving && <Loader2 size={18} className="animate-spin" />}
                        {saving ? 'Saving...' : isEdit ? 'Save changes' : 'Create role'}
                    </button>
                </div>
            </div>
        </div>
    );
}
