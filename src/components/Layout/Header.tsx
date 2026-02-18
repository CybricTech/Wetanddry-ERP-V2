"use client";

import React, { useState, useRef, useEffect, useTransition } from 'react';
import { Search, Truck, Package, Users, Building2, ShoppingCart, X, Loader2 } from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';
import { globalSearch, type SearchResult } from '@/lib/actions/search';
import { useRouter } from 'next/navigation';
import type { Session } from 'next-auth';

interface HeaderProps {
    session?: Session | null;
}

const categoryConfig: Record<SearchResult['category'], { icon: React.ElementType; color: string; label: string }> = {
    truck: { icon: Truck, color: 'text-blue-600 bg-blue-50', label: 'Fleet' },
    inventory: { icon: Package, color: 'text-amber-600 bg-amber-50', label: 'Inventory' },
    staff: { icon: Users, color: 'text-purple-600 bg-purple-50', label: 'Staff' },
    client: { icon: Building2, color: 'text-emerald-600 bg-emerald-50', label: 'CRM' },
    order: { icon: ShoppingCart, color: 'text-indigo-600 bg-indigo-50', label: 'Orders' },
};

export function Header({ session }: HeaderProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    const router = useRouter();

    // Debounced search
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (query.trim().length < 2) {
            setResults([]);
            setIsOpen(false);
            return;
        }

        debounceRef.current = setTimeout(() => {
            startTransition(async () => {
                const data = await globalSearch(query);
                setResults(data);
                setIsOpen(data.length > 0);
            });
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (
                dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (result: SearchResult) => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        router.push(result.href);
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                {/* Search Bar */}
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        name="search"
                        id="global-search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => { if (results.length > 0) setIsOpen(true); }}
                        placeholder="Search trucks, materials, staff, clients..."
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        autoComplete="off"
                    />
                    {/* Loading / Clear */}
                    {query && (
                        <button
                            onClick={clearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            {isPending ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                        </button>
                    )}

                    {/* Results Dropdown */}
                    {isOpen && (
                        <div
                            ref={dropdownRef}
                            className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-[400px] overflow-y-auto z-50"
                        >
                            {results.map((result) => {
                                const config = categoryConfig[result.category];
                                const Icon = config.icon;
                                return (
                                    <button
                                        key={`${result.category}-${result.id}`}
                                        onClick={() => handleSelect(result)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-b-0"
                                    >
                                        <div className={`p-2 rounded-lg ${config.color}`}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{result.title}</p>
                                            <p className="text-xs text-gray-500 truncate">{result.subtitle}</p>
                                        </div>
                                        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">
                                            {config.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* No results */}
                    {query.trim().length >= 2 && !isPending && results.length === 0 && isOpen === false && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-6 text-center z-50">
                            <p className="text-sm text-gray-500">No results for &quot;{query}&quot;</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <NotificationBell initialSession={session} />
            </div>
        </header>
    );
}
