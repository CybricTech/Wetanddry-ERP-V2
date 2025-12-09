'use client'

import React, { useState, useTransition } from 'react';
import {
    Factory, Play, AlertCircle, CheckCircle, Database, Clock, ChevronDown,
    Loader2, X, TrendingUp, BarChart3, Beaker, Package, History,
    AlertTriangle, Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import RecipeManager from './RecipeManager';

interface Recipe {
    id: string;
    productCode: string;
    name: string;
    description: string | null;
    totalWeight: number;
    ingredients: {
        id: string;
        materialName: string;
        quantity: number;
        unit: string;
        inventoryItemId?: string | null;
        inventoryItem?: {
            id: string;
            name: string;
        } | null;
    }[];
}

interface Silo {
    id: string;
    name: string;
    description: string | null;
    capacity: number | null;
    cementItem: {
        id: string;
        name: string;
        quantity: number;
        unit: string;
        maxCapacity: number | null;
    } | null;
}

interface ProductionRun {
    id: string;
    quantity: number;
    cementUsed: number | null;
    status: string;
    notes: string | null;
    operatorName: string | null;
    createdAt: Date;
    recipe: {
        name: string;
    };
    silo: {
        name: string;
    } | null;
}

interface InventoryItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
}

interface ProductionClientProps {
    recipes: Recipe[];
    silos: Silo[];
    recentRuns: ProductionRun[];
    inventoryItems: InventoryItem[];
}

