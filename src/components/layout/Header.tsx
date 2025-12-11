"use client";

import React from 'react';
import { Bell, Search } from 'lucide-react';

export function Header() {
    return (
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-4 flex-1">
                {/* Search Bar */}
                <div className="relative max-w-md w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        name="search"
                        id="global-search"
                        placeholder="Search trucks, materials, records..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <button className="relative p-2 hover:bg-gray-100 rounded-lg">
                    <Bell size={20} className="text-gray-600" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
            </div>
        </header>
    );
}
