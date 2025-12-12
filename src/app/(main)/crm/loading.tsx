import React from 'react'

export default function CRMLoading() {
    return (
        <div className="space-y-6 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <div className="h-8 w-64 bg-gray-200 rounded-lg mb-2" />
                    <div className="h-4 w-48 bg-gray-100 rounded" />
                </div>
                <div className="flex gap-3">
                    <div className="h-10 w-36 bg-gray-200 rounded-xl" />
                    <div className="h-10 w-32 bg-violet-200 rounded-xl" />
                </div>
            </div>

            {/* Tab Navigation Skeleton */}
            <div className="h-12 w-80 bg-gray-200 rounded-2xl" />

            {/* Filters Skeleton */}
            <div className="flex gap-3">
                <div className="flex-1 h-11 bg-gray-200 rounded-xl" />
                <div className="h-11 w-32 bg-gray-200 rounded-xl" />
                <div className="h-11 w-32 bg-gray-200 rounded-xl" />
            </div>

            {/* Cards Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
                            <div className="flex-1">
                                <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                                <div className="h-5 w-32 bg-gray-200 rounded" />
                            </div>
                            <div className="h-6 w-16 bg-gray-200 rounded-lg" />
                        </div>
                        <div className="space-y-2">
                            <div className="h-4 w-full bg-gray-100 rounded" />
                            <div className="h-4 w-3/4 bg-gray-100 rounded" />
                        </div>
                        <div className="pt-4 border-t border-gray-100 grid grid-cols-3 gap-3">
                            <div className="text-center">
                                <div className="h-6 w-12 mx-auto bg-gray-200 rounded mb-1" />
                                <div className="h-3 w-10 mx-auto bg-gray-100 rounded" />
                            </div>
                            <div className="text-center border-x border-gray-200">
                                <div className="h-6 w-12 mx-auto bg-gray-200 rounded mb-1" />
                                <div className="h-3 w-10 mx-auto bg-gray-100 rounded" />
                            </div>
                            <div className="text-center">
                                <div className="h-6 w-12 mx-auto bg-gray-200 rounded mb-1" />
                                <div className="h-3 w-10 mx-auto bg-gray-100 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
