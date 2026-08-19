'use client';

import { useState, useTransition } from 'react';
import { Tag, Pencil, Trash2, Check, X, Loader2, AlertCircle, Lock } from 'lucide-react';
import { renameCustomCategory, deleteCustomCategory } from '@/lib/actions/inventory';

export interface CustomCategory {
    id: string;
    name: string;
    createdBy: string | null;
    createdAt: Date | string;
    itemCount: number;
}

/**
 * Management surface for user-created categories. Built-ins are listed read-only so it
 * is obvious why they cannot be touched. Categories are referenced by string rather
 * than foreign key, so anything still in use is locked against rename and delete - the
 * server enforces the same rule.
 */
export default function CategoryManager({
    categories,
    builtIns,
    canManage,
}: {
    categories: CustomCategory[];
    builtIns: string[];
    canManage: boolean;
}) {
    const [isPending, startTransition] = useTransition();
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftName, setDraftName] = useState('');
    const [error, setError] = useState<{ id: string; message: string } | null>(null);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

    const startEdit = (category: CustomCategory) => {
        setEditingId(category.id);
        setDraftName(category.name);
        setError(null);
        setConfirmingDeleteId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setDraftName('');
        setError(null);
    };

    const saveRename = (id: string) => {
        startTransition(async () => {
            const result = await renameCustomCategory(id, draftName);
            if ('error' in result && result.error) {
                setError({ id, message: result.error });
                return;
            }
            cancelEdit();
        });
    };

    const confirmDelete = (id: string) => {
        startTransition(async () => {
            const result = await deleteCustomCategory(id);
            if ('error' in result && result.error) {
                setError({ id, message: result.error });
                setConfirmingDeleteId(null);
                return;
            }
            setConfirmingDeleteId(null);
        });
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                        <Tag size={18} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Item Categories</h3>
                        <p className="text-sm text-gray-500">
                            Custom categories are created when adding or receiving stock.
                        </p>
                    </div>
                </div>
                <span className="text-xs text-gray-500 tabular-nums">
                    {categories.length} custom · {builtIns.length} built-in
                </span>
            </div>

            <div className="divide-y divide-gray-100">
                {builtIns.map((name) => (
                    <div key={name} className="px-6 py-3.5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Lock size={14} className="text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-700">{name}</span>
                        </div>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">Built-in</span>
                    </div>
                ))}

                {categories.map((category) => {
                    const isEditing = editingId === category.id;
                    const isLocked = category.itemCount > 0;
                    const rowError = error?.id === category.id ? error.message : null;

                    return (
                        <div key={category.id} className="px-6 py-3.5">
                            <div className="flex items-center justify-between gap-4">
                                {isEditing ? (
                                    <div className="flex items-center gap-2 flex-1">
                                        <input
                                            type="text"
                                            value={draftName}
                                            onChange={(e) => setDraftName(e.target.value)}
                                            autoFocus
                                            disabled={isPending}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveRename(category.id);
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            className="flex-1 max-w-xs px-3 py-2 bg-gray-50 border border-purple-300 rounded-lg focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => saveRename(category.id)}
                                            disabled={isPending}
                                            className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                            aria-label="Save name"
                                        >
                                            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={cancelEdit}
                                            disabled={isPending}
                                            className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
                                            aria-label="Cancel"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="font-medium text-gray-900 truncate">{category.name}</span>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                                isLocked ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                                            }`}
                                        >
                                            {category.itemCount} item{category.itemCount === 1 ? '' : 's'}
                                        </span>
                                        {category.createdBy && (
                                            <span className="text-xs text-gray-400 truncate hidden sm:inline">
                                                added by {category.createdBy}
                                            </span>
                                        )}
                                    </div>
                                )}

                                {canManage && !isEditing && (
                                    <div className="flex items-center gap-1 shrink-0">
                                        {confirmingDeleteId === category.id ? (
                                            <>
                                                <span className="text-xs text-gray-500 mr-1">Delete?</span>
                                                <button
                                                    type="button"
                                                    onClick={() => confirmDelete(category.id)}
                                                    disabled={isPending}
                                                    className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                                                >
                                                    {isPending ? <Loader2 size={12} className="animate-spin" /> : 'Yes'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingDeleteId(null)}
                                                    className="px-2.5 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                                                >
                                                    No
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => startEdit(category)}
                                                    disabled={isLocked}
                                                    title={
                                                        isLocked
                                                            ? `In use by ${category.itemCount} item${category.itemCount === 1 ? '' : 's'} - move them first`
                                                            : 'Rename'
                                                    }
                                                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setError(null);
                                                        setConfirmingDeleteId(category.id);
                                                    }}
                                                    disabled={isLocked}
                                                    title={
                                                        isLocked
                                                            ? `In use by ${category.itemCount} item${category.itemCount === 1 ? '' : 's'} - move them first`
                                                            : 'Delete'
                                                    }
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 disabled:cursor-not-allowed"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {rowError && (
                                <p className="text-xs text-red-600 flex items-start gap-1.5 mt-2">
                                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                    {rowError}
                                </p>
                            )}
                        </div>
                    );
                })}

                {categories.length === 0 && (
                    <div className="px-6 py-8 text-center">
                        <p className="text-sm text-gray-500">No custom categories yet.</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Create one from the category picker when adding or receiving an item.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
