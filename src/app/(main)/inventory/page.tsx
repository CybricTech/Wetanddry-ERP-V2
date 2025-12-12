import React from 'react';
import { getInventoryStats, getStorageLocations, getAllStockTransactions, getPendingApprovals, seedInitialInventory } from '@/lib/actions/inventory';
import InventoryClient from '@/components/inventory/InventoryClient';
import { auth } from '@/auth';

// Revalidate every 30 seconds - balances freshness with performance
export const revalidate = 30;

export default async function InventoryPage() {
    // Get current user session
    const session = await auth();
    const currentUser = session?.user?.name || session?.user?.email || 'Unknown';

    // Fetch all required data in parallel
    const [inventoryStats, locations, transactionsData, pendingData] = await Promise.all([
        getInventoryStats(),
        getStorageLocations(),
        getAllStockTransactions({ limit: 100 }),
        getPendingApprovals()
    ]);

    const { items, totalItems, lowStockItems, totalValue, expiringItems, siloStats } = inventoryStats;

    // Seed initial data if empty
    if (totalItems === 0) {
        await seedInitialInventory();
    }

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
        />
    );
}
