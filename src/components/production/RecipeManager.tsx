'use client'

import { useState, useMemo } from 'react'
import { Plus, Trash2, Save, X, Calculator, Info } from 'lucide-react'
import { createRecipe, deleteRecipe } from '@/lib/actions/production'
import { useRouter } from 'next/navigation'

interface InventoryItem {
    id: string
    name: string
    unit: string
}

interface Recipe {
    id: string
    productCode: string
    name: string
    totalWeight: number
    ingredients: {
        id?: string
        materialName: string
        quantity: number
        unit: string
        inventoryItemId?: string | null
        inventoryItem?: {
            id: string
            name: string
        } | null
    }[]
}

// Extracted Component to prevent re-renders
function IngredientInput({
    label,
    id,
    qtyName,
    inventoryItems,
    onChange,
    selectedItemId
}: {
    label: string,
    id: string,
    qtyName: string,
    inventoryItems: InventoryItem[],
    onChange: (itemId: string) => void,
    selectedItemId?: string
}) {
    const selectedItem = inventoryItems.find(i => i.id === selectedItemId)

    return (
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">{label}</label>
            <div className="flex gap-3">
                <div className="flex-1">
                    <select
                        name={id}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        onChange={(e) => onChange(e.target.value)}
                        value={selectedItemId || ''}
                    >
                        <option value="">Select Material...</option>
                        {inventoryItems.map(item => (
                            <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                    </select>
                </div>
                <div className="w-32 relative">
                    <input
                        name={qtyName}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-right pr-9"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">
                        {selectedItem?.unit || '-'}
                    </span>
                </div>
            </div>
        </div>
    )
}

function AddRecipeModal({
    setIsAdding,
    router,
    inventoryItems
}: {
    setIsAdding: (val: boolean) => void,
    router: any,
    inventoryItems: InventoryItem[]
}) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [totals, setTotals] = useState(0)

    // Track selected items to show units
    const [selections, setSelections] = useState<{ [key: string]: string }>({})

    const handleSelectionChange = (key: string, itemId: string) => {
        setSelections(prev => ({ ...prev, [key]: itemId }))
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const formData = new FormData(e.currentTarget)
        const res = await createRecipe(formData)

        if (res.success) {
            setIsAdding(false)
            router.refresh()
        } else {
            setError(res.message || 'Failed to create recipe')
        }
        setLoading(false)
    }

    const handleCalc = (e: React.FormEvent<HTMLFormElement>) => {
        const form = e.currentTarget
        const sum =
            (parseFloat((form.elements.namedItem('qty_agg20') as HTMLInputElement).value) || 0) +
            (parseFloat((form.elements.namedItem('qty_agg10') as HTMLInputElement).value) || 0) +
            (parseFloat((form.elements.namedItem('qty_stoneDust') as HTMLInputElement).value) || 0) +
            (parseFloat((form.elements.namedItem('qty_cement') as HTMLInputElement).value) || 0) +
            (parseFloat((form.elements.namedItem('qty_water') as HTMLInputElement).value) || 0) +
            (parseFloat((form.elements.namedItem('qty_admixture') as HTMLInputElement).value) || 0)
        setTotals(sum)
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Calculator className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 text-lg">New Mix Design</h3>
                            <p className="text-xs text-gray-500">Configure composition and material ratios</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    <form id="recipe-form" onSubmit={handleSubmit} onChange={handleCalc} className="p-8 space-y-8">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                {error}
                            </div>
                        )}

                        {/* Basic Info */}
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Product Code</label>
                                <input
                                    name="productCode"
                                    placeholder="e.g. C25"
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Mix Description</label>
                                <input
                                    name="name"
                                    placeholder="e.g. Standard Grade Concrete"
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* Ingredients */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <div className="h-2 w-2 rounded-full bg-orange-400" />
                                    <h4 className="font-semibold text-gray-900">Aggregates</h4>
                                </div>
                                <IngredientInput
                                    label="20mm Aggregate"
                                    id="id_agg20"
                                    qtyName="qty_agg20"
                                    inventoryItems={inventoryItems}
                                    selectedItemId={selections['agg20']}
                                    onChange={(id) => handleSelectionChange('agg20', id)}
                                />
                                <IngredientInput
                                    label="10mm Aggregate"
                                    id="id_agg10"
                                    qtyName="qty_agg10"
                                    inventoryItems={inventoryItems}
                                    selectedItemId={selections['agg10']}
                                    onChange={(id) => handleSelectionChange('agg10', id)}
                                />
                                <IngredientInput
                                    label="Stone Dust"
                                    id="id_stoneDust"
                                    qtyName="qty_stoneDust"
                                    inventoryItems={inventoryItems}
                                    selectedItemId={selections['stoneDust']}
                                    onChange={(id) => handleSelectionChange('stoneDust', id)}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <div className="h-2 w-2 rounded-full bg-blue-400" />
                                    <h4 className="font-semibold text-gray-900">Binders & Fluids</h4>
                                </div>
                                <IngredientInput
                                    label="Cement"
                                    id="id_cement"
                                    qtyName="qty_cement"
                                    inventoryItems={inventoryItems}
                                    selectedItemId={selections['cement']}
                                    onChange={(id) => handleSelectionChange('cement', id)}
                                />
                                <IngredientInput
                                    label="Water"
                                    id="id_water"
                                    qtyName="qty_water"
                                    inventoryItems={inventoryItems}
                                    selectedItemId={selections['water']}
                                    onChange={(id) => handleSelectionChange('water', id)}
                                />
                                <IngredientInput
                                    label="Admixture"
                                    id="id_admixture"
                                    qtyName="qty_admixture"
                                    inventoryItems={inventoryItems}
                                    selectedItemId={selections['admixture']}
                                    onChange={(id) => handleSelectionChange('admixture', id)}
                                />
                            </div>
                        </div>
                    </form>
                </div>

                <div className="px-8 py-5 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                        <span className="text-sm text-gray-500 font-medium uppercase tracking-wider block mb-1">Total Batch Weight</span>
                        <span className="text-2xl font-bold text-gray-900">{totals.toFixed(2)} <span className="text-sm font-medium text-gray-500">kg (approx)</span></span>
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors shadow-sm">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="recipe-form"
                            disabled={loading}
                            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Recipe
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function RecipeManager({ recipes, inventoryItems, canManageRecipes = false }: { recipes: Recipe[], inventoryItems: InventoryItem[], canManageRecipes?: boolean }) {
    const router = useRouter()
    const [isAdding, setIsAdding] = useState(false)

    // Helper to get ingredient quantity safely
    const getQty = (recipe: Recipe, name: string) => {
        const ing = recipe.ingredients.find(i => i.materialName.toLowerCase().includes(name.toLowerCase()))
        return ing ? ing.quantity : '-'
    }

    const RecipeRow = ({ recipe, index, canManageRecipes }: { recipe: Recipe; index: number; canManageRecipes: boolean }) => (
        <tr className="hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors">
            <td className="py-4 px-4 text-sm text-gray-500 font-mono">{String(index + 1).padStart(2, '0')}</td>
            <td className="py-4 px-4">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-gray-900">{recipe.productCode}</span>
                    <span className="text-xs text-gray-500">{recipe.name}</span>
                </div>
            </td>
            <td className="py-4 px-4 text-sm text-gray-600 text-right font-medium">{getQty(recipe, '20mm')}</td>
            <td className="py-4 px-4 text-sm text-gray-600 text-right font-medium">{getQty(recipe, '10mm')}</td>
            <td className="py-4 px-4 text-sm text-gray-600 text-right font-medium">{getQty(recipe, 'Stone')}</td>
            <td className="py-4 px-4 text-sm text-gray-600 text-right font-medium">{getQty(recipe, 'Cement')}</td>
            <td className="py-4 px-4 text-sm text-gray-600 text-right font-medium">{getQty(recipe, 'Water')}</td>
            <td className="py-4 px-4 text-sm text-gray-600 text-right font-medium">{getQty(recipe, 'Admixture')}</td>
            <td className="py-4 px-4 text-right">
                <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                    {recipe.totalWeight.toFixed(2)} kg
                </span>
            </td>
            <td className="py-4 px-4 text-right">
                {canManageRecipes && (
                    <button
                        onClick={async () => {
                            if (confirm('Are you sure you want to delete this recipe?')) {
                                const res = await deleteRecipe(recipe.id)
                                if (!res.success) alert(res.message)
                            }
                        }}
                        className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Recipe"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </td>
        </tr>
    )

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Mix Design Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure standard recipes and material ratios per cubic meter.</p>
                </div>
                {canManageRecipes && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/25 font-medium"
                    >
                        <Plus className="w-5 h-5" />
                        Create New Recipe
                    </button>
                )}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                    <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100 text-left">
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">S/NO</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">20mm</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">10mm</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Stone</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Cement</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Water</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Admix</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Wt</th>
                            <th className="py-4 px-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {recipes.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-16 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="bg-gray-100 p-4 rounded-full">
                                            <Calculator className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="font-medium">No recipes defined yet</p>
                                        <p className="text-sm text-gray-400">Create your first mix design to get started</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            recipes.map((recipe, i) => (
                                <RecipeRow key={recipe.id} recipe={recipe} index={i} canManageRecipes={canManageRecipes} />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isAdding && (
                <AddRecipeModal
                    setIsAdding={setIsAdding}
                    router={router}
                    inventoryItems={inventoryItems}
                />
            )}
        </div>
    )
}