export default function ProductionClient({ recipes, silos, recentRuns, inventoryItems }: ProductionClientProps) {
    const [activeTab, setActiveTab] = useState<'production' | 'recipes' | 'logs'>('recipes');
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [selectedSilo, setSelectedSilo] = useState<Silo | null>(null);
    const [quantity, setQuantity] = useState<string>('');
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryData, setSummaryData] = useState<any>(null);

    // Calculate required materials for selected recipe and quantity
    const calculateRequirements = () => {
        if (!selectedRecipe || !quantity) return null;
        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) return null;

        return selectedRecipe.ingredients.map(ing => {
            // Find available stock
            const isCement = ing.materialName.toLowerCase().includes('cement');
            let available = 0;
            let unit = ing.unit;

            if (isCement && selectedSilo && selectedSilo.cementItem) {
                available = selectedSilo.cementItem.quantity;
                unit = selectedSilo.cementItem.unit;
            } else {
                // FIXED: Look up by ID first (robust), fall back to name (legacy)
                const linkedId = ing.inventoryItemId || ing.inventoryItem?.id;

                let item: InventoryItem | undefined;
                if (linkedId) {
                    item = inventoryItems.find(i => i.id === linkedId);
                } else {
                    item = inventoryItems.find(i => i.name === ing.materialName);
                }

                if (item) {
                    available = item.quantity;
                    unit = item.unit;
                }
            }

            return {
                name: ing.materialName,
                required: ing.quantity * qty,
                available,
                unit,
                isCement,
                isSufficient: available >= (ing.quantity * qty)
            };
        });
    };

    const requirements = calculateRequirements();
    const cementRequirement = requirements?.find(r => r.isCement);
    const allMaterialsSufficient = requirements?.every(r => r.isSufficient) ?? false;

    // Derived check for button disabled state
    const canExecute = selectedRecipe && selectedSilo && quantity && allMaterialsSufficient && !isPending;

    const handleSubmit = async () => {
        if (!canExecute) return;

        const formData = new FormData();
        formData.append('recipeId', selectedRecipe!.id);
        formData.append('siloId', selectedSilo!.id);
        formData.append('quantity', quantity);

        startTransition(async () => {
            try {
                const { createProductionRun } = await import('@/lib/actions/production');
                const result = await createProductionRun(formData);

                if (result.success) {
                    setMessage({ type: 'success', text: result.message });
                    setShowConfirmModal(false);

                    // Set summary data and show result modal
                    setSummaryData({
                        recipeName: selectedRecipe!.name,
                        quantity: quantity,
                        deductions: result.deductions,
                        runId: result.run?.id
                    });
                    setShowSummaryModal(true);

                    // clear form
                    setSelectedRecipe(null);
                    setSelectedSilo(null);
                    setQuantity('');
                } else {
                    setMessage({ type: 'error', text: result.message });
                    setShowConfirmModal(false);
                }
            } catch (error: any) {
                setMessage({ type: 'error', text: error.message || 'Production failed' });
                setShowConfirmModal(false);
            }
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Production & Mixology</h1>
                    <p className="text-gray-600 mt-1">Manage mix designs and execute production</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 gap-1">
                <button
                    onClick={() => setActiveTab('recipes')}
                    className={cn(
                        "px-6 py-3 font-medium text-sm transition-colors relative rounded-t-lg",
                        activeTab === 'recipes'
                            ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                >
                    Mix Designs
                </button>
                <button
                    onClick={() => setActiveTab('production')}
                    className={cn(
                        "px-6 py-3 font-medium text-sm transition-colors relative rounded-t-lg",
                        activeTab === 'production'
                            ? "text-blue-600 bg-blue-50/50 border-b-2 border-blue-600"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                >
                    Run Production
                </button>
                <div className="w-px bg-gray-200 my-3 mx-1" />
                <button
                    onClick={() => setActiveTab('logs')}
                    className={cn(
                        "px-6 py-3 font-medium text-sm transition-colors relative rounded-t-lg flex items-center gap-2",
                        activeTab === 'logs'
                            ? "text-indigo-600 bg-indigo-50/50 border-b-2 border-indigo-600"
                            : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )}
                >
                    <History size={16} />
                    Logs & History
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'recipes' && (
                <RecipeManager recipes={recipes} inventoryItems={inventoryItems} />
            )}

            {activeTab === 'production' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Production Form */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Alert Message */}
                        {message && (
                            <div className={cn(
                                "p-4 rounded-xl flex items-center gap-3 animate-in slide-in-from-top duration-300",
                                message.type === 'success'
                                    ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                                    : "bg-red-50 border border-red-200 text-red-800"
                            )}>
                                {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
                                <span className="font-medium">{message.text}</span>
                                <button onClick={() => setMessage(null)} className="ml-auto">
                                    <X size={18} />
                                </button>
                            </div>
                        )}

                        {/* Recipe Selection */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Beaker className="text-blue-600" size={22} />
                                Step 1: Select Recipe
                            </h2>

                            {recipes.length === 0 ? (
                                <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                    <p className="text-gray-500">No recipes found. Switch to the "Mix Designs" tab to add recipes.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {recipes.map(recipe => (
                                        <button
                                            key={recipe.id}
                                            onClick={() => setSelectedRecipe(recipe)}
                                            className={cn(
                                                "p-4 rounded-xl border-2 text-left transition-all",
                                                selectedRecipe?.id === recipe.id
                                                    ? "border-blue-500 bg-blue-50"
                                                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                                            )}
                                        >
                                            <div className="font-bold text-gray-900 flex justify-between">
                                                <span>{recipe.productCode}</span>
                                                <span className="text-gray-500 font-normal text-sm">{recipe.totalWeight.toFixed(0)} kg/m³</span>
                                            </div>
                                            <div className="font-medium text-gray-700">{recipe.name}</div>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {recipe.ingredients.slice(0, 3).map(ing => (
                                                    <span key={ing.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                        {ing.materialName.split(' ')[0]}
                                                    </span>
                                                ))}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Silo Selection */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Database className="text-indigo-600" size={22} />
                                Step 2: Select Cement Silo
                                <span className="text-sm font-normal text-red-500 ml-2">*Required</span>
                            </h2>

                            {silos.length === 0 ? (
                                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                    <Database className="mx-auto text-gray-300 mb-3" size={40} />
                                    <p className="text-gray-500">No silos available. Please add silos in Inventory Management.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {silos.map(silo => {
                                        const percentage = silo.cementItem?.maxCapacity
                                            ? (silo.cementItem.quantity / silo.cementItem.maxCapacity) * 100
                                            : 50;
                                        const isLow = silo.cementItem ? silo.cementItem.quantity < 5000 : true;

                                        return (
                                            <button
                                                key={silo.id}
                                                onClick={() => setSelectedSilo(silo)}
                                                disabled={!silo.cementItem}
                                                className={cn(
                                                    "p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden",
                                                    selectedSilo?.id === silo.id
                                                        ? "border-indigo-500 bg-indigo-50"
                                                        : silo.cementItem
                                                            ? "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                                                            : "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                                )}
                                            >
                                                <div className="flex items-start justify-between mb-3">
                                                    <div>
                                                        <div className="font-semibold text-gray-900">{silo.name}</div>
                                                        <p className="text-sm text-gray-500">{silo.cementItem?.name || 'No cement loaded'}</p>
                                                    </div>
                                                    {isLow && silo.cementItem && (
                                                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                                            Low
                                                        </span>
                                                    )}
                                                </div>

                                                {silo.cementItem && (
                                                    <>
                                                        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all",
                                                                    isLow ? "bg-amber-500" : "bg-indigo-500"
                                                                )}
                                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                                            />
                                                        </div>
                                                        <div className="mt-2 flex justify-between text-sm">
                                                            <span className="text-gray-500">Available</span>
                                                            <span className="font-semibold text-gray-900">
                                                                {silo.cementItem.quantity.toLocaleString()} {silo.cementItem.unit}
                                                            </span>
                                                        </div>
                                                    </>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Quantity Input */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Package className="text-emerald-600" size={22} />
                                Step 3: Production Quantity
                            </h2>

                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Quantity to Produce
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step="0.5"
                                            min="0.5"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            placeholder="Enter quantity"
                                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-lg"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">m³</span>
                                    </div>
                                </div>
                            </div>

                            {/* Material Requirements Preview with Active Stock Checks */}
                            {requirements && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Required vs Available Materials:</h4>
                                    <div className="space-y-3">
                                        {requirements.map((req, idx) => (
                                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                                                <div className={cn(
                                                    "flex items-center gap-2",
                                                    req.isCement ? "text-indigo-700 font-medium" : "text-gray-700"
                                                )}>
                                                    {req.isCement && <Database size={14} />}
                                                    <span>{req.name}</span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-2 sm:mt-0">
                                                    <div className="text-right">
                                                        <span className="text-xs text-gray-500 block">Required</span>
                                                        <span className="font-semibold text-gray-900">
                                                            {req.required.toLocaleString(undefined, { maximumFractionDigits: 2 })} {req.unit}
                                                        </span>
                                                    </div>
                                                    <div className="text-right border-l pl-4">
                                                        <span className="text-xs text-gray-500 block">Available</span>
                                                        <span className={cn(
                                                            "font-semibold",
                                                            req.isSufficient ? "text-emerald-600" : "text-red-500"
                                                        )}>
                                                            {req.available.toLocaleString(undefined, { maximumFractionDigits: 2 })} {req.unit}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {!allMaterialsSufficient && (
                                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2 text-sm">
                                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                                            <span>Insufficient stock for one or more ingredients. Please restock before producing.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Execute Button */}
                            <button
                                onClick={() => setShowConfirmModal(true)}
                                disabled={!canExecute}
                                className={cn(
                                    "mt-6 w-full py-4 rounded-xl font-semibold text-lg flex items-center justify-center gap-3 transition-all",
                                    canExecute
                                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25"
                                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                )}
                            >
                                <Play size={22} />
                                Execute Production
                            </button>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Quick Stats */}
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
                            <h3 className="font-semibold mb-4 flex items-center gap-2">
                                <BarChart3 size={20} />
                                Today's Production
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <div className="text-blue-200 text-sm">Total Runs</div>
                                    <div className="text-3xl font-bold">
                                        {recentRuns.filter(r =>
                                            new Date(r.createdAt).toDateString() === new Date().toDateString()
                                        ).length}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-blue-200 text-sm">Volume Produced</div>
                                    <div className="text-3xl font-bold">
                                        {recentRuns
                                            .filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString())
                                            .reduce((sum, r) => sum + r.quantity, 0)
                                            .toFixed(1)} m³
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Runs */}
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <History size={18} />
                                    Recent Production Runs
                                </h3>
                            </div>
                            {recentRuns.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <Factory className="mx-auto text-gray-300 mb-3" size={32} />
                                    <p>No production runs yet</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                                    {recentRuns.slice(0, 10).map(run => (
                                        <div key={run.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <div className="font-medium text-gray-900">{run.recipe.name}</div>
                                                    <div className="text-sm text-gray-500 mt-1">
                                                        {run.quantity} m³ • {run.silo?.name || 'N/A'}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                                        run.status === 'Completed'
                                                            ? "bg-emerald-100 text-emerald-700"
                                                            : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {run.status}
                                                    </span>
                                                    <div className="text-xs text-gray-400 mt-1">
                                                        {new Date(run.createdAt).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                            {run.cementUsed && (
                                                <div className="mt-2 text-xs text-indigo-600">
                                                    Cement used: {run.cementUsed.toLocaleString()} kg
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Confirmation Modal */}
                    {showConfirmModal && (
                        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                                <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                                    <div className="flex items-center gap-3">
                                        <Factory size={24} />
                                        <h3 className="text-xl font-bold">Confirm Production</h3>
                                    </div>
                                </div>

                                <div className="p-6 space-y-4">
                                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Recipe</span>
                                            <span className="font-semibold text-gray-900">{selectedRecipe?.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Cement Source</span>
                                            <span className="font-semibold text-indigo-600">{selectedSilo?.name}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600">Quantity</span>
                                            <span className="font-semibold text-gray-900">{quantity} m³</span>
                                        </div>
                                        {cementRequirement && (
                                            <div className="flex justify-between pt-2 border-t border-gray-200">
                                                <span className="text-gray-600">Cement to Deduct</span>
                                                <span className="font-semibold text-red-600">
                                                    -{cementRequirement.required.toLocaleString()} {cementRequirement.unit}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                                        <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={18} />
                                        <p className="text-sm text-amber-800">
                                            This will automatically deduct the required materials from inventory. This action cannot be undone.
                                        </p>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={() => setShowConfirmModal(false)}
                                            disabled={isPending}
                                            className="flex-1 py-3 px-4 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isPending}
                                            className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
                                        >
                                            {isPending ? (
                                                <>
                                                    <Loader2 size={18} className="animate-spin" />
                                                    Processing...
                                                </>
                                            ) : (
                                                <>
                                                    <Play size={18} />
                                                    Confirm & Execute
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRODUCTION SUMMARY MODAL */}
                    {showSummaryModal && summaryData && (
                        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
                                <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-center">
                                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md">
                                        <CheckCircle size={32} className="text-white" />
                                    </div>
                                    <h2 className="text-2xl font-bold">Production Successful!</h2>
                                    <p className="text-emerald-50 mt-1">Inventory has been updated automatically.</p>
                                </div>

                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl text-center">
                                            <div className="text-gray-500 text-xs uppercase font-bold tracking-wider">Recipe</div>
                                            <div className="text-gray-900 font-bold text-lg mt-1">{summaryData.recipeName}</div>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl text-center">
                                            <div className="text-gray-500 text-xs uppercase font-bold tracking-wider">Quantity</div>
                                            <div className="text-gray-900 font-bold text-lg mt-1">{summaryData.quantity} m³</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                            <TrendingUp size={16} className="text-gray-500" />
                                            Materials Deducted
                                        </h4>
                                        <div className="bg-gray-50 rounded-xl overflow-hidden border border-gray-100 divide-y divide-gray-100 max-h-60 overflow-y-auto">
                                            {summaryData.deductions?.map((d: any, idx: number) => (
                                                <div key={idx} className="flex justify-between p-3 text-sm">
                                                    <span className="text-gray-600">{d.item}</span>
                                                    <span className="font-mono font-medium text-gray-900">-{d.quantity.toLocaleString()} {d.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => setShowSummaryModal(false)}
                                        className="w-full py-4 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                                    >
                                        Close & Continue
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'logs' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <History className="text-indigo-600" size={20} />
                            Production History
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Detailed log of all production executions and status.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full whitespace-nowrap">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Recipe</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Quantity</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Cement Used</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Source Silo</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase">Operator</th>
                                    <th className="py-4 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentRuns.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-gray-500">
                                            No production history found.
                                        </td>
                                    </tr>
                                ) : (
                                    recentRuns.map((run) => (
                                        <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="py-4 px-6 text-sm text-gray-900">
                                                <div className="font-medium">
                                                    {new Date(run.createdAt).toLocaleDateString('en-GB', {
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric'
                                                    })}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {new Date(run.createdAt).toLocaleTimeString('en-US', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-sm text-gray-900 font-medium">{run.recipe.name}</td>
                                            <td className="py-4 px-6 text-sm text-gray-900 text-right">
                                                <span className="font-semibold">{run.quantity.toFixed(1)}</span> m³
                                            </td>
                                            <td className="py-4 px-6 text-sm text-gray-600 text-right">
                                                {run.cementUsed ? `${run.cementUsed.toLocaleString()} kg` : '-'}
                                            </td>
                                            <td className="py-4 px-6 text-sm text-gray-600">
                                                <div className="flex items-center gap-2">
                                                    <Database size={14} className="text-gray-400" />
                                                    {run.silo?.name || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-sm text-gray-600">
                                                {run.operatorName || 'System'}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className={cn(
                                                    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                                    run.status === 'Completed'
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-red-100 text-red-700"
                                                )}>
                                                    {run.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
