'use client';

import { useState } from 'react';
import { Plus, X, Loader2, AlertCircle } from 'lucide-react';

/**
 * Category picker with inline "create new" support, shared by every place an item's
 * category is chosen (Add Item, Stock In). Extracted so the __custom__ behaviour,
 * duplicate validation and error display cannot drift between the two.
 *
 * Writes the chosen value through a hidden input named `category`, so the parent form
 * submits it as ordinary FormData with no extra wiring.
 */
export default function CategorySelect({
    categories,
    value,
    onChange,
    accent = 'purple',
    required = true,
    canCreate = true,
}: {
    categories: string[];
    value: string;
    onChange: (category: string) => void;
    /** Matches the surrounding modal's colour, which differs between Add Item and Stock In. */
    accent?: 'purple' | 'emerald';
    required?: boolean;
    canCreate?: boolean;
}) {
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customCategoryName, setCustomCategoryName] = useState('');
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [localCategories, setLocalCategories] = useState(categories);

    const ring =
        accent === 'emerald'
            ? 'focus:border-emerald-500 focus:ring-emerald-500/10'
            : 'focus:border-purple-500 focus:ring-purple-500/10';
    const button = accent === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-purple-600 hover:bg-purple-700';
    const border = accent === 'emerald' ? 'border-emerald-300' : 'border-purple-300';

    const handleCategoryChange = (next: string) => {
        if (next === '__custom__') {
            setShowCustomInput(true);
            onChange('');
            setError('');
        } else {
            setShowCustomInput(false);
            onChange(next);
            setCustomCategoryName('');
            setError('');
        }
    };

    const handleCreate = async () => {
        const name = customCategoryName.trim();
        if (!name) {
            setError('Please enter a category name');
            return;
        }
        if (localCategories.includes(name)) {
            setError(`"${name}" already exists`);
            return;
        }

        setIsCreating(true);
        setError('');
        try {
            const { createCustomCategory } = await import('@/lib/actions/inventory');
            await createCustomCategory(name);
            setLocalCategories((prev) => [...prev, name]);
            onChange(name);
            setShowCustomInput(false);
            setCustomCategoryName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create category');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <>
            {/* The real submitted value - the select below is only the control surface. */}
            <input type="hidden" name="category" value={value} />

            {!showCustomInput ? (
                <select
                    value={value}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    required={required}
                    className={`w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-4 outline-none transition-all ${ring}`}
                >
                    <option value="">Select category</option>
                    {localCategories.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                    {canCreate && <option value="__custom__">✨ Custom (Create New)</option>}
                </select>
            ) : (
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={customCategoryName}
                            onChange={(e) => {
                                setCustomCategoryName(e.target.value);
                                setError('');
                            }}
                            placeholder="Enter new category name..."
                            autoFocus
                            className={`flex-1 px-4 py-3 bg-gray-50 border rounded-xl focus:bg-white focus:ring-4 outline-none transition-all placeholder:text-gray-400 ${border} ${ring}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreate();
                                }
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={isCreating}
                            className={`px-4 py-3 text-white rounded-xl transition-all font-medium text-sm flex items-center gap-1.5 disabled:opacity-50 ${button}`}
                        >
                            {isCreating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                            Add
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowCustomInput(false);
                                setCustomCategoryName('');
                                setError('');
                            }}
                            className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    {error && (
                        <p className="text-xs text-red-600 flex items-center gap-1">
                            <AlertCircle size={12} />
                            {error}
                        </p>
                    )}
                    <p className="text-xs text-gray-400">
                        This category will be saved and available for future items.
                    </p>
                </div>
            )}
        </>
    );
}
