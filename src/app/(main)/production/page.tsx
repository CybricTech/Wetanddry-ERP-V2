import React from 'react';
import { getRecipes, getSilos, getProductionRuns, getAllInventoryItems } from '@/lib/actions/production';
import ProductionClient from '@/components/production/ProductionClient';

// Revalidate every 30 seconds
export const revalidate = 30;

export default async function ProductionPage() {
    const recipes = await getRecipes();
    const silos = await getSilos();
    const recentRuns = await getProductionRuns();
    const inventoryItems = await getAllInventoryItems();

    return (
        <ProductionClient
            recipes={recipes}
            silos={silos}
            recentRuns={recentRuns}
            inventoryItems={inventoryItems}
        />
    );
}
