import React from 'react';
import {
    getInventoryStats,
    getStorageLocations,
    getAllStockTransactions,
    getPendingApprovals,
    getCustomCategories,
    getCustomCategoryDetails,
    getRepairs,
    getRepairStats
} from '@/lib/actions/inventory';
import InventoryClient from '@/components/inventory/InventoryClient';
import { auth } from '@/auth';

// Revalidate every 30 seconds - balances freshness with performance
export const revalidate = 30;

export default async function InventoryPage() {
    // Get current user session
    const session = await auth();
    const currentUser = session?.user?.name || session?.user?.email || 'Unknown';

    // Fetch all required data in parallel
    const [
        inventoryStats,
        locations,
        transactionsData,
        pendingData,
        customCategories,
        customCategoryDetails,
        repairs,
        repairStats
    ] = await Promise.all([
        getInventoryStats(),
        getStorageLocations(),
        getAllStockTransactions({ limit: 100 }),
        getPendingApprovals(),
        getCustomCategories(),
        getCustomCategoryDetails(),
        getRepairs(),
        getRepairStats()
    ]);

    const { items, totalItems, lowStockItems, totalValue, expiringItems, siloStats } = inventoryStats;

    return (
        <InventoryClient
            items={items}
            totalItems={totalItems}
            lowStockItems={lowStockItems}
            totalValue={totalValue}
            expiringItems={expiringItems}
            siloStats={siloStats}
            locations={locations}
            transactions={transactionsData.transactions}
            pendingApprovals={pendingData.pendingQueue}
            pendingCounts={pendingData.counts}
            currentUser={currentUser}
            permissions={session?.user?.permissions}
            customCategories={customCategories}
            customCategoryDetails={customCategoryDetails}
            repairs={JSON.parse(JSON.stringify(repairs))}
            repairStats={repairStats}
        />
    );
}
